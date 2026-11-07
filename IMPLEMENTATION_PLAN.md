# Implementation plan

- [x] Phase 0: inspect reference projects and the actual Thunderbird 156 modules.
- [x] Phase 0: package a minimal native subscription Experiment and diagnostic UI.
- [x] Phase 0: prove authenticated native event synchronization in Thunderbird 156.
- [x] Phase 0: prove synchronization survives extension disable.
- [x] Phase 1: secure metadata discovery, all home sets, property-specific statuses.
- [x] Phase 1: real Stalwart personal/direct/group ACL scenarios in both assisted modes.
- [x] Phase 2: durable resources, account boundaries, suppression and reconciliation.
- [x] Phase 3: periodic/startup rediscovery, no overlaps, backoff, notifications.
- [x] Phase 4: initial selection, account/resource management, settings and diagnostics.
- [x] Phase 5: automated/live acceptance tests, reproducible XPI and distribution guidance.
- [ ] Release hardening: Windows/macOS, OAuth providers, native prompt/certificate UI and public ATN review.

Mandatory Stalwart group-sharing tests pass in both assisted modes. See TESTING.md for the exact covered matrix and remaining release-hardening limits.

Repository maintenance: Tailor v0.5.0 config, project-specific community templates,
Dependabot, Just hooks, ESLint/Prettier/Ruff checks and code-health cleanup are in
place. See docs/REPOSITORY.md and docs/CODE_HEALTH.md.
