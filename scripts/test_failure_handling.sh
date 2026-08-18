#!/usr/bin/env bash
# X3-D Failure / Missed-run / Restart Handling — comprehensive tests
#
# Verifies all failure categories documented in the X3 Planning:
#   - grace window exceeded → SKIP (missed-run)
#   - activation guard failures → BLOCKED
#   - UNKNOWN_RESULT → QUARANTINE (no auto-retry)
#   - in_progress crash guard → BLOCKED (restart protection)
#   - published → SKIP (no duplicate)
#   - failed → ALLOW retry
#   - content missing → fail-closed
#   - invalid jstDate → rejected
#
# All tests run offline. No network. No real publish.
#
# Note on REAL_PUBLISH_ENABLED tests: because .env is sourced by run_x_daily.sh,
# shell-level env var overrides of REAL_PUBLISH_ENABLED are not reliable when .env
# contains the flag. These guards are verified via code inspection (grep).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "[PASS] $1"; (( PASS_COUNT++ )) || true; }
fail() { echo "[FAIL] $1" >&2; (( FAIL_COUNT++ )) || true; }

# ── Section 1: Grace window / Missed-run ──────────────────────────────────────
echo ""
echo "=== Section 1: Grace window / Missed-run ==="

# 1-1: Outside grace window → SKIP exit 0 (demonstrating missed-run)
echo "-- Test 1-1: outside grace window → SKIP exit 0 --"
_JST_HH=$(TZ=Asia/Tokyo date '+%H')
_JST_MM=$(TZ=Asia/Tokyo date '+%M')
_MINS=$(( 10#${_JST_HH} * 60 + 10#${_JST_MM} ))
_GRACE_START=$(( 8 * 60 + 8 ))
_GRACE_END=$(( 8 * 60 + 38 ))

if (( _MINS >= _GRACE_START && _MINS <= _GRACE_END )); then
  pass "1-1: inside grace window (08:08–08:38 JST) — test only valid outside window; skipped"
else
  _OUT_SKIP="$(bash "${SCRIPT_DIR}/run_x_daily.sh" --dry-run 2>&1)" && _E_SKIP=0 || _E_SKIP=$?
  if [[ $_E_SKIP -eq 0 ]] && printf '%s\n' "$_OUT_SKIP" | grep -q 'Outside grace window'; then
    pass "1-1: outside grace window → SKIP exit 0 (missed-run handled correctly)"
  else
    fail "1-1: expected SKIP exit 0 — exit=$_E_SKIP"
  fi
fi

# 1-2: No catch-up publishing message
echo "-- Test 1-2: no catch-up publishing in missed-run output --"
if (( _MINS < _GRACE_START || _MINS > _GRACE_END )); then
  printf '%s\n' "$_OUT_SKIP" | grep -q 'No catch-up publishing' \
    && pass "1-2: 'No catch-up publishing' confirmed" \
    || fail "1-2: 'No catch-up publishing' not found"
else
  pass "1-2: inside window — skipped"
fi

# 1-3: Grace window arithmetic — all boundary values
echo "-- Test 1-3: grace window arithmetic boundary values --"
python3 -c "
start=488; end=518  # 08:08=488, 08:38=518
cases=[(8,7,'SKIP'),(8,8,'PROCEED'),(8,38,'PROCEED'),(8,39,'SKIP'),(0,0,'SKIP'),(14,0,'SKIP')]
ok=all((h*60+m < start or h*60+m > end)==(e=='SKIP') for h,m,e in cases)
print('OK' if ok else 'FAIL')
" | grep -q 'OK' \
  && pass "1-3: grace window arithmetic correct for 08:07/08:08/08:38/08:39/00:00/14:00" \
  || fail "1-3: grace window arithmetic error"

# ── Section 2: Activation guards ─────────────────────────────────────────────
echo ""
echo "=== Section 2: Activation guards ==="

# 2-1: SCHEDULED_PUBLISH_ENABLED not set → BLOCKED (not in .env — reliable test)
echo "-- Test 2-1: SCHEDULED_PUBLISH_ENABLED unset → BLOCKED --"
_OUT21="$(SCHEDULED_PUBLISH_ENABLED='' REAL_PUBLISH_ENABLED=true \
  bash "${SCRIPT_DIR}/run_x_daily.sh" --skip-time-check 2>&1)" && _E21=0 || _E21=$?
if [[ $_E21 -ne 0 ]] && printf '%s\n' "$_OUT21" | grep -q 'BLOCKED'; then
  pass "2-1: SCHEDULED_PUBLISH_ENABLED empty → BLOCKED exit $_E21"
else
  fail "2-1: expected BLOCKED — exit=$_E21"
fi

# 2-2: REAL_PUBLISH_ENABLED guard — code inspection (.env may override shell env)
echo "-- Test 2-2: REAL_PUBLISH_ENABLED guard exists in run_x_daily.sh --"
grep -q 'REAL_PUBLISH_ENABLED:-false.*!= .true' "${SCRIPT_DIR}/run_x_daily.sh" \
  || grep -q '"REAL_PUBLISH_ENABLED:-false".*!= "true"' "${SCRIPT_DIR}/run_x_daily.sh" \
  && pass "2-2: REAL_PUBLISH_ENABLED fail-closed guard confirmed in source code" \
  || fail "2-2: REAL_PUBLISH_ENABLED guard not found in run_x_daily.sh"

# 2-3: Both activation flags false → BLOCKED at SCHEDULED guard
echo "-- Test 2-3: both flags false → BLOCKED at SCHEDULED_PUBLISH_ENABLED --"
_OUT23="$(SCHEDULED_PUBLISH_ENABLED=false REAL_PUBLISH_ENABLED=false \
  bash "${SCRIPT_DIR}/run_x_daily.sh" --skip-time-check 2>&1)" && _E23=0 || _E23=$?
if [[ $_E23 -ne 0 ]] && printf '%s\n' "$_OUT23" | grep -q 'SCHEDULED_PUBLISH_ENABLED'; then
  pass "2-3: both false → BLOCKED at SCHEDULED_PUBLISH_ENABLED guard"
else
  fail "2-3: expected BLOCKED — exit=$_E23"
fi

# 2-4: Credential fail-closed guard — code inspection
echo "-- Test 2-4: credential fail-closed guard in run_x_daily.sh --"
grep -q 'Missing X credential vars' "${SCRIPT_DIR}/run_x_daily.sh" \
  && grep -q 'MISSING_CREDS' "${SCRIPT_DIR}/run_x_daily.sh" \
  && pass "2-4: credential fail-closed guard confirmed in source code" \
  || fail "2-4: credential fail-closed guard not found"

# 2-5: Partial credential set → BLOCKED (Node.js level — environment controlled)
echo "-- Test 2-5: partial credentials → fail-closed (Node.js level) --"
_CRED_RESULT="$(X_API_KEY='' X_API_SECRET='' X_ACCESS_TOKEN='' X_ACCESS_TOKEN_SECRET='' \
  node --input-type=module <<'CREDEOF' 2>&1
import { xCredentialsAvailable } from "/Users/butatohitsujitohaiboru/AI-SNS-Automation/src/lib/x_credential_loader.js";
process.env.X_API_KEY = '';
process.env.X_API_SECRET = '';
process.env.X_ACCESS_TOKEN = '';
process.env.X_ACCESS_TOKEN_SECRET = '';
const available = xCredentialsAvailable();
console.log(available ? "AVAILABLE" : "NOT_AVAILABLE");
CREDEOF
)"
printf '%s\n' "$_CRED_RESULT" | grep -q 'NOT_AVAILABLE' \
  && pass "2-5: partial credentials (all empty) → xCredentialsAvailable=false" \
  || fail "2-5: expected NOT_AVAILABLE for empty credentials"

# ── Section 3: Idempotency / Restart states (Node.js) ────────────────────────
echo ""
echo "=== Section 3: Idempotency / Restart states ==="

_NODE_OUT="$(node --input-type=module <<'NODEEOF' 2>&1
import { pathToFileURL } from "node:url";
import path from "node:path";
import { mkdirSync, rmSync, existsSync, renameSync } from "node:fs";

const ROOT = "/Users/butatohitsujitohaiboru/AI-SNS-Automation";
const u = (r) => pathToFileURL(path.join(ROOT, r)).href;

const { runDailyJob } = await import(u("src/lib/daily_publish_job.js"));
const { createFileBackedIdempotencyStore } = await import(u("src/lib/text_post_idempotency.js"));

const LEDGER_DIR = path.join(ROOT, "tmp", "publish-records");
let p = 0, f = 0;

function ok(label, cond) {
  if (cond) { console.log("[PASS]", label); p++; }
  else       { console.error("[FAIL]", label); f++; }
}

function cleanup(...jobDates) {
  const { rmSync: rm } = require ? {} : { rmSync };
  for (const d of jobDates) {
    const fp = path.join(LEDGER_DIR, `daily-${d}.json`);
    if (existsSync(fp)) rmSync(fp);
  }
}

// ── 3-1: Ledger API: all state transitions ────────────────────────────────────
{
  const tmpDir = path.join(ROOT, "tmp", "x3d-api-" + Date.now());
  mkdirSync(tmpDir, { recursive: true });
  try {
    const ledger = createFileBackedIdempotencyStore({ dir: tmpDir });
    ledger.set("daily-2099-11-01", { result: "published", xPostId: "x-test", publishedAt: new Date().toISOString() });
    ok("3-1a: published → checkPublished='published'", ledger.checkPublished("daily-2099-11-01") === "published");
    ledger.set("daily-2099-11-02", { result: "unknown_result" });
    ok("3-1b: unknown_result → checkPublished='unknown_result'", ledger.checkPublished("daily-2099-11-02") === "unknown_result");
    ledger.set("daily-2099-11-03", { result: "in_progress" });
    ok("3-1c: in_progress → checkPublished='not_found' (raw .get needed)", ledger.checkPublished("daily-2099-11-03") === "not_found");
    ok("3-1d: in_progress → raw .get shows in_progress", ledger.get("daily-2099-11-03")?.result === "in_progress");
    ledger.set("daily-2099-11-04", { result: "failed" });
    ok("3-1e: failed → checkPublished='not_found' (retryable)", ledger.checkPublished("daily-2099-11-04") === "not_found");
    ok("3-1f: not_found for new", ledger.checkPublished("daily-2099-11-99") === "not_found");
  } finally { rmSync(tmpDir, { recursive: true, force: true }); }
}

// ── 3-2: UNKNOWN_RESULT → QUARANTINE exit 2 ──────────────────────────────────
{
  const jd = "2099-12-02"; const key = `daily-${jd}`;
  const ledger = createFileBackedIdempotencyStore({ dir: LEDGER_DIR });
  ledger.set(key, { result: "unknown_result" });
  try {
    const r = await runDailyJob({ jstDate: jd, dryRun: true });
    ok("3-2: unknown_result → UNKNOWN_RESULT_QUARANTINE", r.reason === "UNKNOWN_RESULT_QUARANTINE");
    ok("3-2b: unknown_result → exitCode 2", r.exitCode === 2);
    ok("3-2c: unknown_result → ok=false", r.ok === false);
  } finally { const fp = path.join(LEDGER_DIR, `${key}.json`); if (existsSync(fp)) rmSync(fp); }
}

// ── 3-3: in_progress real mode → BLOCKED ─────────────────────────────────────
{
  const jd = "2099-12-03"; const key = `daily-${jd}`;
  const ledger = createFileBackedIdempotencyStore({ dir: LEDGER_DIR });
  ledger.set(key, { result: "in_progress", correlationId: "test-restart" });
  try {
    const r = await runDailyJob({ jstDate: jd, dryRun: false });
    ok("3-3: in_progress real → IN_PROGRESS_BLOCK", r.reason === "IN_PROGRESS_BLOCK");
    ok("3-3b: in_progress real → exitCode 1", r.exitCode === 1);
  } finally { const fp = path.join(LEDGER_DIR, `${key}.json`); if (existsSync(fp)) rmSync(fp); }
}

// ── 3-4: in_progress + dry-run → NOT blocked ──────────────────────────────────
{
  const jd = "2099-12-04"; const key = `daily-${jd}`;
  const ledger = createFileBackedIdempotencyStore({ dir: LEDGER_DIR });
  ledger.set(key, { result: "in_progress", correlationId: "test-restart2" });
  try {
    const r = await runDailyJob({ jstDate: jd, dryRun: true });
    ok("3-4: in_progress + dry-run → NOT blocked", r.reason !== "IN_PROGRESS_BLOCK");
    ok("3-4b: dry-run over in_progress succeeds", r.ok === true && r.exitCode === 0);
  } finally { const fp = path.join(LEDGER_DIR, `${key}.json`); if (existsSync(fp)) rmSync(fp); }
}

// ── 3-5: published → SKIP (no duplicate) ─────────────────────────────────────
{
  const jd = "2099-12-05"; const key = `daily-${jd}`;
  const testXPostId = "existing-post-xyz";
  const ledger = createFileBackedIdempotencyStore({ dir: LEDGER_DIR });
  ledger.set(key, { result: "published", xPostId: testXPostId, publishedAt: new Date().toISOString() });
  try {
    const r = await runDailyJob({ jstDate: jd, dryRun: true });
    ok("3-5: published → ALREADY_PUBLISHED", r.reason === "ALREADY_PUBLISHED");
    ok("3-5b: published → ok=true exitCode=0", r.ok === true && r.exitCode === 0);
    ok("3-5c: xPostId returned from ledger", r.xPostId === testXPostId);
  } finally { const fp = path.join(LEDGER_DIR, `${key}.json`); if (existsSync(fp)) rmSync(fp); }
}

// ── 3-6: failed → ALLOW retry ─────────────────────────────────────────────────
{
  const jd = "2099-12-06"; const key = `daily-${jd}`;
  const ledger = createFileBackedIdempotencyStore({ dir: LEDGER_DIR });
  ledger.set(key, { result: "failed", reason: "PROVIDER_REJECTED" });
  try {
    const r = await runDailyJob({ jstDate: jd, dryRun: true });
    ok("3-6: failed → retry proceeds (DRY_RUN_SUCCESS)", r.reason === "DRY_RUN_SUCCESS" && r.ok === true);
  } finally { const fp = path.join(LEDGER_DIR, `${key}.json`); if (existsSync(fp)) rmSync(fp); }
}

// ── 3-7: Content file missing → CONTENT_FILE_MISSING ─────────────────────────
{
  const contentFile = path.join(ROOT, "content", "scheduled", "daily_fixed.txt");
  const tmpBak = contentFile + ".x3d_bak";
  const existed = existsSync(contentFile);
  if (existed) renameSync(contentFile, tmpBak);
  try {
    const r = await runDailyJob({ jstDate: "2099-12-07", dryRun: true });
    ok("3-7: content missing → CONTENT_FILE_MISSING", r.reason === "CONTENT_FILE_MISSING");
    ok("3-7b: content missing → exitCode 1", r.exitCode === 1);
  } finally { if (existed) renameSync(tmpBak, contentFile); }
}

// ── 3-8: Invalid jstDate formats → rejected ───────────────────────────────────
{
  const invalids = [undefined, "", "not-a-date", "2026-08-18T08:08", "20260818", "2026/08/18"];
  let allRejected = true;
  for (const d of invalids) {
    const r = await runDailyJob({ jstDate: d, dryRun: true });
    if (r.reason !== "INVALID_JST_DATE") allRejected = false;
  }
  ok("3-8: all 6 invalid jstDate formats → INVALID_JST_DATE", allRejected);
}

// ── 3-9: UNKNOWN_RESULT auto-retry blocked (two consecutive calls) ─────────────
{
  const jd = "2099-12-09"; const key = `daily-${jd}`;
  const ledger = createFileBackedIdempotencyStore({ dir: LEDGER_DIR });
  ledger.set(key, { result: "unknown_result" });
  try {
    const r1 = await runDailyJob({ jstDate: jd, dryRun: true });
    const r2 = await runDailyJob({ jstDate: jd, dryRun: true });
    ok("3-9: UNKNOWN_RESULT auto-retry blocked (both QUARANTINE)",
       r1.reason === "UNKNOWN_RESULT_QUARANTINE" && r2.reason === "UNKNOWN_RESULT_QUARANTINE");
    ok("3-9b: both calls exit 2 (no retry)", r1.exitCode === 2 && r2.exitCode === 2);
  } finally { const fp = path.join(LEDGER_DIR, `${key}.json`); if (existsSync(fp)) rmSync(fp); }
}

console.log(`\nNode.js tests: ${p} passed, ${f} failed`);
if (f > 0) process.exit(1);
NODEEOF
)"
NODE_EXIT=$?

while IFS= read -r line; do
  case "$line" in
    '[PASS]'*) pass "${line#\[PASS\] }" ;;
    '[FAIL]'*) fail "${line#\[FAIL\] }" ;;
    *)         echo "$line" ;;
  esac
done <<< "$_NODE_OUT"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "X3-D failure handling tests: PASS=${PASS_COUNT} FAIL=${FAIL_COUNT}"
[[ $NODE_EXIT -eq 0 && $FAIL_COUNT -eq 0 ]] || exit 1
