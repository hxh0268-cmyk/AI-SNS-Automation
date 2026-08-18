/**
 * Daily Publish Job — X3-B implementation.
 *
 * FC-1 resolved: jstDate parameter uses Asia/Tokyo authority (passed from run_x_daily.sh).
 * jobId = "daily-{jstDate}" — NOT derived from UTC date (new Date().toISOString()).
 *
 * Flow:
 *   1. Validate jstDate
 *   2. File-backed idempotency check (published → SKIP; unknown_result → QUARANTINE;
 *      in_progress [real mode] → BLOCK)
 *   3. Write in_progress crash guard (real mode only)
 *   4. Load content from content/scheduled/daily_fixed.txt (Stage 1)
 *   5. Validate content (≤280 chars, no control chars)
 *   6. Derive contentDigest + idempotencyKey
 *   7. Invoke XRealProviderAdapter (fake transport in dry-run; real transport in real mode)
 *   8. Write safe diagnostic record to tmp/smoke/
 *   9. Update file-backed ledger in tmp/publish-records/
 *
 * CLI: node daily_publish_job.js --jst-date YYYY-MM-DD [--dry-run]
 *                                 [--scheduled-time HH:MM] [--timezone TZ]
 */

import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import https from "node:https";

const __filePath = new URL(import.meta.url).pathname;
const ROOT = path.resolve(path.dirname(__filePath), "../..");

async function lib(name) {
  return import(pathToFileURL(path.join(ROOT, "src", "lib", name)).href);
}

// ── Safe diagnostic record builder ────────────────────────────────────────────
function buildRecord(fields) {
  return {
    schemaVersion: "x3-v1",
    jobId:              fields.jobId,
    scheduledDate:      fields.scheduledDate,
    scheduledTime:      fields.scheduledTime,
    timezone:           fields.timezone,
    correlationId:      fields.correlationId,
    idempotencyKey:     fields.idempotencyKey ?? null,
    scheduledAt:        fields.scheduledAt,
    startedAt:          fields.startedAt,
    requestedAt:        fields.requestedAt ?? null,
    completedAt:        fields.completedAt,
    durationMs:         fields.durationMs ?? null,
    result:             fields.result,
    xPostId:            fields.xPostId ?? null,
    httpStatus:         fields.httpStatus ?? null,
    providerErrorKind:  fields.providerErrorKind ?? null,
    failureCategory:    fields.failureCategory ?? null,
    contentDigest:      fields.contentDigest ?? null,
    contentSource:      "content/scheduled/daily_fixed.txt",
    dryRun:             fields.dryRun,
  };
}

function writeDiagnosticRecord(correlationId, record) {
  const dir = path.join(ROOT, "tmp", "smoke");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, `result-${correlationId}.json`),
    JSON.stringify(record, null, 2),
    "utf-8",
  );
}

// ── Real HTTPS transport (same pattern as smoke_test_x_post.sh) ───────────────
function createRealHttpsTransport() {
  return (url, opts) =>
    new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const reqOpts = {
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname,
        method: opts.method,
        headers: opts.headers,
        rejectUnauthorized: true,
      };

      let requestSent = false;
      const req = https.request(reqOpts, (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => resolve({ status: res.statusCode, body }));
      });

      req.setTimeout(30000, () => {
        const kind = requestSent ? "TIMEOUT_AFTER_SEND" : "TIMEOUT_BEFORE_SEND";
        req.destroy(Object.assign(new Error(`request timeout (${kind})`), { timeoutKind: kind }));
      });

      req.on("error", (err) => {
        if (err.timeoutKind === "TIMEOUT_AFTER_SEND") {
          reject(Object.assign(err, { unknownResult: true }));
        } else {
          reject(err);
        }
      });

      if (opts.body) {
        req.write(opts.body);
        requestSent = true;
      }
      req.end();
    });
}

// ── Fake transport for dry-run (no network) ───────────────────────────────────
function createFakeTransport() {
  return async (_url, _opts) => ({
    status: 201,
    body: JSON.stringify({ data: { id: `dry-run-${Date.now()}` } }),
  });
}

// ── Fake credential loader for dry-run ────────────────────────────────────────
function fakeCredentialLoader() {
  return { apiKey: "dry-run", apiSecret: "dry-run", accessToken: "dry-run", accessTokenSecret: "dry-run" };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run the daily X publish job.
 *
 * @param {{
 *   jstDate: string,       YYYY-MM-DD in Asia/Tokyo (from run_x_daily.sh — FC-1 compliant)
 *   dryRun?: boolean,
 *   scheduledTime?: string, HH:MM (default "08:08")
 *   timezone?: string,      (default "Asia/Tokyo")
 * }} opts
 * @returns {Promise<{ ok: boolean, reason: string, xPostId?: string, exitCode: number }>}
 */
export async function runDailyJob(opts = {}) {
  const {
    jstDate,
    dryRun = false,
    scheduledTime = "08:08",
    timezone = "Asia/Tokyo",
  } = opts;

  // ── 1. Validate jstDate (FC-1: must be Asia/Tokyo date, not UTC) ──────────
  if (!jstDate || typeof jstDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(jstDate)) {
    console.error("[daily_publish_job] ERROR: --jst-date YYYY-MM-DD is required (Asia/Tokyo authority)");
    return { ok: false, reason: "INVALID_JST_DATE", exitCode: 1 };
  }

  const jobId      = `daily-${jstDate}`;
  const scheduledAt = `${jstDate}T${scheduledTime}:00+09:00`;
  const startedAt  = new Date().toISOString();
  const correlationId = `daily-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  console.log(`[daily_publish_job] started — jobId: ${jobId}  dryRun: ${dryRun}`);

  // ── 2. File-backed idempotency check ─────────────────────────────────────
  const { createFileBackedIdempotencyStore } = await lib("text_post_idempotency.js");
  const ledger = createFileBackedIdempotencyStore({
    dir: path.join(ROOT, "tmp", "publish-records"),
  });

  const prior = ledger.get(jobId);
  if (prior) {
    if (prior.result === "published" && prior.xPostId) {
      console.log(`[daily_publish_job] SKIP — ${jobId} already published (xPostId: ${prior.xPostId})`);
      return { ok: true, reason: "ALREADY_PUBLISHED", xPostId: prior.xPostId, exitCode: 0 };
    }
    if (prior.result === "unknown_result") {
      console.error(`[daily_publish_job] QUARANTINE — ${jobId} prior UNKNOWN_RESULT.`);
      console.error(`  Verify X timeline manually. Delete tmp/publish-records/${jobId}.json only if post is confirmed absent on X.`);
      return { ok: false, reason: "UNKNOWN_RESULT_QUARANTINE", exitCode: 2 };
    }
    // in_progress: crash guard — block re-entry in real mode only
    if (prior.result === "in_progress" && !dryRun) {
      console.error(`[daily_publish_job] BLOCKED — ${jobId} in_progress crash guard.`);
      console.error("  A prior real-mode run started but did not complete. Verify X timeline before retrying.");
      return { ok: false, reason: "IN_PROGRESS_BLOCK", exitCode: 1 };
    }
  }

  // ── 3. Write in_progress crash guard (real mode only) ────────────────────
  if (!dryRun) {
    ledger.set(jobId, {
      result: "in_progress",
      correlationId,
      startedAt,
      note: "If this record persists after the job completed, the process crashed — verify X timeline before retrying",
    });
  }

  try {
    // ── 4. Load Stage 1 content ─────────────────────────────────────────────
    const contentFile = path.join(ROOT, "content", "scheduled", "daily_fixed.txt");
    let rawText;
    try {
      rawText = readFileSync(contentFile, "utf-8");
    } catch {
      console.error(`[daily_publish_job] ERROR: content file not found: ${contentFile}`);
      if (!dryRun) ledger.set(jobId, { result: "failed", reason: "CONTENT_FILE_MISSING", correlationId });
      return { ok: false, reason: "CONTENT_FILE_MISSING", exitCode: 1 };
    }

    // ── 5. Validate content ─────────────────────────────────────────────────
    const { validatePostContent } = await lib("text_post_content.js");
    const validated = validatePostContent(rawText);
    if (!validated.ok) {
      console.error(`[daily_publish_job] ERROR: content validation failed: ${validated.error?.message}`);
      if (!dryRun) ledger.set(jobId, { result: "failed", reason: "CONTENT_INVALID", correlationId });
      return { ok: false, reason: "CONTENT_INVALID", exitCode: 1 };
    }
    const { normalizedText, digest: digestValue, charCount } = validated.content;
    console.log(`[daily_publish_job] content: ${charCount} chars  digest: ${digestValue.slice(0, 16)}...`);

    // ── 6. contentDigest + idempotencyKey ────────────────────────────────────
    const idempotencyKey = createHash("sha256")
      .update(`${jobId}:${digestValue}`)
      .digest("hex");

    // ── 7. Invoke XRealProviderAdapter ───────────────────────────────────────
    const { createXRealProviderAdapter } = await lib("x_real_provider_adapter.js");
    const { loadXCredentials } = await lib("x_credential_loader.js");

    const transport       = dryRun ? createFakeTransport()       : createRealHttpsTransport();
    const credentialLoader = dryRun ? fakeCredentialLoader        : loadXCredentials;

    const adapter = createXRealProviderAdapter({ transport, credentialLoader });

    const requestedAt = new Date().toISOString();
    let providerResult;
    let unknownResult = false;

    try {
      providerResult = await adapter.invoke({
        normalizedText,
        correlationId,
        idempotencyKey,
        requestedAt,
      });
    } catch (err) {
      if (err.unknownResult) {
        unknownResult = true;
      } else {
        const completedAt = new Date().toISOString();
        const record = buildRecord({
          jobId, scheduledDate: jstDate, scheduledTime, timezone, correlationId,
          idempotencyKey, scheduledAt, startedAt, requestedAt, completedAt,
          durationMs: Date.now() - new Date(startedAt).getTime(),
          result: "failed", providerErrorKind: "INTERNAL_ERROR",
          failureCategory: "UNEXPECTED_EXCEPTION", contentDigest: digestValue, dryRun,
        });
        writeDiagnosticRecord(correlationId, record);
        if (!dryRun) ledger.set(jobId, { result: "failed", correlationId, completedAt });
        console.error(`[daily_publish_job] ERROR: unexpected exception during invoke: ${err instanceof Error ? err.message : String(err)}`);
        return { ok: false, reason: "UNEXPECTED_EXCEPTION", exitCode: 1 };
      }
    }

    const completedAt = new Date().toISOString();
    const durationMs  = Date.now() - new Date(startedAt).getTime();

    // ── 8. UNKNOWN_RESULT (post-send timeout) ────────────────────────────────
    if (unknownResult) {
      const record = buildRecord({
        jobId, scheduledDate: jstDate, scheduledTime, timezone, correlationId,
        idempotencyKey, scheduledAt, startedAt, requestedAt, completedAt, durationMs,
        result: "unknown_result", providerErrorKind: "TIMEOUT_AFTER_SEND",
        failureCategory: "UNKNOWN_RESULT", contentDigest: digestValue, dryRun,
      });
      writeDiagnosticRecord(correlationId, record);
      if (!dryRun) ledger.set(jobId, { result: "unknown_result", correlationId, completedAt });
      console.error("[daily_publish_job] UNKNOWN_RESULT: post-send timeout. Verify X timeline manually. Do NOT retry automatically.");
      return { ok: false, reason: "UNKNOWN_RESULT", exitCode: 2 };
    }

    // ── 9. Provider failure ──────────────────────────────────────────────────
    if (!providerResult.ok) {
      const errKind = providerResult.error?.kind ?? "PROVIDER_FAILED";
      const record = buildRecord({
        jobId, scheduledDate: jstDate, scheduledTime, timezone, correlationId,
        idempotencyKey, scheduledAt, startedAt, requestedAt, completedAt, durationMs,
        result: "failed", providerErrorKind: errKind, failureCategory: errKind,
        contentDigest: digestValue, dryRun,
      });
      writeDiagnosticRecord(correlationId, record);
      if (!dryRun) ledger.set(jobId, { result: "failed", correlationId, completedAt });
      console.error(`[daily_publish_job] FAILED — providerErrorKind: ${errKind}`);
      return { ok: false, reason: errKind, exitCode: 1 };
    }

    // ── 10. Success ──────────────────────────────────────────────────────────
    const xPostId     = providerResult.result.xPostId;
    const publishedAt = providerResult.result.publishedAt;
    const resultLabel = dryRun ? "dry_run_success" : "published";

    const record = buildRecord({
      jobId, scheduledDate: jstDate, scheduledTime, timezone, correlationId,
      idempotencyKey, scheduledAt, startedAt, requestedAt, completedAt, durationMs,
      result: resultLabel, xPostId, httpStatus: 201, contentDigest: digestValue, dryRun,
    });
    writeDiagnosticRecord(correlationId, record);

    if (!dryRun) {
      ledger.set(jobId, { result: "published", xPostId, publishedAt, correlationId, completedAt });
      console.log(`[daily_publish_job] PUBLISHED — xPostId: ${xPostId}  duration: ${durationMs}ms`);
    } else {
      console.log(`[daily_publish_job] DRY-RUN SUCCESS — simulated xPostId: ${xPostId}  duration: ${durationMs}ms`);
    }

    return { ok: true, reason: dryRun ? "DRY_RUN_SUCCESS" : "PUBLISHED", xPostId, exitCode: 0 };

  } catch (err) {
    const completedAt = new Date().toISOString();
    try {
      if (!dryRun) ledger.set(jobId, { result: "failed", reason: "UNEXPECTED_ERROR", correlationId, completedAt });
    } catch { /* secondary */ }
    console.error(`[daily_publish_job] ERROR: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, reason: "UNEXPECTED_ERROR", exitCode: 1 };
  }
}

// ── CLI entry point (invoked by run_x_daily.sh) ───────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opts = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--jst-date":
        if (i + 1 < args.length) opts.jstDate = args[++i];
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--scheduled-time":
        if (i + 1 < args.length) opts.scheduledTime = args[++i];
        break;
      case "--timezone":
        if (i + 1 < args.length) opts.timezone = args[++i];
        break;
      default:
        console.error(`[daily_publish_job] unknown argument: ${args[i]}`);
        process.exit(1);
    }
  }

  runDailyJob(opts)
    .then((r) => { process.exit(r.exitCode ?? (r.ok ? 0 : 1)); })
    .catch((err) => {
      console.error(`[daily_publish_job] fatal: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    });
}
