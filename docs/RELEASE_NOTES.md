CalScout 0.2.0 prepares the extension for Thunderbird Add-ons review.

- Supports Thunderbird 153.6 ESR through 159.x; complete Linux integration tests
  passed on 153.6.0 ESR and 159.0 with Radicale 3.9.0 and Stalwart 1.0.3.
- Both Stalwart assisted-discovery modes pass real group-sharing tests, automatic
  subscription and native read-only event sync.
- Adds a bundled privacy policy accessible from the management page.
- Includes an ATN submission packet with listing text, reviewer instructions,
  fixture screenshots, icon, exact source snapshot and checksums.

Download the `.xpi` asset and install through **Add-ons and Themes → gear →
Install Add-on From File**. Verify it using SHA256SUMS. The submission ZIP is a
maintainer packet; extract it before uploading its XPI to ATN.

This remains a development MVP. The Experiment grants full application access.
Windows/macOS and OAuth-provider-specific acceptance need wider testing.
ATN validation, submission and approval are pending. GitHub publication does not
submit to the store or provide an automatic update service.

Source license: MPL-2.0. Support development: https://ko-fi.com/thecuckoocamp
