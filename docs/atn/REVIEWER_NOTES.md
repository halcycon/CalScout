# Reviewer notes — CalScout 0.2.0

CalScout is a general-purpose CalDAV discovery/subscription manager. Any user of
an accessible standards-compliant CalDAV server can use it; a closed organization,
business contract or particular group membership is not required. Group membership
is one tested sharing scenario, not a condition for installing the extension.

## Why the Experiment is necessary

We inspected the shipped modules of Thunderbird 153.6.0 ESR, 156.0 and 159.0. They
contain native calendar-manager and DAV implementations but no built-in calendar
MailExtension schema exposing the required native subscription/authentication
operations. The separate upstream calendar Experiment's create method also lacks
the native authentication-username/identity association required here.

The original, scoped bridge in src/experiments/calendarBridge:

- Lists native calendars and registers only the existing `caldav` type using
  cal.manager.createCalendar/registerCalendar.
- Sets the native authentication username; optionally copies the mail identity
  from a validated same-origin, same-user source subscription.
- Enables/disables only subscriptions marked as owned by CalScout.
- Observes manager registrations/unregistrations and resolves CalDAV DNS service
  candidates. It exposes no event CRUD, custom provider, database or delete API.
- Uses native DAV request/session, prompt and OAuth components for authenticated
  metadata requests. All authenticated hrefs/redirects remain on one origin.

The bridge is exposed only to the extension. No content scripts, external message
connections or web-accessible resources are declared. The message dispatcher
accepts only this extension's own UI pages. No remote JavaScript is loaded.

The native detectCalendars routine is not used unchanged: on the inspected target
it can follow only the first home set on one path and merge failed propstats into
properties. Rediscovery must also reuse the account's native authentication
container and suppress unattended prompts. The protocol parser independently
checks namespaces, per-property status and response bounds. See ARCHITECTURE.md
and docs/SECURITY.md for the boundary and remaining limitations.

## Authentication and privacy

No password or bearer token is stored in extension storage/logs. The adapter uses
native DAV credential lookup and native OAuth. Native OAuth connect's UI flag is
controlled explicitly because getAccessToken permits UI. Saved DAV app-password
logins take precedence over OAuth as in the native session. There is no IMAP
password extraction. HTTPS certificate validation is not bypassed.

An explicit checkbox permits HTTP only on localhost/127.0.0.1/::1 for disposable
local fixtures. It does not enable plaintext connections to remote servers.

## Build and source

The XPI is readable authored JavaScript/HTML/CSS, not bundled/minified/transpiled.
No third-party runtime libraries are packaged. Source is public at
https://github.com/halcycon/CalScout. A source snapshot and build instructions are
included with this submission material for convenience.

Run `npm ci`, `npm run check`, `npm test`, `npm run build`. Node 22+ and Python 3.10+
are required. The archive root includes manifest.json, MPL license and notices.
Test dependencies and fixture servers do not ship in the XPI. SHA256SUMS is included.

## Reproducible review without production credentials

The complete functional acceptance harness creates its own temporary CalDAV
server, accounts, native login entries and Thunderbird profile, then deletes them.
It never needs the reviewer's everyday profile or production credentials.

For personal calendars, UI behavior, duplicates, unattended authentication failure,
unsubscribe suppression, disable and restart persistence, run:

    python3 -m venv /tmp/calscout-review
    /tmp/calscout-review/bin/pip install radicale==3.9.0
    npm ci
    npm run build
    THUNDERBIRD_BIN=/absolute/path/to/thunderbird \
      /tmp/calscout-review/bin/python tests/integration/thunderbird.py

The local Radicale fixture uses username `alice`, password `fixture-password`.
The harness seeds this credential in its disposable profile's native login manager.
It is a fixture credential only; there is no persistent public hosted test account.

For effective group ACLs, use Stalwart 1.0.3 and run the command in TESTING.md.
The harness starts an isolated network namespace before opening Stalwart recovery
services. It creates alice@example.test, bob@example.test and team@example.test;
fixture users have password `fixture-password`. Alice joins Team after initial
setup, and Bob grants Team read access through real WebDAV ACL requests. Both
assisted-discovery settings are tested. The actual authenticated responses and
regression recordings are in tests/fixtures.

If a persistent, remotely reachable test account is required instead of local
fixtures, request it privately from the developer. Do not use an everyday account
or publish credentials in a public issue. No hosted reviewer account is provisioned
by this submission package.

## Manual behavior to inspect

1. Open CalDAV Discovery → Manage calendars. Connect/discover an account using its
   native authentication prompt; existing secure native accounts are imported.
2. Review the discovered calendars and subscribe individually. Automatic policy
   must not add calendars until Finish initial review is selected.
3. Select automatic subscription, add/share another calendar on the server, and
   let the next scan run. Discover Now is also available. The harness accelerates
   only the alarm time; it does not replace the production discovery code.
4. Remove a subscription through Thunderbird's normal UI. It must remain ignored
   until explicitly restored/subscribed in CalScout.
5. Revoke a share or disconnect the server. Existing subscriptions must remain.
6. Disable CalScout and change a fixture event server-side. The native calendar
   must continue syncing. Restart persistence is also covered by the harness.

The screenshots in this packet are captured from actual Thunderbird 159 with
fixture-only accounts. They are illustrative UI material, not test credentials.
