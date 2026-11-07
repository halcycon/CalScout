import test from 'node:test';
import assert from 'node:assert/strict';
import { DiscoveryService } from '../../src/background/service.mjs';
import { freshState, validateAccount } from '../../src/storage/state.mjs';
const resource = (name, path = name) => ({
  name,
  url: `https://dav.example/home/${path}/`,
  aliases: [],
  resourceId: `urn:uuid:${path}`,
  owner: null,
  readOnly: false,
});
async function setup() {
  let stored = freshState();
  stored.accounts.push(validateAccount({ url: 'https://dav.example/', username: 'alice' }));
  const account = stored.accounts[0];
  const natives = [];
  const calls = [];
  let resources = [resource('Alice')];
  let failure;
  let clock = 1000000;
  const browser = {
    storage: {
      local: {
        get: async () => ({ state: structuredClone(stored) }),
        set: async (data) => {
          stored = structuredClone(data.state);
        },
      },
    },
    alarms: { clear: async () => {}, create() {} },
    runtime: { getURL: (path) => path },
    notifications: { create: async () => {} },
    calendarBridge: {
      list: async () => structuredClone(natives),
      scan: async (account, prompt) => {
        calls.push({ account, prompt });
        return failure
          ? { error: failure }
          : { resources: structuredClone(resources), complete: true, warnings: [] };
      },
      register: async (details) => {
        const c = { id: crypto.randomUUID(), ...details, type: 'caldav', managed: true };
        natives.push(c);
        return c;
      },
      setEnabled: async () => {},
    },
  };
  const service = new DiscoveryService(browser, () => clock);
  await service.start();
  return {
    service,
    natives,
    calls,
    account,
    browser,
    getStored: () => stored,
    setResources: (r) => {
      resources = r;
    },
    fail: (e) => {
      failure = e;
    },
    advance: (n) => {
      clock += n;
    },
  };
}
test('first-run approval gates automatic subscriptions; later shares subscribe on a background scan', async () => {
  const s = await setup();
  await s.service.action({ action: 'settings', settings: { policy: 'auto' } });
  await s.service.scan({ manual: true });
  assert.equal(s.natives.length, 0);
  await s.service.action({ action: 'finishSetup' });
  await s.service.scan({ manual: true });
  assert.equal(s.natives.length, 1);
  s.setResources([resource('Alice'), resource('Bob via Team')]);
  s.advance(31 * 60000);
  await s.service.scan();
  assert.equal(s.natives.length, 2);
  assert.equal(s.calls.at(-1).prompt, false);
});
test('native manual unsubscribe is persistent and is never automatically re-added', async () => {
  const s = await setup();
  await s.service.action({ action: 'settings', settings: { policy: 'auto' } });
  await s.service.action({ action: 'finishSetup' });
  await s.service.scan({ manual: true });
  s.natives.splice(0);
  await s.service.scan({ manual: true });
  assert.equal(s.natives.length, 0);
  assert.equal(s.getStored().resources[0].suppressed, true);
  const restarted = new DiscoveryService(s.browser);
  await restarted.start();
  await restarted.scan({ manual: true });
  assert.equal(s.natives.length, 0);
  await restarted.action({ action: 'restore', resourceId: s.getStored().resources[0].id });
  await restarted.scan({ manual: true });
  assert.equal(s.natives.length, 1);
});
test('offline and auth failures preserve subscriptions and suppress unattended auth retries', async () => {
  const s = await setup();
  await s.service.action({ action: 'settings', settings: { policy: 'auto' } });
  await s.service.action({ action: 'finishSetup' });
  await s.service.scan({ manual: true });
  const before = structuredClone(s.natives);
  s.fail('network');
  await s.service.scan({ manual: true });
  assert.deepEqual(s.natives, before);
  assert.equal(s.getStored().resources[0].missingScans, 0);
  s.fail('auth');
  await s.service.scan({ manual: true });
  s.advance(24 * 60 * 60000);
  const count = s.calls.length;
  await s.service.scan();
  assert.equal(s.calls.length, count);
});
test('resource disappearance is cautious and never deletes a native calendar', async () => {
  const s = await setup();
  await s.service.action({ action: 'settings', settings: { policy: 'auto' } });
  await s.service.action({ action: 'finishSetup' });
  await s.service.scan({ manual: true });
  s.setResources([]);
  await s.service.scan({ manual: true });
  assert.equal(s.getStored().resources[0].availability, 'unconfirmed');
  await s.service.scan({ manual: true });
  assert.equal(s.getStored().resources[0].availability, 'unavailable');
  assert.equal(s.natives.length, 1);
});
test('stable server resource id prevents duplicate registration when the collection URL changes', async () => {
  const s = await setup();
  await s.service.action({ action: 'settings', settings: { policy: 'auto' } });
  await s.service.action({ action: 'finishSetup' });
  await s.service.scan({ manual: true });
  s.setResources([{ ...resource('Alice'), url: 'https://dav.example/new-path/', aliases: [] }]);
  await s.service.scan({ manual: true });
  assert.equal(s.natives.length, 1);
  assert.equal(s.getStored().resources.length, 1);
});
test('same URL on different authenticated accounts is isolated', async () => {
  const s = await setup();
  await s.service.action({
    action: 'addAccount',
    account: { url: 'https://dav.example/', username: 'bob' },
  });
  await s.service.action({ action: 'settings', settings: { policy: 'auto' } });
  await s.service.action({ action: 'finishSetup' });
  await s.service.scan({ manual: true });
  assert.equal(s.natives.length, 2);
  assert.deepEqual(
    s.natives.map((n) => n.username),
    ['alice', 'bob'],
  );
});
test('overlapping discovery requests share a single scan', async () => {
  const s = await setup();
  await Promise.all([s.service.scan({ manual: true }), s.service.scan({ manual: true })]);
  assert.equal(s.calls.length, 1);
});
test('registration failures remain available for retry and do not create suppression', async () => {
  const s = await setup();
  const register = s.browser.calendarBridge.register;
  s.browser.calendarBridge.register = async () => {
    throw new Error('native API changed');
  };
  await s.service.action({ action: 'settings', settings: { policy: 'auto' } });
  await s.service.action({ action: 'finishSetup' });
  await s.service.scan({ manual: true });
  let record = s.getStored().resources[0];
  assert.equal(record.registrationError, true);
  assert.equal(record.suppressed, false);
  assert.equal(record.subscriptionId, null);
  s.browser.calendarBridge.register = register;
  await s.service.action({ action: 'subscribe', resourceId: record.id });
  assert.equal(s.natives.length, 1);
});
test('incomplete discovery does not count missing resources or disable subscriptions', async () => {
  const s = await setup();
  await s.service.action({
    action: 'settings',
    settings: { policy: 'auto', disableMissing: true },
  });
  await s.service.action({ action: 'finishSetup' });
  await s.service.scan({ manual: true });
  s.browser.calendarBridge.scan = async () => ({
    resources: [],
    complete: false,
    warnings: ['Partial home set'],
  });
  s.browser.calendarBridge.setEnabled = async () => {
    throw new Error('Must not disable');
  };
  for (let i = 0; i < 4; i++) await s.service.scan({ manual: true });
  assert.equal(s.getStored().resources[0].missingScans, 0);
  assert.equal(s.getStored().resources[0].availability, 'available');
});

test('distinct account sign-in requests queue without losing their authentication intent', async () => {
  const s = await setup();
  await s.service.action({
    action: 'addAccount',
    account: { url: 'https://dav.example/', username: 'bob' },
  });
  const bob = s.getStored().accounts.find((account) => account.username === 'bob');
  const calls = [];
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  s.browser.calendarBridge.scan = async (account, allowPrompt) => {
    calls.push({ username: account.username, allowPrompt });
    if (calls.length === 1) await blocked;
    return { resources: [], complete: true, warnings: [] };
  };
  const first = s.service.scan({ manual: true, accountId: s.account.id });
  const second = s.service.scan({ manual: true, accountId: bob.id, allowPrompt: true });
  release();
  await Promise.all([first, second]);
  assert.deepEqual(calls, [
    { username: 'alice', allowPrompt: false },
    { username: 'bob', allowPrompt: true },
  ]);
});

test('automatic subscription requires observation in the current scan, including partial scans', async () => {
  const s = await setup();
  await s.service.scan({ manual: true });
  await s.service.action({ action: 'finishSetup' });
  await s.service.action({ action: 'settings', settings: { policy: 'auto' } });
  const scan = s.browser.calendarBridge.scan;
  s.browser.calendarBridge.scan = async () => ({ resources: [], complete: false, warnings: [] });
  await s.service.scan({ manual: true });
  assert.equal(s.natives.length, 0);
  s.browser.calendarBridge.scan = scan;
  await s.service.scan({ manual: true });
  assert.equal(s.natives.length, 1);
});

test('manual registration failures reject the action while preserving a retryable record', async () => {
  const s = await setup();
  await s.service.scan({ manual: true });
  s.browser.calendarBridge.register = async () => {
    throw new Error('Sensitive native response');
  };
  const record = s.getStored().resources[0];
  await assert.rejects(
    s.service.action({ action: 'subscribe', resourceId: record.id }),
    /Calendar registration failed/,
  );
  const persisted = s.getStored().resources[0];
  assert.equal(persisted.registrationError, true);
  assert.equal(persisted.suppressed, false);
  assert.equal(persisted.subscriptionId, null);
});
