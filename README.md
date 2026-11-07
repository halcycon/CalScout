# CalScout

Automatic CalDAV calendar discovery for Thunderbird 156, using Thunderbird's
native provider for all event synchronization. **Under active development.**

Implemented: principal/home-set discovery, recurring scans, optional native
auto-subscription, first-run approval, persistent ignore/unsubscribe suppression,
account isolation, backoff, notifications and a management screen. Native sync,
discovery, UI/background messaging and automatic late-calendar registration are
tested in real Thunderbird 156. Stalwart 1.0.3 group-sharing, later shares, read-only native sync and revocation pass with assisted discovery enabled and disabled.

Run `npm ci` for test dependencies. Build with `npm run build`; test with `npm test`. The unsigned development XPI is
written to `dist/calscout-0.1.0.xpi`. In a disposable Thunderbird 156 profile, use
Add-ons Manager → gear → Debug Add-ons → Load Temporary Add-on → select
`src/manifest.json`. Open the CalDAV Discovery toolbar action to list calendars
and open Manage calendars. Existing secure CalDAV accounts are included automatically. For a new account, use Connect an account; Thunderbird handles authentication.

The Experiment has full Thunderbird privileges. No passwords are stored in
extension storage; subscriptions remain registered when CalScout is disabled.
The prototype deliberately offers no deletion API. See [TESTING.md](TESTING.md),
[ARCHITECTURE.md](ARCHITECTURE.md), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md),
and [COMPATIBILITY.md](COMPATIBILITY.md) for evidence, limitations and next work.

License: MPL-2.0.

See [usage](docs/USAGE.md), [security model](docs/SECURITY.md), and [release procedure](docs/RELEASE.md). This is a development MVP; wider platform and OAuth-provider testing remains.
