/* SPDX-License-Identifier: MPL-2.0 */
import { calendarURL } from '../common/urls.mjs';
export const DEFAULTS = Object.freeze({ enabled: true, interval: 30, policy: 'ask', notifications: true, disableMissing: false, debug: false });
export const freshState = () => ({ version: 1, settings: { ...DEFAULTS }, firstRunComplete: false, accounts: [], resources: [], logs: [] });
export function validateSettings(input) {
  const result = { ...DEFAULTS, ...input };
  if (![0,15,30,60,120].includes(result.interval)) throw new Error('Unsupported discovery interval');
  if (!['ask','auto'].includes(result.policy)) throw new Error('Unknown subscription policy');
  for (const key of ['enabled','notifications','disableMissing','debug']) if (typeof result[key] !== 'boolean') throw new Error('Invalid setting');
  return Object.fromEntries(Object.keys(DEFAULTS).map(key => [key, result[key]]));
}
export function accountKey(account) { return JSON.stringify([new URL(account.url).origin, account.username]); }
export function validateAccount(input) {
  const url = new URL(input.url);
  calendarURL(url.href, input.allowLocalhost === true);
  if (!input.username?.trim()) throw new Error('An authentication username is required');
  return { id: input.id || crypto.randomUUID(), name: String(input.name || input.username).slice(0,200),
    url: url.href, username: input.username.trim(), enabled: true, allowLocalhost: input.allowLocalhost === true,
    ...(input.sourceId ? { sourceId: input.sourceId } : {}) };
}
export function log(state, event, accountId = null, detail = null) {
  // Deliberately structured: no arbitrary server text, URL queries, headers or tokens.
  state.logs.push({ time: Date.now(), event, accountId, detail });
  state.logs = state.logs.slice(-200);
}
const canonical = (url, account) => { try { return calendarURL(url, account.allowLocalhost); } catch { return ''; } };
const nativeFor = (account, resource, natives) => natives.find(c => c.type === 'caldav' && c.username === account.username &&
  new URL(c.url).origin === new URL(account.url).origin &&
  [resource.url, ...(resource.aliases || [])].includes(canonical(c.url, account)));

/** Reconcile successful discovery without deleting or mutating native calendars. */
export function reconcile(state, account, result, natives, now) {
  const found = new Set();
  const added = [];
  for (const resource of result.resources) {
    let record = state.resources.find(r => r.accountId === account.id &&
      ((resource.resourceId && r.resourceId === resource.resourceId) || r.url === resource.url ||
       (r.aliases || []).includes(resource.url) || (resource.aliases || []).includes(r.url)));
    if (!record) {
      record = { id: crypto.randomUUID(), accountId: account.id, suppressed: false, subscriptionId: null, firstSeen: now };
      state.resources.push(record);
      added.push(record.id);
    }
    const aliases = [...new Set([...(record.aliases || []), record.url, ...resource.aliases || [], resource.url].filter(Boolean))];
    Object.assign(record, { url: resource.url, aliases, resourceId: resource.resourceId, name: resource.name || new URL(resource.url).pathname,
      owner: resource.owner, readOnly: resource.readOnly, lastSeen: now, missingScans: 0, availability: 'available' });
    found.add(record.id);
  }
  for (const record of state.resources.filter(r => r.accountId === account.id)) {
    const native = nativeFor(account, record, natives);
    if (native) {
      record.subscriptionId = native.id;
      record.managed = native.managed;
      record.registrationError = false;
    } else if (record.subscriptionId) {
      // Persist deliberate native unsubscriptions even if the calendar later returns.
      record.subscriptionId = null;
      record.suppressed = true;
    }
    if (!found.has(record.id) && result.complete) {
      record.missingScans = (record.missingScans || 0) + 1;
      record.availability = record.missingScans >= 2 ? 'unavailable' : 'unconfirmed';
    }
  }
  return added;
}
export function reconcileSubscriptions(state, natives) {
  for (const account of state.accounts) {
    for (const r of state.resources.filter(r => r.accountId === account.id)) {
      const native = nativeFor(account, r, natives);
      if (native) { r.subscriptionId = native.id; r.managed = native.managed; }
      else if (r.subscriptionId) { r.subscriptionId = null; r.suppressed = true; }
    }
  }
}
export function retryDelay(failures, interval, random = Math.random) {
  return Math.min(120, Math.max(1, interval || 30) * 2 ** Math.min(failures - 1, 6)) * 60000 * (1 + random() * .2);
}
