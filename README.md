# CalScout

Automatic CalDAV calendar discovery for Thunderbird 156, using Thunderbird's
native provider for all event synchronization. **Under active development.**

Phase 0 proves native subscription registration and authenticated sync, including
after CalScout is disabled. The current prototype requires a test calendar URL;
automatic discovery and the mandatory Stalwart group-sharing tests are pending.

Build with `npm run build`; test with `npm test`. The unsigned development XPI is
written to `dist/calscout-0.1.0.xpi`. In a disposable Thunderbird 156 profile, use
Add-ons Manager → gear → Debug Add-ons → Load Temporary Add-on → select
`src/manifest.json`. Open the CalDAV Discovery toolbar action to list calendars
or add a native test subscription. Thunderbird handles the authentication prompt.

The Experiment has full Thunderbird privileges. No passwords are stored in
extension storage; subscriptions remain registered when CalScout is disabled.
The prototype deliberately offers no deletion API. See [TESTING.md](TESTING.md),
[ARCHITECTURE.md](ARCHITECTURE.md), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md),
and [COMPATIBILITY.md](COMPATIBILITY.md) for evidence, limitations and next work.

License: MPL-2.0.
