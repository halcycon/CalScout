# Code health pass — 2026-11-07

Used the installed Desloppify CLI to scan JavaScript and Python, prepare a review,
track defects, and verify fixes. Review findings were imported without subjective
scores. No aggregate/strict health score is claimed: the twenty subjective score
dimensions remain unassessed. Scan state and review packets are local artifacts
under ignored `.desloppify/`.

The initial JavaScript scan had no mechanical findings but could not run ESLint.
ESLint now runs successfully against the extension, unit tests and build helper,
including Thunderbird's privileged globals. Prettier and Ruff replace dense,
inconsistent formatting with checked conventions. These tools run in CI and the
Tailor Just hooks. They are development dependencies, not XPI runtime libraries.

| Reviewed defect | Change | Evidence |
|---|---|---|
| A running scan consumed a different account's sign-in request | Coalesce only equivalent requests; serialize distinct requests | Unit test checks both account and prompt intent |
| Partial discovery could auto-subscribe stale historical resources | Reconciliation returns observed records; automatic subscriptions use that list | Partial-scan regression test |
| Manual registration failure appeared successful | Persist retry state, reject the action with a deliberate user-facing error, redact native errors | Registration and redaction tests |
| Two native-subscription reconciliation implementations drifted | Shared helper applies matches, clears registration errors and persists unsubscribe suppression | Existing suppression, retry and restart tests |
| Released UI exposed obsolete Phase 0 registration form | Removed prototype page/script and footer link | Packaged runtime contains only the current UI |
| Calendar refresh discarded unsaved settings | Render account/table rows separately; initialize preferences only on load/save | Real Thunderbird UI regression test |

The Python scan also flagged the Stalwart fixture constructor's responsibilities.
Configuration, account creation and process lifecycle now have separate methods;
failed startup closes its log and stops any process already started. A direct
Python complexity check no longer flags this fixture class. The remaining two
complexity signals are below the scanner threshold in sequential integration tests.

Validation: 25 unit tests; ESLint/Prettier; Ruff lint/format; actionlint; Just
build/test/lint; dependency audit; real Thunderbird 156/Radicale acceptance,
including native sync, UI drafts, account isolation, suppression and restart;
Stalwart 1.0.3 acceptance with assisted discovery enabled and disabled. Package
builds remain reproducible. See TESTING.md for the live-test commands and wider
platform/OAuth limits.
