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
Build: Python 3 (stdlib). Unit tests: Node 22+. Integration: Python test venv with
Radicale 3.9.0, Thunderbird 156, Marionette chrome access in a disposable profile.

Distribution: this XPI is an unsigned development build. Experiments carry full
application privileges and require Thunderbird add-on review for distribution.
Do not infer Firefox signing requirements apply to Thunderbird. Test normal
installation and review the current [Thunderbird add-on distribution guidance](https://developer.thunderbird.net/add-ons/mailextensions/distribution)
before publishing; no review or signing submission has been performed.
