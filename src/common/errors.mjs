/* SPDX-License-Identifier: MPL-2.0 */
// Only deliberate application messages may cross the UI boundary. Native errors
// can contain server URLs or response data and must remain redacted.
export class UserError extends Error {}

export function userMessage(error) {
  return error instanceof UserError
    ? error.message
    : 'CalScout could not complete this operation. Check the account status and diagnostic log.';
}
