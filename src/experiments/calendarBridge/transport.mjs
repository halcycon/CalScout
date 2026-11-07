/* SPDX-License-Identifier: MPL-2.0 */
import { cal } from 'resource:///modules/calendar/calUtils.sys.mjs';
import { CalDavGenericRequest } from 'resource:///modules/caldav/CalDavRequest.sys.mjs';
import { CalDavSession } from 'resource:///modules/caldav/CalDavSession.sys.mjs';
import { OAuth2Module } from 'resource:///modules/OAuth2Module.sys.mjs';
import { setTimeout, clearTimeout } from 'resource://gre/modules/Timer.sys.mjs';
import { PROPFIND_BODY } from '../../discovery/xml.mjs';
import { safeTarget, DiscoveryError } from '../../discovery/discover.mjs';

Cu.importGlobalProperties(['DOMParser']);
export const parseXML = xml => new DOMParser().parseFromString(xml, 'application/xml');

/** Preserve native credential lookup while permitting at most one user-initiated prompt. */
class DiscoveryPrompt extends cal.auth.Prompt {
  constructor(allowPrompt) { super(); this.allowPrompt = allowPrompt; this.prompted = false; }
  _promptAuthInternal(...args) {
    if (!this.allowPrompt || this.prompted) return false;
    this.prompted = true;
    return super._promptAuthInternal(...args);
  }
  asyncPromptAuth(channel, callback, context, level, info) {
    if (info.flags & info.PREVIOUS_FAILED) {
      Services.tm.dispatchToMainThread(() => callback.onAuthCancelled(context, true));
      return;
    }
    return super.asyncPromptAuth(channel, callback, context, level, info);
  }
  promptAuth(channel, level, info) {
    if (info.flags & info.PREVIOUS_FAILED) return false;
    return super.promptAuth(channel, level, info);
  }
}

class DiscoverySession extends CalDavSession {
  constructor(username, allowPrompt) {
    super(username);
    this.allowPrompt = allowPrompt;
    this.prompt = new DiscoveryPrompt(allowPrompt);
  }
  getInterface(iid) {
    if (iid.equals(Ci.nsIAuthPrompt2)) return this.prompt;
    return super.getInterface(iid);
  }
  async prepareRequest(channel) {
    // Same selection rule as native CalDavSession: a saved HTTPS DAV login wins
    // over OAuth (e.g. Fastmail app passwords). Never inspect an IMAP login.
    if (!('_oAuth' in this)) {
      const logins = await Services.logins.searchLoginsAsync({ origin: channel.URI.prePath });
      const hasDAVLogin = logins.some(login => login.username === this.username);
      const oauth = new OAuth2Module();
      this._oAuth = !hasDAVLogin && oauth.initFromHostname(channel.URI.host, this.username, 'caldav') ? oauth : null;
    }
    if (this._oAuth) {
      // Native getAccessToken always permits UI. connect explicitly controls UI
      // so alarm/startup scans cannot open authentication windows.
      const token = await new Promise((resolve, reject) => this._oAuth.connect(this.allowPrompt, {
        onSuccess: resolve,
        onFailure: () => reject(new DiscoveryError('auth', 'Native OAuth authentication required')),
      }));
      channel.setRequestHeader('Authorization', `Bearer ${token}`, false);
    }
  }
}

export function makeTransport(account, source, allowPrompt) {
  const session = new DiscoverySession(account.username, allowPrompt);
  let calendar = source?.wrappedJSObject;
  if (calendar?.mUncachedCalendar) calendar = calendar.mUncachedCalendar.wrappedJSObject;
  if (!calendar) {
    calendar = cal.manager.createCalendar('caldav', Services.io.newURI(account.url));
    calendar.setProperty('username', account.username);
    calendar.id = cal.getUUID();
  }
  const active = new Set();
  const requestMetadata = async (url, depth) => {
    safeTarget(url, account.url, account.allowLocalhost);
    const request = new CalDavGenericRequest(session, calendar, 'PROPFIND', Services.io.newURI(url),
      { Depth: String(depth) }, PROPFIND_BODY, 'application/xml; charset=utf-8');
    let redirects = 0;
    const originalRedirect = request.asyncOnChannelRedirect;
    request.asyncOnChannelRedirect = function(oldChannel, newChannel, flags, callback) {
      try {
        safeTarget(newChannel.URI.spec, account.url, account.allowLocalhost);
        if (++redirects > 5) throw new Error('Too many redirects');
      } catch {
        callback.onRedirectVerifyCallback(Cr.NS_ERROR_ABORT);
        return;
      }
      originalRedirect.call(this, oldChannel, newChannel, flags, callback);
    };
    active.add(request);
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        (request.response?.nsirequest || request.channel).cancel(Cr.NS_ERROR_NET_TIMEOUT);
        reject(new DiscoveryError('network', 'DAV metadata request timed out'));
      }, 30000);
    });
    try {
      const response = await Promise.race([request.commit(), timeout]);
      return { status: response.status, url: response.uri.spec, text: response.text };
    } finally {
      clearTimeout(timer);
      active.delete(request);
    }
  };
  requestMetadata.cancel = () => { for (const r of active) (r.response?.nsirequest || r.channel).cancel(Cr.NS_ERROR_ABORT); };
  return requestMetadata;
}
