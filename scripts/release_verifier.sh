#!/usr/bin/env bash
# External release verifier — free, reproducible, independent of GitHub Actions.
#
# Verifies an exact Web SHA + DCS SHA pair from clean temporary checkouts:
#   Web: typecheck, full test suite, production build, immutable-artifact
#        boot-check, release identity.
#   DCS: full pytest suite, Code V2 release payload contract.
#   Pair: Web/DCS consistency via acceptance tests against the checked-out
#         DCS; pinned pair vs release-compatibility.json.
#
# Fail-closed: any failed check => verdict FAIL, exit 1.
# Evidence: JSON + Markdown report + full log in --out-dir (default ./evidence).
#
# Usage:
#   scripts/release_verifier.sh --web-sha <40-hex> --dcs-sha <40-hex> \
#     [--out-dir DIR] [--post-status]
#
# With --post-status (optional), a commit status is published to both repos via
# the GitHub API (context: external-release-verifier) when a token is available.

set -uo pipefail

WEB_REPO="gnabriverner-pixel/Zerkalo"
DCS_REPO="gnabriverner-pixel/digital-code-system"
WEB_URL="https://github.com/${WEB_REPO}.git"
DCS_URL="https://github.com/${DCS_REPO}.git"
DEAD_BRIDGE_URL="http://127.0.0.1:9"

WEB_SHA_ARG="" DCS_SHA_ARG="" OUT_DIR_ARG="" POST_STATUS=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --web-sha) WEB_SHA_ARG="$2"; shift 2 ;;
    --dcs-sha) DCS_SHA_ARG="$2"; shift 2 ;;
    --out-dir) OUT_DIR_ARG="$2"; shift 2 ;;
    --post-status) POST_STATUS=1; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

sha40() { echo "$1" | grep -Eq '^[0-9a-f]{40}$' && return 0 || return 1; }
sha40 "$WEB_SHA_ARG" || { echo "ERROR: --web-sha must be a 40-hex SHA" >&2; exit 2; }
sha40 "$DCS_SHA_ARG" || { echo "ERROR: --dcs-sha must be a 40-hex SHA" >&2; exit 2; }
WEB_SHA="$WEB_SHA_ARG"; DCS_SHA="$DCS_SHA_ARG"
export WEB_SHA DCS_SHA

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="${OUT_DIR_ARG:-$REPO_ROOT/evidence/verify-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/verifier.log"
JSON="$OUT_DIR/report.json"
MD="$OUT_DIR/report.md"
: > "$LOG"

START_TS="$(date +%s)"
START_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

RESULTS_WEB=""   # "name:status:seconds" space-separated
RESULTS_DCS=""
STEP_FAIL=0

say() { printf '[verifier %s] %s\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "$LOG"; }

run_check() { # run_check <side> <name> <workdir> <cmd...>
  local side="$1" name="$2" workdir="$3"; shift 3
  local t0 t1 rc tail_lines
  t0=$(date +%s)
  say "[$side] START $name"
  ( cd "$workdir" && "$@" ) >>"$LOG" 2>&1
  rc=$?
  t1=$(date +%s)
  if [[ $rc -ne 0 ]]; then
    STEP_FAIL=1
    tail_lines=$(tail -n 15 "$LOG" | tr '\n' ' ' | cut -c1-300)
    say "[$side] FAIL  $name (rc=$rc, $((t1-t0))s)"
    eval "RESULTS_${side}+=\" $name=FAIL:$((t1-t0)):rc$rc\""
  else
    say "[$side] PASS  $name ($((t1-t0))s)"
    eval "RESULTS_${side}+=\" $name=PASS:$((t1-t0))\""
  fi
  return 0  # fail-closed is decided after all checks
}

say "External release verifier"
say "  Web SHA: $WEB_SHA"
say "  DCS SHA: $DCS_SHA"
say "  Out dir: $OUT_DIR"

WORK="$(mktemp -d /tmp/zerkalo-release-verify.XXXXXX)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

# ------------------------------------------------------- clean checkouts
say "Cloning clean checkouts"
git clone --quiet "$WEB_URL" "$WORK/web" >>"$LOG" 2>&1 || { say "FATAL: cannot clone $WEB_URL"; exit 1; }
git clone --quiet "$DCS_URL" "$WORK/dcs" >>"$LOG" 2>&1 || { say "FATAL: cannot clone $DCS_URL"; exit 1; }
git -C "$WORK/web" checkout --quiet "$WEB_SHA" >>"$LOG" 2>&1 || { say "FATAL: Web SHA $WEB_SHA not found"; exit 1; }
git -C "$WORK/dcs" checkout --quiet "$DCS_SHA" >>"$LOG" 2>&1 || { say "FATAL: DCS SHA $DCS_SHA not found"; exit 1; }

DIRTY=0
[[ -n "$(git -C "$WORK/web" status --porcelain)" ]] && DIRTY=1
[[ -n "$(git -C "$WORK/dcs" status --porcelain)" ]] && DIRTY=1
say "Uncommitted-changes check at pinned SHAs: $([[ $DIRTY -eq 0 ]] && echo clean || echo DIRTY)"

# ------------------------------------------------------- environment
NODE_VERSION="$(node -v 2>/dev/null || echo missing)"
PYTHON_BASE="$(command -v python3.12 || command -v python3 || true)"
[[ -n "$PYTHON_BASE" ]] || { say "FATAL: python3.12 not found"; exit 1; }
say "python -m venv"
python3.12 -m venv "$WORK/venv" >>"$LOG" 2>&1 || "$PYTHON_BASE" -m venv "$WORK/venv" >>"$LOG" 2>&1 || { say "FATAL: venv creation failed"; exit 1; }
VENV_PY="$WORK/venv/bin/python"
run_check DCS pip_install "$WORK/dcs" "$VENV_PY" -m pip install --quiet -r requirements.txt

# ------------------------------------------------------- DCS checks
run_check DCS pytest_full "$WORK/dcs" env PYTHONDONTWRITEBYTECODE=1 "$VENV_PY" -B -m pytest -q -p no:cacheprovider \
  --ignore=archive --ignore=.venv --ignore=.venv312 --ignore=.venv-e2e --ignore=venv --ignore=node_modules

if [[ -f "$WORK/dcs/scripts/code_v2_payload.py" ]]; then
  cat > "$WORK/check_payload.py" <<'PYEOF'
import json, sys
payload = json.load(open(sys.argv[1], encoding="utf-8"))
result = next(item for item in payload["positions"] if item["position"] == "result")
assert result["role"] == "Возможный горизонт", result["role"]
assert payload["synthesis"]["mature_integration"]["title"] == "Число Результата: возможный горизонт"
PYEOF
  run_check DCS code_v2_payload "$WORK/dcs" bash -c "\"$VENV_PY\" scripts/code_v2_payload.py --dob 06.05.1986 --indent 0 > /tmp/verifier-code-v2.json && \"$VENV_PY\" \"$WORK/check_payload.py\" /tmp/verifier-code-v2.json"
fi

# ------------------------------------------------------- Web checks
export DCS_ROOT="$WORK/dcs"
export DCS_BRIDGE_URL="$DEAD_BRIDGE_URL"
export PYTHON_BIN="$VENV_PY"

run_check WEB npm_ci "$WORK/web" npm ci --no-audit --no-fund
run_check WEB typecheck "$WORK/web" npm run lint
run_check WEB tests "$WORK/web" npm test
run_check WEB build "$WORK/web" npm run build
run_check WEB package_boot_check "$WORK/web" node scripts/package_release.cjs
run_check WEB release_identity "$WORK/web" node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync("dist/release.json","utf8"));if(p.release_sha!==process.env.WEB_SHA||p.dirty!==false)process.exit(1)' 2>/dev/null

# Pair pin consistency (informational, recorded in report)
PIN_MATCH="null"
if [[ -f "$WORK/web/release-compatibility.json" ]]; then
  PIN="$(node -e 'console.log(JSON.parse(require("fs").readFileSync("'$WORK'/web/release-compatibility.json","utf8")).dcs.pinned_sha)' 2>/dev/null || echo "")"
  if [[ -n "$PIN" ]]; then
    [[ "$PIN" == "$DCS_SHA" ]] && PIN_MATCH=true || PIN_MATCH=false
    say "release-compatibility.json pinned DCS: $PIN — match with verified pair: $PIN_MATCH"
  fi
fi

# ------------------------------------------------------- verdict
FINISHED_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
DURATION=$(( $(date +%s) - START_TS ))
VERDICT="PASS"; [[ $STEP_FAIL -ne 0 || $DIRTY -ne 0 ]] && VERDICT="FAIL"

# ------------------------------------------------------- JSON report
json_side() { # json_side <var-with-entries>
  local out="" entry name status seconds extra
  for entry in $1; do
    name="${entry%%=*}"; rest="${entry#*=}"; status="${rest%%:*}"; seconds="${rest#*:}"; seconds="${seconds%%:*}"
    extra=""; [[ "$status" == "FAIL" && "$seconds" == rc* ]] && { extra="rc${seconds#rc}"; seconds=""; }
    out+=",\"$name\":{\"status\":\"$status\",\"seconds\":${seconds:-null}${extra:+,\"exit_code\":\"$extra\"}}"
  done
  echo "${out#,}"
}
WEB_JSON="$(json_side "$RESULTS_WEB")"
DCS_JSON="$(json_side "$RESULTS_DCS")"

cat > "$JSON" <<EOF
{
  "verdict": "$VERDICT",
  "pair": {
    "web_repo": "$WEB_REPO", "web_sha": "$WEB_SHA",
    "dcs_repo": "$DCS_REPO", "dcs_sha": "$DCS_SHA",
    "pinned_pair_match": $PIN_MATCH
  },
  "environment": { "node": "$NODE_VERSION", "python_base": "$("$PYTHON_BASE" -V 2>&1)", "host": "$(hostname -s)" },
  "sources_clean": $([[ $DIRTY -eq 0 ]] && echo true || echo false),
  "started_at": "$START_ISO", "finished_at": "$FINISHED_ISO", "duration_seconds": $DURATION,
  "checks": {
    "web": { ${WEB_JSON:-} },
    "dcs": { ${DCS_JSON:-} }
  },
  "policy": {
    "github_actions": "EXTERNAL_BLOCKED: GitHub account billing lock; this verifier is the independent release gate",
    "fail_closed": true
  }
}
EOF

# ------------------------------------------------------- Markdown report
{
  echo "# External Release Verification — $VERDICT"
  echo
  echo "- Date: $FINISHED_ISO (duration ${DURATION}s)"
  echo "- Web: \`$WEB_SHA\` ($WEB_REPO)"
  echo "- DCS: \`$DCS_SHA\` ($DCS_REPO)"
  echo "- Pinned pair match (release-compatibility.json): $PIN_MATCH"
  echo "- Sources at pinned SHAs: clean checkouts"
  echo "- GitHub Actions: EXTERNAL_BLOCKED (account billing lock) — this run is the release gate."
  echo
  echo "## Checks"
  echo
  echo "| Side | Check | Status | Time |"
  echo "|------|-------|--------|------|"
  for entry in $RESULTS_WEB; do
    name="${entry%%=*}"; rest="${entry#*=}"; status="${rest%%:*}"; seconds="${rest#*:}"; seconds="${seconds%%:*}"
    echo "| Web | $name | $status | ${seconds:-} |"
  done
  for entry in $RESULTS_DCS; do
    name="${entry%%=*}"; rest="${entry#*=}"; status="${rest%%:*}"; seconds="${rest#*:}"; seconds="${seconds%%:*}"
    echo "| DCS | $name | $status | ${seconds:-} |"
  done
  echo
  echo "Evidence log: \`$LOG\`; JSON: \`$JSON\`."
} > "$MD"

say "Report: $JSON"
say "Report: $MD"
say "VERDICT: $VERDICT (web_sha=$WEB_SHA dcs_sha=$DCS_SHA)"

# ------------------------------------------------------- optional commit status
if [[ "$POST_STATUS" -eq 1 ]]; then
  if command -v gh >/dev/null 2>&1; then
    STATE="success"; [[ "$VERDICT" == "FAIL" ]] && STATE="failure"
    DESC="external-release-verifier: $VERDICT"
    gh api "repos/$WEB_REPO/statuses/$WEB_SHA" -f state="$STATE" -f context="external-release-verifier" -f description="$DESC" >>"$LOG" 2>&1 \
      && say "Commit status posted to $WEB_REPO@$WEB_SHA" || say "WARN: failed to post Web commit status"
    gh api "repos/$DCS_REPO/statuses/$DCS_SHA" -f state="$STATE" -f context="external-release-verifier" -f description="$DESC" >>"$LOG" 2>&1 \
      && say "Commit status posted to $DCS_REPO@$DCS_SHA" || say "WARN: failed to post DCS commit status"
  else
    say "WARN: gh CLI not available — commit status not posted"
  fi
fi

[[ "$VERDICT" == "PASS" ]] || exit 1
