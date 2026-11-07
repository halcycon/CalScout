#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-check}" == correct ]]; then
    npm run format
    npm exec eslint -- . --fix
    ruff check --fix scripts tests
    ruff format scripts tests
fi
npm run check
ruff check scripts tests
ruff format --check scripts tests
