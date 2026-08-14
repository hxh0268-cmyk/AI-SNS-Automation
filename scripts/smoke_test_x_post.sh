#!/usr/bin/env bash
# X2 Fixed-Text Smoke Test — POST /2/tweets
#
# Authorized by ADR-0025. Executes one fixed-text post to verify
# the X Real Provider Adapter works end-to-end with real credentials.
#
# Usage:
#   ./scripts/smoke_test_x_post.sh --dry-run  --actor <identity>
#   ./scripts/smoke_test_x_post.sh --execute  --actor <identity>
#
# --dry-run : Preview all parameters; zero network; kill switch OFF
# --execute : Perform real POST /2/tweets; requires REAL_PUBLISH_ENABLED=true in .env
# --actor   : Human actor identity string (required)
#
# Safety invariants:
#   1. No network call without --execute
#   2. No network call without REAL_PUBLISH_ENABLED=true
#   3. Human approval record required (--actor)
#   4. Idempotency: skip if today's job already published
#   5. UNKNOWN_RESULT: quarantine on post-send timeout; no auto-retry
#   6. No secret values in output or audit records
#   7. Manual cleanup required: delete test post on X after verification
#
# ADR-0025 §9 — X2 Smoke Test Procedure
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Argument parsing ──────────────────────────────────────────────────────────
DRY_RUN=false
EXECUTE=false
ACTOR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)  DRY_RUN=true; shift ;;
    --execute)  EXECUTE=true; shift ;;
    --actor)    [[ $# -gt 1 ]] || { echo "[ERROR] --actor requires a value" >&2; exit 1; }
                ACTOR="$2"; shift 2 ;;
    *) echo "[ERROR] Unknown argument: $1" >&2; echo "Usage: $0 --dry-run|--execute --actor <name>" >&2; exit 1 ;;
  esac
done

# ── Validation ────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "false" && "$EXECUTE" == "false" ]]; then
  echo "[ERROR] Specify --dry-run or --execute" >&2
  exit 1
fi
if [[ "$DRY_RUN" == "true" && "$EXECUTE" == "true" ]]; then
  echo "[ERROR] --dry-run and --execute are mutually exclusive" >&2
  exit 1
fi
if [[ -z "$ACTOR" ]]; then
  echo "[ERROR] --actor <identity> is required (human approval)" >&2
  exit 1
fi

MODE="dry-run"
[[ "$EXECUTE" == "true" ]] && MODE="execute"

echo ""
echo "============================================================"
echo " X2 Fixed-Text Smoke Test — mode: $MODE"
echo "============================================================"
echo ""

# ── Main logic (Node.js) ─────────────────────────────────────────────────────
node --input-type=module <<NODEEOF
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import https from "node:https";

const ROOT    = process.cwd();
const u       = (r) => pathToFileURL(path.join(ROOT, r)).href;
const DRY_RUN = "${DRY_RUN}" === "true";
const ACTOR   = "${ACTOR}";
const MODE    = "${MODE}";

// ── Fixed smoke test text (ADR-0025 §9) ──────────────────────────────────────
const FIXED_TEXT = "AI-SNS-Automation X publishing smoke test [delete after verify]";

// ── Imports ───────────────────────────────────────────────────────────────────
const { validatePostContent, normalizePostText, contentDigest } =
  await import(u("src/lib/text_post_content.js"));
const { createXRealProviderAdapter } =
  await import(u("src/lib/x_real_provider_adapter.js"));
const { loadXCredentials, xCredentialsAvailable } =
  await import(u("src/lib/x_credential_loader.js"));
const { createFileBackedIdempotencyStore } =
  await import(u("src/lib/text_post_idempotency.js"));

// ── Step 0: Content validation ────────────────────────────────────────────────
const validated = validatePostContent(FIXED_TEXT);
if (!validated.ok) {
  console.error("[FATAL] Fixed text failed validation:", validated.error?.message);
  process.exit(1);
}
const normalizedText = validated.content.normalizedText;
const digest = validated.content.digest;
const charCount = validated.content.charCount;

// ── Step 1: IDs ───────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);  // YYYY-MM-DD
const jobId = \`smoke-test-\${today}\`;
const correlationId = \`smoke-\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`;
const idempotencyKey = createHash("sha256").update(jobId + digest).digest("hex");

// ── Step 2: Idempotency check ─────────────────────────────────────────────────
const smokeDir = path.join(ROOT, "tmp", "smoke");
const ledger = createFileBackedIdempotencyStore({ dir: path.join(ROOT, "tmp", "publish-records") });
const priorStatus = ledger.checkPublished(jobId);

// ── Display plan ───────────────────────────────────────────────────────────────
console.log("=== X2 Smoke Test Parameters ===");
console.log("  mode:           ", MODE);
console.log("  actor:          ", ACTOR);
console.log("  normalizedText: ", normalizedText);
console.log("  charCount:      ", charCount, "(≤280 ✓)");
console.log("  contentDigest:  ", digest);
console.log("  jobId:          ", jobId);
console.log("  correlationId:  ", correlationId);
console.log("  idempotencyKey: ", idempotencyKey);
console.log("  endpoint:       ", "POST https://api.x.com/2/tweets");
console.log("  priorStatus:    ", priorStatus);
console.log("  REAL_PUBLISH_ENABLED:", process.env.REAL_PUBLISH_ENABLED ?? "(not set)");
console.log("  xCredentialsAvailable:", xCredentialsAvailable());
console.log("");

if (priorStatus === "published") {
  console.log("[SKIP] Idempotency: smoke-test already published today.");
  console.log("       jobId:", jobId, "— delete tmp/publish-records/" + jobId + ".json to reset.");
  process.exit(0);
}

if (priorStatus === "unknown_result") {
  console.log("[QUARANTINE] Previous smoke test for", jobId, "ended in UNKNOWN_RESULT.");
  console.log("             Verify X timeline manually before retrying.");
  console.log("             If post is NOT on X: delete tmp/publish-records/" + jobId + ".json to retry.");
  console.log("             If post IS on X: record xPostId and mark as resolved.");
  process.exit(2);
}

// ── Dry-run exit ──────────────────────────────────────────────────────────────
if (DRY_RUN) {
  console.log("=== DRY-RUN: No network call. Inspect above parameters. ===");
  console.log("  kill switch:  OFF (not enabled in dry-run)");
  console.log("  network:      NO CALL");
  console.log("  OAuth:        NOT EXECUTED");
  console.log("  xPostId:      N/A");
  console.log("");
  console.log("If parameters look correct, run with --execute:");
  console.log("  REAL_PUBLISH_ENABLED=true ./scripts/smoke_test_x_post.sh --execute --actor '" + ACTOR + "'");
  process.exit(0);
}

// ── Execute path ──────────────────────────────────────────────────────────────
if (process.env.REAL_PUBLISH_ENABLED !== "true") {
  console.error("[BLOCKED] REAL_PUBLISH_ENABLED is not 'true'.");
  console.error("          Set REAL_PUBLISH_ENABLED=true in .env and re-run with --execute.");
  process.exit(1);
}

if (!xCredentialsAvailable()) {
  console.error("[BLOCKED] X credentials not available.");
  console.error("          Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET in .env");
  process.exit(1);
}

// ── Human approval record ─────────────────────────────────────────────────────
const approval = {
  actorId: ACTOR,
  approvedAt: new Date().toISOString(),
  contentDigest: digest,
  normalizedText,
};
console.log("=== Human Approval ===");
console.log("  actorId:    ", approval.actorId);
console.log("  approvedAt: ", approval.approvedAt);
console.log("  digest:     ", approval.contentDigest);
console.log("");

// ── Real HTTPS transport ──────────────────────────────────────────────────────
function createRealHttpsTransport() {
  return function transport(url, opts) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const reqOpts = {
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname,
        method: opts.method,
        headers: opts.headers,
        rejectUnauthorized: true,  // TLS verification ON
      };

      let requestSent = false;
      const req = https.request(reqOpts, (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => resolve({ status: res.statusCode, body }));
      });

      // Socket timeout (fires before or after send)
      req.setTimeout(30000, () => {
        const kind = requestSent ? "TIMEOUT_AFTER_SEND" : "TIMEOUT_BEFORE_SEND";
        req.destroy(Object.assign(new Error(\`request timeout (\${kind})\`), { timeoutKind: kind }));
      });

      req.on("error", (err) => {
        if (err.timeoutKind === "TIMEOUT_AFTER_SEND") {
          // Post-send timeout: UNKNOWN_RESULT — do NOT retry
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
  };
}

// ── Invoke ────────────────────────────────────────────────────────────────────
console.log("=== Executing POST /2/tweets ===");

const transport = createRealHttpsTransport();
const adapter = createXRealProviderAdapter({
  transport,
  credentialLoader: loadXCredentials,
});

const requestedAt = new Date().toISOString();
let result;
let unknownResult = false;

try {
  result = await adapter.invoke({
    normalizedText,
    correlationId,
    idempotencyKey,
    requestedAt,
  });
} catch (err) {
  if (err.unknownResult) {
    unknownResult = true;
    console.error("[UNKNOWN_RESULT] Post-send timeout: cannot determine if POST was received.");
    console.error("                Verify X timeline manually. Do NOT retry automatically.");
  } else {
    console.error("[ERROR] Unexpected exception:", err.message);
    process.exit(1);
  }
}

// ── Result handling ────────────────────────────────────────────────────────────
if (unknownResult) {
  if (!existsSync(smokeDir)) mkdirSync(smokeDir, { recursive: true });
  const resultRecord = {
    jobId, correlationId, idempotencyKey,
    result: "unknown_result", xPostId: null,
    requestedAt, actorId: ACTOR, contentDigest: digest,
    failureCategory: "UNKNOWN_RESULT",
    note: "Verify X timeline manually; no auto-retry permitted",
  };
  ledger.set(jobId, { result: "unknown_result", xPostId: null });
  writeFileSync(path.join(smokeDir, \`result-\${correlationId}.json\`), JSON.stringify(resultRecord, null, 2));
  console.log("[QUARANTINE] Record written. Verify X timeline manually.");
  process.exit(2);
}

if (!result.ok) {
  console.error("[FAILED] Provider error:", result.error?.kind, result.error?.message);
  const resultRecord = {
    jobId, correlationId, idempotencyKey,
    result: "failed", xPostId: null,
    requestedAt, actorId: ACTOR, contentDigest: digest,
    failureCategory: result.error?.kind,
    failureMessage: result.error?.kind,   // kind only; no raw message to prevent leakage
  };
  if (!existsSync(smokeDir)) mkdirSync(smokeDir, { recursive: true });
  writeFileSync(path.join(smokeDir, \`result-\${correlationId}.json\`), JSON.stringify(resultRecord, null, 2));
  process.exit(1);
}

// ── Success ───────────────────────────────────────────────────────────────────
const xPostId = result.result.xPostId;
const publishedAt = result.result.publishedAt;

const successRecord = {
  jobId, correlationId, idempotencyKey,
  result: "published", xPostId, publishedAt,
  requestedAt, actorId: ACTOR, contentDigest: digest,
  normalizedText,
};

ledger.set(jobId, { result: "published", xPostId, publishedAt });
if (!existsSync(smokeDir)) mkdirSync(smokeDir, { recursive: true });
writeFileSync(path.join(smokeDir, \`result-\${correlationId}.json\`), JSON.stringify(successRecord, null, 2));

console.log("");
console.log("=== SUCCESS ===");
console.log("  xPostId:    ", xPostId);
console.log("  publishedAt:", publishedAt);
console.log("  resultFile: ", path.join("tmp", "smoke", \`result-\${correlationId}.json\`));
console.log("");
console.log("REQUIRED: Verify post is visible on X account.");
console.log("REQUIRED: Delete test post manually on X after verification.");
console.log("          (Cleanup policy per ADR-0025 §9 Step 6)");

NODEEOF
