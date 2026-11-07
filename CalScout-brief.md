# Project Brief: Automatic CalDAV Calendar Discovery for Thunderbird

**Working title:** CalDAV Auto-Discovery  
**Target application:** Mozilla Thunderbird 156+  
**Initial target server:** Stalwart Mail Server  
**Long-term compatibility:** Any standards-compliant CalDAV server  
**Project type:** Open-source Thunderbird MailExtension

## 1. Project overview

Develop a Thunderbird extension that automatically discovers, subscribes to, and manages CalDAV calendars available to an authenticated user, including calendars that become available **after Thunderbird's initial account configuration**.

Thunderbird natively supports CalDAV but does not automatically rediscover newly shared calendars. A user who receives access to another user's calendar, joins a group with a shared calendar, or gains access through a group-level calendar share must currently perform manual discovery and subscription.

We want to eliminate this limitation.

The extension should function primarily as a **discovery and subscription manager**, delegating all calendar data synchronisation to Thunderbird's native CalDAV implementation.

It must not implement a competing calendar synchronisation engine.

## 2. Primary use case

Consider a Stalwart installation containing three accounts:

- `alice@example.com` — a normal user.
- `team@example.com` — a group account, of which Alice is a member.
- `bob@example.com` — another normal user.

The following calendars exist:

1. Alice's personal calendar.
2. The group calendar belonging to `team@example.com`.
3. Bob's personal calendar, which Bob has shared with `team@example.com`.

Alice already uses Thunderbird, and her email account is configured.

### Expected behaviour

Without Alice having to know any calendar URLs:

- The extension identifies her CalDAV server.
- It discovers calendars available to Alice using her credentials.
- It discovers the group calendar.
- It discovers Bob's calendar through Alice's membership of the group, assuming Stalwart's effective ACL permissions expose that resource.
- It offers to subscribe to these calendars, or adds them automatically according to the user's preferences.
- They appear in Thunderbird's normal calendar list.
- Thunderbird's built-in CalDAV provider manages all events and synchronisation.

If Bob subsequently shares another calendar with the group, the extension detects and adds it without requiring Alice to run the calendar setup wizard.

If Alice joins another group, that group's available calendars should similarly be discovered.

The scenario involving Bob sharing a calendar with Alice's group is a mandatory integration test. Do not assume that permission inheritance works as expected without verifying the authenticated WebDAV responses.

## 3. Architecture and implementation approach

### Fundamental requirement

**Reuse Thunderbird's native CalDAV provider.**

The extension is responsible for:

- Server discovery.
- Calendar collection discovery.
- Tracking calendar availability.
- Identifying newly available resources.
- Managing native Thunderbird calendar subscriptions.
- Handling access changes.
- Presenting configuration and notifications.

Thunderbird remains responsible for:

- Event synchronisation.
- Event creation and editing.
- Recurring events.
- Meeting invitations.
- Authentication and credential storage.
- Offline caching.
- Conflict resolution.
- Calendar reminders.

Avoid duplicating functionality already implemented by Thunderbird.

### Reference projects

Investigate these repositories before implementation.

**TbSync (modern implementation)**  
https://github.com/jobisoft/TbSync

The modern v5 implementation targets Thunderbird 153+ and uses experimental calendar APIs.

Investigate its architecture for interacting with Thunderbird's calendar system, account management, resource registration and persistent state.

**DAV-4-TbSync (legacy CalDAV provider)**  
https://github.com/jobisoft/DAV-4-TbSync

Although discontinued, this implementation may contain useful CalDAV discovery logic, authentication handling, resource enumeration and compatibility workarounds.

It is MPL-2.0 licensed (verify the applicable version and any reused files).

Reuse compatible portions where beneficial, with proper attribution, rather than automatically reimplementing everything.

**Thunderbird WebExtension Experiments**  
https://github.com/thunderbird/webext-experiments

Investigate the calendar Experiment API and whether it supports listing and creating native CalDAV calendar subscriptions.

**DAVx⁵**  
https://github.com/bitfireAT/davx5-ose

Examine its approach to CalDAV discovery, principal resolution, shared calendars, multiple home sets and ACL permissions.

DAVx⁵ is GPLv3-licensed and written for Android. Prefer adapting its architectural concepts and protocol handling rather than copying implementation code.

**Thunderbird calendar internals**  
https://source-docs.thunderbird.net/en/latest/calendar/calendars.html

Investigate `CalCalendarManager`, the built-in CalDAV provider and the existing calendar discovery implementation.

### Licensing

The project should ideally use MPL-2.0.

Confirm licensing compatibility before importing source files. Maintain copyright notices and attribution for any third-party code.

Do not incorporate GPLv3 code from DAVx⁵ into an MPL-2.0-only project without explicitly resolving the licensing consequences.

## 4. Thunderbird integration

Target Thunderbird 156 initially, but avoid unnecessarily depending on version-specific behaviour.

### Extension architecture

Use a modern MailExtension with:

- A background discovery service.
- A small calendar integration layer.
- An options interface.
- A toolbar action for manual discovery.
- Persistent configuration and discovery state.
- Event logging and diagnostics.

Investigate Manifest V2 versus V3 based on what Thunderbird 156 and the necessary Experiment APIs actually support. Document the choice.

### Calendar integration

First determine whether the calendar Experiment API already exposes the required operations.

If necessary, implement a minimal privileged Experiment API.

The bridge should expose operations equivalent to:

- List registered calendars and their properties.
- Read the server URL and identity associated with an existing calendar.
- Register a new native CalDAV calendar.
- Associate its authentication context correctly.
- Query whether a calendar is managed by the extension.
- Enable or disable an existing subscription safely.
- Observe relevant changes to registered calendars.

Use Thunderbird's established calendar-management interfaces rather than editing calendar-registry preferences directly.

Prefer an existing supported interface where available.

### Important

Creating a calendar subscription must instantiate Thunderbird's native `caldav` calendar type.

Do not register a custom sync provider.

The extension should not read, copy, overwrite or migrate existing calendar event databases.

A successfully subscribed calendar must remain usable through Thunderbird's native CalDAV functionality even if automatic discovery is subsequently disabled.

## 5. CalDAV discovery

Implement standards-compliant CalDAV resource discovery.

Investigate and use the relevant standards, including:

- RFC 4791 — CalDAV.
- RFC 6764 — Locating CalDAV and CardDAV services.
- RFC 3744 — WebDAV ACL.
- RFC 5397 — WebDAV Current Principal Extension.
- Relevant WebDAV properties and collection discovery mechanisms.

### Server discovery

The extension should first inspect existing Thunderbird CalDAV subscriptions to identify server locations.

Where there is no existing CalDAV subscription, investigate obtaining server settings from:

1. Thunderbird's already configured email accounts and available autoconfiguration metadata.
2. Mozilla autoconfiguration documents.
3. CalDAV DNS SRV discovery.
4. Standard `/.well-known/caldav` endpoints.
5. A manually provided server URL as a fallback.

Do not assume the mail server hostname is necessarily the CalDAV hostname.

Automatic reuse of account configuration is preferred, but an existing IMAP account does not automatically establish CalDAV credentials.

If Thunderbird cannot securely reuse an appropriate existing authentication context, prompt the user through the native authentication mechanism. Never silently extract an IMAP password.

The goal is that an ordinary user does not need to know a CalDAV URL.

A one-time initial configuration step is acceptable when discovery or authentication cannot be completed automatically.

### Calendar discovery

Use the authenticated principal to identify the relevant calendar home collections.

Support:

- `DAV:current-user-principal`
- `CALDAV:calendar-home-set`
- `DAV:resourcetype`
- `DAV:displayname`
- `DAV:current-user-privilege-set`
- `CALDAV:supported-calendar-component-set`
- Multiple calendar home sets.
- Collections accessible through WebDAV ACL sharing.

Use `PROPFIND` and appropriate depth values to enumerate calendar collections.

Correctly parse `207 Multi-Status` responses, including property-specific error statuses.

Do not treat a missing optional property as failure of the entire resource.

Validate that a discovered collection is actually a calendar before subscribing to it.

Avoid requesting or downloading individual calendar events during discovery.

### Stalwart compatibility

Stalwart supports assisted discovery through its `enableAssistedDiscovery` setting.

When assisted discovery is enabled, shared collections may be presented alongside the user's personal calendars during a `PROPFIND` on the user's calendar home.

When it is disabled, multiple calendar home sets may need to be traversed.

Support both approaches where the server makes the relevant shared collections discoverable to the authenticated user.

Do not hardcode Stalwart-specific paths except as optional compatibility fallbacks.

The primary implementation must use standard WebDAV and CalDAV discovery.

## 6. Automatic rediscovery

This is the principal feature of the extension.

### Triggers

Run discovery:

- When Thunderbird starts, once its account and calendar services are ready.
- At a configurable interval.
- When the user clicks **Discover Calendars Now**.
- Following relevant account or authentication configuration changes, when detectable.

Suggested default interval: **30 minutes**.

Support intervals of 15, 30, 60 and 120 minutes, plus manual-only operation.

Avoid overlapping scans, excessive network requests and repeated authentication prompts.

Implement exponential backoff for network failures and rate limiting where appropriate.

### New calendar handling

When discovery identifies a previously unknown accessible calendar:

1. Compare it with existing native Thunderbird subscriptions.
2. Check the extension's historical discovery records.
3. Determine whether the user has previously dismissed or unsubscribed from it.
4. Apply the configured subscription policy.

Support two modes:

**Automatic subscription**

New calendars are added using Thunderbird's native CalDAV implementation.

The user may optionally receive a notification.

**Notification and approval**

The user sees a notification such as:

> Two new shared calendars are available: Team Calendar and Bob's Calendar.

They can subscribe to one or both.

Provide a **Discover Now** button regardless of the selected mode.

### First-run behaviour

On initial installation, present an overview of available calendars.

Do not silently subscribe to every existing resource without giving the user an opportunity to choose or explicitly enable automatic subscription.

Subsequent discoveries can be automatic.

### Duplicate prevention

Normalise calendar URLs sufficiently to avoid duplicate subscriptions caused by:

- Trailing slashes.
- URL encoding differences.
- Redirects.
- Alternative principal paths.
- Already registered calendars.
- Repeated discovery scans.

Where available, use stable server-provided resource identifiers.

Do not assume that two different authenticated accounts accessing the same URL should automatically share one subscription.

Preserve account and authentication boundaries.

### Removed calendars

Distinguish between:

- A calendar whose share has been revoked.
- A calendar temporarily unavailable because of network problems.
- An authentication failure.
- A calendar manually unsubscribed by the user.
- A calendar deleted from the server.

Do not automatically delete a registered calendar based solely on its absence from a single discovery scan.

Prefer marking the resource unavailable and presenting an appropriate status.

Automatic removal should be optional and disabled by default.

Never delete locally stored calendar data without explicit user action.

### User preferences

If a user manually unsubscribes from a discovered calendar, do not repeatedly re-add it.

Maintain a persistent suppression record, with an option to restore or forget that decision.

## 7. User interface

Aim for a minimal interface consistent with Thunderbird's existing design.

### Toolbar action

Provide a button labelled **CalDAV Discovery**.

Its popup should display:

- Connected CalDAV accounts.
- Last discovery time.
- Number of registered calendars.
- Newly discovered calendars.
- Calendars requiring attention.
- A **Discover Now** action.

### Calendar management view

Display available resources grouped by server/account and, where known, owner.

For example:

| Calendar | Owner | Status |
|---|---|---|
| Alice's Calendar | Alice | Subscribed |
| Team Calendar | Team Group | Subscribed |
| Bob's Calendar | Bob | Newly discovered |

Show meaningful labels for:

- Subscribed.
- Available.
- Ignored.
- Inaccessible.
- Authentication required.
- Discovery error.

Where permissions can be identified, display read-only or read/write capability.

### Settings

Provide configuration for:

- Automatic discovery enabled/disabled.
- Discovery interval.
- Auto-subscribe versus ask first.
- Notification preferences.
- Servers/accounts to include.
- Ignored calendars.
- Handling of revoked access.
- Debug logging.

Provide a simple way to rescan all accounts without resetting their configuration.

Avoid unnecessarily complicated configuration screens.

## 8. Authentication and security

This extension will interact with authenticated calendar resources and potentially privileged Thunderbird APIs.

Security must be designed into the implementation.

Requirements:

- Reuse Thunderbird's existing credential and authentication systems wherever possible.
- Never save account passwords in extension storage.
- Do not log credentials, bearer tokens or sensitive authentication headers.
- Support authentication prompts and app-specific passwords.
- Respect TLS certificate validation.
- Require HTTPS for remote connections, with a narrowly scoped, explicit localhost development exception.
- Do not transmit discovered calendar metadata to external services.
- Avoid analytics or telemetry by default.
- Validate redirect destinations and avoid forwarding credentials to unrelated origins.
- Parse untrusted XML securely and reject dangerous or malformed responses.
- Avoid exposing privileged Experiment API operations to untrusted pages.

Ensure that multiple Thunderbird accounts remain isolated.

If the calendar integration requires an Experiment API, clearly explain the resulting elevated extension permissions to the user.

## 9. Handling errors

A discovery failure must never break existing calendar synchronisation.

Examples:

**Server unreachable:** Log the failure and retry later. Leave subscriptions unchanged.

**Authentication expired:** Report the problem without repeatedly prompting or attempting invalid credentials.

**Calendar no longer accessible:** Preserve the existing subscription and notify the user.

**Malformed XML:** Ignore or report the problematic response without crashing the background service.

**Duplicate calendar found:** Do not create another subscription.

**Thunderbird API changed:** Fail safely and report a compatibility problem.

**Calendar registration failed:** Preserve the discovery record and allow retry.

Provide useful logs showing discovery operations, returned resource identifiers and subscription decisions, with appropriate redaction.

## 10. Proposed project structure

A suggested structure, adaptable to the chosen build tooling:

- `src/background/` — scheduling, discovery orchestration, account tracking.
- `src/discovery/` — CalDAV and WebDAV discovery.
- `src/thunderbird/` — native calendar integration and authentication.
- `src/experiments/` — privileged API bridge where necessary.
- `src/ui/` — popup, options and resource management.
- `src/storage/` — preferences, resource records and suppression lists.
- `src/common/` — normalisation, logging and shared utilities.
- `tests/unit/` — protocol and state-management tests.
- `tests/integration/` — real Thunderbird and CalDAV tests.
- `docs/` — architecture, security model, user documentation.
- `scripts/` — development, packaging and test tooling.

Use modern JavaScript or TypeScript as appropriate.

Prefer modular, testable code.

Keep Thunderbird-specific logic isolated from generic CalDAV discovery logic, making future integration with other applications possible.

## 11. Development phases

### Phase 0 — Technical investigation and proof of concept

Before implementing the full extension:

1. Examine Thunderbird 156's calendar Experiment APIs.
2. Examine modern TbSync's calendar integration.
3. Identify how native CalDAV calendars are registered.
4. Determine how existing authentication contexts are selected or reused.
5. Confirm whether an extension can invoke Thunderbird's existing calendar discovery routines.
6. Build a minimal experiment that enumerates existing calendars and registers one test CalDAV subscription.
7. Verify that the new subscription synchronises through Thunderbird's native provider.

Document the findings and unresolved limitations.

**Exit criterion:** A demonstrable path exists to adding a native CalDAV subscription without implementing a custom sync engine.

### Phase 1 — Discovery engine

Implement standards-compliant server and collection discovery.

Support direct and group-shared resources.

Test using Stalwart.

**Exit criterion:** The engine can enumerate all accessible calendar collections for a test user, including the group-sharing scenario, without subscribing to them.

### Phase 2 — Native subscription manager

Implement subscription registration, duplicate detection, persistent resource tracking and user suppression lists.

**Exit criterion:** Newly available calendars can be subscribed to without manual entry of their URLs, and existing subscriptions remain intact.

### Phase 3 — Background automation

Implement startup discovery, periodic scans, new calendar detection, notifications and optional automatic subscription.

**Exit criterion:** Sharing a new calendar with a user or their group causes it to become available in Thunderbird without manually running account or calendar setup.

### Phase 4 — UI and settings

Implement the toolbar popup, management interface, first-run flow and configuration.

**Exit criterion:** A non-technical Thunderbird user can operate the extension without needing to understand CalDAV URLs.

### Phase 5 — Testing and release

Add automated tests, compatibility testing, packaging, documentation and release tooling.

Produce an installable `.xpi` file and document any signing requirements for normal distribution.

## 12. Testing requirements

At minimum, test against Thunderbird 156 and a current Stalwart installation.

Tests should include:

| Scenario | Expected result |
|---|---|
| Personal calendar exists | Discovered |
| User joins a group with a calendar | Newly discovered |
| Another user shares a calendar directly | Newly discovered |
| Another user shares a calendar with the user's group | Newly discovered, if effective ACL grants access |
| A second calendar is shared later | Automatically discovered on next scan |
| Calendar already registered natively | No duplicate |
| User manually unsubscribes | Not automatically re-added |
| Sharing permission revoked | Safe handling, no local data loss |
| Server temporarily offline | Existing subscriptions unaffected |
| Authentication expires | Graceful failure |
| Two accounts use the same server | Correct account isolation |
| Read-only calendar | Appropriate native access behaviour |
| Thunderbird restarts | State preserved |
| Extension disabled | Native calendar subscriptions continue functioning |

Test with Stalwart's assisted discovery both enabled and disabled.

Where practical, test against another CalDAV implementation such as Radicale, Nextcloud or Baïkal to identify unintended Stalwart-specific assumptions.

Use mock WebDAV servers and recorded/sanitised XML fixtures for unit tests. Supplement these with integration tests using real authenticated servers.

## 13. Out of scope for the initial release

The following are explicitly excluded from the MVP:

- Implementing a standalone CalDAV synchronisation engine.
- Replacing Thunderbird's existing calendar provider.
- Creating or modifying calendar events within the extension.
- Managing calendar sharing permissions on the server.
- Editing group membership.
- Calendar invitations or scheduling.
- CardDAV contact discovery.
- JMAP calendar synchronisation.
- Mobile platform support.
- A server-side daemon or administrator service.

The architecture should not prevent later support for CardDAV or other discoverable resources.

## 14. Definition of done

The MVP is complete when:

1. It installs and runs in Thunderbird 156.
2. It can discover the relevant CalDAV server using existing configuration or a one-time account setup.
3. It enumerates personal, group and shared calendars.
4. It subscribes using Thunderbird's native CalDAV provider.
5. It detects calendars made available after initial configuration.
6. It can automatically subscribe to newly available calendars.
7. It avoids duplicate subscriptions.
8. It respects user decisions to ignore or unsubscribe from calendars.
9. It handles revoked permissions and network errors safely.
10. It requires no ongoing manual calendar URL management.
11. It has automated tests and reproducible build instructions.
12. The source code and a functional `.xpi` package are provided.

## 15. Instructions for the coding agent

You are responsible for investigating, designing and implementing this Thunderbird extension.

**Start with Phase 0.**

Do not assume that Thunderbird's published WebExtension calendar APIs provide all necessary functionality. Inspect the actual APIs and source code for the target Thunderbird version.

Prioritise reusing existing Thunderbird calendar functionality, the calendar Experiment API and appropriate ideas or reusable code from TbSync.

Do not implement a replacement CalDAV synchronisation engine.

Where an architectural decision is uncertain, investigate the existing implementations, run a minimal technical experiment, and document the result.

Maintain the following documents as work progresses:

- `ARCHITECTURE.md` — architecture and key technical decisions.
- `IMPLEMENTATION_PLAN.md` — work packages and progress.
- `COMPATIBILITY.md` — Thunderbird versions and API dependencies.
- `TESTING.md` — testing procedures and results.
- `THIRD_PARTY_NOTICES.md` — attribution and licences for reused components.

Implement incrementally, with tests and commits after meaningful milestones.

Avoid excessive scaffolding or general-purpose frameworks where straightforward solutions are sufficient.

**The core success criterion is simple:**

A user already running Thunderbird gains access to a newly shared CalDAV calendar. Without repeating account setup, entering a URL or manually running discovery, that calendar becomes available in Thunderbird's native calendar interface.

Start by producing a concise technical feasibility assessment, then implement the Phase 0 proof of concept. Continue with the remaining phases once the integration approach is validated.

---

## Reference documentation

- [TbSync — modern Thunderbird integration](https://github.com/jobisoft/TbSync)
- [DAV-4-TbSync — legacy CalDAV discovery](https://github.com/jobisoft/DAV-4-TbSync)
- [Thunderbird Experiment APIs](https://github.com/thunderbird/webext-experiments)
- [DAVx⁵ — reference discovery implementation](https://github.com/bitfireAT/davx5-ose)
- [Stalwart WebDAV and assisted discovery](https://stalw.art/docs/collaboration/webdav/)
- [Thunderbird MailExtension development](https://developer.thunderbird.net/add-ons/mailextensions)
- [Thunderbird Calendar internals](https://source-docs.thunderbird.net/en/latest/calendar/calendars.html)

**Design principle:** Keep the extension server-agnostic. Use Stalwart as the initial integration environment, but rely on standards-compliant discovery so the add-on is useful with other CalDAV servers and could potentially be upstreamed to Thunderbird.
