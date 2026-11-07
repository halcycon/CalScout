import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import { parseMultiStatus } from '../../src/discovery/xml.mjs';
import { discover, safeTarget } from '../../src/discovery/discover.mjs';
const parseXML = xml => new DOMParser({ onError: level => { throw new Error(level); } }).parseFromString(xml, 'application/xml');
const multi = rows => `<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">${rows}</d:multistatus>`;
const row = (href, props, optional = '') => `<d:response><d:href>${href}</d:href><d:propstat><d:prop>${props}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>${optional}</d:response>`;
const calendar = name => `<d:resourcetype><d:collection/><c:calendar/></d:resourcetype><d:displayname>${name}</d:displayname>`;
const home = path => `<c:calendar-home-set><d:href>${path}</d:href></c:calendar-home-set>`;

test('namespace-aware property status parsing keeps successful optional properties', () => {
  const xml = multi(row('/a/', calendar('Alice &amp; Team'), '<d:propstat><d:prop><d:displayname>Wrong</d:displayname><d:owner/></d:prop><d:status>HTTP/1.1 404 Not Found</d:status></d:propstat>'));
  const [result] = parseMultiStatus(xml, parseXML);
  assert.equal(result.name, 'Alice & Team');
  assert.equal(result.calendar, true);
  assert.equal(result.owner, null);
  assert.equal(result.readOnly, null);
});
test('failed resourcetype cannot create a calendar and unrelated namespaces cannot impersonate it', () => {
  assert.equal(parseMultiStatus(multi('<d:response><d:href>/a/</d:href><d:propstat><d:prop>'+calendar('No')+'</d:prop><d:status>HTTP/1.1 403 Forbidden</d:status></d:propstat></d:response>'), parseXML)[0].calendar, false);
  assert.equal(parseMultiStatus(multi(row('/a/', '<d:resourcetype><e:calendar xmlns:e="evil"/></d:resourcetype>')), parseXML)[0].calendar, false);
});
test('read-only privileges, supported components, resource ids and owners are parsed', () => {
  const [result] = parseMultiStatus(multi(row('/a/', calendar('Team') + '<d:current-user-privilege-set><d:privilege><d:read/></d:privilege></d:current-user-privilege-set><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set><d:resource-id><d:href>urn:uuid:abc</d:href></d:resource-id><d:owner><d:href>/principals/team/</d:href></d:owner>')), parseXML);
  assert.equal(result.readOnly, true);
  assert.equal(result.resourceId, 'urn:uuid:abc');
  assert.deepEqual(result.components, ['VEVENT']);
});
test('DTD, entities, malformed, oversized XML and wrong namespace are rejected', () => {
  for (const xml of ['<!DOCTYPE x [<!ENTITY y SYSTEM "file:///etc/passwd">]><x/>', '<x/>', multi('<d:response>'), 'x'.repeat(2*1024*1024+1)]) {
    assert.throws(() => parseMultiStatus(xml, parseXML));
  }
});
test('every home set and advertised group principal is traversed without downloading events', async () => {
  const responses = {
    '0:/personal/': multi(row('/personal/', '<d:current-user-principal><d:href>/principals/alice/</d:href></d:current-user-principal>')),
    '0:/principals/alice/': multi(row('/principals/alice/', '<c:calendar-home-set><d:href>/homes/alice/</d:href><d:href>/homes/shared/</d:href></c:calendar-home-set><d:group-membership><d:href>/principals/team/</d:href></d:group-membership>')),
    '0:/principals/team/': multi(row('/principals/team/', home('/homes/team/'))),
    '1:/homes/alice/': multi(row('/homes/alice/personal/', calendar('Alice'))),
    '1:/homes/shared/': multi(row('/homes/bob/shared/', calendar('Bob via Team'))),
    '1:/homes/team/': multi(row('/homes/team/team/', calendar('Team'))),
  };
  const calls = [];
  const result = await discover({ url:'https://dav.example/personal/' }, async (url, depth) => {
    const key = `${depth}:${new URL(url).pathname}`;
    calls.push(key);
    assert.ok(responses[key], key);
    return {status:207, text:responses[key], url};
  }, parseXML);
  assert.deepEqual(result.resources.map(r => r.name).sort(), ['Alice', 'Bob via Team', 'Team']);
  assert.equal(result.complete, true);
  assert.equal(calls.length, 6);
});
test('cross-origin resources and redirects are rejected before following', async () => {
  assert.throws(() => safeTarget('https://evil.example/a', 'https://dav.example/'));
  await assert.rejects(discover({url:'https://dav.example/'}, async url => ({status:207,url,text:multi(row('/',home('https://evil.example/a')))}),parseXML));
});
test('auth and home errors fail the scan instead of implying removal', async () => {
  await assert.rejects(discover({url:'https://dav.example/'}, async()=>({status:401}),parseXML), {kind:'auth'});
  await assert.rejects(discover({url:'https://dav.example/'}, async()=>({status:503}),parseXML), {kind:'http'});
});

test('recorded Stalwart 1.0.3 responses expose effective group ACLs and all calendars in both modes', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const mode of ['assisted','multiple-homes']) {
    const principal = await readFile(new URL(`../fixtures/stalwart-1.0.3-${mode}-principal.xml`, import.meta.url), 'utf8');
    const homes = JSON.parse(await readFile(new URL(`../fixtures/stalwart-1.0.3-${mode}-homes.json`, import.meta.url), 'utf8'));
    const share = parseMultiStatus(await readFile(new URL(`../fixtures/stalwart-1.0.3-${mode}-group-share.xml`, import.meta.url), 'utf8'), parseXML)[0];
    assert.equal(share.calendar, true);
    assert.equal(share.readOnly, true);
    assert.equal(share.principal, '/dav/pal/alice%40example.test/');
    const result = await discover({url:'https://fixture.example/dav/pal/alice%40example.test/'}, async (url, depth) => {
      const path = new URL(url).pathname;
      const text = depth === 0 ? principal : homes.find(([home]) => home === path)?.[1];
      assert.ok(text, `Unexpected recorded request ${depth} ${path}`);
      return {status:207,url,text};
    }, parseXML);
    for (const expected of ['Alice','Team','BobShared','BobDirect']) assert.ok(result.resources.some(r => r.name === expected),`${mode}: ${expected}`);
    assert.equal(result.complete,true);
    if (mode === 'multiple-homes') assert.ok(homes.length >= 3);
  }
});
