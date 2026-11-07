/* SPDX-License-Identifier: MPL-2.0 */
export function calendarURL(value, allowLocalhost = false) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(allowLocalhost && local && url.protocol === 'http:')) {
    throw new Error('HTTPS is required (HTTP is permitted only for explicit localhost development).');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Calendar URLs must not contain credentials, queries or fragments.');
  }
  // Decode only unreserved octets; encoded slashes must retain their meaning.
  url.pathname = url.pathname.replace(/%[0-9a-f]{2}/gi, part => {
    const char = String.fromCharCode(parseInt(part.slice(1), 16));
    return /^[a-z0-9._~-]$/i.test(char) ? char : part.toUpperCase();
  });
  url.pathname = url.pathname.replace(/\/+$/, '') + '/';
  return url.href;
}
export function subscriptionKey(url, username, allowLocalhost = false) {
  return JSON.stringify([calendarURL(url, allowLocalhost), username]);
}
