# Security model

CalScout's parent Experiment has full application privileges. Treat it as trusted
application code. The API is available only to the installed extension; there
are no content scripts, externally_connectable pages or web-accessible resources.
The message dispatcher accepts only this extension's own `ui/` pages.

Authentication belongs to Thunderbird. The bridge uses native DAV HTTP channels,
per-username containers, native calendar prompts and the native OAuth module.
It never sends credentials to background/UI storage. It never requests an IMAP
password. Calendar passwords/app passwords and OAuth grants remain in Thunderbird's
native systems. Background scans cannot open password/OAuth UI; explicit per-account
sign-in can prompt once. Authentication errors suspend unattended retries.

Remote endpoints must be HTTPS. An opt-in development flag permits HTTP only for
localhost, 127.0.0.1 and ::1. URL userinfo, query strings and fragments are rejected.
Authenticated requests, redirects and advertised resources must stay on one
origin. Redirects are limited to five per request. A provider using a different
CalDAV host must be configured as a separate origin (DNS SRV can suggest it).
No certificate overrides are applied.

Discovery parses metadata only, with namespace checks, property-specific statuses,
DTD/entity rejection, a 2 MiB parsed-body limit, at most 5,000 resources per response,
a 64-request traversal bound, loop detection and a 30-second per-request timeout.
The native HTTP stream can buffer data before the parser's body-size check; a
hostile authenticated server can still consume network/memory up to native channel
limits. Whole-scan limits prevent endless traversal but are not a streaming quota.

The bridge exposes no event/database CRUD, sharing or group-management operations.
It can register only the native caldav type. Only owned subscriptions can be
explicitly enabled/disabled. There is no delete API. Removing or disabling CalScout
does not remove subscriptions or cached events.

Storage contains account endpoints/usernames, calendar metadata, local resource IDs,
subscription/suppression state, preferences and a bounded structured log. It has
no passwords, bearer tokens, server response bodies or authentication headers.
Server labels are rendered as text. Nothing is sent to analytics or telemetry
services. Thunderbird's own independent telemetry/settings are outside CalScout.

Report security issues privately to the project maintainer before publishing an
exploit. Native OAuth UI cancellation, enterprise authentication providers and
platform-specific certificate behavior still need expanded manual acceptance tests.
