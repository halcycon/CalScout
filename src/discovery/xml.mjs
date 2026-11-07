/* SPDX-License-Identifier: MPL-2.0 */
export const DAV = 'DAV:';
export const CALDAV = 'urn:ietf:params:xml:ns:caldav';
const children = (node, ns, name) => Array.from(node.childNodes || [])
  .filter(c => c.nodeType === 1 && c.namespaceURI === ns && c.localName === name);
const child = (node, ns, name) => children(node, ns, name)[0];
const text = node => node?.textContent?.trim() || '';
const hrefs = node => children(node, DAV, 'href').map(text).filter(Boolean);
const code = node => Number(/^HTTP\/\S+\s+(\d{3})(?:\s|$)/.exec(text(node))?.[1] || 0);

/** Parse only successful properties; XML parsing is injected for browser/Node portability. */
export function parseMultiStatus(xml, parseXML) {
  if (typeof xml !== 'string' || xml.length > 2 * 1024 * 1024 || /<!\s*(DOCTYPE|ENTITY)\b/i.test(xml)) {
    throw new Error('Unsafe or oversized DAV XML response');
  }
  const doc = parseXML(xml);
  const root = doc.documentElement;
  if (!root || root.namespaceURI !== DAV || root.localName !== 'multistatus' ||
      doc.getElementsByTagNameNS('*', 'parsererror').length) {
    throw new Error('Malformed DAV Multi-Status response');
  }
  const responses = children(root, DAV, 'response');
  if (responses.length > 5000) throw new Error('Too many DAV resources');
  return responses.map(response => {
    const href = text(child(response, DAV, 'href'));
    if (!href) throw new Error('DAV resource has no href');
    const status = code(child(response, DAV, 'status')) || 200;
    const props = new Map();
    const failures = {};
    for (const block of children(response, DAV, 'propstat')) {
      const status = code(child(block, DAV, 'status'));
      const prop = child(block, DAV, 'prop');
      for (const node of Array.from(prop?.childNodes || []).filter(n => n.nodeType === 1)) {
        const key = `${node.namespaceURI}|${node.localName}`;
        if (status >= 200 && status < 300) props.set(key, node);
        else failures[key] = status;
      }
    }
    const p = (ns, name) => props.get(`${ns}|${name}`);
    const privilegesNode = p(DAV, 'current-user-privilege-set');
    const privileges = privilegesNode ? children(privilegesNode, DAV, 'privilege')
      .flatMap(n => Array.from(n.childNodes).filter(n => n.nodeType === 1 && n.namespaceURI === DAV).map(n => n.localName)) : null;
    const componentsNode = p(CALDAV, 'supported-calendar-component-set');
    return {
      href, status, failures,
      calendar: !!child(p(DAV, 'resourcetype') || {}, CALDAV, 'calendar'),
      collection: !!child(p(DAV, 'resourcetype') || {}, DAV, 'collection'),
      name: text(p(DAV, 'displayname')),
      principal: hrefs(p(DAV, 'current-user-principal') || {})[0] || null,
      homes: hrefs(p(CALDAV, 'calendar-home-set') || {}),
      groups: hrefs(p(DAV, 'group-membership') || {}),
      owner: hrefs(p(DAV, 'owner') || {})[0] || null,
      resourceId: hrefs(p(DAV, 'resource-id') || {})[0] || null,
      color: text(p('http://apple.com/ns/ical/', 'calendar-color')),
      privileges,
      readOnly: privileges === null ? null : !privileges.some(p => ['write', 'write-content', 'all'].includes(p)),
      components: componentsNode ? children(componentsNode, CALDAV, 'comp').map(n => n.getAttribute('name')) : null,
    };
  });
}

export const PROPFIND_BODY = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/">
<d:prop><d:current-user-principal/><c:calendar-home-set/><d:resourcetype/><d:displayname/>
<d:current-user-privilege-set/><c:supported-calendar-component-set/><d:owner/><d:resource-id/>
<d:group-membership/><a:calendar-color/></d:prop></d:propfind>`;
