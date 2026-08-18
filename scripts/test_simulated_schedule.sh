#!/usr/bin/env bash
# X3-C Simulated Scheduled Execution — end-to-end tests
#
# Verifies that --simulate-scheduled (= --dry-run + --skip-time-check) runs
# correctly without any real network, real post, or credential exposure.
#
# DoD coverage:
#   #17 dry-run available
#   #18 simulated 08:08 schedule test available
#   #5  scheduler double-fire safe (dry-run re-runnable)
#   #10 credential-safe
#   #11 no secret logging
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "[PASS] $1"; (( PASS_COUNT++ )) || true; }
fail() { echo "[FAIL] $1" >&2; (( FAIL_COUNT++ )) || true; }

# ── Helper: run --simulate-scheduled and capture output + exit code ───────────
run_simulated() {
  local out exit_code
  out="$(bash "${SCRIPT_DIR}/run_x_daily.sh" --simulate-scheduled 2>&1)" && exit_code=0 || exit_code=$?
  printf '%s\n' "$out"
  return "$exit_code"
}

# ── Test 1: --simulate-scheduled exits 0 ─────────────────────────────────────
# Synthetic date 2099-01-15 isolates from production ledger — real ledger never touched.
echo "-- Test 1: --simulate-scheduled exits 0 --"
_OUT="$(bash "${SCRIPT_DIR}/run_x_daily.sh" --simulate-scheduled --jst-date 2099-01-15 2>&1)" && _EXIT=0 || _EXIT=$?
if [[ $_EXIT -eq 0 ]]; then pass "--simulate-scheduled exit 0"; else fail "--simulate-scheduled exit $_EXIT"; fi

# ── Test 2: Output contains DRY-RUN SUCCESS ───────────────────────────────────
echo "-- Test 2: DRY-RUN SUCCESS in output --"
printf '%s\n' "$_OUT" | grep -q 'DRY-RUN SUCCESS' \
  && pass "output contains DRY-RUN SUCCESS" \
  || fail "DRY-RUN SUCCESS not found in output"

# ── Test 3: Mode logged as dry-run ───────────────────────────────────────────
echo "-- Test 3: mode logged as dry-run --"
printf '%s\n' "$_OUT" | grep -q 'mode: dry-run' \
  && pass "mode: dry-run logged" \
  || fail "mode: dry-run not found in output"

# ── Test 4: Grace window check SKIPPED (--simulate-scheduled bypasses it) ────
echo "-- Test 4: grace window check skipped --"
printf '%s\n' "$_OUT" | grep -q 'Grace window check SKIPPED' \
  && pass "grace window check SKIPPED" \
  || fail "grace window check was not skipped"

# ── Test 5: Canonical timezone Asia/Tokyo logged ──────────────────────────────
echo "-- Test 5: Asia/Tokyo timezone logged --"
printf '%s\n' "$_OUT" | grep -q 'Asia/Tokyo' \
  && pass "canonical timezone Asia/Tokyo logged" \
  || fail "Asia/Tokyo not found in output"

# ── Test 6: 08:08 JST schedule logged ────────────────────────────────────────
echo "-- Test 6: 08:08 JST schedule logged --"
printf '%s\n' "$_OUT" | grep -q '08:08 JST' \
  && pass "08:08 JST schedule logged" \
  || fail "08:08 JST not found in output"

# ── Test 7: JST date logged (YYYY-MM-DD format) ───────────────────────────────
echo "-- Test 7: JST date in output --"
printf '%s\n' "$_OUT" | grep -qE 'JST date: [0-9]{4}-[0-9]{2}-[0-9]{2}' \
  && pass "JST date logged in YYYY-MM-DD format" \
  || fail "JST date not found in output"

# ── Test 8: Activation guards are informational (not blocking in dry-run) ─────
echo "-- Test 8: activation guards informational --"
printf '%s\n' "$_OUT" | grep -q 'Activation guards informational only' \
  && pass "activation guards are informational only" \
  || fail "activation guards informational message not found"

# ── Test 9: No real network call (simulated xPostId starts with dry-run-) ─────
echo "-- Test 9: simulated xPostId (no real network) --"
printf '%s\n' "$_OUT" | grep -qE 'simulated xPostId: dry-run-[0-9]+' \
  && pass "simulated xPostId confirms no real network" \
  || fail "simulated xPostId not found — may indicate real network attempt"

# ── Test 10: Credential values not in output ─────────────────────────────────
echo "-- Test 10: no credential values in output --"
if printf '%s\n' "$_OUT" | grep -qE '[A-Za-z0-9+/]{40,}'; then
  fail "potential credential-length string in output"
else
  pass "no credential-length strings in output"
fi

# ── Test 11: .env not tracked (git tracking guard passes) ─────────────────────
echo "-- Test 11: .env git tracking guard --"
printf '%s\n' "$_OUT" | grep -q 'NOT tracked (correct)' \
  && pass ".env git tracking guard PASSED" \
  || fail ".env git tracking guard message not found"

# ── Test 12: Diagnostic record written to tmp/smoke/ ─────────────────────────
# Synthetic date 2099-01-15 — not in production ledger → reaches DRY-RUN SUCCESS → writes record.
echo "-- Test 12: diagnostic record written --"
_SMOKE_DIR="${PROJECT_ROOT}/tmp/smoke"
_BEFORE=$(ls "${_SMOKE_DIR}"/*.json 2>/dev/null | wc -l || echo 0)
bash "${SCRIPT_DIR}/run_x_daily.sh" --simulate-scheduled --jst-date 2099-01-15 > /dev/null 2>&1 || true
_AFTER=$(ls "${_SMOKE_DIR}"/*.json 2>/dev/null | wc -l || echo 0)
if (( _AFTER > _BEFORE )); then
  pass "diagnostic record written to tmp/smoke/"
else
  fail "no new diagnostic record found in tmp/smoke/"
fi

# ── Test 13: No publish-records/ ledger write in dry-run ─────────────────────
echo "-- Test 13: dry-run does not write to publish-records/ --"
_JST_DATE="$(TZ=Asia/Tokyo date '+%Y-%m-%d')"
_LEDGER="${PROJECT_ROOT}/tmp/publish-records/daily-${_JST_DATE}.json"
_EXISTED=false
[[ -f "${_LEDGER}" ]] && _EXISTED=true

bash "${SCRIPT_DIR}/run_x_daily.sh" --simulate-scheduled > /dev/null 2>&1 || true

if [[ "${_EXISTED}" == "true" ]]; then
  pass "publish-records/ entry pre-existed (not created by this run — acceptable)"
else
  if [[ -f "${_LEDGER}" ]]; then
    fail "dry-run wrote to publish-records/ — should not persist ledger entries"
  else
    pass "dry-run did NOT write to publish-records/ ledger"
  fi
fi

# ── Test 14: Double-fire safety — two consecutive --simulate-scheduled ─────────
# Synthetic date isolates from production ledger. Dry-run never writes ledger →
# both runs are re-runnable and independently reach DRY-RUN SUCCESS.
echo "-- Test 14: double-fire safety (two consecutive runs) --"
_OUT1="$(bash "${SCRIPT_DIR}/run_x_daily.sh" --simulate-scheduled --jst-date 2099-01-15 2>&1)" && _E1=0 || _E1=$?
_OUT2="$(bash "${SCRIPT_DIR}/run_x_daily.sh" --simulate-scheduled --jst-date 2099-01-15 2>&1)" && _E2=0 || _E2=$?
if [[ $_E1 -eq 0 && $_E2 -eq 0 ]]; then
  pass "double-fire: both runs exit 0 (dry-run re-runnable — correct)"
else
  fail "double-fire: unexpected exit — E1=$_E1 E2=$_E2"
fi
printf '%s\n' "$_OUT1" | grep -q 'DRY-RUN SUCCESS' && pass "double-fire: run 1 DRY-RUN SUCCESS" || fail "double-fire: run 1 no DRY-RUN SUCCESS"
printf '%s\n' "$_OUT2" | grep -q 'DRY-RUN SUCCESS' && pass "double-fire: run 2 DRY-RUN SUCCESS" || fail "double-fire: run 2 no DRY-RUN SUCCESS"

# ── Test 15: --simulate-scheduled equivalent to --dry-run --skip-time-check ───
# Both forms use synthetic date to isolate from production ledger.
echo "-- Test 15: --simulate-scheduled == --dry-run --skip-time-check --"
_OUT_SIM="$(bash "${SCRIPT_DIR}/run_x_daily.sh" --simulate-scheduled --jst-date 2099-01-15 2>&1)" && _ES=0 || _ES=$?
_OUT_DST="$(bash "${SCRIPT_DIR}/run_x_daily.sh" --dry-run --skip-time-check --jst-date 2099-01-15 2>&1)" && _ED=0 || _ED=$?
# Both should exit 0 and contain DRY-RUN SUCCESS
if [[ $_ES -eq 0 && $_ED -eq 0 ]]; then
  pass "--simulate-scheduled and --dry-run --skip-time-check both exit 0"
else
  fail "--simulate-scheduled vs --dry-run --skip-time-check mismatch: ES=$_ES ED=$_ED"
fi
printf '%s\n' "$_OUT_SIM" | grep -q 'DRY-RUN SUCCESS' \
  && printf '%s\n' "$_OUT_DST" | grep -q 'DRY-RUN SUCCESS' \
  && pass "both modes produce DRY-RUN SUCCESS" \
  || fail "mode output mismatch"

# ── Test 16: Unknown argument is rejected ─────────────────────────────────────
echo "-- Test 16: unknown argument rejected --"
bash "${SCRIPT_DIR}/run_x_daily.sh" --unknown-flag > /dev/null 2>&1 && _UNKNOWN_EXIT=0 || _UNKNOWN_EXIT=$?
if [[ $_UNKNOWN_EXIT -ne 0 ]]; then
  pass "unknown argument correctly rejected (exit $_UNKNOWN_EXIT)"
else
  fail "unknown argument was not rejected"
fi

# ── Test 17: ALREADY_PUBLISHED idempotency guard (regression — dedicated) ────
# Separate from Tests 1-15 which verify DRY-RUN SUCCESS execution.
# This test verifies the idempotency guard itself: when a prior published entry
# exists in the ledger, --simulate-scheduled returns ALREADY_PUBLISHED exit 0.
# Uses synthetic date 2099-01-16 with a temporary fixture (created + cleaned up here).
# M-2 fix: trap ensures synthetic fixture cleanup on SIGINT/SIGTERM/set-e exits.
# Only removes the specific synthetic file — production ledger is never referenced.
echo "-- Test 17: ALREADY_PUBLISHED idempotency guard (published ledger) --"
_T17_DATE="2099-01-16"
_T17_LEDGER="${PROJECT_ROOT}/tmp/publish-records/daily-${_T17_DATE}.json"
trap 'rm -f "${_T17_LEDGER}"' EXIT
mkdir -p "${PROJECT_ROOT}/tmp/publish-records"
cat > "${_T17_LEDGER}" <<'T17FIXTURE'
{"result":"published","xPostId":"test-x3c-already-pub","publishedAt":"2099-01-16T08:08:00.000Z"}
T17FIXTURE
_T17_OUT="$(bash "${SCRIPT_DIR}/run_x_daily.sh" --simulate-scheduled --jst-date "${_T17_DATE}" 2>&1)" && _T17_E=0 || _T17_E=$?
rm -f "${_T17_LEDGER}"
trap - EXIT
if [[ $_T17_E -eq 0 ]] && printf '%s\n' "$_T17_OUT" | grep -q 'already published'; then
  pass "17: published-ledger date → ALREADY_PUBLISHED exit 0 (idempotency guard confirmed)"
else
  fail "17: ALREADY_PUBLISHED not returned for pre-published date — exit=${_T17_E}"
fi

# ── Tests 18-21: --jst-date argument validation (M-1 regression) ──────────────
# Verifies that --jst-date input validation is fail-closed.

# 18: empty value → rejected non-zero
echo "-- Test 18: --jst-date '' → rejected non-zero (M-1 regression) --"
bash "${SCRIPT_DIR}/run_x_daily.sh" --simulate-scheduled --jst-date "" > /dev/null 2>&1 && _E18=0 || _E18=$?
if [[ $_E18 -ne 0 ]]; then
  pass "18: --jst-date '' → rejected exit ${_E18}"
else
  fail "18: --jst-date '' was not rejected (silent ignore not allowed)"
fi

# 19: non-zero-padded / wrong format → rejected non-zero
echo "-- Test 19: --jst-date '2099-1-5' → rejected non-zero (format) --"
bash "${SCRIPT_DIR}/run_x_daily.sh" --simulate-scheduled --jst-date "2099-1-5" > /dev/null 2>&1 && _E19=0 || _E19=$?
if [[ $_E19 -ne 0 ]]; then
  pass "19: --jst-date '2099-1-5' → rejected exit ${_E19}"
else
  fail "19: --jst-date '2099-1-5' was not rejected"
fi

# 20: valid date but no --dry-run flag → rejected non-zero (real-mode guard)
echo "-- Test 20: --jst-date 2099-01-15 without --dry-run → rejected non-zero --"
bash "${SCRIPT_DIR}/run_x_daily.sh" --jst-date "2099-01-15" > /dev/null 2>&1 && _E20=0 || _E20=$?
if [[ $_E20 -ne 0 ]]; then
  pass "20: --jst-date without --dry-run → FATAL exit ${_E20}"
else
  fail "20: --jst-date without --dry-run was not rejected"
fi

# 21: valid synthetic date + --dry-run → exit 0 (confirm fix does not break valid usage)
echo "-- Test 21: valid --jst-date + --dry-run → exit 0 (valid usage unbroken) --"
bash "${SCRIPT_DIR}/run_x_daily.sh" --simulate-scheduled --jst-date "2099-01-15" > /dev/null 2>&1 && _E21=0 || _E21=$?
if [[ $_E21 -eq 0 ]]; then
  pass "21: valid --jst-date + --simulate-scheduled → exit 0"
else
  fail "21: valid --jst-date + --simulate-scheduled unexpectedly rejected exit=${_E21}"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "X3-C simulated schedule tests: PASS=${PASS_COUNT} FAIL=${FAIL_COUNT}"
[[ $FAIL_COUNT -eq 0 ]] || exit 1
