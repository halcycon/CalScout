CalScout 0.2.1 fixes the Thunderbird Add-ons upload blocker in 0.2.0.

- Changes the minimum Thunderbird version from 153.6.0 to ATN's registered 153.0;
  retains the tested maximum of 159.* and the existing extension ID.
- Verifies the 153.0 baseline with the native Radicale and Stalwart harnesses.
- Checks both compatibility bounds against ATN's live registry when creating a
  submission packet. Adds regression tests for unregistered compatibility values.
- Explains Firefox-specific account API warnings in the reviewer notes.

Download `calscout-0.2.1.xpi` and select it again in ATN's upload form. Its privacy
policy, listing text, icon and screenshots are included in the submission packet.
Verify the XPI with SHA256SUMS and packet/source ZIPs with ATN_SHA256SUMS.

This remains a development MVP with a privileged Experiment granting full
application access. Linux acceptance covers Thunderbird 153.0, 153.6 ESR and 159.0;
Windows/macOS and OAuth-provider variations need wider testing. ATN hosted
validation, submission and review remain pending; the live version-registry check
does not constitute store approval.

Source license: MPL-2.0. Support development: https://ko-fi.com/thecuckoocamp
