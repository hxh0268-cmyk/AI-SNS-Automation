#!/usr/bin/env bash
# X3-B Daily Publish Job — unit tests
# Tests run offline: no network, no X API call, no real publish.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "[PASS] $1"; (( PASS_COUNT++ )) || true; }
fail() { echo "[FAIL] $1" >&2; (( FAIL_COUNT++ )) || true; }

# ── Run all checks via a single Node.js process ───────────────────────────────
_NODE_OUTPUT="$(node --input-type=module <<NODEEOF 2>&1
import { pathToFileURL } from "node:url";
import path from "node:path";
import { mkdirSync, rmSync, existsSync, renameSync, readdirSync } from "node:fs";

const ROOT = "${PROJECT_ROOT}";
const u    = (r) => pathToFileURL(path.join(ROOT, r)).href;

let p = 0, f = 0;
function ok(label, cond, detail) {
  if (cond) { console.log("[PASS]", label); p++; }
  else       { console.error("[FAIL]", label, detail ? ("— " + detail) : ""); f++; }
}

// 1. Module exports
const { runDailyJob } = await import(u("src/lib/daily_publish_job.js"));
ok("runDailyJob exported as function", typeof runDailyJob === "function");

// 2. Invalid jstDate inputs
ok("undefined jstDate → INVALID_JST_DATE",
  (await runDailyJob({ jstDate: undefined, dryRun: true })).reason === "INVALID_JST_DATE");
ok("'not-a-date' → INVALID_JST_DATE",
  (await runDailyJob({ jstDate: "not-a-date", dryRun: true })).reason === "INVALID_JST_DATE");
ok("datetime string → INVALID_JST_DATE",
  (await runDailyJob({ jstDate: "2026-08-15T08:08", dryRun: true })).reason === "INVALID_JST_DATE");
ok("empty string → INVALID_JST_DATE",
  (await runDailyJob({ jstDate: "", dryRun: true })).reason === "INVALID_JST_DATE");

// 3. Valid date format is accepted (FC-1: function accepts jstDate from Asia/Tokyo authority)
{
  const r = await runDailyJob({ jstDate: "2099-01-01", dryRun: true });
  ok("valid YYYY-MM-DD accepted (not INVALID_JST_DATE)", r.reason !== "INVALID_JST_DATE");
}

// 4. Missing content file
{
  const contentFile = path.join(ROOT, "content", "scheduled", "daily_fixed.txt");
  const tmpBak      = contentFile + ".bak_test";
  const existed = existsSync(contentFile);
  if (existed) renameSync(contentFile, tmpBak);
  try {
    const r = await runDailyJob({ jstDate: "2099-01-02", dryRun: true });
    ok("missing content file → CONTENT_FILE_MISSING", r.reason === "CONTENT_FILE_MISSING" && r.exitCode === 1);
  } finally {
    if (existed) renameSync(tmpBak, contentFile);
  }
}

// 5. Successful dry-run
{
  const r = await runDailyJob({ jstDate: "2099-01-03", dryRun: true });
  ok("dry-run ok=true",                r.ok === true);
  ok("dry-run reason=DRY_RUN_SUCCESS", r.reason === "DRY_RUN_SUCCESS");
  ok("dry-run exitCode=0",             r.exitCode === 0);
  ok("dry-run simulated xPostId",      typeof r.xPostId === "string" && r.xPostId.startsWith("dry-run-"));
}

// 6. Diagnostic record written to tmp/smoke/
{
  const smokeDir = path.join(ROOT, "tmp", "smoke");
  const before   = existsSync(smokeDir) ? readdirSync(smokeDir).filter(f => f.startsWith("result-")).length : 0;
  await runDailyJob({ jstDate: "2099-01-04", dryRun: true });
  const after    = existsSync(smokeDir) ? readdirSync(smokeDir).filter(f => f.startsWith("result-")).length : 0;
  ok("diagnostic record written to tmp/smoke/", after > before);
}

// 7. Dry-run does NOT write to publish-records ledger
{
  const recordFile = path.join(ROOT, "tmp", "publish-records", "daily-2099-01-05.json");
  if (existsSync(recordFile)) rmSync(recordFile);
  await runDailyJob({ jstDate: "2099-01-05", dryRun: true });
  ok("dry-run does NOT write to publish-records/", !existsSync(recordFile));
}

// 8. Two dry-runs with same date both succeed (no blocking)
{
  const r1 = await runDailyJob({ jstDate: "2099-02-01", dryRun: true });
  const r2 = await runDailyJob({ jstDate: "2099-02-01", dryRun: true });
  ok("dry-run is re-runnable (no in_progress block)", r1.ok && r2.ok);
}

// 9. Ledger API: checkPublished states (via existing store)
{
  const { createFileBackedIdempotencyStore } = await import(u("src/lib/text_post_idempotency.js"));
  const tmpDir = path.join(ROOT, "tmp", "test-ledger-" + Date.now());
  mkdirSync(tmpDir, { recursive: true });
  try {
    const ledger = createFileBackedIdempotencyStore({ dir: tmpDir });
    ledger.set("daily-2099-06-01", { result: "published", xPostId: "x123", publishedAt: new Date().toISOString() });
    ok("ledger: published state readable",    ledger.checkPublished("daily-2099-06-01") === "published");
    ledger.set("daily-2099-06-02", { result: "unknown_result" });
    ok("ledger: unknown_result state readable", ledger.checkPublished("daily-2099-06-02") === "unknown_result");
    ok("ledger: not_found for new jobId",    ledger.checkPublished("daily-2099-06-03") === "not_found");
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// 10. Content file char count is within X limit
{
  const { readFileSync } = await import("node:fs");
  const { validatePostContent } = await import(u("src/lib/text_post_content.js"));
  const rawText = readFileSync(path.join(ROOT, "content", "scheduled", "daily_fixed.txt"), "utf-8");
  const v = validatePostContent(rawText);
  ok("daily_fixed.txt passes validatePostContent", v.ok === true);
  ok("daily_fixed.txt charCount <= 280", v.ok && v.content.charCount <= 280);
}

console.log(\`\nX3-B tests: \${p} passed, \${f} failed\`);
if (f > 0) process.exit(1);
NODEEOF
)"
NODE_EXIT=$?

# Relay output and tally
while IFS= read -r line; do
  case "$line" in
    '[PASS]'*) pass "${line#\[PASS\] }" ;;
    '[FAIL]'*) fail "${line#\[FAIL\] }" ;;
    *)         echo "$line" ;;
  esac
done <<< "$_NODE_OUTPUT"

echo ""
echo "Results: PASS=${PASS_COUNT} FAIL=${FAIL_COUNT}"
[[ $NODE_EXIT -eq 0 && $FAIL_COUNT -eq 0 ]] || exit 1
