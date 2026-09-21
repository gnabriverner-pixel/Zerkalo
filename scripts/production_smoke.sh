#!/usr/bin/env bash
# Production-safe synthetic smoke for the deployed Zerkalo Web pair.
#
# ┌───────────────────────────────────────────────────────────────────────────┐
# │  DO NOT USE REAL USER DOB — EVER.                                         │
# │  This smoke may only ever send the synthetic fixture declared below       │
# │  (SYNTHETIC_SMOKE_DOB). Never the owner's DOB, never any real user's      │
# │  DOB, never personal data taken from production.                          │
# └───────────────────────────────────────────────────────────────────────────┘
#
# SYNTHETIC_SMOKE_DOB=01.07.1990 is a documented synthetic fixture whose
# required properties are enforced by server/production_smoke_fixture.test.ts:
#   - adult: born 1990, 18+ with a wide margin;
#   - valid DD.MM.YYYY, day <= 28 -> no month-length edge;
#   - not Feb 29 and not a year boundary (January/December) -> no
#     calendar-cycle or leap-day edge;
#   - not the calculation canon golden case, tied to no real person;
#   - no test anywhere pins expected numeric results for it.
#
# The smoke checks STRUCTURAL INVARIANTS ONLY: HTTP success, status, canonical
# authority, expected schema/positions, absence of server errors. It never
# asserts psychological or numerological content for any specific person.
#
# It never sends Telegram messages, never creates payments and never calls
# delete-data endpoints.
#
# Usage:
#   scripts/production_smoke.sh [--base-url https://zerkalosebya.ru] [--skip-code-v2]
#
# Environment overrides: SMOKE_BASE_URL.
# Exit code 0 = PASS; any structural violation -> exit 1 (fail-closed).

set -uo pipefail

BASE_URL="${SMOKE_BASE_URL:-https://zerkalosebya.ru}"
SKIP_CODE_V2=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url) BASE_URL="$2"; shift 2 ;;
    --skip-code-v2) SKIP_CODE_V2=1; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
BASE_URL="${BASE_URL%/}"

# ---------------------------------------------------------------------------
# Synthetic fixture — the ONLY date of birth this smoke is allowed to send.
# DO NOT REPLACE IT WITH A REAL PERSON'S DATE OF BIRTH.
# ---------------------------------------------------------------------------
readonly SYNTHETIC_SMOKE_DOB="01.07.1990"

readonly CANONICAL_AUTHORITY="digital-code-system/engine.py::full_analysis"
readonly FIVE_POSITIONS=('soul' 'expression' 'path' 'direction' 'result')

SMOKE_FAIL=0
WORK="$(mktemp -d "${TMPDIR:-/tmp}/zerkalo-production-smoke.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

fail() { echo "  [FAIL] $*" >&2; SMOKE_FAIL=1; }
ok()   { echo "  [OK] $*"; }

# http <method> <path> <out-file> [extra curl args...] -> echoes HTTP code
http() {
  local method="$1" url_path="$2" out="$3"; shift 3
  curl -sS --max-time 30 -X "$method" -o "$out" -w '%{http_code}' "$@" "$BASE_URL$url_path"
}

# assert_json <file> <node-predicate-on-d> <label>
assert_json() {
  local file="$1" predicate="$2" label="$3"
  if node -e '
    const fs = require("fs");
    let d;
    try { d = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); }
    catch { console.error("not valid JSON"); process.exit(1); }
    const ok = ('"$predicate"');
    process.exit(ok ? 0 : 1);
  ' "$file" 2>/dev/null; then
    ok "$label"
  else
    fail "$label (response in $file)"
  fi
}

echo "=== Zerkalo production smoke (synthetic fixture $SYNTHETIC_SMOKE_DOB) ==="
echo "Base URL: $BASE_URL"

# 1. Public health — service is up and reports a release identity.
echo "[1/4] GET /health"
code="$(http GET /health "$WORK/health.json")" || fail "GET /health request failed"
[[ "$code" == "200" ]] || fail "GET /health returned HTTP $code (expected 200)"
assert_json "$WORK/health.json" \
  'd.status === "ok" && typeof d.release_sha === "string" && d.release_sha.length >= 7' \
  "/health: status ok and release identity present"

# 2. Consent — safe synthetic session (no personal data in the consent payload).
echo "[2/4] Synthetic consent session"
code="$(http GET /api/consent "$WORK/consent_get.json")" || fail "GET /api/consent request failed"
[[ "$code" == "200" ]] || fail "GET /api/consent returned HTTP $code (expected 200)"
CONSENT_VERSION="$(node -e '
  const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  if (typeof d.version !== "string" || !d.version) process.exit(1);
  process.stdout.write(d.version);
' "$WORK/consent_get.json" 2>/dev/null)" || fail "GET /api/consent: version missing"
[[ -n "${CONSENT_VERSION:-}" ]] && ok "consent version: $CONSENT_VERSION"

code="$(http POST /api/consent "$WORK/consent_post.json" \
  --header "Content-Type: application/json" \
  --header "Origin: $BASE_URL" \
  --cookie-jar "$WORK/cookies.txt" \
  --data "{\"accepted\":true,\"adult\":true,\"version\":\"$CONSENT_VERSION\",\"scope\":\"core\"}")" \
  || fail "POST /api/consent request failed"
[[ "$code" == "200" ]] || fail "POST /api/consent returned HTTP $code (expected 200)"
grep -q "zerkalo_consent" "$WORK/cookies.txt" 2>/dev/null \
  && ok "synthetic consent cookie issued" \
  || fail "consent cookie missing after POST /api/consent"

# 3. Canonical calculation — structural invariants only.
echo "[3/4] POST /api/calculate (synthetic fixture only)"
code="$(http POST /api/calculate "$WORK/calculate.json" \
  --header "Content-Type: application/json" \
  --cookie "$WORK/cookies.txt" \
  --data "{\"dob\":\"$SYNTHETIC_SMOKE_DOB\"}")" || fail "POST /api/calculate request failed"
[[ "$code" == "200" ]] || fail "POST /api/calculate returned HTTP $code (expected 200)"
assert_json "$WORK/calculate.json" 'd.status === "ok"' "/api/calculate: status ok"
assert_json "$WORK/calculate.json" \
  "d.result && d.result.canonicalAuthority === \"$CANONICAL_AUTHORITY\"" \
  "/api/calculate: canonical authority is $CANONICAL_AUTHORITY"
FIVE_INT_CHECK="d.result && [$(printf '"%s",' "${FIVE_POSITIONS[@]}" | sed 's/,$//')].every(k => Number.isInteger(d.result[k]) && d.result[k] >= 1)"
assert_json "$WORK/calculate.json" "$FIVE_INT_CHECK" \
  "/api/calculate: five canonical numbers present as integers ($(IFS=,; echo "${FIVE_POSITIONS[*]}"))"
assert_json "$WORK/calculate.json" \
  'd.status === "ok" && !(d.code) && !(d.message)' \
  "/api/calculate: no server error fields"

# 4. Code V2 payload — structural schema/positions only.
if [[ "$SKIP_CODE_V2" -eq 0 ]]; then
  echo "[4/4] POST /api/code-v2 (synthetic fixture only)"
  code="$(http POST /api/code-v2 "$WORK/codev2.json" \
    --header "Content-Type: application/json" \
    --cookie "$WORK/cookies.txt" \
    --data "{\"dob\":\"$SYNTHETIC_SMOKE_DOB\"}")" || fail "POST /api/code-v2 request failed"
  [[ "$code" == "200" ]] || fail "POST /api/code-v2 returned HTTP $code (expected 200)"
  assert_json "$WORK/codev2.json" 'd.status === "ok"' "/api/code-v2: status ok"
  assert_json "$WORK/codev2.json" \
    "d.payload && d.payload.calculation && d.payload.calculation.date === \"$SYNTHETIC_SMOKE_DOB\"" \
    "/api/code-v2: calculation echoes the synthetic fixture date"
  assert_json "$WORK/codev2.json" \
    'd.payload && d.payload.calculation && d.payload.calculation.five_numbers && ["soul","expression","path","direction","result"].every(k => Number.isInteger(d.payload.calculation.five_numbers[k]))' \
    "/api/code-v2: five_numbers schema complete"
  assert_json "$WORK/codev2.json" \
    'd.payload && Array.isArray(d.payload.positions) && d.payload.positions.length === 5 && d.payload.positions.every(p => typeof p.public_name === "string" && p.public_name.length > 0)' \
    "/api/code-v2: 5 canonical positions with public_name"
  assert_json "$WORK/codev2.json" \
    'd.payload && d.payload.synthesis && typeof d.payload.synthesis === "object" && Object.keys(d.payload.synthesis).length > 0' \
    "/api/code-v2: synthesis object present"
  assert_json "$WORK/codev2.json" \
    'd.status === "ok" && !(d.code) && !(d.message)' \
    "/api/code-v2: no server error fields"
else
  echo "[4/4] POST /api/code-v2 skipped (--skip-code-v2)"
fi

echo
if [[ "$SMOKE_FAIL" -ne 0 ]]; then
  echo "PRODUCTION SMOKE: FAIL (structural violation above) — do not accept the release" >&2
  exit 1
fi
echo "PRODUCTION SMOKE: PASS (structural invariants only, synthetic fixture $SYNTHETIC_SMOKE_DOB)"
exit 0
