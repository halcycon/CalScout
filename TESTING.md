# Testing

## Automated checks

```sh
npm ci
npm run check
npm test
npm run build
```

Node 22+ runs **25 tests** covering protocol parsing, real Stalwart recordings,
URL security, state reconciliation, scheduling policy and redacted UI errors.
Regression tests cover distinct account sign-ins during a scan, stale partial
results and explicit registration failure reporting. @xmldom/xmldom 0.9.12
is a test dependency only. Python 3's standard library produces the XPI. The
GitHub Actions workflow also runs Ruff on the Python fixtures and repeats these checks and verifies build reproducibility.

## Real Thunderbird + Radicale

```sh
python3 -m venv /tmp/calscout-test-venv
/tmp/calscout-test-venv/bin/pip install radicale==3.9.0
npm run build
THUNDERBIRD_BIN=/absolute/path/to/thunderbird \
  /tmp/calscout-test-venv/bin/python tests/integration/thunderbird.py
```

The harness uses disposable server storage, fixture credentials and a Thunderbird
profile. It performs a **normal unsigned XPI installation**, registers a native
caldav subscription, fetches a real server event through Thunderbird, opens the
management UI, tests its background IPC and preservation of unsaved preference edits, automatically subscribes a later calendar
through an alarm, checks isolation from a second username, observes native manual
unsubscribe suppression, disables the extension, verifies continued native sync,
and restarts Thunderbird to verify settings/suppression/subscription persistence.
No signing preference bypass is used. Never use an everyday Thunderbird profile.

## Real Thunderbird + Stalwart

Download the pinned [Stalwart 1.0.3 binary](https://github.com/stalwartlabs/stalwart/releases/tag/v1.0.3)
and [Thunderbird 156.0 binary](https://ftp.mozilla.org/pub/thunderbird/releases/156.0/).
On Linux, with `unshare` and `ip` installed:

```sh
npm run build
STALWART_BIN=/absolute/path/to/stalwart \
THUNDERBIRD_BIN=/absolute/path/to/thunderbird \
  python3 tests/integration/stalwart.py
```

The harness automatically enters a user/network namespace and enables loopback.
This keeps Stalwart's bootstrap/recovery listener off the host network; the fixture
refuses to run where non-loopback interfaces exist. Normal DAV service binds to
127.0.0.1. No containers, production infrastructure, external credentials or running
mail server are required. Server data and Thunderbird profiles are temporary.
Startup can take tens of seconds because fixture network isolation intentionally
prevents Stalwart from fetching its optional WebUI/GeoIP bundles. Those downloads
are unnecessary for CalDAV tests and their server-side errors are expected.

For **each** assisted-discovery mode, the test:

1. Creates Alice, Team and Bob, including Alice's Team membership.
2. Creates personal/group calendars; Bob shares one with Alice directly and one
   with Team using an actual DAV ACL request.
3. Authenticates as Alice and asserts the group-shared calendar's PROPFIND returns
   a calendar resourcetype and effective read privilege.
4. Asserts CalScout discovers personal, group, direct and inherited shared resources.
   With assisted discovery disabled, asserts multiple advertised home sets exist.
5. Removes Alice from Team before initial background discovery; verifies approval
   mode creates no subscriptions and Team resources are absent.
6. Completes initial review, enables auto-subscription, joins Alice to Team again,
   and adds a second later Bob-to-Team share.
7. Advances the real extension alarm's firing time, without a manual discovery
   message. Verifies the group/inherited/later resources become native subscriptions.
   Only the alarm time is accelerated; discovery and subscription code are unchanged.
8. Writes a test event as Bob and verifies Thunderbird's native read-only calendar
   fetches it while authenticated as Alice through the Team ACL.
9. Revokes the later share and verifies repeated scans mark it inaccessible while
   preserving its native subscription and local data.

Add `--record` to regenerate the sanitized fixture-only PROPFIND recordings under
`tests/fixtures/`. These contain no authentication headers or production metadata.
Fixture setup is server-specific; extension source has no Stalwart path literals.

## Results, 2026-11-07

Environment: Linux x86_64; Thunderbird **156.0**, build **20260910221217**;
Radicale **3.9.0**; Stalwart **1.0.3**. All commands above pass.

| Scenario | Evidence | Result |
|---|---|---|
| Personal calendar | Live Radicale/Stalwart | PASS |
| Existing native calendar; no duplicate | Live Radicale | PASS |
| Direct share | Live Stalwart, both modes | PASS |
| Bob shares with Alice's group | Alice-authenticated DAV responses + live native sync, both modes | PASS |
| Alice joins group after setup | Live Stalwart + real extension alarm, both modes | PASS |
| Later share automatically subscribed | Live Stalwart/Radicale + real alarm | PASS |
| Read-only native subscription | Live Stalwart native event fetch | PASS |
| Access revoked | Live Stalwart; native subscription preserved | PASS |
| Manual native unsubscribe | Live Radicale; suppression persists across restart | PASS |
| Two authentication usernames | Live Radicale rejects borrowing Alice's context; state unit tests isolate subscriptions | PASS |
| Unattended auth failure | Live Radicale, no prompt; unit tests suspend retries | PASS |
| Offline/partial/malformed scan | Unit/recorded response tests; subscriptions preserved | PASS |
| Normal unsigned XPI installation | Live Thunderbird AddonManager installation path | PASS |
| Full Thunderbird restart | Native subscriptions/settings/suppression persist | PASS |
| Extension disabled | Live native event refresh continues | PASS |
| Reproducible package | Two builds compared by SHA-256 | PASS |

Discovery requests metadata only. All event operations in tests are fixture setup
or Thunderbird's native provider, never an extension sync engine.

## Remaining release hardening

Windows/macOS; OAuth-provider-specific refresh and cancellation; native interactive
password/certificate dialogs; enterprise proxy/auth environments; DNS SRV and
Mozilla autoconfiguration coverage across providers; UI screen-reader/manual
usability review. Mozilla autoconfiguration metadata is not implemented. Remote
HTTPS policy and malicious metadata are unit-tested; live fixture connections
use the explicit localhost HTTP exception. The complete production TLS/auth
matrix has not been exercised. ATN public review/publication is not performed.

## Code health and repository checks

Install Python helper tools in a virtual environment with
`python -m pip install -r requirements-dev.txt`. Then run `ruff check scripts tests/integration`
and `ruff format --check scripts tests/integration`. `just lint` runs the JavaScript
and Python checks plus actionlint (install actionlint separately). `just build`
and `just test` delegate to the npm commands through Tailor project hooks.

Desloppify's local state is ignored by Git. Run `desloppify scan --path . --no-badge`
with npm dependencies installed; its ESLint detector must succeed. The six manual
review findings and verification are documented in docs/CODE_HEALTH.md. No
subjective health score is claimed from a findings-only review.
