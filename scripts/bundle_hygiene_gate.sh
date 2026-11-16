#!/usr/bin/env bash
# Production bundle hygiene gate.
#
# Scope: ONLY the built browser bundle ($ROOT/dist/assets/*.js).
#
# A repo-wide grep is deliberately NOT part of this gate: 06.05.1986 is the
# documented golden case of the calculation canon (docs/canon/PROTOCOL_CALCULATION_V1.md
# "Reference Golden Case", server acceptance/parity tests, DCS payload checks) and
# legitimately stays in the repository. What must never ship is the browser bundle
# containing QA-only copy or QA preset dates.
#
# Patterns are QA-only markers. Do not add generic product copy here: e.g. the plain
# string "Digital Code V2" also renders as the in-product tooltip of the V2 preview
# badge and is not by itself a leak marker.
#
# Fail-closed: exit 1 if the bundle is missing, empty, or contains any pattern.
#
# Usage: scripts/bundle_hygiene_gate.sh [repo-root]

set -uo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ASSET_DIR="$ROOT/dist/assets"

FORBIDDEN=(
  'QA Режим'
  'Контрольные даты'
  'Переключить на V1'
  'Переключить вертикальный срез'
  'V2 PREVIEW'
  '06.05.1986'
  '06.09.1991'
  '18.12.1989'
  '01.10.1990'
)

if [[ ! -d "$ASSET_DIR" ]]; then
  echo "bundle hygiene gate: FAIL — $ASSET_DIR not found (run the production build first)" >&2
  exit 1
fi

assets=""
for f in "$ASSET_DIR"/*.js; do
  [[ -f "$f" ]] || continue
  assets="$assets$f"$'\n'
done

if [[ -z "$assets" ]]; then
  echo "bundle hygiene gate: FAIL — no JS assets found in $ASSET_DIR" >&2
  exit 1
fi

echo "bundle hygiene gate — scanned assets:"
while IFS= read -r f; do
  [[ -n "$f" ]] || continue
  echo "  $(basename "$f") ($(wc -c <"$f" | tr -d ' ') bytes)"
done <<<"$assets"

echo "bundle hygiene gate — pattern scan:"
status=0
while IFS= read -r pattern; do
  [[ -n "$pattern" ]] || continue
  count=0
  while IFS= read -r f; do
    [[ -n "$f" ]] || continue
    n=$(grep -o -F -- "$pattern" "$f" 2>/dev/null | wc -l | tr -d ' ')
    count=$((count + n))
  done <<<"$assets"

  if [[ "$count" -eq 0 ]]; then
    verdict="ABSENT"
  else
    verdict="PRESENT"
    status=1
  fi
  echo "  [$verdict] $pattern — $count occurrence(s)"
done < <(printf '%s\n' "${FORBIDDEN[@]}")

if [[ "$status" -ne 0 ]]; then
  echo "bundle hygiene gate: FAIL — QA-only copy or QA preset dates are shipped in the browser bundle" >&2
  exit 1
fi

echo "bundle hygiene gate: PASS — no QA copy and no QA preset dates in the production browser bundle"
exit 0
