/* SPDX-License-Identifier: MPL-2.0 */
const status = document.querySelector('#status');
async function refresh() {
  const calendars = await browser.calendarBridge.list();
  const list = document.querySelector('#calendars');
  list.replaceChildren(...calendars.map(calendar => {
    const row = document.createElement('li');
    row.textContent = `${calendar.name} · ${calendar.type} · ${calendar.username || 'no username'} · ${calendar.enabled ? 'enabled' : 'disabled'}${calendar.managed ? ' · managed by CalScout' : ''}`;
    return row;
  }));
  status.textContent = `${calendars.length} native calendars registered.`;
}
document.querySelector('#refresh').addEventListener('click', () => refresh().catch(e => { status.textContent = e.message; }));
document.querySelector('#register').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.target.querySelector('button');
  button.disabled = true;
  try {
    const form = new FormData(event.target);
    await browser.calendarBridge.register({
      name: form.get('name'), url: form.get('url'), username: form.get('username'),
      allowLocalhost: form.has('allowLocalhost'),
    });
    await refresh();
    status.textContent = 'Native subscription registered. Verify synchronisation in Thunderbird’s calendar view.';
  } catch (e) { status.textContent = e.message; }
  finally { button.disabled = false; }
});
refresh().catch(e => { status.textContent = e.message; });
