# SPDX-License-Identifier: MPL-2.0
"""Catch ATN rejecting valid Thunderbird releases absent from its version registry."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from check_atn import GUID, accepted_versions, validate  # noqa: E402


class AtnTests(unittest.TestCase):
    def setUp(self):
        self.versions = accepted_versions(
            f"<code>other-application</code><code>153.6.0</code>"
            f"<code>{GUID}</code><code>153.0, 153.*, 159.0, 159.*, *</code>"
        )

    def manifest(self, minimum="153.0", maximum="159.*"):
        return {
            "browser_specific_settings": {
                "gecko": {
                    "strict_min_version": minimum,
                    "strict_max_version": maximum,
                }
            }
        }

    def test_accepted_range(self):
        validate(self.manifest(), self.versions)

    def test_unregistered_point_release_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "strict_min_version='153.6.0'"):
            validate(self.manifest(minimum="153.6.0"), self.versions)

    def test_unknown_maximum_and_wildcard_minimum_are_rejected(self):
        for manifest in (self.manifest(maximum="160.*"), self.manifest(minimum="153.*")):
            with self.subTest(manifest=manifest), self.assertRaises(ValueError):
                validate(manifest, self.versions)

    def test_missing_thunderbird_list_does_not_pass(self):
        with self.assertRaisesRegex(ValueError, "Cannot locate Thunderbird"):
            accepted_versions("<code>153.0, 159.*, *</code>")


if __name__ == "__main__":
    unittest.main()
