/* SPDX-License-Identifier: MPL-2.0 */
import { send, time, node, button, resourceStatus, busy, status, accountError } from './shared.mjs';
let current;
const settingsForm = document.querySelector('#settings');
const connectForm = document.querySelector('#connect');
function renderPreferences(settings) {
  for (const [key, value] of Object.entries(settings)) {
    const input = settingsForm.elements.namedItem(key);
    if (input.type === 'checkbox') input.checked = value;
    else input.value = value;
  }
}

function calendarRow(resource, account) {
  const row = node('tr');
  const name = node('td');
  const permissions =
    typeof resource.readOnly !== 'boolean'
      ? 'Permissions not advertised'
      : resource.readOnly
        ? 'Read only'
        : 'Read / write';
  name.append(node('strong', resource.name), node('div', permissions, 'muted'));
  let owner = resource.owner || 'Not advertised';
  if (resource.owner) {
    try {
      const path = new URL(resource.owner, account.url).pathname;
      const segment = path.split('/').filter(Boolean).pop();
      owner = segment ? decodeURIComponent(segment) : resource.owner;
    } catch {
      /* Keep the server label as plain text if its URL is malformed. */
    }
  }
  const label = node('td');
  label.append(node('span', resourceStatus(resource), 'badge'));
  const actions = node('td');
  const group = node('div', '', 'actions');
  if (!resource.subscriptionId) {
    if (resource.availability === 'available')
      group.append(button('Subscribe', 'subscribe', resource.id));
    group.append(
      button(
        resource.suppressed ? 'Restore' : 'Ignore',
        resource.suppressed ? 'restore' : 'ignore',
        resource.id,
      ),
    );
  }
  actions.append(group);
  row.append(name, node('td', owner), label, actions);
  return row;
}

function calendarTable(account, resources) {
  const wrap = node('div', '', 'table-wrap');
  const table = node('table');
  const head = node('thead');
  const row = node('tr');
  for (const text of ['Calendar', 'Owner', 'Status', 'Actions']) {
    const th = node('th', text);
    th.scope = 'col';
    row.append(th);
  }
  head.append(row);
  const body = node('tbody');
  body.append(...resources.map((resource) => calendarRow(resource, account)));
  table.append(head, body);
  wrap.append(table);
  return wrap;
}

function accountSection(account, resources) {
  const section = node('section', '', 'account');
  const heading = node('div', '', 'account-heading');
  const title = node('div');
  title.append(
    node('h3', account.name),
    node('p', `${account.username} · ${new URL(account.url).host}`, 'muted'),
    node(
      'p',
      account.error ? accountError(account.error) : `Last discovery: ${time(account.lastSuccess)}`,
      'muted',
    ),
  );
  const actions = node('div', '', 'actions');
  actions.append(
    button(account.enabled ? 'Pause account' : 'Enable account', 'accountEnabled', account.id),
    button('Discover / sign in', 'accountScan', account.id),
  );
  heading.append(title, actions);
  section.append(heading);
  if (account.warnings?.length) section.append(node('p', account.warnings.join('. '), 'muted'));
  section.append(
    resources.length
      ? calendarTable(account, resources)
      : node(
          'p',
          'No calendars discovered. Use Discover / sign in to check this account.',
          'empty',
        ),
  );
  return section;
}

async function refresh(state) {
  state ||= await send('state');
  if (!current) renderPreferences(state.settings);
  current = state;
  document.querySelector('#onboarding').hidden = state.firstRunComplete;
  const container = document.querySelector('#accounts');
  container.replaceChildren(
    ...state.accounts.map((account) =>
      accountSection(
        account,
        state.resources.filter((resource) => resource.accountId === account.id),
      ),
    ),
  );
  if (!state.accounts.length)
    container.append(node('p', 'No calendar accounts connected yet.', 'empty'));
  document.querySelector('#logs').textContent =
    state.logs
      .slice(state.settings.debug ? -200 : -15)
      .map(
        (entry) =>
          `${time(entry.time)} · ${entry.event}${state.settings.debug && entry.detail ? ' · ' + JSON.stringify(entry.detail) : ''}`,
      )
      .join('\n') || 'No discovery operations recorded.';
}
document.querySelector('#accounts').addEventListener('click', (event) => {
  const target = event.target.closest('button[data-action]');
  if (!target) return;
  busy(target, async () => {
    const { action, id } = target.dataset;
    let state;
    if (action === 'accountEnabled')
      state = await send(action, {
        accountId: id,
        enabled: !current.accounts.find((a) => a.id === id).enabled,
      });
    else if (action === 'accountScan') {
      status.textContent = 'Discovering…';
      state = await send('scan', { accountId: id, allowPrompt: true });
    } else state = await send(action, { resourceId: id });
    await refresh(state);
    status.textContent = 'Calendar status updated.';
  });
});
document.querySelector('#discover').addEventListener('click', (event) =>
  busy(event.target, async () => {
    status.textContent = 'Discovering all enabled accounts…';
    await refresh(await send('scan'));
    status.textContent = 'Discovery finished. Account results are shown below.';
  }),
);
document.querySelector('#finish').addEventListener('click', (event) =>
  busy(event.target, async () => {
    await refresh(await send('finishSetup'));
    status.textContent = 'Initial review complete.';
  }),
);
settingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  busy(settingsForm.querySelector('button'), async () => {
    const data = new FormData(settingsForm);
    const state = await send('settings', {
      settings: {
        enabled: data.has('enabled'),
        interval: Number(data.get('interval')),
        policy: data.get('policy'),
        notifications: data.has('notifications'),
        disableMissing: data.has('disableMissing'),
        debug: data.has('debug'),
      },
    });
    renderPreferences(state.settings);
    await refresh(state);
    status.textContent = 'Preferences saved.';
  });
});
async function lookup(email) {
  // The bridge candidate resolver is privileged but returns URLs only. UI still
  // sends all persistent changes through the serialized background service.
  const candidates = await browser.calendarBridge.candidates(email);
  const select = document.querySelector('#candidates');
  select.replaceChildren();
  for (const url of candidates) {
    const option = node('option', url);
    option.value = url;
    select.append(option);
  }
  if (!candidates.length)
    status.textContent = 'Enter a full email address or use advanced server settings.';
}
document
  .querySelector('#lookup')
  .addEventListener('click', (event) =>
    busy(event.target, () => lookup(connectForm.elements.username.value)),
  );
document.querySelector('#suggest').addEventListener('click', (event) =>
  busy(event.target, async () => {
    const suggestions = await send('suggestions');
    const container = document.querySelector('#suggestions');
    container.replaceChildren();
    for (const suggestion of suggestions) {
      const pick = node('button', suggestion.email);
      pick.type = 'button';
      pick.addEventListener('click', () =>
        busy(pick, async () => {
          connectForm.elements.username.value = suggestion.email;
          await lookup(suggestion.email);
        }),
      );
      container.append(pick);
    }
    if (!suggestions.length)
      status.textContent = 'No mail identities found. Enter an email address below.';
  }),
);
connectForm.addEventListener('submit', (event) => {
  event.preventDefault();
  busy(connectForm.querySelector('button[type=submit]'), async () => {
    const data = new FormData(connectForm);
    const url = data.get('url') || document.querySelector('#candidates').value;
    if (!url) throw new Error('Find a calendar server first or provide its address.');
    const state = await send('addAccount', {
      account: {
        url,
        username: data.get('username'),
        name: data.get('name'),
        allowLocalhost: data.has('allowLocalhost'),
      },
    });
    const account = state.accounts.find(
      (a) =>
        a.username === data.get('username').trim() && new URL(a.url).origin === new URL(url).origin,
    );
    await refresh(state);
    status.textContent = 'Connecting through Thunderbird authentication…';
    await refresh(await send('scan', { accountId: account.id, allowPrompt: true }));
    status.textContent = 'Connection checked. Review the account status and available calendars.';
  });
});
document
  .querySelector('#refresh')
  .addEventListener('click', (event) => busy(event.target, () => refresh()));
document
  .querySelector('#clear')
  .addEventListener('click', (event) =>
    busy(event.target, async () => refresh(await send('clearLogs'))),
  );
refresh().catch((e) => {
  status.textContent = e.message;
});
