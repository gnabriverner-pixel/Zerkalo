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

START_TS="$(date +%s)"
START_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

RESULTS_WEB=""   # "name:status:seconds" space-separated
RESULTS_DCS=""
STEP_FAIL=0

# LOG/JSON/MD are only defined AFTER the self-cleanliness gate: the verifier
# must not create files inside its own repo (default OUT_DIR) before proving
# the tree is clean. Early failures write evidence under /tmp instead.
say() { printf '[verifier %s] %s\n' "$(date -u +%H:%M:%S)" "$*" | { [[ -n "${LOG:-}" ]] && tee -a "$LOG" || cat; }; }
say_early() { printf '[verifier %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

EARLY_FAIL_DIR=""
fail_early() { # fail_early <reason> — pre-cleanliness failure, /tmp evidence
  local reason="$1"
  EARLY_FAIL_DIR="/tmp/release-verifier-fail-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$EARLY_FAIL_DIR"
  cat > "$EARLY_FAIL_DIR/report.json" <<EOF
{
  "verdict": "FAIL",
  "failure_reason": "$reason",
  "pair": { "web_repo": "$WEB_REPO", "web_sha": "$WEB_SHA", "dcs_repo": "$DCS_REPO", "dcs_sha": "$DCS_SHA" },
  "web_pin_match": false,
  "dcs_pin_match": false,
  "pinned_pair_match": false,
  "gate_phase": "pre-cleanliness (evidence in /tmp; no files written inside the repo)",
  "started_at": "$START_ISO",
  "finished_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "policy": { "fail_closed": true }
}
EOF
  say_early "GATE FAIL: $reason"
  say_early "Evidence: $EARLY_FAIL_DIR/report.json"
  exit 1
}

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

# ------------------------------------------------------- fail-closed gates
# The canonical pair and runtime are defined by the COMMITTED
# release-compatibility.json of THIS repository (the verifier's own checkout).
# Any violation fails BEFORE cloning, installing or testing anything expensive.
WEB_PIN_MATCH=false; DCS_PIN_MATCH=false; PINNED_PAIR_MATCH=false
MANIFEST_SHA=""

fail_evidence() { # fail_evidence <reason> — post-cleanliness failure, evidence in OUT_DIR
  local reason="$1"
  say "GATE FAIL: $reason"
  cat > "$JSON" <<EOF
{
  "verdict": "FAIL",
  "failure_reason": "$reason",
  "pair": { "web_repo": "$WEB_REPO", "web_sha": "$WEB_SHA", "dcs_repo": "$DCS_REPO", "dcs_sha": "$DCS_SHA" },
  "web_pin_match": $WEB_PIN_MATCH,
  "dcs_pin_match": $DCS_PIN_MATCH,
  "pinned_pair_match": $PINNED_PAIR_MATCH,
  "manifest_sha": "${MANIFEST_SHA:-null}",
  "started_at": "$START_ISO",
  "finished_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "policy": { "github_actions": "EXTERNAL_BLOCKED: GitHub account billing lock; this verifier is the independent release gate", "fail_closed": true }
}
EOF
  {
    echo "# External Release Verification — FAIL (gate)"
    echo
    echo "- Reason: $reason"
    echo "- Requested pair: web \`$WEB_SHA\` + dcs \`$DCS_SHA\`"
    echo "- web_pin_match=$WEB_PIN_MATCH dcs_pin_match=$DCS_PIN_MATCH pinned_pair_match=$PINNED_PAIR_MATCH (manifest ${MANIFEST_SHA:-n/a})"
    echo "- No clone/install/test steps executed (fail-closed before expensive steps)."
  } > "$MD"
  exit 1
}

MANIFEST="$REPO_ROOT/release-compatibility.json"
CANONICAL_NODE_MAJOR="24"

# ---- Phase A: pre-cleanliness gates. Nothing has been written inside the
# repo yet; early failures keep their evidence in /tmp.
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo none)"
[[ "$NODE_MAJOR" == "$CANONICAL_NODE_MAJOR" ]] || fail_early "node v$NODE_MAJOR is not the canonical verification runtime (need Node $CANONICAL_NODE_MAJOR, CI parity)"
[[ -f "$MANIFEST" ]] || fail_early "release-compatibility.json missing in verifier repo ($REPO_ROOT)"
[[ -z "$(git -C "$REPO_ROOT" status --porcelain)" ]] || fail_early "verifier repo working tree is dirty — commit release-compatibility.json before verifying"
MANIFEST_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
WEB_PIN="$(node -e 'const m=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log((m.web&&m.web.pinned_sha)||"")' "$MANIFEST")"
DCS_PIN="$(node -e 'const m=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log((m.dcs&&m.dcs.pinned_sha)||"")' "$MANIFEST")"
sha40 "$WEB_PIN" || fail_early "manifest web.pinned_sha missing or invalid: '${WEB_PIN:-}'"
sha40 "$DCS_PIN" || fail_early "manifest dcs.pinned_sha missing or invalid: '${DCS_PIN:-}'"

# ---- Phase B: tree proven clean — now create evidence paths inside the repo.
OUT_DIR="${OUT_DIR_ARG:-$REPO_ROOT/evidence/verify-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/verifier.log"
JSON="$OUT_DIR/report.json"
MD="$OUT_DIR/report.md"
: > "$LOG"

# ---- Phase C: pair pin gates (fail-closed before any expensive step).
WEB_PIN_MATCH=false; DCS_PIN_MATCH=false; PINNED_PAIR_MATCH=false
[[ "$WEB_SHA" == "$WEB_PIN" ]] || fail_evidence "requested web SHA != pinned web SHA ($WEB_SHA != $WEB_PIN)"
WEB_PIN_MATCH=true
[[ "$DCS_SHA" == "$DCS_PIN" ]] || fail_evidence "requested dcs SHA != pinned dcs SHA ($DCS_SHA != $DCS_PIN)"
DCS_PIN_MATCH=true
PINNED_PAIR_MATCH=true
say "Pair gate PASS: web+dcs pins match manifest @ ${MANIFEST_SHA:0:7}; node v$NODE_MAJOR (canonical)"

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
run_check WEB bundle_hygiene "$WORK/web" bash scripts/bundle_hygiene_gate.sh "$WORK/web"
run_check WEB package_boot_check "$WORK/web" node scripts/package_release.cjs
run_check WEB release_identity "$WORK/web" node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync("dist/release.json","utf8"));if(p.release_sha!==process.env.WEB_SHA||p.dirty!==false)process.exit(1)' 2>/dev/null

# Cross-check: the manifest inside the verified Web SHA must pin the same DCS SHA
# (guards against drift between the verifier repo's manifest and the verified tree).
if [[ -f "$WORK/web/release-compatibility.json" ]]; then
  TREE_PIN="$(node -e 'const m=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log((m.dcs&&m.dcs.pinned_sha)||"")' "$WORK/web/release-compatibility.json" 2>/dev/null || echo "")"
  if [[ "$TREE_PIN" == "$DCS_SHA" ]]; then
    RESULTS_WEB+=" manifest_pair_consistency=PASS:0"
    say "[WEB] PASS  manifest_pair_consistency (tree pins $DCS_SHA)"
  else
    RESULTS_WEB+=" manifest_pair_consistency=FAIL:0:pin"
    STEP_FAIL=1
    say "[WEB] FAIL  manifest_pair_consistency (verified tree pins '${TREE_PIN:-<none>}' != $DCS_SHA)"
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
    "web_pin_match": $WEB_PIN_MATCH,
    "dcs_pin_match": $DCS_PIN_MATCH,
    "pinned_pair_match": $PINNED_PAIR_MATCH,
    "manifest_sha": "$MANIFEST_SHA"
  },
  "environment": { "node": "$NODE_VERSION", "canonical_node_major": $CANONICAL_NODE_MAJOR, "python_base": "$("$PYTHON_BASE" -V 2>&1)", "host": "$(hostname -s)" },
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
  echo "- Pinned pair (manifest \`$MANIFEST_SHA\`): web=$WEB_PIN_MATCH dcs=$DCS_PIN_MATCH pair=$PINNED_PAIR_MATCH"
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
