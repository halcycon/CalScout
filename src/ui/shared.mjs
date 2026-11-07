/* SPDX-License-Identifier: MPL-2.0 */
export const status = document.querySelector('#status');
export async function send(action, fields = {}) {
  const result = await browser.runtime.sendMessage({ action, ...fields });
  if (!result?.ok) throw new Error(result?.error || 'CalScout background service is unavailable.');
  return result.state;
}
export const time = (value) => (value ? new Date(value).toLocaleString() : 'Not checked yet');
export const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
};
export const button = (text, action, id) => {
  const element = node('button', text);
  element.type = 'button';
  element.dataset.action = action;
  element.dataset.id = id;
  return element;
};
export function resourceStatus(r) {
  if (r.registrationError) return 'Subscription failed';
  if (r.availability === 'unavailable') return 'Inaccessible';
  if (r.availability === 'unconfirmed') return 'Not seen on last scan';
  if (r.subscriptionId) return 'Subscribed';
  if (r.suppressed) return 'Ignored';
  return 'Available';
}
export const accountError = (error) =>
  ({
    auth: 'Authentication required',
    network: 'Server unreachable or malformed response',
    http: 'Discovery error',
    compatibility: 'Thunderbird API compatibility error',
    security: 'Unsafe server response blocked',
    protocol: 'Invalid DAV response',
    limit: 'Server discovery limit exceeded',
  })[error] || 'Discovery error';
export async function busy(button, work) {
  button.disabled = true;
  try {
    await work();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}
