#!/usr/bin/env bash
# PATAPIM Remote Doctor — diagnoses why the patapim.ai dashboard isn't
# showing this Mac as "Connected", and uploads a redacted report to your
# account so support can see it.
#
# Run with: curl -fsSL https://patapim.ai/remote-doctor/remote-doctor.sh | bash

SCHEMA_VERSION=1
API_BASE="${PATAPIM_API_BASE:-https://patapim.ai}"
PATAPIM_DIR="${HOME}/.patapim"
ACCOUNT_FILE="${PATAPIM_DIR}/account.json"
REMOTE_LOG="${PATAPIM_DIR}/remote-access.log"
LOCAL_REMOTE_URL="http://localhost:31415/ping"

if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_CYAN=$'\033[36m'
else
  C_RESET=; C_BOLD=; C_DIM=; C_RED=; C_GREEN=; C_YELLOW=; C_CYAN=
fi

say()   { printf '%s\n' "$*"; }
hr()    { printf '%s\n' "----------------------------------------"; }
ok()    { printf '  %s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
bad()   { printf '  %s✗%s %s\n' "$C_RED" "$C_RESET" "$*"; }
warn()  { printf '  %s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
info()  { printf '  %s•%s %s\n' "$C_CYAN" "$C_RESET" "$*"; }

# JSON-escape a string for embedding inside double-quoted JSON values.
# Handles: backslash, double quote, common control chars.
json_escape() {
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//	/\\t}
  s=${s//$'\r'/\\r}
  s=${s//$'\n'/\\n}
  printf '%s' "$s"
}

# Extract a top-level JSON string value (best-effort, no jq dependency).
# Works for fields like "token":"abc". Does not handle escaped quotes in values
# (fine for tokens, hostnames, plain identifiers).
json_get_string() {
  local key=$1 input=$2
  printf '%s' "$input" \
    | LC_ALL=C tr -d '\n' \
    | LC_ALL=C grep -oE "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" \
    | head -1 \
    | sed -E "s/^\"$key\"[[:space:]]*:[[:space:]]*\"(.*)\"$/\1/"
}

say ""
say "${C_BOLD}PATAPIM Remote Doctor${C_RESET}"
hr

OS=$(uname -s)
ARCH=$(uname -m)
HOSTNAME_LOCAL=$(hostname 2>/dev/null || echo unknown)
USER_NAME=$(id -un 2>/dev/null || echo unknown)
RUN_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

info "host: $HOSTNAME_LOCAL ($OS $ARCH), user: $USER_NAME"
info "time: $RUN_AT"
say ""

# ---------- account.json ----------
DEVICE_TOKEN=""
EMAIL=""
PLAN=""
INSTANCE_NAME=""
ACCOUNT_OK=false
if [ -f "$ACCOUNT_FILE" ]; then
  ACCOUNT_RAW=$(cat "$ACCOUNT_FILE" 2>/dev/null || true)
  DEVICE_TOKEN=$(json_get_string token "$ACCOUNT_RAW")
  EMAIL=$(json_get_string email "$ACCOUNT_RAW")
  PLAN=$(json_get_string plan "$ACCOUNT_RAW")
  INSTANCE_NAME=$(json_get_string instanceName "$ACCOUNT_RAW")
  if [ -n "$DEVICE_TOKEN" ]; then
    ACCOUNT_OK=true
    ok "signed in as ${EMAIL:-?} (plan: ${PLAN:-?}, instance: ${INSTANCE_NAME:-?})"
  else
    bad "account.json present but no token found — sign in again from PATAPIM"
  fi
else
  bad "no $ACCOUNT_FILE — PATAPIM has never signed in on this Mac"
fi

# ---------- processes ----------
PATAPIM_RUNNING=false
CLOUDFLARED_RUNNING=false
if pgrep -fl 'Electron.*[Pp][Aa][Tt][Aa][Pp][Ii][Mm]' >/dev/null 2>&1 || pgrep -fl 'PATAPIM' >/dev/null 2>&1; then
  PATAPIM_RUNNING=true
  ok "PATAPIM process is running"
else
  bad "PATAPIM process is NOT running on this Mac"
fi
if pgrep -fl cloudflared >/dev/null 2>&1; then
  CLOUDFLARED_RUNNING=true
  ok "cloudflared is running"
else
  warn "cloudflared is not running (expected if remote isn't enabled here)"
fi

CLOUDFLARED_BIN_PATH="${PATAPIM_DIR}/cloudflared"
CLOUDFLARED_BIN=false
if [ -x "$CLOUDFLARED_BIN_PATH" ]; then
  CLOUDFLARED_BIN=true
  info "bundled cloudflared binary: present"
else
  warn "bundled cloudflared binary missing at $CLOUDFLARED_BIN_PATH"
fi

# ---------- local remote server ----------
LOCAL_STATUS=""
LOCAL_BODY=""
LOCAL_ERR=""
LOCAL_OK=false
if command -v curl >/dev/null 2>&1; then
  LOCAL_OUT=$(curl -sS -o /tmp/patapim-doctor-local.$$ -w '%{http_code}' --max-time 3 "$LOCAL_REMOTE_URL" 2>/tmp/patapim-doctor-local-err.$$ || true)
  LOCAL_STATUS=$LOCAL_OUT
  LOCAL_BODY=$(cat /tmp/patapim-doctor-local.$$ 2>/dev/null || true)
  LOCAL_ERR=$(cat /tmp/patapim-doctor-local-err.$$ 2>/dev/null || true)
  rm -f /tmp/patapim-doctor-local.$$ /tmp/patapim-doctor-local-err.$$
  if [ "$LOCAL_STATUS" = "200" ]; then
    LOCAL_OK=true
    ok "local remote server responds on :31415"
  elif [ "$LOCAL_STATUS" = "000" ] || [ -z "$LOCAL_STATUS" ]; then
    bad "local remote server NOT listening on :31415 (${LOCAL_ERR:-connection refused})"
  else
    bad "local remote server returned HTTP $LOCAL_STATUS on /ping"
  fi
else
  bad "curl not found — cannot probe local server"
fi

# ---------- cloud device list ----------
DEVICES_STATUS=""
DEVICES_BODY=""
if [ "$ACCOUNT_OK" = "true" ] && command -v curl >/dev/null 2>&1; then
  DEVICES_BODY=$(curl -sS -m 10 -H "Authorization: Bearer $DEVICE_TOKEN" "$API_BASE/api/device/list" -w $'\n___HTTP=%{http_code}' 2>/dev/null || true)
  DEVICES_STATUS=$(printf '%s' "$DEVICES_BODY" | tail -1 | sed 's/^___HTTP=//')
  DEVICES_BODY=$(printf '%s' "$DEVICES_BODY" | sed '$d')
  if [ "$DEVICES_STATUS" = "200" ]; then
    ok "cloud /api/device/list reachable"
    # Surface a quick summary line per device
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      info "  $line"
    done < <(printf '%s' "$DEVICES_BODY" \
      | LC_ALL=C tr -d '\n' \
      | grep -oE '\{[^{}]*"deviceName"[^{}]*\}' \
      | while read -r dev; do
          name=$(json_get_string deviceName "$dev")
          status=$(json_get_string status "$dev")
          tunnel=$(json_get_string tunnelUrl "$dev")
          printf '%s  [%s]  tunnel=%s\n' "${name:-?}" "${status:-?}" "${tunnel:-null}"
        done)
  else
    bad "cloud /api/device/list returned HTTP ${DEVICES_STATUS:-?}"
  fi
fi

# ---------- recent log ----------
LOG_EXISTS=false
LOG_TAIL=""
if [ -f "$REMOTE_LOG" ]; then
  LOG_EXISTS=true
  LOG_TAIL=$(tail -n 30 "$REMOTE_LOG" 2>/dev/null || true)
  info "tail of remote-access.log present ($(wc -l < "$REMOTE_LOG" | tr -d ' ') lines total)"
else
  info "no $REMOTE_LOG (only created once remote actually runs)"
fi

# ---------- directory listing (names only, no contents) ----------
DIR_LISTING=""
if [ -d "$PATAPIM_DIR" ]; then
  DIR_LISTING=$(ls -1 "$PATAPIM_DIR" 2>/dev/null | head -60 || true)
fi

# ---------- verdict ----------
say ""
say "${C_BOLD}Verdict${C_RESET}"
hr
if [ "$ACCOUNT_OK" != "true" ]; then
  warn "Sign in from the PATAPIM app first, then re-run this script."
elif [ "$PATAPIM_RUNNING" != "true" ]; then
  warn "PATAPIM isn't running on this Mac. Launch it, enable remote, and re-run."
elif [ "$LOCAL_OK" != "true" ]; then
  warn "PATAPIM is running but its local remote server (:31415) isn't responding."
  warn "Open PATAPIM → Settings → Remote and turn remote access on, or restart PATAPIM."
elif [ "$CLOUDFLARED_RUNNING" != "true" ]; then
  warn "Local server is up but cloudflared isn't. The tunnel can't be established."
  warn "Toggle remote off/on in PATAPIM to relaunch cloudflared."
else
  ok "Local side looks healthy. If the dashboard still says \"Connecting…\", the"
  ok "tunnel URL cached server-side has gone stale at Cloudflare's edge. Toggle"
  ok "remote off then on in PATAPIM to mint a fresh tunnel URL."
fi
say ""

# ---------- build report JSON ----------
LOG_TAIL_ESC=$(json_escape "$LOG_TAIL")
DIR_LISTING_ESC=$(json_escape "$DIR_LISTING")
DEVICES_BODY_ESC=$(json_escape "$DEVICES_BODY")
LOCAL_BODY_ESC=$(json_escape "$LOCAL_BODY")
LOCAL_ERR_ESC=$(json_escape "$LOCAL_ERR")
EMAIL_ESC=$(json_escape "$EMAIL")
PLAN_ESC=$(json_escape "$PLAN")
INSTANCE_NAME_ESC=$(json_escape "$INSTANCE_NAME")
HOSTNAME_ESC=$(json_escape "$HOSTNAME_LOCAL")
USER_ESC=$(json_escape "$USER_NAME")
OS_ESC=$(json_escape "$OS $ARCH")

REPORT_JSON=$(cat <<JSON
{
  "schemaVersion": $SCHEMA_VERSION,
  "runAt": "$RUN_AT",
  "host": { "os": "$OS_ESC", "hostname": "$HOSTNAME_ESC", "user": "$USER_ESC" },
  "account": {
    "found": $ACCOUNT_OK,
    "email": "$EMAIL_ESC",
    "plan": "$PLAN_ESC",
    "instanceName": "$INSTANCE_NAME_ESC"
  },
  "processes": {
    "patapimRunning": $PATAPIM_RUNNING,
    "cloudflaredRunning": $CLOUDFLARED_RUNNING,
    "cloudflaredBundled": $CLOUDFLARED_BIN
  },
  "localServer": {
    "ok": $LOCAL_OK,
    "httpStatus": "${LOCAL_STATUS:-}",
    "body": "$LOCAL_BODY_ESC",
    "error": "$LOCAL_ERR_ESC"
  },
  "cloud": {
    "deviceListStatus": "${DEVICES_STATUS:-}",
    "deviceListBody": "$DEVICES_BODY_ESC"
  },
  "logs": {
    "remoteAccessExists": $LOG_EXISTS,
    "remoteAccessTail": "$LOG_TAIL_ESC"
  },
  "patapimDir": "$DIR_LISTING_ESC"
}
JSON
)

# ---------- upload ----------
if [ "$ACCOUNT_OK" = "true" ] && command -v curl >/dev/null 2>&1; then
  say "${C_DIM}Uploading report to support…${C_RESET}"
  UP_OUT=$(curl -sS -m 10 -X POST \
    -H "Authorization: Bearer $DEVICE_TOKEN" \
    -H "Content-Type: application/json" \
    --data-binary "$REPORT_JSON" \
    -w $'\n___HTTP=%{http_code}' \
    "$API_BASE/api/remote-doctor/report" 2>/dev/null || true)
  UP_STATUS=$(printf '%s' "$UP_OUT" | tail -1 | sed 's/^___HTTP=//')
  if [ "$UP_STATUS" = "200" ]; then
    ok "report uploaded — support can now see it"
  else
    bad "upload failed (HTTP ${UP_STATUS:-?})"
  fi
else
  warn "skipping upload (no token or curl available)"
fi

say ""
say "${C_DIM}Done.${C_RESET}"
