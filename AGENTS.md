# CalScout

Thunderbird 156 MailExtension; see README.md and CalScout-brief.md. Runtime source
is dependency-free modern JavaScript. Use the native caldav provider; never add an
event synchronization engine or direct calendar database/registry-preference writes.

- `npm ci`, `npm run check`, `npm test`, `npm run build`.
- Native integration commands and verified results: TESTING.md.
- Privileged bridge: src/experiments/calendarBridge; generic DAV: src/discovery.
- Serialized background orchestration: src/background/service.mjs.
- Durable resource/suppression model: src/storage/state.mjs.
- UI: static HTML/CSS/modules under src/ui; no framework required.
- XPI: dist/calscout-0.1.0.xpi, ignored build output.

Never use production credentials or the user's normal Thunderbird profile in
tests. Stalwart fixtures must run in an isolated network namespace; use the
provided harness. Keep architecture, compatibility, implementation plan, testing
and third-party notices accurate. Maintain MPL-2.0 compatibility; copy no GPL/AGPL
reference implementation into extension source. Existing subscriptions and local
calendar data must survive discovery failures, extension disable and uninstall.
