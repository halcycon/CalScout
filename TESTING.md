# Testing

## Unit and package

`npm ci`, `npm test` and `npm run build`. The XML DOM dependency is test-only; the XPI ships no npm libraries.

## Native integration (isolated local fixtures)

```sh
python3 -m venv /tmp/calscout-test-venv
/tmp/calscout-test-venv/bin/pip install radicale==3.9.0
THUNDERBIRD_BIN=/absolute/path/to/thunderbird \
  /tmp/calscout-test-venv/bin/python tests/integration/thunderbird.py
```

The harness creates and removes its own Radicale storage, two fixture users and
Thunderbird profile. It listens only on loopback, seeds a known test credential
in Thunderbird's native login manager, and installs CalScout temporarily. Never
point this test at an everyday profile. No production credentials are required.

2026-11-07 results: 18 protocol, security, lifecycle and orchestration unit tests pass. Real Thunderbird 156.0 +
Radicale 3.9.0: native registration, URL duplicate prevention, authenticated event
fetch, metadata discovery through native authentication, management page/background IPC, alarm-triggered discovery and auto-subscription of a later calendar, extension disable and subsequent native event refresh all PASS.

Native event requests in this test come from Thunderbird's provider; the
extension has no event synchronization code.

## Required remaining acceptance tests

Real Stalwart is not yet tested. Use separate Alice, Team and Bob fixture accounts;
record server version and authenticated sanitized PROPFIND responses. Test assisted
discovery enabled and disabled. Bob sharing with Team, Alice belonging to Team,
and a second later share are mandatory. Do not substitute mocks for these results.

Also verify expired authentication, native prompt cancellation, two accounts on
one server, read-only calendars, restart persistence, revocation/offline safety,
manual unsubscribe suppression, TLS failures, malicious redirects/XML, and the
first-run approval flow. Record unexposed shares as a server limitation rather
than inventing hidden paths or claiming ACL inheritance works.
