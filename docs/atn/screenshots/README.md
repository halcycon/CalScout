# Screenshot provenance

Captured from CalScout's actual UI in Thunderbird 159.0 on Linux, using the
isolated Stalwart 1.0.3 fixture. All names, server addresses and calendars are
local demonstration data. No production accounts or credentials are shown.

Regenerate after `npm run build`:

```sh
CALSCOUT_SCREENSHOT_DIR="$PWD/docs/atn/screenshots" \
STALWART_BIN=/absolute/path/to/stalwart \
THUNDERBIRD_BIN=/absolute/path/to/thunderbird \
  python3 tests/integration/stalwart.py
```

The harness uses the native Marionette screenshot command. calendars.png captures
the complete management page; preferences.png shows the preference controls.
icon128.png in the parent directory is rendered from src/ui/icon.svg.
