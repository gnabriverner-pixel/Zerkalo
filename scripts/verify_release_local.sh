#!/usr/bin/env bash
# Local reproducible release verification for the Zerkalo Web repo.
# Runs the same checks as Product Release CI, against an explicitly sourced
# DCS checkout — never against whatever happens to listen on 127.0.0.1:39500.
#
# Usage:
#   scripts/verify_release_local.sh [--dcs-root /path/to/digital-code-system] [--skip-build]
#
# Exit code 0 = all checks passed; non-zero = fail-closed.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DCS_ROOT_ARG=""
SKIP_BUILD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dcs-root) DCS_ROOT_ARG="$2"; shift 2 ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

log()  { printf '\n\033[1;34m[verify]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[verify] FAIL:\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- DCS source
# Priority: --dcs-root flag > DCS_ROOT env > canonical sibling checkout.
DCS_ROOT="${DCS_ROOT_ARG:-${DCS_ROOT:-}}"
if [[ -z "$DCS_ROOT" ]]; then
  for candidate in "$REPO_ROOT/../digital-code-system" "$HOME/code/digital-code-system"; do
    if [[ -d "$candidate/.git" ]]; then DCS_ROOT="$(cd "$candidate" && pwd)"; break; fi
  done
fi
[[ -n "$DCS_ROOT" && -d "$DCS_ROOT/.git" ]] || fail "canonical DCS_ROOT not found. Pass --dcs-root /path/to/digital-code-system"

log "DCS provenance"
echo "  DCS_ROOT: $DCS_ROOT"
echo "  DCS remote: $(git -C "$DCS_ROOT" remote get-url origin 2>/dev/null || echo 'unknown')"
echo "  DCS HEAD:   $(git -C "$DCS_ROOT" rev-parse HEAD)"
echo "  DCS branch: $(git -C "$DCS_ROOT" rev-parse --abbrev-ref HEAD)"
if [[ -n "$(git -C "$DCS_ROOT" status --porcelain 2>/dev/null | head -1)" ]]; then
  echo "  DCS status: DIRTY (verification runs against dirty working tree — treat results with care)"
else
  echo "  DCS status: clean"
fi

# ---------------------------------------------------------------- bridge guard
# Default: HTTP bridge disabled via a dead loopback address so a stale local
# service cannot intercept the check. The script never kills processes.
export DCS_BRIDGE_URL="http://127.0.0.1:9"
if lsof -nP -iTCP:39500 -sTCP:LISTEN >/dev/null 2>&1; then
  log "WARNING: port 39500 is occupied:"
  lsof -nP -iTCP:39500 -sTCP:LISTEN || true
  echo "  This script bypasses it (DCS_BRIDGE_URL=http://127.0.0.1:9), but the"
  echo "  stale listener should be identified and stopped by a human."
  echo "  Identify it with: lsof -nP -iTCP:39500 -sTCP:LISTEN  (cwd of the PID)"
else
  log "Port 39500 is free — no local bridge interception possible"
fi

# ---------------------------------------------------------------- exact python
PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  for candidate in "$DCS_ROOT/.venv/bin/python" "$(command -v python3.12 || true)" "$(command -v python3 || true)"; do
    if [[ -n "$candidate" && -x "$candidate" ]]; then PYTHON_BIN="$candidate"; break; fi
  done
fi
[[ -n "$PYTHON_BIN" && -x "$PYTHON_BIN" ]] || fail "no usable Python found (need 3.12 with DCS deps)"
log "Python: $PYTHON_BIN ($("$PYTHON_BIN" -V 2>&1))"
"$PYTHON_BIN" -c 'import sys; raise SystemExit(0 if sys.version_info[:2]==(3,12) else 1)' || \
  fail "Python 3.12 required (found $("$PYTHON_BIN" -V 2>&1))"
if ! "$PYTHON_BIN" -c 'import pytest' >/dev/null 2>&1; then
  fail "DCS dependencies missing in $PYTHON_BIN (pytest not importable). Install: $PYTHON_BIN -m pip install -r $DCS_ROOT/requirements.txt"
fi

# Canonical verification runtime must match CI (Node major 24).
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$NODE_MAJOR" != "24" ]]; then
  fail "Node 24 is the canonical verification runtime (found v$NODE_MAJOR). Prepend: PATH=\"\$(brew --prefix node@24)/bin:\$PATH\""
fi

export DCS_ROOT
export PYTHON_BIN

cd "$REPO_ROOT"

# ---------------------------------------------------------------- web checks
[[ -d node_modules ]] || { log "Installing exact web dependencies"; npm ci; }

log "1/5 Typecheck"
npm run lint

log "2/5 Full test suite (incl. DCS-paired acceptance tests)"
npm test

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  log "3/5 Production build"
  npm run build

  log "3b/5 Production bundle hygiene gate"
  bash "$REPO_ROOT/scripts/bundle_hygiene_gate.sh" "$REPO_ROOT"

  log "4/5 Immutable artifact packaging + boot-check"
  node scripts/package_release.cjs

  log "5/5 Release identity"
  EXPECTED_SHA="$(git rev-parse HEAD)"
  node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync("dist/release.json","utf8"));if(p.release_sha!==process.env.EXPECTED_SHA||p.dirty!==false){console.error(p);process.exit(1)}' \
    || fail "release.json identity mismatch (expected $EXPECTED_SHA, dirty must be false)"
  echo "  release.json sha == HEAD ($EXPECTED_SHA), dirty=false"
else
  log "3-5/5 skipped (--skip-build)"
fi

log "ALL CHECKS PASSED (Web @ $(git rev-parse HEAD) + DCS @ $(git -C "$DCS_ROOT" rev-parse HEAD))"
