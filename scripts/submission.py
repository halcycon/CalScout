# SPDX-License-Identifier: MPL-2.0
"""Package a committed source snapshot and ATN submission materials alongside the XPI."""

import hashlib
import subprocess
import zipfile

from package import ROOT, build


def git(*args):
    return subprocess.check_output(["git", "-C", str(ROOT), *args])


def main():
    if git("status", "--porcelain").strip():
        raise SystemExit("Commit all source/material changes before building a submission snapshot")
    xpi = build()
    source = xpi.with_name(xpi.stem + "-source.zip")
    source.write_bytes(git("archive", "--format=zip", "HEAD"))
    files = {
        xpi.name: xpi.read_bytes(),
        source.name: source.read_bytes(),
        "privacy.txt": (ROOT / "src/ui/privacy.txt").read_bytes(),
        "SOURCE_COMMIT.txt": git("rev-parse", "HEAD"),
    }
    for path in sorted((ROOT / "docs/atn").rglob("*")):
        if path.is_file():
            files[path.relative_to(ROOT / "docs/atn").as_posix()] = path.read_bytes()
    files["SHA256SUMS"] = "".join(
        f"{hashlib.sha256(data).hexdigest()}  {name}\n" for name, data in sorted(files.items())
    ).encode()
    output = xpi.with_name(xpi.stem + "-atn-submission.zip")
    with zipfile.ZipFile(output, "w") as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    (xpi.parent / "ATN_SHA256SUMS").write_text(
        "".join(
            f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n"
            for path in (output, source)
        )
    )
    print(output)


if __name__ == "__main__":
    main()
