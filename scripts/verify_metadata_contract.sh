#!/usr/bin/env bash
# T4.3: Strict Release Verifier Contract — Application Pin vs Metadata Release Commit
set -euo pipefail

REPO_ROOT="" WEB_SHA="" WEB_PIN="" DCS_SHA="" DCS_PIN=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-root) REPO_ROOT="$2"; shift 2 ;;
    --web-sha) WEB_SHA="$2"; shift 2 ;;
    --web-pin) WEB_PIN="$2"; shift 2 ;;
    --dcs-sha) DCS_SHA="$2"; shift 2 ;;
    --dcs-pin) DCS_PIN="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$REPO_ROOT" && -d "$REPO_ROOT/.git" ]] || {
  echo "FAIL_CLOSED: invalid repo root: '$REPO_ROOT'" >&2
  exit 1
}

# 1. DCS Pin match: verifier repository manifest must match requested DCS SHA
[[ "$DCS_SHA" == "$DCS_PIN" ]] || {
  echo "FAIL_CLOSED: verifier manifest DCS pin mismatch (requested $DCS_SHA != pinned $DCS_PIN)" >&2
  exit 1
}

# 2. Case A: Legacy / Direct match
if [[ "$WEB_SHA" == "$WEB_PIN" ]]; then
  # Inside WEB_SHA tree, verify DCS pin matches requested DCS_SHA
  TREE_DCS="$(git -C "$REPO_ROOT" show "${WEB_SHA}:release-compatibility.json" 2>/dev/null | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const m=JSON.parse(d);console.log((m.dcs&&m.dcs.pinned_sha)||"")}catch{console.log("")}})' || echo "")"
  if [[ -n "$TREE_DCS" && "$TREE_DCS" != "$DCS_SHA" ]]; then
    echo "FAIL_CLOSED: tree DCS pin mismatch inside direct candidate $WEB_SHA ('$TREE_DCS' != '$DCS_SHA')" >&2
    exit 1
  fi
  echo "LEGACY_DIRECT_MATCH: web_sha matches application pin ($WEB_SHA)"
  exit 0
fi

# 3. Case B+: WEB_SHA != WEB_PIN -> Must prove it is a strict single-commit metadata release child
# Invariant 1: WEB_PIN must be the immediate direct parent of WEB_SHA
PARENTS="$(git -C "$REPO_ROOT" rev-list --parents -n 1 "$WEB_SHA" 2>/dev/null || echo "")"
if [[ "$PARENTS" != "$WEB_SHA $WEB_PIN" ]]; then
  echo "FAIL_CLOSED: release commit is not an immediate direct child of application pin (expected '$WEB_SHA $WEB_PIN', got '${PARENTS:-none}')" >&2
  exit 1
fi

# Invariant 2 & 3: Difference between WEB_PIN and WEB_SHA must be ONLY release-compatibility.json (no application code)
DIFF_FILES="$(git -C "$REPO_ROOT" diff --name-only "$WEB_PIN" "$WEB_SHA" 2>/dev/null || echo "error")"
if [[ "$DIFF_FILES" != "release-compatibility.json" ]]; then
  echo "FAIL_CLOSED: application-code changes detected outside release-compatibility.json in metadata commit ($DIFF_FILES)" >&2
  exit 1
fi

# Invariant 4: Inside exact tree of WEB_SHA:
# - web.pinned_sha == WEB_PIN
# - dcs.pinned_sha == requested DCS_SHA
TREE_WEB_PIN="$(git -C "$REPO_ROOT" show "${WEB_SHA}:release-compatibility.json" 2>/dev/null | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const m=JSON.parse(d);console.log((m.web&&m.web.pinned_sha)||"")}catch{console.log("")}})' || echo "")"
TREE_DCS_PIN="$(git -C "$REPO_ROOT" show "${WEB_SHA}:release-compatibility.json" 2>/dev/null | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const m=JSON.parse(d);console.log((m.dcs&&m.dcs.pinned_sha)||"")}catch{console.log("")}})' || echo "")"

if [[ "$TREE_WEB_PIN" != "$WEB_PIN" ]]; then
  echo "FAIL_CLOSED: tree application pin mismatch inside $WEB_SHA ('$TREE_WEB_PIN' != '$WEB_PIN')" >&2
  exit 1
fi

if [[ "$TREE_DCS_PIN" != "$DCS_SHA" ]]; then
  echo "FAIL_CLOSED: tree DCS pin mismatch inside $WEB_SHA ('$TREE_DCS_PIN' != '$DCS_SHA')" >&2
  exit 1
fi

echo "METADATA_CHILD_MATCH: release commit $WEB_SHA is a verified metadata child of application pin $WEB_PIN (manifest-only delta)"
exit 0
