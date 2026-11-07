# Compatibility

Tested: Thunderbird **156.0**, Linux x86_64, build **20260910221217**.
Downloaded from Mozilla's release archive, archive SHA-256:
`cfa82799a50f60ac3e870baf11873373a04abb88a75a36dad43b9d5c1efacf01`.

Target binary: https://ftp.mozilla.org/pub/thunderbird/releases/156.0/linux-x86_64/en-US/thunderbird-156.0.tar.xz

The manifest deliberately limits compatibility to 156.* until later versions are
tested. MV2 and privileged parent Experiments were loaded successfully. Internal
calendar modules are not a stable public extension API; any API break must be
reported and leave existing subscriptions alone.

Dependencies: `calUtils.sys.mjs`, `cal.manager.createCalendar/registerCalendar`,
`calICalendar` properties, native `caldav` provider. No external runtime libraries.
Build: Python 3 (stdlib). Unit tests: Node 22+ with test-only @xmldom/xmldom 0.9.12. Integration: Python test venv with
Radicale 3.9.0, Thunderbird 156, Marionette chrome access in a disposable profile.

Distribution: normal unsigned XPI installation and restart persistence were verified
on the target release, without changing signing preferences. The XPI is a development
build with full application privileges; no public review or publication was performed.
ATN listing requires its own review, including the Experiment justification. See
[release procedure](docs/RELEASE.md) and the [Thunderbird review policy](https://thunderbird.github.io/atn-review-policy/).

Live server compatibility: Radicale 3.9.0 and Stalwart 1.0.3. Stalwart assisted
discovery enabled/disabled both pass authenticated group-share discovery, later
share automation, native read-only event sync and non-destructive revocation.
Cross-origin authenticated redirects are deliberately blocked; configure the
actual secure CalDAV origin separately if a provider needs one. Mozilla mail
autoconfiguration documents are not consumed; DNS SRV/TXT, domain well-known,
existing CalDAV subscriptions and explicit endpoint setup are supported.
