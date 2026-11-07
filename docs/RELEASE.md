# Development release procedure

1. Run `npm ci`, `npm run check`, `npm test`, and `npm run build`.
2. Run the real Thunderbird/Radicale and Thunderbird/Stalwart acceptance commands
   in TESTING.md. Stalwart must pass with assisted discovery enabled and disabled.
3. Verify the package installs normally in a clean Thunderbird 156 profile,
   survives restart and preserves native sync when disabled.
4. Build twice and compare SHA-256 digests. Package contents must include the
   manifest, local runtime source/assets, MPL license and third-party notices.
5. Update compatibility and test evidence before claiming support for another
   Thunderbird major version. No update URL or automatic release publisher is set.

Thunderbird 156.0 accepted this unsigned XPI through the normal AddonManager
installation path, without signing bypass preferences. Firefox signing policy
must not be applied by analogy. Public listing on addons.thunderbird.net requires
review; an Experiment needs a justification because it grants full application
access and uses internal APIs. See the [Thunderbird review policy](https://thunderbird.github.io/atn-review-policy/)
and [reviewer guide](https://addons-reviewer-guide.thunderbird.net/add-on-review-guide).
No public listing, signing request, review submission or publication is performed
by the build or test scripts.

The release artifact is currently a development MVP. Linux x86_64 integration is
covered; Windows/macOS, OAuth-provider variations, native prompt cancellation and
enterprise authentication need broader acceptance testing before a general release.
