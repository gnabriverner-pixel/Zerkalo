#!/usr/bin/env bash
# Production health monitor for the zerkalosebya.ru release pair.
#
# Checks (all read-only):
#   - systemd units: zerkalo.service, digital-code-bridge.service,
#     digital-code-v2-prod.service (active? restarts in the last hour?)
#   - Web /health       (HTTP 200 + release_sha present)
#   - Web /health/ready (HTTP 200, dcs_bridge state ready)
#   - Monitor bot heartbeat via safe read-only getMe (only when the monitor bot is configured)
#
# Notifications go ONLY through the monitor's own service bot: MONITOR_BOT_TOKEN + MONITOR_CHAT_ID.
# The product bot token (TELEGRAM_BOT_TOKEN) is deliberately never used here. Without both variables the
# monitor only writes to the journal.
#
# Message policy:
#   - a check changing state (ok -> failed, failed -> ok): one message per state, at most once per hour per check
#   - restarts are NOT a message of their own: "unstable: N restarts in the last hour" is a flag, sent only when
#     N >= 3 and at most once per hour per unit
#   - optional daily summary at 09:00 Moscow time (MONITOR_DAILY_SUMMARY=true), one message
#
# Intended to run on the production host via a systemd service+timer
# (see deploy/zerkalo-health-monitor.{service,timer}). State is kept in
# MONITOR_STATE_DIR (default /var/lib/zerkalo-health-monitor).
#
# Test seams (not used in production): MONITOR_SYSTEMCTL, MONITOR_CURL, MONITOR_NOW (epoch seconds).

set -uo pipefail

WEB_HEALTH_URL="${WEB_HEALTH_URL:-https://zerkalosebya.ru/health}"
WEB_READY_URL="${WEB_READY_URL:-https://zerkalosebya.ru/health/ready}"
UNITS_STR="${MONITOR_UNITS:-zerkalo.service digital-code-bridge.service digital-code-v2-prod.service}"
BOT_TOKEN="${MONITOR_BOT_TOKEN:-}"
CHAT_ID="${MONITOR_CHAT_ID:-}"
STATE_DIR="${MONITOR_STATE_DIR:-/var/lib/zerkalo-health-monitor}"
STATE_FILE="$STATE_DIR/state.env"
TIMEOUT="${MONITOR_TIMEOUT_SECONDS:-10}"
SYSTEMCTL="${MONITOR_SYSTEMCTL:-systemctl}"
FETCH="${MONITOR_CURL:-curl}"
NOW="${MONITOR_NOW:-$(date +%s)}"
HOUR=3600
UNSTABLE_MIN="${MONITOR_UNSTABLE_RESTARTS:-3}"

log() { printf '[health-monitor %s] %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }

notify() { # notify <text>
  local text="$1"
  if [[ -n "$BOT_TOKEN" && -n "$CHAT_ID" ]]; then
    "$FETCH" -fsS -m 10 -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
      -d chat_id="$CHAT_ID" --data-urlencode text="$text" >/dev/null 2>&1 \
      && log "notify: sent" || log "notify: FAILED to send"
  else
    log "notify: journal only (MONITOR_BOT_TOKEN/MONITOR_CHAT_ID not set): $text"
  fi
}

safe() { printf '%s' "$1" | tr -c 'A-Za-z0-9' '_'; }

# ---------------------------------------------------------------- state store
mkdir -p "$STATE_DIR" 2>/dev/null || { log "FATAL: cannot create $STATE_DIR"; exit 1; }
touch "$STATE_FILE"
# shellcheck disable=SC1090
source "$STATE_FILE" 2>/dev/null || true
STATE_OUT=()          # lines written back to the state file
EVENTS=()             # lines of the message about state changes
FLAGS=()              # "unstable" flags

# ---------------------------------------------------------------- checks
CHECK_RESULTS=()
CHECK_NAMES=()
CHECK_STATUS=()
OVERALL="healthy"

record() { # record <name> <ok|failed> <detail>
  CHECK_NAMES+=("$1"); CHECK_STATUS+=("$2"); CHECK_RESULTS+=("$1=$3")
  [[ "$2" == "failed" ]] && OVERALL="failed"
  return 0
}

restarts_last_hour() { # restarts_last_hour <unit> <current>  -> prints N, updates history file
  local unit="$1" cur="$2" hist tmp ts val first="" n
  hist="$STATE_DIR/restarts.$(safe "$unit")"; tmp="$hist.tmp"; : > "$tmp"
  if [[ -f "$hist" ]]; then
    while read -r ts val; do
      [[ "$ts" =~ ^[0-9]+$ && "$val" =~ ^[0-9]+$ ]] || continue
      (( ts >= NOW - HOUR - 300 )) || continue
      # the counter resets when the unit is restarted by hand / the host reboots: forget older samples
      if (( val > cur )); then : > "$tmp"; first=""; continue; fi
      echo "$ts $val" >> "$tmp"
      [[ -z "$first" ]] && first="$val"
    done < "$hist"
  fi
  echo "$NOW $cur" >> "$tmp"; mv "$tmp" "$hist"
  [[ -z "$first" ]] && first="$cur"
  n=$(( cur - first )); echo "$n"
}

check_unit() {
  local unit="$1" active restarts n key last
  if ! command -v "$SYSTEMCTL" >/dev/null 2>&1; then
    record "unit:$unit" ok "skip(no systemctl)"; return
  fi
  active="$("$SYSTEMCTL" is-active "$unit" 2>/dev/null || true)"
  restarts="$("$SYSTEMCTL" show -p NRestarts --value "$unit" 2>/dev/null || echo '?')"
  if [[ "$active" != "active" ]]; then
    record "unit:$unit" failed "failed(state=$active)"; return
  fi
  record "unit:$unit" ok "ok(restarts=$restarts)"
  if [[ "$restarts" =~ ^[0-9]+$ ]]; then
    n="$(restarts_last_hour "$unit" "$restarts")"
    key="LU_$(safe "$unit")"; last="${!key:-0}"
    if (( n >= UNSTABLE_MIN )) && (( NOW - last >= HOUR )); then
      FLAGS+=("$unit: нестабилен, $n перезапусков за час")
      last="$NOW"
    fi
    [[ "$last" != "0" ]] && STATE_OUT+=("$key=$last")
  fi
  return 0
}

check_web_health() {
  local body rc
  body="$("$FETCH" -fsS -m "$TIMEOUT" "$WEB_HEALTH_URL" 2>/dev/null)"
  rc=$?
  if [[ $rc -ne 0 || -z "$body" ]]; then
    record "web:health" failed "failed(curl_rc=$rc)"; return
  fi
  echo "$body" | grep -q '"release_sha":"[0-9a-f]\{40\}"' || {
    record "web:health" failed "failed(no release_sha)"; return; }
  record "web:health" ok "ok"
}

check_web_ready() {
  local body rc code tmp="/tmp/zkm-ready.$$"
  code="$("$FETCH" -fsS -m "$TIMEOUT" -o "$tmp" -w '%{http_code}' "$WEB_READY_URL" 2>/dev/null)"; rc=$?
  body="$(cat "$tmp" 2>/dev/null)"; rm -f "$tmp"
  if [[ $rc -ne 0 || "$code" != "200" ]]; then
    record "web:ready" failed "failed(http=$code rc=$rc)"; return
  fi
  echo "$body" | grep -q '"status":"ready"' || {
    record "web:ready" failed "failed(not ready)"; return; }
  # New-schema payloads expose checks.dcs_bridge.state; pre-operability deploys
  # do not. Only enforce when the field is present (forward/back compatible).
  if echo "$body" | grep -q '"dcs_bridge"'; then
    echo "$body" | grep -q '"state":"ready"' || {
      record "web:ready" failed "degraded(dcs_bridge not ready)"; return; }
    record "web:ready" ok "ok(dcs_bridge=ready)"
  else
    record "web:ready" ok "ok(legacy payload)"
  fi
}

check_bot_heartbeat() {
  # Read-only getMe on the MONITOR bot: proves its token is valid and Telegram API reachable.
  # One retry absorbs transient network blips so they do not page the owner.
  if [[ -z "$BOT_TOKEN" ]]; then
    record "bot:getMe" ok "skip(no monitor token)"; return
  fi
  local code attempt
  for attempt in 1 2; do
    code="$("$FETCH" -fsS -m "$TIMEOUT" -o /dev/null -w '%{http_code}' "https://api.telegram.org/bot${BOT_TOKEN}/getMe" 2>/dev/null)"
    [[ "$code" == "200" ]] && break
    [[ $attempt -eq 1 ]] && sleep "${MONITOR_RETRY_SLEEP:-2}"
  done
  if [[ "$code" != "200" ]]; then
    record "bot:getMe" failed "failed(http=$code)"; return
  fi
  record "bot:getMe" ok "ok"
}

for u in $UNITS_STR; do check_unit "$u"; done
check_web_health
check_web_ready
check_bot_heartbeat

DETAIL="$(printf '%s\n' "${CHECK_RESULTS[@]}" | paste -sd', ' -)"
log "overall=$OVERALL: $DETAIL"

# ---------------------------------------------------------------- transitions (per check, once an hour per state)
i=0
for name in "${CHECK_NAMES[@]}"; do
  status="${CHECK_STATUS[$i]}"; s="$(safe "$name")"
  prev_key="PS_$s"; prev="${!prev_key:-unknown}"
  STATE_OUT+=("$prev_key=$status")
  last_key="LN_${s}_${status}"; last="${!last_key:-0}"
  if [[ "$prev" != "$status" ]] && { [[ "$prev" != "unknown" ]] || [[ "$status" == "failed" ]]; }; then
    if (( NOW - last >= HOUR )); then
      if [[ "$status" == "failed" ]]; then EVENTS+=("🔴 $name: упал — ${CHECK_RESULTS[$i]#*=}"); else EVENTS+=("🟢 $name: снова в порядке"); fi
      last="$NOW"
    else
      log "suppressed (<1h since last $status message): $name"
    fi
  fi
  [[ "$last" != "0" ]] && STATE_OUT+=("$last_key=$last")
  # carry the other state's timestamp forward
  other="ok"; [[ "$status" == "ok" ]] && other="failed"
  other_key="LN_${s}_${other}"; [[ -n "${!other_key:-}" ]] && STATE_OUT+=("$other_key=${!other_key}")
  i=$((i+1))
done

if (( ${#EVENTS[@]} > 0 || ${#FLAGS[@]} > 0 )); then
  notify "zerkalo health: $(printf '%s; ' ${EVENTS[@]+"${EVENTS[@]}"} ${FLAGS[@]+"${FLAGS[@]}"})"
fi

# ---------------------------------------------------------------- optional daily summary, 09:00 Moscow (UTC+3)
SUMMARY_DAY="${LAST_SUMMARY_DAY:-}"
if [[ "${MONITOR_DAILY_SUMMARY:-false}" == "true" ]]; then
  msk=$(( NOW + 3*HOUR )); day=$(( msk / 86400 )); msk_hour=$(( (msk / HOUR) % 24 ))
  if (( msk_hour == 9 )) && [[ "$SUMMARY_DAY" != "$day" ]]; then
    notify "zerkalo health, сводка за сутки: $OVERALL. $DETAIL"
    SUMMARY_DAY="$day"
  fi
fi
[[ -n "$SUMMARY_DAY" ]] && STATE_OUT+=("LAST_SUMMARY_DAY=$SUMMARY_DAY")

# Persist state atomically (values are plain tokens/numbers; names are sanitised)
{ echo "PREV_OVERALL=$OVERALL"; printf '%s\n' ${STATE_OUT[@]+"${STATE_OUT[@]}"}; } > "$STATE_FILE.tmp"
mv "$STATE_FILE.tmp" "$STATE_FILE"

[[ "$OVERALL" == "healthy" ]] || exit 1
