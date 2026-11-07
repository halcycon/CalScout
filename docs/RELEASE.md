# Builds and releases

The public source repository is https://github.com/halcycon/CalScout. CalScout's
source is MPL-2.0; separate repository-template notices remain in
THIRD_PARTY_NOTICES.md. No npm libraries or fixture servers ship in the extension.

## Development builds

The **Check and package** workflow runs on branch pushes, pull requests and manual
workflow dispatch. It runs JavaScript/Python checks and tests, builds the XPI,
verifies reproducibility, and uploads the `calscout-xpi` artifact for 30 days. It then downloads the artifact
and verifies its checksum again. GitHub Actions dependencies are pinned to
reviewed release commits using the current Node 24 action runtime.
Extract its `calscout-<version>.xpi` and `SHA256SUMS`. The artifact name is fixed;
the filename and manifest carry the source version, not a separate CI version.

To build locally: `npm ci && npm run check && npm test && npm run build`.
Python 3.10+ and Node 22+ are required. Verify a download from its directory with
`sha256sum --check SHA256SUMS`. The ZIP root contains manifest.json, local runtime
source/assets, the MPL license and third-party notices.

## Publish a release

1. Update `src/manifest.json`, `package.json` and the lockfile to the same numeric
   three-part version. Keep the extension ID stable. Update docs/RELEASE_NOTES.md.
2. Run the unit/package checks and native acceptance commands in TESTING.md.
   Stalwart must pass with assisted discovery enabled and disabled. Update
   compatibility evidence before claiming another Thunderbird major version.
3. Commit and push to main; confirm **Check and package** is green.
4. Create and push the matching version tag, for example:

   ```sh
   git tag -a v0.2.0 -m 'CalScout 0.2.0'
   git push origin v0.2.0
   ```

The **Publish extension** workflow calls the same check/build workflow. Packaging
rejects a tag/version mismatch or missing license/notices. Only its publish job
has `contents: write`; builds use read-only permissions. Publication verifies the
downloaded checksum, prepares a draft, uploads the XPI/checksum, and publishes it.
A retry can finish an existing draft, but refuses to overwrite a published release.
Versions below 1.0 are published as prereleases. Versions 1.0+ are marked latest.

The workflow does not submit to addons.thunderbird.net, sign with Mozilla, create
an update feed, or read private credentials beyond GitHub's scoped workflow token.
Tag publication is the explicit release trigger; ordinary CI builds do not publish.

## Installation and distribution

Thunderbird 156.0 accepted this unsigned XPI through normal installation without
signing bypass preferences. Install from **Add-ons and Themes → gear → Install
Add-on From File**. Firefox signing policy must not be applied by analogy.

Public listing on addons.thunderbird.net requires review. The Experiment needs a
justification because it grants full application access and uses internal APIs.
See the [Thunderbird review policy](https://thunderbird.github.io/atn-review-policy/)
and [reviewer guide](https://addons-reviewer-guide.thunderbird.net/add-on-review-guide).
GitHub publication does not imply ATN review or endorsement.

The extension is a development MVP. Linux integration is covered; Windows/macOS,
OAuth-provider variations, native prompt cancellation and enterprise authentication
need broader acceptance testing before a general release.
