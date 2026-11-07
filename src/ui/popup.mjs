/* SPDX-License-Identifier: MPL-2.0 */
import { send, time, node, busy, status, accountError } from './shared.mjs';
async function refresh(state) {
  state ||= await send('state');
  document.querySelector('#subscribed').textContent =
    state.nativeCalendarCount ?? state.resources.filter((r) => r.subscriptionId).length;
  document.querySelector('#available').textContent = state.resources.filter(
    (r) => !r.subscriptionId && !r.suppressed && r.availability === 'available',
  ).length;
  document.querySelector('#attention').textContent =
    state.accounts.filter((a) => a.error).length +
    state.resources.filter(
      (r) => ['unavailable', 'unconfirmed'].includes(r.availability) || r.registrationError,
    ).length;
  const list = document.querySelector('#accounts');
  list.replaceChildren(
    ...state.accounts.map((account) => {
      const row = node('li');
      row.append(
        node('strong', account.name),
        node(
          'div',
          account.error
            ? accountError(account.error)
            : `Last discovery: ${time(account.lastSuccess)}`,
          'muted',
        ),
      );
      return row;
    }),
  );
  if (!state.accounts.length) list.append(node('li', 'Connect a calendar account to get started.'));
  if (!state.firstRunComplete)
    status.textContent = 'Review your calendars and finish setup in Manage calendars.';
}
document.querySelector('#discover').addEventListener('click', (event) =>
  busy(event.target, async () => {
    status.textContent = 'Discovering calendars…';
    await refresh(await send('scan'));
    status.textContent = 'Discovery finished. Open Manage calendars to review results.';
  }),
);
document
  .querySelector('#manage')
  .addEventListener('click', () => browser.runtime.openOptionsPage());
refresh().catch((e) => {
  status.textContent = e.message;
});
