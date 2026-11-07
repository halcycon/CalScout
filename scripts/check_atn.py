# SPDX-License-Identifier: MPL-2.0
"""Check manifest compatibility values against ATN's published application versions."""

import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import urlopen

URL = "https://addons.thunderbird.net/en-US/thunderbird/pages/appversions/"
GUID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}"


class CodeParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.codes = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        if tag == "code":
            self.current = []

    def handle_data(self, data):
        if self.current is not None:
            self.current.append(data)

    def handle_endtag(self, tag):
        if tag == "code" and self.current is not None:
            self.codes.append("".join(self.current).strip())
            self.current = None


def accepted_versions(html):
    parser = CodeParser()
    parser.feed(html)
    try:
        values = parser.codes[parser.codes.index(GUID) + 1]
    except (ValueError, IndexError) as error:
        raise ValueError("Cannot locate Thunderbird's ATN application-version list") from error
    versions = {value.strip() for value in values.split(",")}
    if "*" not in versions or "153.0" not in versions:
        raise ValueError("Unexpected ATN application-version page; inspect its format")
    return versions


def validate(manifest, versions):
    gecko = manifest["browser_specific_settings"]["gecko"]
    for key in ("strict_min_version", "strict_max_version"):
        value = gecko[key]
        if value not in versions or (key == "strict_min_version" and "*" in value):
            raise ValueError(f"ATN does not accept {key}={value!r}; see {URL}")


def check():
    manifest = json.loads((Path(__file__).resolve().parents[1] / "src/manifest.json").read_text())
    with urlopen(URL, timeout=30) as response:
        versions = accepted_versions(response.read(2_000_000).decode("utf-8"))
    validate(manifest, versions)
    gecko = manifest["browser_specific_settings"]["gecko"]
    print(
        f"ATN application versions accepted: {gecko['strict_min_version']} – {gecko['strict_max_version']}"
    )


if __name__ == "__main__":
    check()
