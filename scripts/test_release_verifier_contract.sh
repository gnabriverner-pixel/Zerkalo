#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

TMP_BASE=$(mktemp /tmp/vitest.contract.XXXXXX)
TMP_CFG="${TMP_BASE}.ts"
mv "$TMP_BASE" "$TMP_CFG"
trap 'rm -f "$TMP_CFG"' EXIT

cat << 'EOF' > "$TMP_CFG"
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/release_verifier_contract.test.ts'],
    environment: 'node',
  },
});
EOF

NODE_PATH="$REPO_ROOT/node_modules" npx vitest run tests/release_verifier_contract.test.ts --config "$TMP_CFG"
