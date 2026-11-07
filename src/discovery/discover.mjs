/* SPDX-License-Identifier: MPL-2.0 */
import { calendarURL } from '../common/urls.mjs';
import { parseMultiStatus } from './xml.mjs';

export class DiscoveryError extends Error {
  constructor(kind, message, status = 0) { super(message); this.kind = kind; this.status = status; }
}

/** Same-origin boundary applies both to advertised hrefs and HTTP redirects. */
export function safeTarget(value, base, allowLocalhost = false) {
  const url = new URL(value, base);
  calendarURL(url.href, allowLocalhost);
  if (url.origin !== new URL(base).origin) throw new DiscoveryError('security', 'Cross-origin DAV resource blocked');
  return url.href;
}

export async function discover({ url, allowLocalhost = false }, request, parseXML) {
  const origin = new URL(url).origin;
  safeTarget(url, url, allowLocalhost);
  const seen = new Set();
  const resources = new Map();
  const warnings = [];
  const queue = [{ url, depth: 0, required: true }];
  let homeCount = 0;
  let principalUrl = null;
  let complete = true;
  const enqueue = (href, base, depth, required) => {
    const target = safeTarget(href, base, allowLocalhost);
    if (!seen.has(`${depth}:${target}`)) queue.push({ url: target, depth, required });
  };
  while (queue.length) {
    const task = queue.shift();
    const key = `${task.depth}:${task.url}`;
    if (seen.has(key)) continue;
    if (seen.size >= 64) throw new DiscoveryError('limit', 'Discovery exceeded the 64-collection safety limit');
    seen.add(key);
    let response;
    try { response = await request(task.url, task.depth); }
    catch (error) { throw new DiscoveryError(error.kind || 'network', error.message); }
    if ([401, 403].includes(response.status)) {
      if (task.required) throw new DiscoveryError('auth', 'Authentication or calendar access required', response.status);
      complete = false;
      warnings.push('An advertised group principal was inaccessible');
      continue;
    }
    if (response.status !== 207) {
      if (task.required) throw new DiscoveryError('http', `DAV discovery returned HTTP ${response.status}`, response.status);
      complete = false;
      continue;
    }
    const base = safeTarget(response.url || task.url, url, allowLocalhost);
    let rows;
    try { rows = parseMultiStatus(response.text, parseXML); }
    catch { throw new DiscoveryError('protocol', 'Malformed DAV metadata response'); }
    if (!rows.length) throw new DiscoveryError('protocol', 'Empty DAV Multi-Status response');
    for (const row of rows) {
      const target = safeTarget(row.href, base, allowLocalhost);
      if (row.status < 200 || row.status >= 300) { complete = false; continue; }
      if (row.calendar && (!row.components || row.components.some(c => ['VEVENT', 'VTODO'].includes(c)))) {
        const normalized = calendarURL(target, allowLocalhost);
        const alias = calendarURL(task.url, allowLocalhost);
        const existing = resources.get(normalized);
        resources.set(normalized, { ...row, url: normalized,
          aliases: [...new Set([...(existing?.aliases || []), normalized,
            ...(task.depth === 0 && calendarURL(base, allowLocalhost) === normalized ? [alias] : [])])],
        });
      }
      // Only depth-0 target properties can introduce further principal traversal.
      // Depth-1 responses describe children, not the user's authentication identity.
      if (task.depth === 0) {
        if (row.principal) {
          principalUrl ||= safeTarget(row.principal, base, allowLocalhost);
          enqueue(row.principal, base, 0, true);
        }
        for (const home of row.homes) { enqueue(home, base, 1, true); homeCount++; }
        for (const group of row.groups) enqueue(group, base, 0, false);
      }
    }
  }
  if (!homeCount) {
    // A directly readable calendar alone does not establish a complete home listing.
    complete = false;
    warnings.push('No calendar home set was advertised; only directly reachable calendars were found');
  }
  return { resources: [...resources.values()], complete, warnings, requests: seen.size, origin, principalUrl };
}
