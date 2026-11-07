import test from 'node:test';
import assert from 'node:assert/strict';
import { DiscoveryService } from '../../src/background/service.mjs';
import { freshState, validateAccount } from '../../src/storage/state.mjs';
const resource = (name, path = name) => ({ name, url:`https://dav.example/home/${path}/`, aliases:[], resourceId:`urn:uuid:${path}`, owner:null, readOnly:false });
async function setup() {
  let stored = freshState();
  stored.accounts.push(validateAccount({url:'https://dav.example/',username:'alice'}));
  const account = stored.accounts[0];
  const natives = [];
  const calls = [];
  let resources = [resource('Alice')];
  let failure;
  let clock = 1000000;
  const browser = {
    storage:{local:{get:async()=>({state:structuredClone(stored)}),set:async data=>{stored=structuredClone(data.state);}}},
    alarms:{clear:async()=>{},create(){}},
    runtime:{getURL:path=>path},
    notifications:{create:async()=>{}},
    calendarBridge:{
      list:async()=>structuredClone(natives),
      scan:async(account,prompt)=>{ calls.push({account,prompt}); return failure ? {error:failure} : {resources:structuredClone(resources),complete:true,warnings:[]}; },
      register:async details=>{ const c={id:crypto.randomUUID(),...details,type:'caldav',managed:true}; natives.push(c); return c; },
      setEnabled:async()=>{},
    },
  };
  const service = new DiscoveryService(browser,()=>clock);
  await service.start();
  return {service,natives,calls,account,browser,getStored:()=>stored,setResources:r=>{resources=r;},fail:e=>{failure=e;},advance:n=>{clock+=n;}};
}
test('first-run approval gates automatic subscriptions; later shares subscribe on a background scan', async()=>{
  const s=await setup();
  await s.service.action({action:'settings',settings:{policy:'auto'}});
  await s.service.scan({manual:true});
  assert.equal(s.natives.length,0);
  await s.service.action({action:'finishSetup'});
  await s.service.scan({manual:true});
  assert.equal(s.natives.length,1);
  s.setResources([resource('Alice'),resource('Bob via Team')]);
  s.advance(31*60000);
  await s.service.scan();
  assert.equal(s.natives.length,2);
  assert.equal(s.calls.at(-1).prompt,false);
});
test('native manual unsubscribe is persistent and is never automatically re-added',async()=>{
  const s=await setup();
  await s.service.action({action:'settings',settings:{policy:'auto'}});
  await s.service.action({action:'finishSetup'});
  await s.service.scan({manual:true});
  s.natives.splice(0);
  await s.service.scan({manual:true});
  assert.equal(s.natives.length,0);
  assert.equal(s.getStored().resources[0].suppressed,true);
  const restarted = new DiscoveryService(s.browser);
  await restarted.start();
  await restarted.scan({manual:true});
  assert.equal(s.natives.length,0);
  await restarted.action({action:'restore',resourceId:s.getStored().resources[0].id});
  await restarted.scan({manual:true});
  assert.equal(s.natives.length,1);
});
test('offline and auth failures preserve subscriptions and suppress unattended auth retries',async()=>{
  const s=await setup();
  await s.service.action({action:'settings',settings:{policy:'auto'}});
  await s.service.action({action:'finishSetup'});
  await s.service.scan({manual:true});
  const before=structuredClone(s.natives);
  s.fail('network');
  await s.service.scan({manual:true});
  assert.deepEqual(s.natives,before);
  assert.equal(s.getStored().resources[0].missingScans,0);
  s.fail('auth');
  await s.service.scan({manual:true});
  s.advance(24*60*60000);
  const count=s.calls.length;
  await s.service.scan();
  assert.equal(s.calls.length,count);
});
test('resource disappearance is cautious and never deletes a native calendar',async()=>{
  const s=await setup();
  await s.service.action({action:'settings',settings:{policy:'auto'}});
  await s.service.action({action:'finishSetup'});
  await s.service.scan({manual:true});
  s.setResources([]);
  await s.service.scan({manual:true});
  assert.equal(s.getStored().resources[0].availability,'unconfirmed');
  await s.service.scan({manual:true});
  assert.equal(s.getStored().resources[0].availability,'unavailable');
  assert.equal(s.natives.length,1);
});
test('stable server resource id prevents duplicate registration when the collection URL changes',async()=>{
  const s=await setup();
  await s.service.action({action:'settings',settings:{policy:'auto'}});
  await s.service.action({action:'finishSetup'});
  await s.service.scan({manual:true});
  s.setResources([{...resource('Alice'),url:'https://dav.example/new-path/',aliases:[]}]);
  await s.service.scan({manual:true});
  assert.equal(s.natives.length,1);
  assert.equal(s.getStored().resources.length,1);
});
test('same URL on different authenticated accounts is isolated',async()=>{
  const s=await setup();
  await s.service.action({action:'addAccount',account:{url:'https://dav.example/',username:'bob'}});
  await s.service.action({action:'settings',settings:{policy:'auto'}});
  await s.service.action({action:'finishSetup'});
  await s.service.scan({manual:true});
  assert.equal(s.natives.length,2);
  assert.deepEqual(s.natives.map(n=>n.username),['alice','bob']);
});
test('overlapping discovery requests share a single scan',async()=>{
  const s=await setup();
  await Promise.all([s.service.scan({manual:true}),s.service.scan({manual:true})]);
  assert.equal(s.calls.length,1);
});
