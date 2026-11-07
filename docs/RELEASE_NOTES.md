CalScout's first development release for **Thunderbird 156.x**.

- Discover personal, group and shared CalDAV calendars without repeating account setup.
- Subscribe through Thunderbird's native CalDAV provider.
- Periodic rediscovery, first-run approval and optional automatic subscription.
- Persistent ignore/unsubscribe decisions and safe handling of revoked access.
- Tested against Thunderbird 156, Stalwart 1.0.3 (both assisted-discovery modes)
  and Radicale 3.9.0, including a later Bob → Team → Alice share.

Download the `.xpi` asset and install it through **Add-ons and Themes → gear →
Install Add-on From File**. `SHA256SUMS` contains the download checksum.

This is a development MVP. The Experiment grants full application access;
Windows/macOS and OAuth-provider-specific acceptance need wider testing.
There is no ATN listing or automatic update service. Review the README and
security model before trying it in your everyday profile.

Source license: MPL-2.0. Support development: https://ko-fi.com/thecuckoocamp
