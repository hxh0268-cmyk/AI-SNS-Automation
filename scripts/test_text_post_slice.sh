#!/usr/bin/env bash
# Stage A Text Post Slice tests (offline). Non-numbered; invoked as TP-AUX.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); echo "[FAIL] $1" >&2; }

STATUS_BEFORE="$(git status --short | sort || true)"

node --input-type=module <<'EOF'
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const u = (rel) => pathToFileURL(path.join(ROOT, rel)).href;

const {
  contentDigest,
  normalizePostText,
  validateNoUnsupportedFeatures,
  validatePostContent,
} = await import(u("src/lib/text_post_content.js"));
const {
  AUDIT_EVENT_TYPE,
  createInMemoryAuditSink,
} = await import(u("src/lib/text_post_audit.js"));
const {
  checkIdempotency,
  createInMemoryIdempotencyStore,
} = await import(u("src/lib/text_post_idempotency.js"));
const {
  createKillSwitch,
  createNoNetworkGuard,
} = await import(u("src/lib/text_post_kill_switch.js"));
const {
  LIFECYCLE_STATE,
  TEXT_POST_ERROR_KIND,
} = await import(u("src/lib/text_post_lifecycle.js"));
const {
  FakeXTextPostProvider,
  createTextPostService,
  mapProviderError,
} = await import(u("src/lib/text_post_service.js"));
const {
  capability,
  invokeMockTextPost,
  policy,
  providerId,
} = await import(u("src/lib/x_text_post_mock_provider.js"));
let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`[PASS] ${name}`);
}
function check(name, fn) {
  try {
    fn();
    ok(name);
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  }
}

const FIXED_NOW = "2026-08-04T12:00:00.000Z";
function makeService(overrides = {}) {
  let seq = 0;
  return createTextPostService({
    now: () => FIXED_NOW,
    createCorrelationId: () => {
      seq += 1;
      return `corr-${String(seq).padStart(4, "0")}`;
    },
    auditSink: createInMemoryAuditSink({
      now: () => FIXED_NOW,
      nextEventId: (() => {
        let n = 0;
        return () => {
          n += 1;
          return `evt-${String(n).padStart(4, "0")}`;
        };
      })(),
    }),
    ...overrides,
  });
}

// 1 valid draft
check("1 valid draft creation", () => {
  const svc = makeService();
  const d = svc.createDraft("Hello Stage A");
  assert.equal(d.ok, true);
  assert.equal(d.draft.state, LIFECYCLE_STATE.DRAFT);
  assert.ok(d.draft.correlationId);
});

// 2 validation success
check("2 validation success", () => {
  const svc = makeService();
  const d = svc.createDraft("Hello Stage A");
  const v = svc.validateDraft(d.draft);
  assert.equal(v.ok, true);
  assert.equal(v.content.normalizedText, "Hello Stage A");
  assert.equal(v.state, LIFECYCLE_STATE.VALIDATED);
});

// 3 approval success
check("3 approval success", () => {
  const svc = makeService();
  const d = svc.createDraft("Approve me");
  const v = svc.validateDraft(d.draft);
  const a = svc.approve({
    correlationId: v.correlationId,
    content: v.content,
    actorId: "human-reviewer-1",
  });
  assert.equal(a.ok, true);
  assert.equal(a.approval.actorId, "human-reviewer-1");
  assert.equal(a.approval.approvedAt, FIXED_NOW);
  assert.equal(a.approval.contentDigest, v.content.digest);
});

// 4 approved dry-run success
check("4 approved dry-run success", () => {
  const svc = makeService();
  const r = svc.runStageADryRun({
    rawText: "Dry run ok",
    actorId: "actor-1",
    idempotencyKey: "key-1",
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, LIFECYCLE_STATE.DRY_RUN_SUCCEEDED);
  assert.equal(r.result.status, LIFECYCLE_STATE.DRY_RUN_SUCCEEDED);
  assert.equal(r.result.published, false);
  assert.equal(r.result.acceptance, "accepted_by_fake_provider");
});

// 5 same key same payload replay
check("5 same idempotency key same payload returns same result", () => {
  const svc = makeService();
  const a = svc.runStageADryRun({
    rawText: "Replay me",
    actorId: "actor-1",
    idempotencyKey: "key-replay",
  });
  const b = svc.runStageADryRun({
    rawText: "Replay me",
    actorId: "actor-1",
    idempotencyKey: "key-replay",
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(b.replay, true);
  assert.deepEqual(b.result, a.result);
});

// 6 audit sequence
check("6 audit sequence correct", () => {
  const svc = makeService();
  svc.runStageADryRun({
    rawText: "Audit path",
    actorId: "actor-1",
    idempotencyKey: "key-audit",
  });
  const types = svc.getAuditEvents().map((e) => e.event_type);
  assert.deepEqual(types, [
    AUDIT_EVENT_TYPE.DRAFT_CREATED,
    AUDIT_EVENT_TYPE.VALIDATION_PASSED,
    AUDIT_EVENT_TYPE.APPROVAL_RECORDED,
    AUDIT_EVENT_TYPE.PUBLISH_REQUESTED,
    AUDIT_EVENT_TYPE.FAKE_PROVIDER_INVOKED,
    AUDIT_EVENT_TYPE.DRY_RUN_SUCCEEDED,
  ]);
});

// 7 fake provider receives normalized request
check("7 fake provider receives normalized request", () => {
  let seen = null;
  const svc = makeService({
    providerInvoke: (req) => {
      seen = req;
      return invokeMockTextPost(req);
    },
  });
  svc.runStageADryRun({
    rawText: "  Trim me  ",
    actorId: "actor-1",
    idempotencyKey: "key-norm",
  });
  assert.equal(seen.capability, capability);
  assert.equal(seen.applicationContract.normalizedText, "Trim me");
});

// 8 empty
check("8 empty content", () => {
  const v = validatePostContent("");
  assert.equal(v.ok, false);
  assert.equal(v.error.kind, TEXT_POST_ERROR_KIND.INVALID_CONTENT);
});

// 9 whitespace-only
check("9 whitespace-only content", () => {
  const v = validatePostContent(" \n\t ");
  assert.equal(v.ok, false);
  assert.equal(v.error.kind, TEXT_POST_ERROR_KIND.INVALID_CONTENT);
});

// 10 too long
check("10 too-long content", () => {
  const v = validatePostContent("x".repeat(281));
  assert.equal(v.ok, false);
});

// 11 unsupported media
check("11 unsupported media", () => {
  const f = validateNoUnsupportedFeatures({ media: [{ id: "1" }] });
  assert.equal(f.ok, false);
  assert.equal(f.error.kind, TEXT_POST_ERROR_KIND.UNSUPPORTED_FEATURE);
});

// 12 approval missing
check("12 approval missing", () => {
  const svc = makeService();
  svc.getKillSwitch().enable();
  const d = svc.createDraft("Needs approval");
  const v = svc.validateDraft(d.draft);
  const r = svc.requestDryRunPublish({
    correlationId: v.correlationId,
    content: v.content,
    approval: null,
    idempotencyKey: "key-no-appr",
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, TEXT_POST_ERROR_KIND.APPROVAL_REQUIRED);
  assert.equal(svc.getProviderInvokeCount(), 0);
});

// 13 approval digest mismatch / mutation
check("13 approval digest mismatch", () => {
  const svc = makeService();
  const d = svc.createDraft("Original");
  const v = svc.validateDraft(d.draft);
  const a = svc.approve({
    correlationId: v.correlationId,
    content: v.content,
    actorId: "actor-1",
  });
  svc.getKillSwitch().enable();
  const r = svc.requestDryRunPublish({
    correlationId: v.correlationId,
    content: v.content,
    approval: a.approval,
    idempotencyKey: "key-mismatch",
    mutatedNormalizedText: "Mutated",
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, TEXT_POST_ERROR_KIND.APPROVAL_CONTENT_MISMATCH);
});

// 14 kill switch disabled
check("14 kill switch disabled", () => {
  const svc = makeService();
  const d = svc.createDraft("KS off");
  const v = svc.validateDraft(d.draft);
  const a = svc.approve({
    correlationId: v.correlationId,
    content: v.content,
    actorId: "actor-1",
  });
  // kill switch remains disabled
  const r = svc.requestDryRunPublish({
    correlationId: v.correlationId,
    content: v.content,
    approval: a.approval,
    idempotencyKey: "key-ks",
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, TEXT_POST_ERROR_KIND.KILL_SWITCH_DISABLED);
  assert.equal(svc.getProviderInvokeCount(), 0);
});

// 15 duplicate request (different key, same content)
check("15 duplicate request", () => {
  const svc = makeService();
  const a = svc.runStageADryRun({
    rawText: "Dup content",
    actorId: "actor-1",
    idempotencyKey: "key-dup-a",
  });
  assert.equal(a.ok, true);
  const b = svc.runStageADryRun({
    rawText: "Dup content",
    actorId: "actor-1",
    idempotencyKey: "key-dup-b",
  });
  assert.equal(b.ok, false);
  assert.equal(b.error.kind, TEXT_POST_ERROR_KIND.DUPLICATE_REQUEST);
});

// 16 idempotency conflict
check("16 idempotency conflict", () => {
  const svc = makeService();
  assert.equal(
    svc.runStageADryRun({
      rawText: "First",
      actorId: "actor-1",
      idempotencyKey: "key-conflict",
    }).ok,
    true,
  );
  const b = svc.runStageADryRun({
    rawText: "Second different",
    actorId: "actor-1",
    idempotencyKey: "key-conflict",
  });
  assert.equal(b.ok, false);
  assert.equal(b.error.kind, TEXT_POST_ERROR_KIND.IDEMPOTENCY_CONFLICT);
});

// 17 transient failure
check("17 fake provider transient failure", () => {
  const svc = makeService();
  const r = svc.runStageADryRun({
    rawText: "Transient",
    actorId: "actor-1",
    idempotencyKey: "key-tr",
    simulateError: "simulate_transient",
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, TEXT_POST_ERROR_KIND.PROVIDER_TRANSIENT_FAILURE);
});

// 18 permanent failure
check("18 fake provider permanent failure", () => {
  const svc = makeService();
  const r = svc.runStageADryRun({
    rawText: "Permanent",
    actorId: "actor-1",
    idempotencyKey: "key-perm",
    simulateError: "simulate_permanent",
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, TEXT_POST_ERROR_KIND.PROVIDER_PERMANENT_FAILURE);
});

// 19 authn mapping
check("19 authentication error mapping", () => {
  const svc = makeService();
  const r = svc.runStageADryRun({
    rawText: "Authn",
    actorId: "actor-1",
    idempotencyKey: "key-authn",
    simulateError: "simulate_auth_failure",
  });
  assert.equal(r.ok, false);
  assert.equal(
    r.error.kind,
    TEXT_POST_ERROR_KIND.PROVIDER_AUTHENTICATION_FAILED,
  );
});

// 20 authz mapping
check("20 authorization error mapping", () => {
  const svc = makeService();
  const r = svc.runStageADryRun({
    rawText: "Authz",
    actorId: "actor-1",
    idempotencyKey: "key-authz",
    simulateError: "simulate_authz_failure",
  });
  assert.equal(r.ok, false);
  assert.equal(
    r.error.kind,
    TEXT_POST_ERROR_KIND.PROVIDER_AUTHORIZATION_FAILED,
  );
});

// 21 audit sink failure policy
check("21 audit sink failure policy", () => {
  const sink = createInMemoryAuditSink();
  sink.record = () => {
    throw new Error("sink down");
  };
  const svc = makeService({ auditSink: sink });
  const r = svc.createDraft("x");
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, TEXT_POST_ERROR_KIND.INTERNAL_ERROR);
});

// 22 no-network guard
check("22 no-network guard", () => {
  const g = createNoNetworkGuard();
  assert.doesNotThrow(() => g.assertNoNetwork(null));
  assert.throws(() => g.assertNoNetwork("example.com"));
});

// 23 external hostname rejected
check("23 external hostname attempt rejected", () => {
  const svc = makeService();
  const d = svc.createDraft("Host");
  const v = svc.validateDraft(d.draft);
  const a = svc.approve({
    correlationId: v.correlationId,
    content: v.content,
    actorId: "actor-1",
  });
  svc.getKillSwitch().enable();
  const r = svc.requestDryRunPublish({
    correlationId: v.correlationId,
    content: v.content,
    approval: a.approval,
    idempotencyKey: "key-host",
    hostname: "api.x.com",
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, TEXT_POST_ERROR_KIND.INTERNAL_ERROR);
  assert.match(r.error.message, /prohibited/i);
});

// 24 secret-like fields not logged
check("24 secret-like fields not logged", () => {
  const sink = createInMemoryAuditSink();
  assert.throws(() =>
    sink.record({
      event_type: "x",
      accessToken: "secret-value",
    }),
  );
  const svc = makeService();
  svc.runStageADryRun({
    rawText: "No secrets",
    actorId: "actor-1",
    idempotencyKey: "key-sec",
  });
  const blob = JSON.stringify(svc.getAuditEvents());
  assert.equal(blob.includes("accessToken"), false);
  assert.equal(blob.includes("clientSecret"), false);
});

// 25 content mutation after approval
check("25 content mutation after approval", () => {
  const svc = makeService();
  const d = svc.createDraft("Stable");
  const v = svc.validateDraft(d.draft);
  const a = svc.approve({
    correlationId: v.correlationId,
    content: v.content,
    actorId: "actor-1",
  });
  svc.getKillSwitch().enable();
  const r = svc.requestDryRunPublish({
    correlationId: v.correlationId,
    content: { ...v.content, normalizedText: "Changed", digest: contentDigest("Changed") },
    approval: a.approval,
    idempotencyKey: "key-mut",
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, TEXT_POST_ERROR_KIND.APPROVAL_CONTENT_MISMATCH);
});

// 26 deterministic result
check("26 deterministic result", () => {
  const a = makeService().runStageADryRun({
    rawText: "Det",
    actorId: "actor-1",
    idempotencyKey: "key-det-a",
  });
  const b = makeService().runStageADryRun({
    rawText: "Det",
    actorId: "actor-1",
    idempotencyKey: "key-det-b",
  });
  assert.equal(a.result.contentDigest, b.result.contentDigest);
  assert.equal(a.result.completedAt, FIXED_NOW);
  assert.equal(b.result.completedAt, FIXED_NOW);
});

// 27 no repository mutation by tests — checked in shell after
ok("27 no repository mutation by tests (shell verifies)");

// 28 delivery manifest validation
check("28 delivery manifest validation", () => {
  const manifestPath = path.join(
    ROOT,
    "config/delivery/x_text_only_stage_a_manifest.json",
  );
  const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(m.schema_version, "1.0");
  assert.equal(
    m.expected_base_commit,
    "71f88c47bc09beba612e0df7b1885ab46d4086b5",
  );
  assert.equal(m.allowed_paths.length, 11);
  assert.equal(m.expected_file_count, 11);
  assert.equal(m.real_provider, "prohibited");
  assert.equal(m.external_io, "prohibited");
  assert.equal(m.provider_authorization, "none");
  assert.equal(m.endpoint_approval, "none");
  assert.equal(m.automatic_publishing, "prohibited");
  for (const p of m.allowed_paths) {
    assert.ok(
      fs.existsSync(path.join(ROOT, p)),
      `missing allowlist path: ${p}`,
    );
  }
});

// 29 Quality integration — shell TP-AUX; assert script exists
check("29 Quality integration hook present", () => {
  const q = fs.readFileSync(
    path.join(ROOT, "scripts/test_quality_pipeline.sh"),
    "utf8",
  );
  assert.match(q, /TP-AUX|test_text_post_slice/);
});

// 30 Catalog policy verification
check("30 Catalog policy verification", () => {
  const m = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "config/delivery/x_text_only_stage_a_manifest.json"),
      "utf8",
    ),
  );
  assert.match(
    m._planning_notes.catalog_notes,
    /does NOT register x_text_post_mock_provider/,
  );
  assert.equal(policy.realProvider, false);
  assert.equal(policy.networkAccess, false);
  assert.equal(policy.externalIOEnabled, false);
});

// 31 provider not invoked before approval
check("31 provider not invoked before approval", () => {
  const svc = makeService();
  svc.createDraft("x");
  svc.validateDraft({ correlationId: "c", rawText: "x", features: {} });
  assert.equal(svc.getProviderInvokeCount(), 0);
});

// 32 provider not invoked after kill-switch rejection
check("32 provider not invoked after kill-switch rejection", () => {
  const svc = makeService();
  const d = svc.createDraft("ks");
  const v = svc.validateDraft(d.draft);
  const a = svc.approve({
    correlationId: v.correlationId,
    content: v.content,
    actorId: "a",
  });
  const r = svc.requestDryRunPublish({
    correlationId: v.correlationId,
    content: v.content,
    approval: a.approval,
    idempotencyKey: "key-ks2",
  });
  assert.equal(r.error.kind, TEXT_POST_ERROR_KIND.KILL_SWITCH_DISABLED);
  assert.equal(svc.getProviderInvokeCount(), 0);
});

// 33 terminal replay does not invoke provider twice
check("33 terminal replay does not invoke provider twice", () => {
  const svc = makeService();
  svc.runStageADryRun({
    rawText: "Once",
    actorId: "a",
    idempotencyKey: "key-once",
  });
  const count1 = svc.getProviderInvokeCount();
  svc.runStageADryRun({
    rawText: "Once",
    actorId: "a",
    idempotencyKey: "key-once",
  });
  assert.equal(svc.getProviderInvokeCount(), count1);
  assert.equal(count1, 1);
});

// 34 same-key concurrency behavior
check("34 same-key concurrency behavior", () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let enterCount = 0;
  const svc = makeService({
    providerInvoke: async (req) => {
      enterCount += 1;
      if (enterCount === 1) {
        await gate;
      }
      return invokeMockTextPost(req);
    },
  });
  // Synchronous Stage A path uses sync provider; simulate in-flight via store API.
  const store = createInMemoryIdempotencyStore();
  // Use service inFlight by calling sync provider that re-enters check:
  const syncSvc = makeService();
  syncSvc.getKillSwitch().enable();
  const d = syncSvc.createDraft("Concurrent");
  const v = syncSvc.validateDraft(d.draft);
  const a = syncSvc.approve({
    correlationId: v.correlationId,
    content: v.content,
    actorId: "a",
  });
  // Manually mark in-flight by wrapping provider
  let inFlightHit = false;
  const locked = makeService({
    providerInvoke: (req) => {
      // During first invoke, nest a second publish with same key
      const nested = locked.requestDryRunPublish({
        correlationId: v.correlationId,
        content: v.content,
        approval: a.approval,
        idempotencyKey: "key-conc",
      });
      if (!nested.ok && nested.error?.details?.concurrency) {
        inFlightHit = true;
      }
      return invokeMockTextPost(req);
    },
  });
  locked.getKillSwitch().enable();
  const d2 = locked.createDraft("Concurrent");
  const v2 = locked.validateDraft(d2.draft);
  const a2 = locked.approve({
    correlationId: v2.correlationId,
    content: v2.content,
    actorId: "a",
  });
  const r = locked.requestDryRunPublish({
    correlationId: v2.correlationId,
    content: v2.content,
    approval: a2.approval,
    idempotencyKey: "key-conc",
  });
  assert.equal(r.ok, true);
  assert.equal(inFlightHit, true);
  void release;
  void store;
  void enterCount;
});

// 35 unknown provider error maps safely
check("35 unknown provider error maps safely", () => {
  const svc = makeService();
  const r = svc.runStageADryRun({
    rawText: "Unknown",
    actorId: "a",
    idempotencyKey: "key-unk",
    simulateError: "simulate_unknown",
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, TEXT_POST_ERROR_KIND.PROVIDER_PERMANENT_FAILURE);
  assert.equal(r.error.message.includes("__UNKNOWN"), false);
});

// 36 raw provider error not leaked
check("36 raw provider error not leaked", () => {
  const mapped = mapProviderError({
    kind: "__UNKNOWN_PROVIDER_ERROR__",
    message: "accessToken=super-secret raw stack",
  });
  assert.equal(mapped.kind, TEXT_POST_ERROR_KIND.PROVIDER_PERMANENT_FAILURE);
  assert.equal(mapped.message.includes("accessToken"), false);
  assert.equal(mapped.message.includes("super-secret"), false);
});

// 37 content digest stable
check("37 content digest stable", () => {
  const a = contentDigest(normalizePostText("  Hello  "));
  const b = contentDigest("Hello");
  assert.equal(a, b);
  assert.equal(
    a,
    createHash("sha256").update("Hello", "utf8").digest("hex"),
  );
});

// 38 audit ordering stable
check("38 audit ordering stable", () => {
  const svc = makeService();
  svc.runStageADryRun({
    rawText: "Order",
    actorId: "a",
    idempotencyKey: "key-ord",
  });
  const ids = svc.getAuditEvents().map((e) => e.event_id);
  assert.deepEqual(ids, [
    "evt-0001",
    "evt-0002",
    "evt-0003",
    "evt-0004",
    "evt-0005",
    "evt-0006",
  ]);
});

// 39 Stage A cannot produce real published status
check("39 Stage A cannot produce real published status", () => {
  const svc = makeService({
    providerInvoke: () => ({
      ok: true,
      providerId,
      providerVersion: "0.1.0",
      capability,
      result: { status: "published" },
    }),
  });
  const r = svc.runStageADryRun({
    rawText: "No publish",
    actorId: "a",
    idempotencyKey: "key-pub",
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, TEXT_POST_ERROR_KIND.INTERNAL_ERROR);
});

// 40 network disabled by default
check("40 network disabled by default", () => {
  assert.equal(policy.networkAccess, false);
  const ks = createKillSwitch();
  assert.equal(ks.isEnabled(), false);
  const r = invokeMockTextPost({
    capability,
    applicationContract: { normalizedText: "x", requestedAt: FIXED_NOW },
  });
  assert.equal(r.ok, true);
  assert.notEqual(r.result.status, "published");
  assert.equal(FakeXTextPostProvider.capability, capability);
});

// null byte rejection (extra safety under validation group)
check("null byte rejection", () => {
  const v = validatePostContent("a\x00b");
  assert.equal(v.ok, false);
});

// idempotency key required
check("idempotency key required", () => {
  const store = createInMemoryIdempotencyStore();
  const r = checkIdempotency(store, "  ", "abc");
  assert.equal(r.ok, false);
});

console.log(`TEXT_POST_SLICE_CHECKS=${passed}`);
if (process.exitCode) {
  process.exit(1);
}
EOF

STATUS_AFTER="$(git status --short | sort || true)"
if [[ "$STATUS_BEFORE" != "$STATUS_AFTER" ]]; then
  fail "27 repository mutated by tests"
  echo "$STATUS_BEFORE" > /tmp/tp_status_before.txt
  echo "$STATUS_AFTER" > /tmp/tp_status_after.txt
  diff -u /tmp/tp_status_before.txt /tmp/tp_status_after.txt || true
  exit 1
else
  pass "27 no repository mutation by tests"
fi

echo "TEXT_POST_SLICE_ALL_PASSED"
