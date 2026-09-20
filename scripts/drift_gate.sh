#!/usr/bin/env bash
# Minimal Deterministic Drift Gate — Zerkalo (Web)
# Verifies zero occurrences of prohibited legacy paths and fail-closed DCS_ROOT resolution.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "========================================================"
echo " [Web Drift Gate] Checking Canonical Engineering Truth"
echo " Repo: $REPO_ROOT"
echo "========================================================"

DRIFT_FOUND=0

# 1. Prohibited Legacy Path Patterns
PROHIBITED_PATTERNS=(
  "digital-code-product-journey"
  "Documents/New project"
  "Hermes_agent/zerkalo-lab"
  "digital-code-canonical-v3-owner-only"
)

echo "-> 1. Scanning tracked source files for prohibited path patterns..."

# Filter tracked files: scan source/config/tests/scripts, excluding historical registries in docs/, setup guard, and the drift gate itself
TRACKED_SOURCE_FILES=$(git ls-files | grep -v -E '^(docs/CANONICAL_ENGINEERING_TRUTH\.md|docs/ENGINEERING_DRIFT_REGISTRY\.md|archive/|docs/archive/|tests/setup\.ts|scripts/drift_gate\.sh|tests/drift_gate\.test\.ts)')

for pattern in "${PROHIBITED_PATTERNS[@]}"; do
  matches=$(echo "$TRACKED_SOURCE_FILES" | xargs grep -n -F "$pattern" 2>/dev/null || true)
  if [[ -n "$matches" ]]; then
    echo "ERROR: Prohibited drift pattern detected: '$pattern'"
    echo "$matches"
    DRIFT_FOUND=1
  fi
done

if [[ "$DRIFT_FOUND" -eq 0 ]]; then
  echo "   [OK] Zero prohibited paths found in tracked source files."
fi

# 2. Fail-Closed Check on server/dcsBridge.ts
echo "-> 2. Verifying fail-closed DCS_ROOT resolution in server/dcsBridge.ts..."

if [[ ! -f "server/dcsBridge.ts" ]]; then
  echo "ERROR: server/dcsBridge.ts not found!"
  DRIFT_FOUND=1
else
  if grep -q "digital-code-product-journey" "server/dcsBridge.ts"; then
    echo "ERROR: server/dcsBridge.ts contains reference to legacy clone 'digital-code-product-journey'!"
    DRIFT_FOUND=1
  fi

  if grep -q "Documents/New project" "server/dcsBridge.ts"; then
    echo "ERROR: server/dcsBridge.ts contains reference to 'Documents/New project'!"
    DRIFT_FOUND=1
  fi

  if ! grep -q "digital-code-system" "server/dcsBridge.ts"; then
    echo "ERROR: server/dcsBridge.ts does not resolve canonical sibling 'digital-code-system'!"
    DRIFT_FOUND=1
  fi

  if ! grep -q "throw new Error" "server/dcsBridge.ts"; then
    echo "ERROR: server/dcsBridge.ts does not throw on missing DCS root (fail-closed check missing)!"
    DRIFT_FOUND=1
  fi
fi

if [[ "$DRIFT_FOUND" -eq 0 ]]; then
  echo "   [OK] server/dcsBridge.ts adheres to fail-closed canonical contract."
fi

# 3. Native Vitest Gate Test
echo "-> 3. Running native Vitest test suite for drift gate..."
TMP_BASE=$(mktemp /tmp/vitest.drift.XXXXXX)
TMP_CFG="${TMP_BASE}.ts"
mv "$TMP_BASE" "$TMP_CFG"
trap 'rm -f "$TMP_CFG"' EXIT

cat << 'EOF' > "$TMP_CFG"
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/drift_gate.test.ts'],
    environment: 'node',
  },
});
EOF

if NODE_PATH="$REPO_ROOT/node_modules" npx vitest run tests/drift_gate.test.ts --config "$TMP_CFG"; then
  echo "   [OK] tests/drift_gate.test.ts passed."
else
  echo "ERROR: tests/drift_gate.test.ts failed!"
  DRIFT_FOUND=1
fi

echo "========================================================"
if [[ "$DRIFT_FOUND" -ne 0 ]]; then
  echo " FAIL: Minimal Drift Gate found violations. See errors above."
  exit 1
else
  echo " PASS: Minimal Drift Gate verified. All checks passed cleanly."
  exit 0
fi
