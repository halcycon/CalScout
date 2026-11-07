/* SPDX-License-Identifier: MPL-2.0 */
import { freshState, validateSettings, validateAccount, accountKey, reconcile, reconcileSubscriptions, retryDelay, log } from '../storage/state.mjs';

export class DiscoveryService {
  constructor(browser, now = Date.now) { this.browser = browser; this.now = now; this.queue = Promise.resolve(); this.running = null; }
  async start() {
    const { state } = await this.browser.storage.local.get('state');
    if (state && state.version !== 1) throw new Error('Unsupported CalScout state version; stored configuration was preserved');
    this.state = state || freshState();
    this.state.settings = validateSettings(this.state.settings);
    await this.refreshNative();
    await this.save();
    await this.configureAlarm();
  }
  save() { return this.browser.storage.local.set({ state: this.state }); }
  serialize(work) {
    const result = this.queue.then(work);
    this.queue = result.catch(() => {});
    return result;
  }
  async configureAlarm() {
    await this.browser.alarms.clear('calscout-tick');
    if (this.state.settings.enabled && this.state.settings.interval) {
      this.browser.alarms.create('calscout-tick', { delayInMinutes: 1, periodInMinutes: 1 });
    }
  }
  async refreshNative() {
    const natives = await this.browser.calendarBridge.list();
    for (const c of natives.filter(c => c.type === 'caldav' && c.username)) {
      let account;
      try { account = validateAccount({ name: c.username, username: c.username, url: c.url, sourceId: c.id }); }
      catch { continue; } // Unsafe legacy URLs require explicit setup.
      const existing = this.state.accounts.find(a => accountKey(a) === accountKey(account));
      if (!existing) this.state.accounts.push(account);
      else if (!natives.some(n => n.id === existing.sourceId)) existing.sourceId = c.id;
    }
    this.state.nativeCalendarCount = natives.filter(c => c.type === 'caldav').length;
    reconcileSubscriptions(this.state, natives);
    return natives;
  }
  scan({ manual = false, accountId = null, allowPrompt = false } = {}) {
    if (this.running) return this.running;
    const operation = this.serialize(async () => {
      await this.refreshNative();
      const now = this.now();
      let newCount = 0;
      for (const account of this.state.accounts) {
        if (!account.enabled || (accountId && account.id !== accountId)) continue;
        if (!manual && (!this.state.settings.enabled || !this.state.settings.interval || account.authBlocked || (account.nextAttempt || 0) > now)) continue;
        const details = { url: account.discoveryUrl || account.url, username: account.username, allowLocalhost: account.allowLocalhost,
          ...(account.sourceId ? { sourceId: account.sourceId } : {}) };
        account.lastAttempt = now;
        let result;
        try { result = await this.browser.calendarBridge.scan(details, manual && allowPrompt); }
        catch { result = { error: 'compatibility' }; }
        if (result.error) {
          account.error = result.error;
          account.authBlocked = result.error === 'auth';
          account.failures = (account.failures || 0) + 1;
          account.nextAttempt = now + retryDelay(account.failures, this.state.settings.interval);
          log(this.state, 'discovery-error', account.id, result.error);
          await this.save();
          continue;
        }
        account.error = null;
        account.authBlocked = false;
        account.failures = 0;
        account.lastSuccess = this.now();
        account.nextAttempt = this.now() + this.state.settings.interval * 60000;
        account.warnings = result.warnings;
        if (result.principalUrl) account.discoveryUrl = result.principalUrl;
        const natives = await this.browser.calendarBridge.list();
        const added = reconcile(this.state, account, result, natives, this.now());
        newCount += added.filter(id => !this.state.resources.find(r => r.id === id).subscriptionId).length;
        // Save availability and suppression decisions before performing registration.
        await this.save();
        if (this.state.firstRunComplete && this.state.settings.policy === 'auto') {
          for (const record of this.state.resources.filter(r => r.accountId === account.id &&
              r.availability === 'available' && !r.suppressed && !r.subscriptionId)) await this.subscribe(record);
        }
        if (this.state.settings.disableMissing) {
          for (const r of this.state.resources.filter(r => r.accountId === account.id && r.managed && r.subscriptionId && r.missingScans >= 3)) {
            try { await this.browser.calendarBridge.setEnabled(r.subscriptionId, false); r.disabledForMissing = true; }
            catch { log(this.state, 'disable-failed', account.id); }
          }
        }
        log(this.state, 'discovery-complete', account.id, { found: result.resources.length, complete: result.complete });
        await this.save();
      }
      if (newCount && this.state.settings.notifications) {
        await this.browser.notifications.create('calscout-new', { type: 'basic', iconUrl: this.browser.runtime.getURL('ui/icon.svg'),
          title: 'CalScout', message: `${newCount} new calendar${newCount === 1 ? '' : 's'} detected. Open CalDAV Discovery to review.` }).catch(() => {});
      }
      return this.state;
    });
    this.running = operation;
    operation.finally(() => { this.running = null; }).catch(() => {});
    return operation;
  }
  async subscribe(record) {
    const account = this.state.accounts.find(a => a.id === record.accountId);
    if (!account || record.availability !== 'available') throw new Error('Discover this calendar successfully before subscribing');
    try {
      const native = await this.browser.calendarBridge.register({ url: record.url, name: record.name, username: account.username,
        allowLocalhost: account.allowLocalhost, ...(account.sourceId ? { sourceId: account.sourceId } : {}),
        ...(typeof record.readOnly === 'boolean' ? { readOnly: record.readOnly } : {}) });
      record.subscriptionId = native.id;
      record.managed = native.managed;
      record.suppressed = false;
      record.registrationError = false;
      log(this.state, 'subscribed', account.id);
    } catch {
      record.registrationError = true;
      log(this.state, 'registration-failed', account.id);
    }
    await this.save();
  }
  action(message) {
    if (message.action === 'scan') return this.scan({ manual: true, accountId: message.accountId, allowPrompt: message.allowPrompt === true });
    return this.serialize(async () => {
      switch (message.action) {
        case 'state': await this.refreshNative(); await this.save(); break;
        case 'settings':
          this.state.settings = validateSettings({ ...this.state.settings, ...message.settings });
          for (const account of this.state.accounts) account.nextAttempt = 0;
          await this.configureAlarm();
          break;
        case 'finishSetup': this.state.firstRunComplete = true; break;
        case 'addAccount': {
          const account = validateAccount(message.account);
          const existing = this.state.accounts.find(a => accountKey(a) === accountKey(account));
          if (existing) {
            Object.assign(existing, {url:account.url,name:account.name,enabled:true,allowLocalhost:account.allowLocalhost,nextAttempt:0,authBlocked:false});
            delete existing.discoveryUrl;
          } else this.state.accounts.push(account);
          break;
        }
        case 'accountEnabled': {
          const account = this.state.accounts.find(a => a.id === message.accountId);
          if (!account) throw new Error('Unknown account');
          account.enabled = message.enabled === true;
          break;
        }
        case 'subscribe':
        case 'ignore':
        case 'restore': {
          const record = this.state.resources.find(r => r.id === message.resourceId);
          if (!record) throw new Error('Unknown calendar');
          if (message.action === 'subscribe') await this.subscribe(record);
          else record.suppressed = message.action === 'ignore';
          break;
        }
        case 'clearLogs': this.state.logs = []; break;
        default: throw new Error('Unknown CalScout action');
      }
      await this.save();
      return this.state;
    });
  }
}
