# Submit CalScout 0.2.1 to Thunderbird Add-ons

This packet prepares a public listing; it does not mean the add-on is submitted
or approved. GitHub releases do not publish to ATN. There is no ATN credential in
this repository or bundle.

1. Sign in to https://addons.thunderbird.net/en-US/developers/ and start **Submit a
   New Add-on**. Choose distribution on the site. For an existing listing, upload
   a new version through that listing instead of creating a duplicate.
2. Extract this packet and upload **calscout-0.2.1.xpi** as the extension. Do not
   upload the submission ZIP or source ZIP in the extension field. Keep the ID
   `calscout@halcycon` unchanged. Run the site's validator and address errors;
   investigate warnings and explain Experiment-related findings to reviewers.
3. Use LISTING.md for the name, summary, description and metadata. Select Mozilla
   Public License 2.0. Upload icon128.png and the two screenshots with their
   captions. Only Linux x86_64 has been tested; list broader platform support only
   after testing it. The manifest permits Thunderbird 153.0 through 159.*.
4. Paste **all of privacy.txt** into the site's privacy-policy field. Do not paste
   only a URL. Include the description's privacy summary too.
5. Copy REVIEWER_NOTES.md into the private reviewer-notes/testing-information
   field. Explain the privileged Experiment and its missing built-in APIs.
   The notes include reproducible local fixtures and disposable test credentials;
   no persistent hosted account is included. If reviewers need a hosted account,
   arrange one privately before treating their testing requirements as fulfilled.
6. The XPI contains readable, original, untransformed source. If the wizard asks
   for a separate source archive, provide calscout-0.2.1-source.zip. It contains
   package-lock.json, fixtures, build scripts and instructions. SOURCE_COMMIT.txt
   identifies the exact source revision. Build with Node 22+ and Python 3.10+:
   `npm ci && npm run build`. No server fixture is needed to reproduce the XPI.
7. Review the listing preview and declarations. The account holder must read and
   accept the developer agreement and any legal attestations shown by the site.
   Submit for review and retain its URL/status. An Experiment requires manual
   review; upload completion alone is not approval. Respond promptly to reviewer
   questions and provide corrected versions when requested.
8. After approval, add the real ATN listing URL to the README and release notes.
   Confirm installation and updating from the listing before promising store
   updates to existing GitHub installations.

Verify this packet from its extracted directory with `sha256sum --check SHA256SUMS`.
For local maintainers, commit all files and run `npm run build:submission` to
produce an XPI, source snapshot and this packet under dist/. CI and tagged GitHub
releases publish the same materials; neither submits them to ATN automatically.

Policy checked 7 November 2026:
https://thunderbird.github.io/atn-review-policy/
https://webextension-api.thunderbird.net/en/mv3/guides/sourceCodeSubmission.html
