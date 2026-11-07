"""Build a reproducible, dependency-free XPI from the source tree."""
from pathlib import Path
import json
import zipfile
root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'src/manifest.json').read_text())['version']
output = root / 'dist' / f'calscout-{version}.xpi'
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted((root / 'src').rglob('*')):
        if path.is_file():
            info = zipfile.ZipInfo(path.relative_to(root / 'src').as_posix(), (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())
    for name in ('LICENSE', 'THIRD_PARTY_NOTICES.md'):
        if (root / name).exists():
            info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, (root / name).read_bytes())
print(output)
