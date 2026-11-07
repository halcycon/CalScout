# SPDX-License-Identifier: MPL-2.0
"""Build a reproducible XPI and checksum; reject inconsistent release metadata."""

import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def build(root=ROOT, tag=None):
    manifest = json.loads((root / "src/manifest.json").read_text())
    package = json.loads((root / "package.json").read_text())
    version = manifest["version"]
    if not re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", version):
        raise ValueError("Manifest version must be a three-part numeric release version")
    if package["version"] != version:
        raise ValueError("package.json and manifest.json versions must match")
    if tag is not None and tag != f"v{version}":
        raise ValueError(f"Release tag must be v{version}, got {tag}")

    files = [
        (path, path.relative_to(root / "src").as_posix())
        for path in sorted((root / "src").rglob("*"))
        if path.is_file()
    ]
    for name in ("LICENSE", "THIRD_PARTY_NOTICES.md"):
        path = root / name
        if not path.is_file():
            raise ValueError(f"Required distribution notice is missing: {name}")
        files.append((path, name))

    output = root / "dist" / f"calscout-{version}.xpi"
    output.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for path, name in files:
            info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    (output.parent / "SHA256SUMS").write_text(f"{digest}  {output.name}\n")
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", help="Require this Git tag to match the manifest version")
    args = parser.parse_args()
    try:
        print(build(tag=args.tag))
    except (ValueError, OSError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
