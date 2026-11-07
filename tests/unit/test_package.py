# SPDX-License-Identifier: MPL-2.0
"""Release invariants tested against a disposable source tree."""

import hashlib
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from package import build  # noqa: E402


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="calscout-package-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        (self.root / "src").mkdir()
        (self.root / "src/manifest.json").write_text(json.dumps({"version": "0.1.0"}))
        (self.root / "package.json").write_text(json.dumps({"version": "0.1.0"}))
        (self.root / "LICENSE").write_text("Fixture license")
        (self.root / "THIRD_PARTY_NOTICES.md").write_text("Fixture notice")

    def test_reproducible_installable_archive_and_checksum(self):
        output = build(self.root, "v0.1.0")
        first = output.read_bytes()
        (self.root / "src/manifest.json").touch()
        self.assertEqual(build(self.root).read_bytes(), first)
        with zipfile.ZipFile(output) as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(
                set(archive.namelist()), {"manifest.json", "LICENSE", "THIRD_PARTY_NOTICES.md"}
            )
            self.assertEqual(json.loads(archive.read("manifest.json"))["version"], "0.1.0")
        self.assertEqual(
            (output.parent / "SHA256SUMS").read_text(),
            f"{hashlib.sha256(first).hexdigest()}  {output.name}\n",
        )

    def test_release_tag_must_match_manifest(self):
        with self.assertRaisesRegex(ValueError, "Release tag must be v0.1.0"):
            build(self.root, "v0.2.0")
        self.assertFalse((self.root / "dist").exists())

    def test_package_version_must_match_manifest(self):
        (self.root / "package.json").write_text(json.dumps({"version": "0.2.0"}))
        with self.assertRaisesRegex(ValueError, "versions must match"):
            build(self.root)

    def test_distribution_requires_license_and_notices(self):
        for name in ["LICENSE", "THIRD_PARTY_NOTICES.md"]:
            with self.subTest(name=name):
                path = self.root / name
                original = path.read_bytes()
                path.unlink()
                with self.assertRaisesRegex(ValueError, "Required distribution notice"):
                    build(self.root)
                path.write_bytes(original)


if __name__ == "__main__":
    unittest.main()
