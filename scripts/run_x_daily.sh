#!/usr/bin/env bash
# X3-A Scheduler Trigger Foundation — run_x_daily.sh
#
# Canonical schedule: 08:08 JST / Asia/Tokyo
# Grace window:       08:08–08:38 JST (30 minutes)
# Invoked by:         com.aisns.daily launchd agent
#
# Usage:
#   ./scripts/run_x_daily.sh                          Real mode: all guards enforced
#   ./scripts/run_x_daily.sh --dry-run                Preview: zero network; guards informational
#   ./scripts/run_x_daily.sh --dry-run --skip-time-check
#                                                     Test: bypass grace window for simulation
#   ./scripts/run_x_daily.sh --simulate-scheduled     X3-C: dry-run + skip time check combined
#
# Separation from scripts/run_daily.sh:
#   run_daily.sh   — existing Instagram/carousel pipeline (unrelated workstream)
#   run_x_daily.sh — X publishing scheduler (X3 scope; this file)
#
# Safety invariants:
#   1. No network call without SCHEDULED_PUBLISH_ENABLED=true AND REAL_PUBLISH_ENABLED=true
#   2. Canonical timezone = Asia/Tokyo (host timezone independent; TZ= explicit)
#   3. Grace window 08:08–08:38 JST only; no catch-up publishing after grace expiry
#   4. Credential values never logged, never in plist, never in CLI arguments
#   5. .env must not be git-tracked (guard enforced at startup, before credential load)
#   6. Fail-closed: any missing activation flag or credential → non-zero exit
#   7. Partial credential set → blocked (all 4 X vars required)
#   8. No shell xtrace (set -x) around credential loading block
#
# FC-2 resolved in X3-A: plist corrected to Hour=8 Minute=8.
# FC-1 PENDING X3-B:  JST date authority for daily jobId in daily_publish_job.js.
#
# ADR-0026 — X3 Scheduled Publishing Prototype

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Constants ──────────────────────────────────────────────────────────────────
readonly CANONICAL_TZ="Asia/Tokyo"
readonly SCHEDULED_HH=8
readonly SCHEDULED_MM=8
readonly GRACE_WINDOW_MINUTES=30
readonly LOG_DIR="${PROJECT_ROOT}/logs"

# ── Argument parsing ───────────────────────────────────────────────────────────
DRY_RUN=false
SKIP_TIME_CHECK=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)            DRY_RUN=true;                        shift ;;
    --skip-time-check)    SKIP_TIME_CHECK=true;               shift ;;
    --simulate-scheduled) DRY_RUN=true; SKIP_TIME_CHECK=true; shift ;;
    *)
      echo "[ERROR] Unknown argument: $1" >&2
      echo "Usage: $0 [--dry-run] [--skip-time-check] [--simulate-scheduled]" >&2
      exit 1
      ;;
  esac
done

# ── Logging ────────────────────────────────────────────────────────────────────
mkdir -p "${LOG_DIR}"

# JST date for log filename — computed before .env load (no credentials involved)
_EARLY_JST_DATE="$(TZ="${CANONICAL_TZ}" date '+%Y-%m-%d')"
readonly LOG_FILE="${LOG_DIR}/x-daily-${_EARLY_JST_DATE}.log"

log() {
  local level="$1"; shift
  local msg="$*"
  local ts
  ts="$(TZ="${CANONICAL_TZ}" date '+%Y-%m-%dT%H:%M:%S%z')"
  printf '%s [%s] %s\n' "${ts}" "${level}" "${msg}" | tee -a "${LOG_FILE}"
}

log "INFO" "run_x_daily.sh started — mode: $( [[ "${DRY_RUN}" == "true" ]] && echo 'dry-run' || echo 'real' )"
log "INFO" "Canonical timezone: ${CANONICAL_TZ}"
log "INFO" "Canonical schedule: $(printf '%02d:%02d' "${SCHEDULED_HH}" "${SCHEDULED_MM}") JST"

# Compute and log grace window bounds arithmetically (portable; no date -v or date -d)
_GRACE_START_MINS=$(( SCHEDULED_HH * 60 + SCHEDULED_MM ))
_GRACE_END_MINS=$(( _GRACE_START_MINS + GRACE_WINDOW_MINUTES ))
_GRACE_END_HH=$(( _GRACE_END_MINS / 60 ))
_GRACE_END_MM=$(( _GRACE_END_MINS % 60 ))
log "INFO" "Grace window: $(printf '%02d:%02d' "${SCHEDULED_HH}" "${SCHEDULED_MM}")–$(printf '%02d:%02d' "${_GRACE_END_HH}" "${_GRACE_END_MM}") JST (${GRACE_WINDOW_MINUTES} min)"

# ── Security guard: .env must not be git-tracked ───────────────────────────────
# This guard runs BEFORE credential load to prevent any path where
# a tracked .env could be sourced and values exposed.
if git -C "${PROJECT_ROOT}" ls-files --error-unmatch .env 2>/dev/null; then
  log "FATAL" ".env is tracked by git — credential leak risk. Aborting immediately."
  exit 2
fi
log "INFO" "Git tracking guard: .env is NOT tracked (correct)"

# ── Safe .env loading ──────────────────────────────────────────────────────────
# SECURITY: set +x ensures shell xtrace is disabled during this block.
# If xtrace were active, sourcing .env would print credential values to stdout/log.
# Never enable xtrace (set -x / bash -x) in production use of this script.
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  set +x
  set -a
  # shellcheck source=/dev/null
  source "${PROJECT_ROOT}/.env"
  set +a
  log "INFO" ".env loaded from ${PROJECT_ROOT}/.env"
else
  log "WARN" ".env not found at ${PROJECT_ROOT}/.env — credential env vars may be unset"
fi

# ── JST time authority ─────────────────────────────────────────────────────────
# All time/date values use TZ=Asia/Tokyo explicitly.
# The host OS timezone setting (/etc/localtime) is irrelevant to this script.
JST_DATE="$(TZ="${CANONICAL_TZ}" date '+%Y-%m-%d')"
JST_TIME="$(TZ="${CANONICAL_TZ}" date '+%H:%M')"
JST_HH_RAW="$(TZ="${CANONICAL_TZ}" date '+%H')"
JST_MM_RAW="$(TZ="${CANONICAL_TZ}" date '+%M')"

log "INFO" "JST current: ${JST_DATE}T${JST_TIME} JST (host TZ independent)"

# ── Grace window check ─────────────────────────────────────────────────────────
if [[ "${SKIP_TIME_CHECK}" == "true" ]]; then
  log "INFO" "Grace window check SKIPPED (--skip-time-check; for testing/simulation only)"
else
  # Force base-10 to prevent octal misparse of zero-padded values (08, 09)
  JST_TIME_MINS=$(( 10#${JST_HH_RAW} * 60 + 10#${JST_MM_RAW} ))

  if (( JST_TIME_MINS < _GRACE_START_MINS || JST_TIME_MINS > _GRACE_END_MINS )); then
    log "SKIP" "Outside grace window: current JST ${JST_TIME} is not within $(printf '%02d:%02d' "${SCHEDULED_HH}" "${SCHEDULED_MM}")–$(printf '%02d:%02d' "${_GRACE_END_HH}" "${_GRACE_END_MM}"). No catch-up publishing."
    exit 0
  fi

  log "INFO" "Grace window check PASSED — ${JST_TIME} JST is within window"
fi

# ── Activation guards ──────────────────────────────────────────────────────────
# Real Scheduled Publishing requires BOTH flags to equal the string 'true'.
# Either flag absent, empty, or any other value → blocked.
# In dry-run mode: guards are logged for inspection but do not block execution.

if [[ "${DRY_RUN}" == "true" ]]; then
  log "INFO" "[DRY-RUN] SCHEDULED_PUBLISH_ENABLED: ${SCHEDULED_PUBLISH_ENABLED:-(not set)}"
  log "INFO" "[DRY-RUN] REAL_PUBLISH_ENABLED: ${REAL_PUBLISH_ENABLED:-(not set)}"
  log "INFO" "[DRY-RUN] Activation guards informational only — zero network, no real publish"
else
  # SCHEDULED_PUBLISH_ENABLED: Real Scheduled Publishing Activation requires explicit
  # Human Approval after X3 Prototype completion (ADR-0026 §15).
  if [[ "${SCHEDULED_PUBLISH_ENABLED:-false}" != "true" ]]; then
    log "BLOCKED" "SCHEDULED_PUBLISH_ENABLED is not 'true'. Set in .env (gitignored) after explicit Human Approval."
    log "BLOCKED" "Real Scheduled Publishing Activation is a separate Human Approval Gate (ADR-0026)."
    exit 1
  fi

  # REAL_PUBLISH_ENABLED: required for any real X API call (existing guard from ADR-0025)
  if [[ "${REAL_PUBLISH_ENABLED:-false}" != "true" ]]; then
    log "BLOCKED" "REAL_PUBLISH_ENABLED is not 'true'. Set in .env (gitignored) to enable real publishing."
    exit 1
  fi

  log "INFO" "Activation guards PASSED"
fi

# ── Credential presence check ──────────────────────────────────────────────────
# Checks variable NAMES only. Values are never printed, never logged.
# Partial credential set → blocked (all 4 X vars required; loadXCredentials enforces same).
MISSING_CREDS=()
for _CRED_VAR in X_API_KEY X_API_SECRET X_ACCESS_TOKEN X_ACCESS_TOKEN_SECRET; do
  if [[ -z "${!_CRED_VAR:-}" ]]; then
    MISSING_CREDS+=("${_CRED_VAR}")
  fi
done

if [[ ${#MISSING_CREDS[@]} -gt 0 ]]; then
  if [[ "${DRY_RUN}" == "true" ]]; then
    log "WARN" "[DRY-RUN] Missing X credential vars: ${MISSING_CREDS[*]} — set in .env (gitignored)"
  else
    log "BLOCKED" "Missing X credential vars: ${MISSING_CREDS[*]} — set in .env (gitignored); never commit values"
    exit 1
  fi
else
  log "INFO" "Credential presence check PASSED (all 4 X vars set; values not logged)"
fi

# ── Invoke daily publish job ───────────────────────────────────────────────────
# FC-1 NOTE (X3-B mandatory):
#   JST_DATE here correctly uses Asia/Tokyo authority.
#   daily_publish_job.js MUST also derive jobId from Asia/Tokyo date — NOT UTC.
#   new Date().toISOString().slice(0,10) returns UTC date and is incorrect at 08:08 JST.
#   FC-1 full resolution is mandatory in X3-B.
DAILY_JOB="${PROJECT_ROOT}/src/lib/daily_publish_job.js"

if [[ ! -f "${DAILY_JOB}" ]]; then
  log "ERROR" "daily_publish_job.js not found at ${DAILY_JOB} — X3-B implementation required"
  exit 1
fi

log "INFO" "Invoking daily publish job — JST date: ${JST_DATE}"

JOB_ARGS=(
  "${DAILY_JOB}"
  "--jst-date" "${JST_DATE}"
  "--scheduled-time" "$(printf '%02d:%02d' "${SCHEDULED_HH}" "${SCHEDULED_MM}")"
  "--timezone" "${CANONICAL_TZ}"
)
if [[ "${DRY_RUN}" == "true" ]]; then
  JOB_ARGS+=("--dry-run")
fi

node "${JOB_ARGS[@]}"
JOB_EXIT=$?

if [[ ${JOB_EXIT} -ne 0 ]]; then
  log "ERROR" "Daily publish job exited with code ${JOB_EXIT}"
  exit "${JOB_EXIT}"
fi

log "INFO" "run_x_daily.sh complete — JST date: ${JST_DATE}"
