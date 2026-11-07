/* SPDX-License-Identifier: MPL-2.0 */
var { ExtensionCommon } = ChromeUtils.importESModule('resource://gre/modules/ExtensionCommon.sys.mjs');
Cu.importGlobalProperties(['URL']);
var { cal } = ChromeUtils.importESModule('resource:///modules/calendar/calUtils.sys.mjs');

this.calendarBridge = class extends ExtensionCommon.ExtensionAPI {
  onStartup() {
    this.pending = Promise.resolve();
    this.cancellations = new Set();
    this.resourceName = `calscout-${this.extension.uuid}`;
    this.resourceHandler = Services.io.getProtocolHandler('resource').QueryInterface(Ci.nsIResProtocolHandler);
    this.resourceHandler.setSubstitution(this.resourceName, this.extension.rootURI);
  }
  onShutdown() {
    if (this.resourceHandler) {
      for (const cancel of this.cancellations || []) cancel();
      for (const module of ['experiments/calendarBridge/transport.mjs', 'discovery/discover.mjs', 'discovery/xml.mjs', 'common/urls.mjs']) {
        ChromeUtils.unloadESModule(`resource://${this.resourceName}/${module}`);
      }
      this.resourceHandler.setSubstitution(this.resourceName, null);
    }
  }
  getAPI(context) {
    const owner = context.extension.id;
    const bridge = this;
    const serialize = c => ({
      id: c.id, type: c.type, name: c.name || '', url: c.uri.spec,
      username: c.getProperty('username') || '',
      managed: c.getProperty('calscout.owner') === owner,
      enabled: !c.getProperty('disabled'), readOnly: c.readOnly,
    });
    // Keep registration serialized, including across different extension pages.
    if (!this.resourceHandler) this.onStartup();
    let urls;
    const loadURLs = () => urls ||= ChromeUtils.importESModule(`resource://${this.resourceName}/common/urls.mjs`);
    return { calendarBridge: {
      onChanged: new ExtensionCommon.EventManager({
        context, name: 'calendarBridge.onChanged',
        register(fire) {
          const observer = {
            QueryInterface: ChromeUtils.generateQI(['calICalendarManagerObserver']),
            onCalendarRegistered() { fire.async(); },
            onCalendarUnregistering() { fire.async(); },
            onCalendarDeleting() {},
          };
          cal.manager.addObserver(observer);
          return () => cal.manager.removeObserver(observer);
        },
      }).api(),
      async candidates(email) {
        const domain = email.split('@')[1];
        if (!domain || !/^[a-z0-9.-]+$/i.test(domain)) return [];
        const { DNS } = ChromeUtils.importESModule('resource:///modules/DNS.sys.mjs');
        const candidates = [];
        try {
          const service = `_caldavs._tcp.${domain}`;
          const records = await DNS.srv(service);
          const txt = await DNS.txt(service).catch(() => []);
          const path = txt.flatMap(r => r.strings).find(s => s.startsWith('path='))?.slice(5) || '/.well-known/caldav';
          for (const record of records.sort((a,b) => a.prio-b.prio || b.weight-a.weight).slice(0,5)) {
            if (record.host === '.') continue;
            const url = `https://${record.host}:${record.port}${path.startsWith('/') ? path : '/'+path}`;
            try { loadURLs().calendarURL(url); candidates.push(url); } catch {}
          }
        } catch { /* DNS failure leaves the standards-based domain fallback. */ }
        candidates.push(`https://${domain}/.well-known/caldav`);
        return [...new Set(candidates)];
      },
      async list() { return cal.manager.getCalendars().map(serialize); },
      async scan(account, allowPrompt = false) {
        const { calendarURL } = loadURLs();
        calendarURL(account.url, account.allowLocalhost === true);
        if (!account.username.trim()) throw new Error('An authentication username is required');
        const source = account.sourceId ? cal.manager.getCalendarById(account.sourceId) : null;
        if (source && (source.type !== 'caldav' || source.getProperty('username') !== account.username ||
            new URL(source.uri.spec).origin !== new URL(account.url).origin)) {
          throw new Error('Invalid account authentication source');
        }
        const { discover } = ChromeUtils.importESModule(`resource://${bridge.resourceName}/discovery/discover.mjs`);
        const { makeTransport, parseXML } = ChromeUtils.importESModule(`resource://${bridge.resourceName}/experiments/calendarBridge/transport.mjs`);
        const transport = makeTransport(account, source, allowPrompt);
        bridge.cancellations.add(transport.cancel);
        try { return await discover(account, transport, parseXML); }
        catch (error) {
          // Return actionable categories without exposing URLs, tokens or server bodies.
          return { error: ['auth', 'http', 'limit', 'security', 'protocol'].includes(error.kind) ? error.kind : 'network',
            status: error.status || 0, resources: [], complete: false, warnings: [], requests: 0 };
        } finally { bridge.cancellations.delete(transport.cancel); }
      },
      register(details) {
        const operation = bridge.pending.then(() => {
          const { calendarURL, subscriptionKey } = loadURLs();
          const uri = calendarURL(details.url, details.allowLocalhost === true);
          if (!details.name.trim() || !details.username.trim()) {
            throw new Error('A calendar name and authentication username are required.');
          }
          let source;
          if (details.sourceId) {
            source = cal.manager.getCalendarById(details.sourceId);
            if (!source || source.type !== 'caldav' || source.getProperty('username') !== details.username ||
                new URL(source.uri.spec).origin !== new URL(uri).origin) {
              throw new Error('The source calendar must have the same origin and authentication username.');
            }
          }
          const key = subscriptionKey(uri, details.username, details.allowLocalhost === true);
          for (const c of cal.manager.getCalendars()) {
            if (c.type !== 'caldav') continue;
            try {
              if (subscriptionKey(c.uri.spec, c.getProperty('username') || '', details.allowLocalhost === true) === key) {
                return serialize(c);
              }
            } catch { /* An unrelated legacy URL cannot match this safe target. */ }
          }
          const calendar = cal.manager.createCalendar('caldav', Services.io.newURI(uri));
          if (!calendar) throw new Error('Thunderbird native CalDAV provider is unavailable.');
          calendar.setProperty('username', details.username);
          calendar.id = cal.getUUID();
          calendar.name = details.name.trim();
          calendar.setProperty('calscout.owner', owner);
          calendar.setProperty('cache.enabled', true);
          if (typeof details.readOnly === 'boolean') calendar.readOnly = details.readOnly;
          calendar.setProperty('calendar-main-in-composite', true);
          if (source) {
            const identity = source.getProperty('imip.identity.key');
            if (identity) calendar.setProperty('imip.identity.key', identity);
          }
          cal.manager.registerCalendar(calendar);
          return serialize(cal.manager.getCalendarById(calendar.id));
        });
        bridge.pending = operation.catch(() => {});
        return operation;
      },
      async setEnabled(id, enabled) {
        const calendar = cal.manager.getCalendarById(id);
        if (!calendar || calendar.getProperty('calscout.owner') !== owner) {
          throw new Error('Only CalScout-managed calendars may be enabled or disabled.');
        }
        calendar.setProperty('disabled', !enabled);
      },
    } };
  }
  // Native subscriptions intentionally survive extension disable/uninstall.
};
