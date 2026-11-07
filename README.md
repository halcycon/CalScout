# CalScout

[![Check and package](https://github.com/halcycon/CalScout/actions/workflows/check.yml/badge.svg)](https://github.com/halcycon/CalScout/actions/workflows/check.yml)
[![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)](LICENSE)
[![Support on Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20CalScout-ff5e5b.svg)](https://ko-fi.com/thecuckoocamp)

Automatically discover newly shared CalDAV calendars in Thunderbird, including
calendars shared through a group. CalScout manages discovery and subscriptions;
Thunderbird's native CalDAV provider handles all events and synchronisation.

**Development MVP for Thunderbird 153 ESR through 159.x.** Tested with Stalwart 1.0.3 and Radicale
3.9.0. Wider platform and OAuth-provider testing remains. The extension uses a
privileged Experiment and requests full Thunderbird access.

## Install

1. Open [Releases](https://github.com/halcycon/CalScout/releases) and download the
   `calscout-<version>.xpi` asset. Versions below 1.0 are marked as prereleases.
2. In Thunderbird, open **Add-ons and Themes → gear menu → Install Add-on From File**
   and select the XPI. Normal unsigned installation was verified on Thunderbird 153 ESR and 159.
3. Open **CalDAV Discovery → Manage calendars**, discover your accounts, choose
   calendars and finish the initial review. Automatic subscription is optional.

See [usage and setup](docs/USAGE.md) for authentication, server discovery and
preferences. Downloads include `SHA256SUMS` for checksum verification.

## What it does

- Discovers principals, multiple calendar home sets, personal and shared calendars.
- Checks at startup and periodically, with manual discovery available at any time.
- Offers approval or automatic subscription after the first-run review.
- Remembers ignored calendars and native manual unsubscriptions.
- Keeps accounts isolated and backs off after failures.
- Preserves subscriptions and local data when access disappears.

Passwords stay in Thunderbird's native authentication system. There is no
telemetry. Read the [privacy policy](src/ui/privacy.txt). Existing subscriptions remain usable when CalScout is disabled.

## Build and contribute

```sh
npm ci
npm run check
npm test
npm run build
```

Node 22+ and Python 3.10+ are required. The build writes an installable
`dist/calscout-<version>.xpi` and `dist/SHA256SUMS`. Runtime source has no external
library dependencies. For temporary development installation, load
`src/manifest.json` through Thunderbird's **Debug Add-ons → Load Temporary Add-on**.

Every branch push, pull request and manual **Check and package** run produces a
`calscout-xpi` Actions artifact containing the XPI and checksum. A version tag such
as `v0.2.1` runs the same checks and publishes those files to a GitHub release.
Tagged releases also include an [ATN submission packet](docs/atn/SUBMIT.md) with
listing text, privacy policy, reviewer notes, screenshots and exact source snapshot.
ATN submission and review are pending.
See [release maintenance](docs/RELEASE.md) for version checks and publishing.

[Contributing](CONTRIBUTING.md) · [Architecture](ARCHITECTURE.md) ·
[Testing](TESTING.md) · [Compatibility](COMPATIBILITY.md) ·
[Security model](docs/SECURITY.md) · [Repository tooling](docs/REPOSITORY.md)

## License

CalScout source is licensed under [MPL-2.0](LICENSE), a file-level copyleft
license: distributed modifications to covered files remain open, while allowing
integration with other software. This matches the project's Mozilla ecosystem
and its original brief. See [third-party notices](THIRD_PARTY_NOTICES.md) for
separately licensed repository templates and development tools.

## Support and find me

Built and maintained by **Adam Camp / CuckooAdam**. If CalScout is useful to you,
you can [support its development on Ko-fi](https://ko-fi.com/thecuckoocamp).

- [Website and links](https://links.thecuckoocamp.co.uk/@cuckooadam)
- [GoToSocial / Fediverse — @adam@fedi.thecuckoocamp.co.uk](https://fedi.thecuckoocamp.co.uk/@adam)
- [Bluesky — @thecuckoocamp.co.uk](https://bsky.app/profile/thecuckoocamp.co.uk)
- [Ko-fi — The Cuckoo Camp](https://ko-fi.com/thecuckoocamp)

For bugs and feature requests, use [GitHub Issues](https://github.com/halcycon/CalScout/issues).
Report security vulnerabilities privately through [the security policy](SECURITY.md).
