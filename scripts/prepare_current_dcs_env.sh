#!/usr/bin/env bash
set -euo pipefail
ROOT="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="${PYTHON_BIN:?Python 3.12 required}"
"$PYTHON" -c 'import sys; assert sys.version_info[:2] == (3,12), sys.version'
test -f "$ROOT/requirements.txt"
test -f "$ROOT/.github/workflows/product-release-ci.yml"
# Current de78 CI installs requirements.txt; no donor venv or old DCS script.
"$PYTHON" -m venv "$ROOT/.venv"
"$ROOT/.venv/bin/python" -m pip install -r "$ROOT/requirements.txt" -c "$SCRIPT_DIR/dcs-de78-test-runtime.lock"
"$ROOT/.venv/bin/python" -m pip freeze > "$ROOT/.venv/installed-dependencies.txt"
