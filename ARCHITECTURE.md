# CalScout architecture

## Feasibility assessment (2026-11-07)

**Feasible, demonstrated on Thunderbird 153.6 ESR, 156.0 and 159.0.** A MailExtension Experiment can
create and register a native `caldav` calendar through `cal.manager`. Thunderbird
then performs authenticated event synchronization and continues doing so after
the extension is disabled. The reproducible Radicale smoke test passes.

The initial integration uses a deliberately small, original privileged bridge.
The upstream calendar Experiment supports `calendar.calendars.query/create`, but
its create schema does not expose the native authentication username or identity
association needed here. Vendoring the entire calendar Experiment (including
provider and event APIs) would add unnecessary surface area.

Manifest V2 is selected: it supports persistent background modules and Experiments
in the actual target, and modern TbSync 5.3.8 uses it. This is a target-specific
decision, not an assertion that Thunderbird lacks Manifest V3 support.

## Native boundary

`src/experiments/calendarBridge/` lists native calendars, creates only `caldav`
subscriptions, sets their native `username`, optionally copies the mail identity
from a validated same-origin, same-user source, and enables/disables only owned
subscriptions. No calendar registry preferences, event databases or event CRUD
are exposed. Disabling/uninstalling the extension preserves subscriptions.

`CalDavCalendar` creates `CalDavSession(username)` during initialization. Its
requests use the calendar's interface and Thunderbird's per-username containers;
Thunderbird handles password manager access, prompts, OAuth and certificates.
CalScout does not read or store passwords. The test alone inserts an ephemeral
fixture password in the disposable profile's native login manager.

## Discovery decision

Thunderbird 156 includes `CalDavProvider.detectCalendars` (DNS SRV/TXT, well-known,
principal, home sets). It is callable internally, but cannot be used unchanged as
the complete rediscovery engine:

* `detectCollection` follows only the first home set if that property is present.
* `PropfindResponse.data` merges properties across successful and failed propstats.
* Detection sessions accept a password argument and use a fresh authentication
  container. Rediscovery needs the existing calendar's native context instead.
* Shared collections are enumerable only when the authenticated server advertises
  them. ACL permission alone does not imply a traversable discovery path.

Next: use native request/session plumbing with an independently tested,
namespace-aware metadata parser and traversal of every advertised home set.
Discovery must issue only metadata PROPFIND requests, never event REPORTs.

## References inspected

* [Thunderbird calendar manager documentation](https://source-docs.thunderbird.net/en/latest/calendar/calendars.html).
* Thunderbird 156.0 shipped `omni.ja`: `CalCalendarManager.sys.mjs`,
  `CalDavCalendar.sys.mjs`, `CalDavProvider.sys.mjs`, `caldav/CalDavRequest.sys.mjs`,
  `caldav/CalDavSession.sys.mjs`, `calendar/utils/calAuthUtils.sys.mjs` and
  `calProviderUtils.sys.mjs`. Inspect the target binary, not only comm-central.
* [TbSync](https://github.com/jobisoft/TbSync/tree/0e7278ae6aeafc3bb8161417268f6aed18647ac3),
  modern manifest and vendored calendar Experiment: native manager APIs, persistent
  background, separate storage and provider architecture. CalScout needs no provider.
* [Calendar Experiment](https://github.com/thunderbird/webext-experiments/tree/b7f7cb3e76807903a785a03784d6e7df7b213f21/calendar),
  especially parent calendar APIs and schema. Draft, not a guaranteed stable API.
* [DAV-4-TbSync v4.7](https://github.com/jobisoft/DAV-4-TbSync/tree/a22b298c70f6acba2d2c7d692ea80c5e11498989),
  legacy network/sync discovery. Current HEAD contains only its sunset extension;
  historical source must be inspected. MPL-2.0, but no implementation copied.
* [DAVx5](https://github.com/bitfireAT/davx5-ose/tree/e002a1e34b5fa718b3555ec5c6997d2aa4ecc97c),
  `DavResourceFinder` / `HomeSetRefresher`: enumerate multiple home sets, separate
  collection availability from subscription state. GPL concepts only; no code copied.
* [Stalwart WebDAV](https://stalw.art/docs/collaboration/webdav/): assisted
  discovery is server-dependent and requires real group ACL integration tests.

## Implemented discovery and orchestration

The namespace-aware parser accepts successful 2xx propstats only, rejects DTDs,
entities, malformed XML and responses over 2 MiB, and parses metadata without
fetching events. Traversal follows every advertised home set and group principal,
with cycle detection and a 64-request bound. Redirects and hrefs must remain on
the configured origin. A discovered authenticated principal becomes the next
scan's starting point, so a single revoked source collection cannot block all
future rediscovery. Cross-origin discovery needs a separately configured origin.

The transport uses native `CalDavGenericRequest`, `CalDavSession` and
`cal.auth.Prompt`. A small session adapter uses native OAuth2Module.connect's UI
flag, since native getAccessToken always allows UI. Background scans deny prompts;
explicit per-account sign-in permits one native password prompt. Failed credentials
are not retried in a loop. No password or token crosses the privileged API boundary.

`DiscoveryService` serializes state changes; concurrent scans join the same promise.
A one-minute alarm checks persisted per-account deadlines (30-minute discovery by
default), with exponential backoff capped at 120 minutes plus jitter. Auth failures
block unattended retries until a manual scan. Startup schedules its first tick
once account/calendar services have had time to initialize. Calendar registry and
mail account changes are observed. Manual-only mode creates no repeating alarm.

Storage version 1 persists account settings, resource IDs, aliases, subscription
IDs, suppression decisions, timestamps, failures and a bounded structured local
log. Unknown storage versions fail without resetting data. Account boundaries use
origin plus native authentication username. Native IDs removed by the user become
suppressed. Stable DAV resource IDs and URL aliases reconcile moved resources.

Only complete successful scans count absence. One absence is unconfirmed; two
mark unavailable; no native subscriptions are deleted. Optional disabling after
three absent scans is restricted to owned calendars and preserves local data.
Network, auth, XML and partial-listing failures do not count as absence.

## Setup and UI

Existing HTTPS native CalDAV accounts are imported. Without one, setup can read
mail identity addresses (accountsRead) and offer CalDAV SRV/TXT candidates, then
an HTTPS domain well-known endpoint. The mail hostname is never assumed to be
the CalDAV hostname. Users can supply an endpoint as a fallback. Account setup
explicitly invokes native authentication. Mozilla autoconfiguration metadata is
investigated but not implemented; no password is taken from a mail account.

A first-run review gate blocks automatic subscription, even if the policy is set
to auto, until explicitly completed. Options provide resource actions, account
inclusion, interval/policy preferences, suppression restoration and diagnostics.
All server-supplied labels use textContent. The UI has no remote scripts, fonts or
assets. Native subscription sync is independent of every background/UI module.

## Validation milestone

Thunderbird 153.6 ESR, 156.0 and 159.0 + Stalwart 1.0.3 pass both assisted-discovery modes with actual
Alice-authenticated PROPFIND responses confirming Bob → Team → Alice read access.
The live test also removes/re-adds Alice's membership after setup, adds a later
share, fires the real extension alarm, observes automatic native subscriptions,
reads Bob's event through Thunderbird's read-only CalDAV provider, and revokes
access without removing the native subscription. Recordings are in tests/fixtures.
Radicale independently verifies normal unsigned XPI installation, full application
restart persistence and continued native synchronization with CalScout disabled.
See TESTING.md for remaining platform, TLS and OAuth-provider acceptance limits.
