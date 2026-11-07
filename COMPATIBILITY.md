# Compatibility

CalScout 0.2.1 permits Thunderbird **153.0 through 159.***. Acceptance testing
covers Linux x86_64 on **153.0**, **153.6.0 ESR** and **159.0**. The previous 0.1.0 release
was tested on **156.0** (build 20260910221217). Intermediate versions, Windows,
macOS and OAuth-provider variations have not each been tested.

Official Mozilla release archives and SHA-256 checksums:

| Thunderbird | Archive | SHA-256 |
| --- | --- | --- |
| 153.0 | [Linux en-US](https://ftp.mozilla.org/pub/thunderbird/releases/153.0/linux-x86_64/en-US/thunderbird-153.0.tar.xz) | `8a47ef768a498583fd563715d7ec8642da3987fd2c0b092d55e6666261459fcd` |
| 153.6.0 ESR | [Linux en-US](https://ftp.mozilla.org/pub/thunderbird/releases/153.6.0esr/linux-x86_64/en-US/thunderbird-153.6.0esr.tar.xz) | `b615e9996150d64e2d520981d0088dd5d45f375bc0f153d53a682ffbac2d08f3` |
| 159.0 | [Linux en-US](https://ftp.mozilla.org/pub/thunderbird/releases/159.0/linux-x86_64/en-US/thunderbird-159.0.tar.xz) | `a7cb57c4dfec66e566e1cbbdcf7e0aab67aad7262dd0ab38b4f4e8df2b771074` |
| 156.0 (historical) | [Linux en-US](https://ftp.mozilla.org/pub/thunderbird/releases/156.0/linux-x86_64/en-US/thunderbird-156.0.tar.xz) | `cfa82799a50f60ac3e870baf11873373a04abb88a75a36dad43b9d5c1efacf01` |

On 7 November 2026, both current test versions passed the complete Radicale 3.9.0
native smoke test and Stalwart 1.0.3 acceptance with assisted discovery enabled
and disabled. Coverage includes normal unsigned installation, authenticated
rediscovery, group ACLs, later automatic subscription, native read-only event sync,
revocation preservation, account isolation, manual unsubscribe suppression,
extension disable and full Thunderbird restart. See TESTING.md for reproduction.

MV2 and privileged parent Experiments loaded successfully. The shipped modules
provide `calUtils.sys.mjs`, `cal.manager.createCalendar/registerCalendar`, native
DAV authentication and the `caldav` provider. Neither tested release exposes a
built-in calendar MailExtension schema replacing the bridge. Internal calendar
interfaces are not stable public APIs. Failures must preserve subscriptions.

Runtime has no external libraries. Builds use Python 3.10+; tests use Node 22+,
test-only @xmldom/xmldom 0.9.12 and disposable server fixtures. The Thunderbird 159
Marionette harness requires MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1 for privileged test
commands; the harness sets it only for its own disposable Thunderbird processes.
This is not an extension installation requirement or a signing bypass.

Normal unsigned installation and restart persistence passed without changing
signing preferences. GitHub releases provide development builds with full
application privileges. **ATN validation, submission and review are pending**;
preparing a packet or publishing on GitHub does not imply store approval. See
[submission instructions](docs/atn/SUBMIT.md) and the
[Thunderbird review policy](https://thunderbird.github.io/atn-review-policy/).

Cross-origin authenticated redirects are blocked; configure the actual secure
CalDAV origin separately if needed. Mozilla mail autoconfiguration documents are
not consumed; DNS SRV/TXT, domain well-known, existing CalDAV subscriptions and
explicit endpoint setup are supported.

ATN application-version metadata is a separate restriction from Thunderbird's
version comparator. ATN rejected 0.2.0 because `153.6.0` is absent from its
[accepted-version registry](https://addons.thunderbird.net/en-US/thunderbird/pages/appversions/).
Version 0.2.1 uses registered bounds `153.0` and `159.*`; the 153.0 baseline is
also covered by the complete native acceptance harness. `npm run check:atn`
checks both bounds against the live registry. Submission-packet builds run this
check automatically; it is not a substitute for the hosted upload validator.
