/* SPDX-License-Identifier: MPL-2.0 */
import { userMessage } from '../common/errors.mjs';
import { DiscoveryService } from './service.mjs';
const service = new DiscoveryService(browser);
const ready = service.start();
ready.catch(() => {
  browser.browserAction.setBadgeText({ text: '!' });
});
browser.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== browser.runtime.id || !sender.url?.startsWith(browser.runtime.getURL('ui/')))
    return undefined;
  return ready
    .then(async () => {
      if (message.action === 'suggestions') {
        const accounts = await browser.accounts.list();
        const emails = [
          ...new Set(
            accounts.flatMap((a) => (a.identities || []).map((i) => i.email)).filter(Boolean),
          ),
        ];
        return Promise.all(
          emails.map(async (email) => ({
            email,
            candidates: await browser.calendarBridge.candidates(email),
          })),
        );
      }
      return service.action(message);
    })
    .then(
      (state) => ({ ok: true, state }),
      (error) => ({ ok: false, error: userMessage(error) }),
    );
});
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'calscout-tick') ready.then(() => service.scan()).catch(() => {});
});
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') browser.runtime.openOptionsPage();
});
browser.notifications.onClicked.addListener(() => browser.runtime.openOptionsPage());
browser.calendarBridge.onChanged.addListener(() => {
  ready
    .then(() =>
      service.serialize(async () => {
        await service.refreshNative();
        await service.save();
      }),
    )
    .catch(() => {});
});
for (const event of [
  browser.accounts.onCreated,
  browser.accounts.onUpdated,
  browser.accounts.onDeleted,
]) {
  event?.addListener(() => ready.then(() => service.scan({ force: true })).catch(() => {}));
}
// The first alarm gives calendar/account services time to initialize. Native
// registry changes are observed; configured mail-account changes can be imported
// through the setup screen without reading mail credentials.
