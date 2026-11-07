#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-check}" == correct ]]; then
    npm run format
    npm exec eslint -- . --fix
    ruff check --fix scripts tests/integration
    ruff format scripts tests/integration
fi
npm run check
ruff check scripts tests/integration
ruff format --check scripts tests/integration
