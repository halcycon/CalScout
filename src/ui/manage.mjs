/* SPDX-License-Identifier: MPL-2.0 */
import { send, time, node, button, resourceStatus, busy, status, accountError } from './shared.mjs';
let current;
const settingsForm = document.querySelector('#settings');
const connectForm = document.querySelector('#connect');
async function refresh(state) {
  state ||= await send('state');
  current = state;
  document.querySelector('#onboarding').hidden = state.firstRunComplete;
  for (const [key,value] of Object.entries(state.settings)) {
    const input = settingsForm.elements.namedItem(key);
    if (input.type === 'checkbox') input.checked = value;
    else input.value = value;
  }
  const container = document.querySelector('#accounts');
  container.replaceChildren();
  if (!state.accounts.length) container.append(node('p', 'No calendar accounts connected yet.', 'empty'));
  for (const account of state.accounts) {
    const section = node('section', '', 'account');
    const heading = node('div', '', 'account-heading');
    const title = node('div');
    title.append(node('h3', account.name), node('p', `${account.username} · ${new URL(account.url).host}`, 'muted'),
      node('p', account.error ? accountError(account.error) : `Last discovery: ${time(account.lastSuccess)}`, 'muted'));
    const actions = node('div', '', 'actions');
    actions.append(button(account.enabled ? 'Pause account' : 'Enable account', 'accountEnabled', account.id), button('Discover / sign in', 'accountScan', account.id));
    heading.append(title, actions);
    section.append(heading);
    if (account.warnings?.length) section.append(node('p', account.warnings.join('. '), 'muted'));
    const resources = state.resources.filter(r => r.accountId === account.id);
    if (resources.length) {
      const wrap = node('div', '', 'table-wrap');
      const table = node('table');
      const head = node('thead');
      const row = node('tr');
      ['Calendar','Owner','Status','Actions'].forEach(text => { const th = node('th',text); th.scope='col'; row.append(th); });
      head.append(row);
      table.append(head);
      const body = node('tbody');
      for (const r of resources) {
        const row = node('tr');
        const name = node('td');
        name.append(node('strong', r.name), node('div', r.readOnly === true ? 'Read only' : r.readOnly === false ? 'Read / write' : 'Permissions not advertised', 'muted'));
        let owner = 'Not advertised';
        if (r.owner) { try { owner = decodeURIComponent(new URL(r.owner, account.url).pathname.split('/').filter(Boolean).pop()) || r.owner; } catch { owner = r.owner; } }
        const label = node('td'); label.append(node('span', resourceStatus(r), 'badge'));
        const actions = node('td');
        const group = node('div', '', 'actions');
        if (!r.subscriptionId && r.availability === 'available') group.append(button('Subscribe', 'subscribe', r.id));
        if (!r.subscriptionId) group.append(button(r.suppressed ? 'Restore' : 'Ignore', r.suppressed ? 'restore' : 'ignore', r.id));
        actions.append(group);
        row.append(name, node('td', owner), label, actions);
        body.append(row);
      }
      table.append(body); wrap.append(table); section.append(wrap);
    } else section.append(node('p', 'No calendars discovered. Use Discover / sign in to check this account.', 'empty'));
    container.append(section);
  }
  document.querySelector('#logs').textContent = state.logs.slice(state.settings.debug ? -200 : -15).map(l =>
    `${time(l.time)} · ${l.event}${state.settings.debug && l.detail ? ' · ' + JSON.stringify(l.detail) : ''}`).join('\n') || 'No discovery operations recorded.';
}
document.querySelector('#accounts').addEventListener('click', event => {
  const target = event.target.closest('button[data-action]');
  if (!target) return;
  busy(target, async () => {
    const {action,id} = target.dataset;
    let state;
    if (action === 'accountEnabled') state = await send(action, { accountId:id, enabled:!current.accounts.find(a => a.id === id).enabled });
    else if (action === 'accountScan') { status.textContent='Discovering…'; state=await send('scan',{accountId:id,allowPrompt:true}); }
    else state = await send(action,{resourceId:id});
    await refresh(state);
    status.textContent = 'Calendar status updated.';
  });
});
document.querySelector('#discover').addEventListener('click', event => busy(event.target, async () => {
  status.textContent='Discovering all enabled accounts…';
  await refresh(await send('scan'));
  status.textContent='Discovery finished. Account results are shown below.';
}));
document.querySelector('#finish').addEventListener('click', event => busy(event.target, async () => { await refresh(await send('finishSetup')); status.textContent='Initial review complete.'; }));
settingsForm.addEventListener('submit', event => {
  event.preventDefault();
  busy(settingsForm.querySelector('button'), async () => {
    const data = new FormData(settingsForm);
    await refresh(await send('settings',{ settings:{ enabled:data.has('enabled'), interval:Number(data.get('interval')), policy:data.get('policy'), notifications:data.has('notifications'), disableMissing:data.has('disableMissing'), debug:data.has('debug') } }));
    status.textContent='Preferences saved.';
  });
});
async function lookup(email) {
  // The bridge candidate resolver is privileged but returns URLs only. UI still
  // sends all persistent changes through the serialized background service.
  const candidates = await browser.calendarBridge.candidates(email);
  const select = document.querySelector('#candidates'); select.replaceChildren();
  for (const url of candidates) { const option=node('option',url); option.value=url; select.append(option); }
  if (!candidates.length) status.textContent='Enter a full email address or use advanced server settings.';
}
document.querySelector('#lookup').addEventListener('click',event=>busy(event.target,()=>lookup(connectForm.elements.username.value)));
document.querySelector('#suggest').addEventListener('click',event=>busy(event.target,async()=>{
  const suggestions=await send('suggestions'); const container=document.querySelector('#suggestions'); container.replaceChildren();
  for (const suggestion of suggestions) {
    const pick=node('button',suggestion.email); pick.type='button';
    pick.addEventListener('click',()=>busy(pick,async()=>{connectForm.elements.username.value=suggestion.email;await lookup(suggestion.email);}));
    container.append(pick);
  }
  if (!suggestions.length) status.textContent='No mail identities found. Enter an email address below.';
}));
connectForm.addEventListener('submit',event=>{
  event.preventDefault(); busy(connectForm.querySelector('button[type=submit]'),async()=>{
    const data=new FormData(connectForm);
    const url=data.get('url') || document.querySelector('#candidates').value;
    if (!url) throw new Error('Find a calendar server first or provide its address.');
    const before=new Set(current.accounts.map(a=>a.id));
    const state=await send('addAccount',{account:{url,username:data.get('username'),name:data.get('name'),allowLocalhost:data.has('allowLocalhost')}});
    const account=state.accounts.find(a=>!before.has(a.id)) || state.accounts.find(a=>a.username===data.get('username').trim() && new URL(a.url).origin===new URL(url).origin);
    await refresh(state); status.textContent='Connecting through Thunderbird authentication…';
    await refresh(await send('scan',{accountId:account.id,allowPrompt:true}));
    status.textContent='Connection checked. Review the account status and available calendars.';
  });
});
document.querySelector('#refresh').addEventListener('click',event=>busy(event.target,()=>refresh()));
document.querySelector('#clear').addEventListener('click',event=>busy(event.target,async()=>refresh(await send('clearLogs'))));
refresh().catch(e=>{status.textContent=e.message;});
