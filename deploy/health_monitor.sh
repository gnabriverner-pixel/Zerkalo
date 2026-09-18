#!/usr/bin/env bash
# Production health monitor for the zerkalosebya.ru release pair.
#
# Checks (all read-only):
#   - systemd units: zerkalo.service, digital-code-bridge.service,
#     digital-code-v2-prod.service (active? NRestarts trend?)
#   - Web /health       (HTTP 200 + release_sha present)
#   - Web /health/ready (HTTP 200, dcs_bridge state ready)
#   - Telegram bot heartbeat via safe read-only getMe
#
# Owner notification policy (Telegram, via MONITOR_BOT_TOKEN/MONITOR_CHAT_ID):
#   - healthy -> failed transition
#   - failed  -> healthy recovery
#   - NRestarts growth of any unit
# No repeated noise while state is unchanged.
#
# Intended to run on the production host via a systemd service+timer
# (see deploy/zerkalo-health-monitor.{service,timer}). State is kept in
# MONITOR_STATE_DIR (default /var/lib/zerkalo-health-monitor).

set -uo pipefail

WEB_HEALTH_URL="${WEB_HEALTH_URL:-https://zerkalosebya.ru/health}"
WEB_READY_URL="${WEB_READY_URL:-https://zerkalosebya.ru/health/ready}"
UNITS_STR="${MONITOR_UNITS:-zerkalo.service digital-code-bridge.service digital-code-v2-prod.service}"
BOT_TOKEN="${MONITOR_BOT_TOKEN:-${TELEGRAM_BOT_TOKEN:-}}"
CHAT_ID="${MONITOR_CHAT_ID:-}"
STATE_DIR="${MONITOR_STATE_DIR:-/var/lib/zerkalo-health-monitor}"
STATE_FILE="$STATE_DIR/state.env"
TIMEOUT="${MONITOR_TIMEOUT_SECONDS:-10}"

log() { printf '[health-monitor %s] %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }

notify() { # notify <text>
  local text="$1"
  if [[ -n "$BOT_TOKEN" && -n "$CHAT_ID" ]]; then
    curl -fsS -m 10 -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
      -d chat_id="$CHAT_ID" --data-urlencode text="$text" >/dev/null 2>&1 \
      && log "notify: sent" || log "notify: FAILED to send"
  else
    log "notify: skipped (MONITOR_BOT_TOKEN/MONITOR_CHAT_ID not set): $text"
  fi
}

# ---------------------------------------------------------------- state store
mkdir -p "$STATE_DIR" 2>/dev/null || { log "FATAL: cannot create $STATE_DIR"; exit 1; }
touch "$STATE_FILE"
# shellcheck disable=SC1090
source "$STATE_FILE" 2>/dev/null || true

# ---------------------------------------------------------------- checks
CHECK_RESULTS=()
OVERALL="healthy"

check_unit() {
  local unit="$1" active restarts
  if ! command -v systemctl >/dev/null 2>&1; then
    CHECK_RESULTS+=("unit:$unit=skip(no systemctl)"); return
  fi
  active="$(systemctl is-active "$unit" 2>/dev/null || true)"
  restarts="$(systemctl show -p NRestarts --value "$unit" 2>/dev/null || echo '?')"
  if [[ "$active" != "active" ]]; then
    CHECK_RESULTS+=("unit:$unit=failed(state=$active)")
    OVERALL="failed"; return
  fi
  local prev_key="NRESTARTS_${unit//./_}"
  local prev="${!prev_key:-}"
  if [[ -n "$prev" && "$restarts" =~ ^[0-9]+$ && "$restarts" -gt "$prev" ]]; then
    CHECK_RESULTS+=("unit:$unit=restarts_grew($prev->$restarts)")
    notify "⚠️ zerkalo health: $unit NRestarts grew $prev -> $restarts"
  fi
  CHECK_RESULTS+=("unit:$unit=ok(restarts=$restarts)")
}

check_web_health() {
  local body rc
  body="$(curl -fsS -m "$TIMEOUT" "$WEB_HEALTH_URL" 2>/dev/null)"
  rc=$?
  if [[ $rc -ne 0 || -z "$body" ]]; then
    CHECK_RESULTS+=("web:health=failed(curl_rc=$rc)"); OVERALL="failed"; return
  fi
  echo "$body" | grep -q '"release_sha":"[0-9a-f]\{40\}"' || {
    CHECK_RESULTS+=("web:health=failed(no release_sha)"); OVERALL="failed"; return; }
  CHECK_RESULTS+=("web:health=ok")
}

check_web_ready() {
  local body rc code
  code="$(curl -fsS -m "$TIMEOUT" -o /tmp/zkm-ready.$$ -w '%{http_code}' "$WEB_READY_URL" 2>/dev/null)"; rc=$?
  body="$(cat /tmp/zkm-ready.$$ 2>/dev/null)"; rm -f /tmp/zkm-ready.$$
  if [[ $rc -ne 0 || "$code" != "200" ]]; then
    CHECK_RESULTS+=("web:ready=failed(http=$code rc=$rc)"); OVERALL="failed"; return
  fi
  echo "$body" | grep -q '"status":"ready"' || {
    CHECK_RESULTS+=("web:ready=failed(not ready)"); OVERALL="failed"; return; }
  echo "$body" | grep -q '"state":"ready"' || {
    CHECK_RESULTS+=("web:ready=degraded(dcs_bridge not ready)"); OVERALL="failed"; return; }
  CHECK_RESULTS+=("web:ready=ok")
}

check_bot_heartbeat() {
  # Read-only getMe: proves the bot token is valid and Telegram API reachable.
  if [[ -z "$BOT_TOKEN" ]]; then
    CHECK_RESULTS+=("bot:getMe=skip(no token)"); return
  fi
  local code
  code="$(curl -fsS -m "$TIMEOUT" -o /dev/null -w '%{http_code}' "https://api.telegram.org/bot${BOT_TOKEN}/getMe" 2>/dev/null)"
  if [[ "$code" != "200" ]]; then
    CHECK_RESULTS+=("bot:getMe=failed(http=$code)"); OVERALL="failed"; return
  fi
  CHECK_RESULTS+=("bot:getMe=ok")
}

for u in $UNITS_STR; do check_unit "$u"; done
check_web_health
check_web_ready
check_bot_heartbeat

DETAIL="$(printf '%s\n' "${CHECK_RESULTS[@]}" | paste -sd', ' -)"

# ---------------------------------------------------------------- transitions
PREV="${PREV_OVERALL:-unknown}"
log "overall=$OVERALL (prev=$PREV): $DETAIL"

if [[ "$PREV" != "failed" && "$OVERALL" == "failed" ]]; then
  notify "🔴 zerkalo health: FAILED. $DETAIL"
elif [[ "$PREV" == "failed" && "$OVERALL" == "healthy" ]]; then
  notify "🟢 zerkalo health: RECOVERED. $DETAIL"
fi

# Persist state atomically
cat > "$STATE_FILE.tmp" <<EOF
PREV_OVERALL=$OVERALL
EOF
for u in $UNITS_STR; do
  r="$(systemctl show -p NRestarts --value "$u" 2>/dev/null || true)"
  [[ "$r" =~ ^[0-9]+$ ]] && echo "NRESTARTS_${u//./_}=$r" >> "$STATE_FILE.tmp"
done
mv "$STATE_FILE.tmp" "$STATE_FILE"

[[ "$OVERALL" == "healthy" ]] || exit 1
