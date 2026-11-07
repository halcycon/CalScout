/* SPDX-License-Identifier: MPL-2.0 */
var { ExtensionCommon } = ChromeUtils.importESModule('resource://gre/modules/ExtensionCommon.sys.mjs');
var { cal } = ChromeUtils.importESModule('resource:///modules/calendar/calUtils.sys.mjs');

this.calendarBridge = class extends ExtensionCommon.ExtensionAPI {
  onStartup() {
    this.pending = Promise.resolve();
    this.resourceName = `calscout-${this.extension.uuid}`;
    this.resourceHandler = Services.io.getProtocolHandler('resource').QueryInterface(Ci.nsIResProtocolHandler);
    this.resourceHandler.setSubstitution(this.resourceName, this.extension.rootURI);
  }
  onShutdown() {
    if (this.resourceHandler) {
      ChromeUtils.unloadESModule(`resource://${this.resourceName}/common/urls.mjs`);
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
      async list() { return cal.manager.getCalendars().map(serialize); },
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
          calendar.id = cal.getUUID();
          calendar.name = details.name.trim();
          calendar.setProperty('username', details.username);
          calendar.setProperty('calscout.owner', owner);
          calendar.setProperty('cache.enabled', true);
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
