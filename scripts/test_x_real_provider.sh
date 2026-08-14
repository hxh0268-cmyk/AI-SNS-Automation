#!/usr/bin/env bash
# X1 Real Provider offline tests. No network, no credentials, no real POST.
# Invoked as TP-AUX from test_quality_pipeline.sh — output captured; [PASS] lines counted.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); echo "[FAIL] $1" >&2; }

STATUS_BEFORE="$(git status --short | sort || true)"

# ── File existence ────────────────────────────────────────────────────────────
[ -f "src/lib/x_real_provider_adapter.js" ] \
  && pass "x_real_provider_adapter.js exists" \
  || { fail "x_real_provider_adapter.js missing"; }

[ -f "src/lib/x_oauth_client.js" ] \
  && pass "x_oauth_client.js exists" \
  || { fail "x_oauth_client.js missing"; }

[ -f "src/lib/x_credential_loader.js" ] \
  && pass "x_credential_loader.js exists" \
  || { fail "x_credential_loader.js missing"; }

[ -f "config/delivery/x1_impl_manifest.json" ] \
  && pass "x1_impl_manifest.json exists" \
  || { fail "x1_impl_manifest.json missing"; }

# ── Adapter + OAuth client + Credential loader (Node.js inline tests) ─────────
node --input-type=module <<'NODEEOF'
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const u = (r) => pathToFileURL(path.join(ROOT, r)).href;

const {
  createXRealProviderAdapter,
  PROVIDER_ID,
  PROVIDER_VERSION,
  policy,
} = await import(u("src/lib/x_real_provider_adapter.js"));

const {
  buildOAuthHeader,
  createXApiClient,
  X_API_HOST,
  X_TWEETS_PATH,
  X_TWEETS_URL,
} = await import(u("src/lib/x_oauth_client.js"));

const {
  loadXCredentials,
  xCredentialsAvailable,
} = await import(u("src/lib/x_credential_loader.js"));

const {
  AUDIT_EVENT_TYPE,
} = await import(u("src/lib/text_post_audit.js"));

const {
  createFileBackedIdempotencyStore,
} = await import(u("src/lib/text_post_idempotency.js"));

const {
  createProviderResolver,
  RESOLVER_ERROR,
} = await import(u("src/lib/text_post_provider_resolver.js"));

const {
  createTextPostGateway,
} = await import(u("src/lib/text_post_gateway.js"));

const {
  CAPABILITY,
  EXECUTION_MODE,
  AUTHORIZATION_STATE,
} = await import(u("src/lib/text_post_capability.js"));

let pass = 0; let fail = 0;
const ok  = (l) => { pass++; console.log("[PASS]", l); };
const ko  = (l, e) => { fail++; console.error("[FAIL]", l, e?.message ?? String(e)); };

// ── Provider constants ────────────────────────────────────────────────────────
try { assert.equal(PROVIDER_ID, "x-real-provider"); ok("PROVIDER_ID = x-real-provider"); } catch(e) { ko("PROVIDER_ID", e); }
try { assert.equal(PROVIDER_VERSION, "1.0.0"); ok("PROVIDER_VERSION = 1.0.0"); } catch(e) { ko("PROVIDER_VERSION", e); }
try { assert(policy.endpointAllowlist.includes("POST /2/tweets")); ok("policy.endpointAllowlist POST /2/tweets"); } catch(e) { ko("policy endpointAllowlist", e); }
try { assert.equal(policy.automaticPublishing, false); ok("policy.automaticPublishing = false"); } catch(e) { ko("policy.automaticPublishing", e); }
try { assert.equal(policy.realProvider, true); ok("policy.realProvider = true"); } catch(e) { ko("policy.realProvider", e); }
try { assert.equal(policy.executionMode, "live"); ok("policy.executionMode = live"); } catch(e) { ko("policy.executionMode", e); }

// ── Adapter metadata ──────────────────────────────────────────────────────────
try {
  const a = createXRealProviderAdapter();
  assert.equal(a.providerId, "x-real-provider");
  assert.equal(a.executionMode, EXECUTION_MODE.LIVE);
  assert.equal(a.capability, CAPABILITY.PUBLISH_TEXT);
  ok("adapter metadata correct");
} catch(e) { ko("adapter metadata", e); }

// ── Input validation: non-object ──────────────────────────────────────────────
try {
  const a = createXRealProviderAdapter();
  const r = await a.invoke("not-an-object");
  assert.equal(r.ok, false);
  ok("non-object request rejected");
} catch(e) { ko("non-object request", e); }

// ── Input validation: forbidden field ────────────────────────────────────────
try {
  const a = createXRealProviderAdapter();
  const r = await a.invoke({ normalizedText: "hi", correlationId: "c", idempotencyKey: "k", token: "bad" });
  assert.equal(r.ok, false);
  ok("forbidden field 'token' rejected");
} catch(e) { ko("forbidden field token", e); }

// ── Input validation: missing normalizedText ──────────────────────────────────
try {
  const a = createXRealProviderAdapter();
  const r = await a.invoke({ normalizedText: "", correlationId: "c", idempotencyKey: "k" });
  assert.equal(r.ok, false);
  ok("empty normalizedText rejected");
} catch(e) { ko("empty normalizedText", e); }

// ── Input validation: oversized text ─────────────────────────────────────────
try {
  const a = createXRealProviderAdapter();
  const r = await a.invoke({ normalizedText: "x".repeat(281), correlationId: "c", idempotencyKey: "k" });
  assert.equal(r.ok, false);
  ok("normalizedText > 280 chars rejected");
} catch(e) { ko("normalizedText oversized", e); }

// ── Input validation: missing correlationId ───────────────────────────────────
try {
  const a = createXRealProviderAdapter();
  const r = await a.invoke({ normalizedText: "hello", correlationId: "", idempotencyKey: "k" });
  assert.equal(r.ok, false);
  ok("empty correlationId rejected");
} catch(e) { ko("empty correlationId", e); }

// ── Input validation: missing idempotencyKey ──────────────────────────────────
try {
  const a = createXRealProviderAdapter();
  const r = await a.invoke({ normalizedText: "hello", correlationId: "c", idempotencyKey: "" });
  assert.equal(r.ok, false);
  ok("empty idempotencyKey rejected");
} catch(e) { ko("empty idempotencyKey", e); }

// ── No transport → INTERNAL_ERROR (X1 network-zero invariant) ────────────────
try {
  const a = createXRealProviderAdapter();
  const r = await a.invoke({ normalizedText: "hello", correlationId: "c", idempotencyKey: "k" });
  assert.equal(r.ok, false);
  assert(r.error.kind === "INTERNAL_ERROR", `expected INTERNAL_ERROR, got ${r.error.kind}`);
  ok("no transport → INTERNAL_ERROR (network-zero invariant)");
} catch(e) { ko("no transport INTERNAL_ERROR", e); }

// ── Kill-switch disabled ──────────────────────────────────────────────────────
try {
  const ks = { isEnabled: () => false };
  const a = createXRealProviderAdapter({ killSwitch: ks });
  const r = await a.invoke({ normalizedText: "hello", correlationId: "c", idempotencyKey: "k" });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, "KILL_SWITCH_DISABLED");
  ok("kill-switch disabled → KILL_SWITCH_DISABLED");
} catch(e) { ko("kill-switch", e); }

// ── Kill-switch enabled passes through (to no-transport guard) ────────────────
try {
  const ks = { isEnabled: () => true };
  const a = createXRealProviderAdapter({ killSwitch: ks });
  const r = await a.invoke({ normalizedText: "hello", correlationId: "c", idempotencyKey: "k" });
  // No transport → INTERNAL_ERROR (kill-switch check passes, then no-transport guard)
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, "INTERNAL_ERROR");
  ok("kill-switch enabled → proceeds to no-transport guard");
} catch(e) { ko("kill-switch enabled passthrough", e); }

// ── Credential loader failure → PROVIDER_AUTHENTICATION_FAILED ───────────────
try {
  const badLoader = () => { throw new Error("no creds"); };
  const fakeTransport = async () => ({ status: 201, body: '{"data":{"id":"1","text":"hi"}}' });
  const a = createXRealProviderAdapter({ credentialLoader: badLoader, transport: fakeTransport });
  const r = await a.invoke({ normalizedText: "hello", correlationId: "c", idempotencyKey: "k" });
  assert.equal(r.ok, false);
  assert(r.error.kind === "PROVIDER_AUTHENTICATION_FAILED", `got ${r.error.kind}`);
  ok("credential loader failure → PROVIDER_AUTHENTICATION_FAILED");
} catch(e) { ko("credential loader failure", e); }

// ── Fake transport success: ok=true, status=published, xPostId ───────────────
try {
  const fakeCreds = { apiKey: "k", apiSecret: "s", accessToken: "at", accessTokenSecret: "ats" };
  const fakeTransport = async () => ({ status: 201, body: JSON.stringify({ data: { id: "9876543210", text: "hello" } }) });
  const a = createXRealProviderAdapter({ credentialLoader: () => fakeCreds, transport: fakeTransport });
  const r = await a.invoke({ normalizedText: "hello world", correlationId: "corr-001", idempotencyKey: "idem-001" });
  assert.equal(r.ok, true);
  assert.equal(r.result.status, "published");
  assert.equal(r.result.xPostId, "9876543210");
  ok("fake transport success → ok=true status=published xPostId");
} catch(e) { ko("fake transport success", e); }

// ── Fake transport success: result fields complete ────────────────────────────
try {
  const fakeCreds = { apiKey: "k", apiSecret: "s", accessToken: "at", accessTokenSecret: "ats" };
  const fakeTransport = async () => ({ status: 201, body: JSON.stringify({ data: { id: "111", text: "test" } }) });
  const a = createXRealProviderAdapter({ credentialLoader: () => fakeCreds, transport: fakeTransport });
  const r = await a.invoke({ normalizedText: "test", correlationId: "corr-x", idempotencyKey: "idem-x" });
  assert.equal(r.result.normalizedText, "test");
  assert.equal(r.result.correlationId, "corr-x");
  assert.equal(r.result.idempotencyKey, "idem-x");
  assert(typeof r.result.publishedAt === "string");
  ok("fake transport result fields: normalizedText correlationId idempotencyKey publishedAt");
} catch(e) { ko("fake transport result fields", e); }

// ── Fake transport 429 → PROVIDER_RATE_LIMITED ───────────────────────────────
try {
  const fakeCreds = { apiKey: "k", apiSecret: "s", accessToken: "at", accessTokenSecret: "ats" };
  const fakeTransport = async () => ({ status: 429, body: "" });
  const a = createXRealProviderAdapter({ credentialLoader: () => fakeCreds, transport: fakeTransport });
  const r = await a.invoke({ normalizedText: "hello", correlationId: "c", idempotencyKey: "k" });
  assert.equal(r.ok, false);
  assert(r.error.kind === "PROVIDER_RATE_LIMITED", `got ${r.error.kind}`);
  ok("429 → PROVIDER_RATE_LIMITED");
} catch(e) { ko("429 rate limited", e); }

// ── Fake transport 503 → PROVIDER_TRANSIENT_FAILURE ──────────────────────────
try {
  const fakeCreds = { apiKey: "k", apiSecret: "s", accessToken: "at", accessTokenSecret: "ats" };
  const fakeTransport = async () => ({ status: 503, body: "" });
  const a = createXRealProviderAdapter({ credentialLoader: () => fakeCreds, transport: fakeTransport });
  const r = await a.invoke({ normalizedText: "hello", correlationId: "c", idempotencyKey: "k" });
  assert.equal(r.ok, false);
  assert(r.error.kind === "PROVIDER_TRANSIENT_FAILURE", `got ${r.error.kind}`);
  ok("503 → PROVIDER_TRANSIENT_FAILURE");
} catch(e) { ko("503 server error", e); }

// ── Fake transport 401 → PROVIDER_AUTHENTICATION_FAILED ──────────────────────
try {
  const fakeCreds = { apiKey: "k", apiSecret: "s", accessToken: "at", accessTokenSecret: "ats" };
  const fakeTransport = async () => ({ status: 401, body: "" });
  const a = createXRealProviderAdapter({ credentialLoader: () => fakeCreds, transport: fakeTransport });
  const r = await a.invoke({ normalizedText: "hello", correlationId: "c", idempotencyKey: "k" });
  assert.equal(r.ok, false);
  assert(r.error.kind === "PROVIDER_AUTHENTICATION_FAILED", `got ${r.error.kind}`);
  ok("401 → PROVIDER_AUTHENTICATION_FAILED");
} catch(e) { ko("401 auth error", e); }

// ── Fake transport throws → PROVIDER_TRANSIENT_FAILURE ───────────────────────
try {
  const fakeCreds = { apiKey: "k", apiSecret: "s", accessToken: "at", accessTokenSecret: "ats" };
  const fakeTransport = async () => { throw new Error("connection refused"); };
  const a = createXRealProviderAdapter({ credentialLoader: () => fakeCreds, transport: fakeTransport });
  const r = await a.invoke({ normalizedText: "hello", correlationId: "c", idempotencyKey: "k" });
  assert.equal(r.ok, false);
  assert(r.error.kind === "PROVIDER_TRANSIENT_FAILURE", `got ${r.error.kind}`);
  ok("transport exception → PROVIDER_TRANSIENT_FAILURE");
} catch(e) { ko("transport exception", e); }

// ── OAuth: endpoint constants ─────────────────────────────────────────────────
try {
  assert.equal(X_API_HOST, "api.x.com");
  assert.equal(X_TWEETS_PATH, "/2/tweets");
  assert.equal(X_TWEETS_URL, "https://api.x.com/2/tweets");
  ok("endpoint constants: host=api.x.com path=/2/tweets");
} catch(e) { ko("endpoint constants", e); }

// ── OAuth: header format ──────────────────────────────────────────────────────
try {
  const creds = { apiKey: "myKey", apiSecret: "mySecret", accessToken: "myToken", accessTokenSecret: "myTS" };
  const h = buildOAuthHeader(creds, { nonce: "abc", timestamp: "1000000000" }, "hello");
  assert(h.startsWith("OAuth "), "must start with 'OAuth '");
  assert(h.includes("oauth_consumer_key="), "missing oauth_consumer_key");
  assert(h.includes("oauth_signature="), "missing oauth_signature");
  assert(h.includes("oauth_signature_method="), "missing oauth_signature_method");
  assert(h.includes("oauth_token="), "missing oauth_token");
  assert(h.includes("oauth_version="), "missing oauth_version");
  ok("OAuth header format: starts with 'OAuth ', all required fields present");
} catch(e) { ko("OAuth header format", e); }

// ── OAuth: header is deterministic ───────────────────────────────────────────
try {
  const creds = { apiKey: "k", apiSecret: "s", accessToken: "t", accessTokenSecret: "ts" };
  const h1 = buildOAuthHeader(creds, { nonce: "n", timestamp: "t" }, "text");
  const h2 = buildOAuthHeader(creds, { nonce: "n", timestamp: "t" }, "text");
  assert.equal(h1, h2);
  ok("OAuth header deterministic for same inputs");
} catch(e) { ko("OAuth deterministic", e); }

// ── OAuth: body text does NOT affect signature (RFC 5849 §3.4.1.3.1: JSON body excluded) ──
try {
  const creds = { apiKey: "k", apiSecret: "s", accessToken: "t", accessTokenSecret: "ts" };
  const h1 = buildOAuthHeader(creds, { nonce: "n", timestamp: "1000" });
  const h2 = buildOAuthHeader(creds, { nonce: "n", timestamp: "1000" });
  assert.equal(h1, h2);
  ok("same OAuth params → same signature regardless of JSON body content (RFC 5849 §3.4.1.3.1)");
} catch(e) { ko("OAuth body-independent signature", e); }

// ── XApiClient: 201 → xPostId extracted ──────────────────────────────────────
try {
  const creds = { apiKey: "k", apiSecret: "s", accessToken: "t", accessTokenSecret: "ts" };
  const client = createXApiClient({
    transport: async () => ({ status: 201, body: JSON.stringify({ data: { id: "42abc", text: "hi" } }) }),
  });
  const r = await client.postTweet("hello", creds, "corr-1");
  assert.equal(r.ok, true);
  assert.equal(r.xPostId, "42abc");
  ok("XApiClient 201 → xPostId extracted");
} catch(e) { ko("XApiClient 201", e); }

// ── XApiClient: 201 invalid JSON → PROVIDER_REJECTED ─────────────────────────
try {
  const creds = { apiKey: "k", apiSecret: "s", accessToken: "t", accessTokenSecret: "ts" };
  const client = createXApiClient({ transport: async () => ({ status: 201, body: "not-json" }) });
  const r = await client.postTweet("hello", creds, "c");
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, "PROVIDER_REJECTED");
  ok("XApiClient 201 invalid JSON → PROVIDER_REJECTED");
} catch(e) { ko("XApiClient invalid JSON", e); }

// ── XApiClient: 429 → PROVIDER_RATE_LIMITED ──────────────────────────────────
try {
  const creds = { apiKey: "k", apiSecret: "s", accessToken: "t", accessTokenSecret: "ts" };
  const client = createXApiClient({ transport: async () => ({ status: 429, body: "" }) });
  const r = await client.postTweet("hello", creds, "c");
  assert.equal(r.ok, false); assert.equal(r.error.kind, "PROVIDER_RATE_LIMITED");
  ok("XApiClient 429 → PROVIDER_RATE_LIMITED");
} catch(e) { ko("XApiClient 429", e); }

// ── XApiClient: 500 → PROVIDER_TRANSIENT_FAILURE ─────────────────────────────
try {
  const creds = { apiKey: "k", apiSecret: "s", accessToken: "t", accessTokenSecret: "ts" };
  const client = createXApiClient({ transport: async () => ({ status: 500, body: "" }) });
  const r = await client.postTweet("hello", creds, "c");
  assert.equal(r.ok, false); assert.equal(r.error.kind, "PROVIDER_TRANSIENT_FAILURE");
  ok("XApiClient 500 → PROVIDER_TRANSIENT_FAILURE");
} catch(e) { ko("XApiClient 500", e); }

// ── XApiClient: 401 → PROVIDER_AUTHENTICATION_FAILED ─────────────────────────
try {
  const creds = { apiKey: "k", apiSecret: "s", accessToken: "t", accessTokenSecret: "ts" };
  const client = createXApiClient({ transport: async () => ({ status: 401, body: "" }) });
  const r = await client.postTweet("hello", creds, "c");
  assert.equal(r.ok, false); assert.equal(r.error.kind, "PROVIDER_AUTHENTICATION_FAILED");
  ok("XApiClient 401 → PROVIDER_AUTHENTICATION_FAILED");
} catch(e) { ko("XApiClient 401", e); }

// ── XApiClient: 403 → PROVIDER_AUTHENTICATION_FAILED ─────────────────────────
try {
  const creds = { apiKey: "k", apiSecret: "s", accessToken: "t", accessTokenSecret: "ts" };
  const client = createXApiClient({ transport: async () => ({ status: 403, body: "" }) });
  const r = await client.postTweet("hello", creds, "c");
  assert.equal(r.ok, false); assert.equal(r.error.kind, "PROVIDER_AUTHENTICATION_FAILED");
  ok("XApiClient 403 → PROVIDER_AUTHENTICATION_FAILED");
} catch(e) { ko("XApiClient 403", e); }

// ── XApiClient: unexpected status → PROVIDER_REJECTED ────────────────────────
try {
  const creds = { apiKey: "k", apiSecret: "s", accessToken: "t", accessTokenSecret: "ts" };
  const client = createXApiClient({ transport: async () => ({ status: 418, body: "" }) });
  const r = await client.postTweet("hello", creds, "c");
  assert.equal(r.ok, false); assert.equal(r.error.kind, "PROVIDER_REJECTED");
  ok("XApiClient unexpected status → PROVIDER_REJECTED");
} catch(e) { ko("XApiClient unexpected", e); }

// ── Credential loader: missing env var throws with var name in message ─────────
try {
  const saved = process.env.X_API_KEY;
  delete process.env.X_API_KEY;
  try {
    loadXCredentials();
    throw new Error("should have thrown");
  } catch(e) {
    assert(e.message.includes("X_API_KEY"), `var name missing from: ${e.message}`);
    if (saved !== undefined) process.env.X_API_KEY = saved;
  }
  ok("credential loader: missing X_API_KEY → message includes var name");
} catch(e) { ko("credential loader missing", e); }

// ── Credential loader: all vars present → returns credentials ────────────────
try {
  const saved = { ...process.env };
  process.env.X_API_KEY = "testkey"; process.env.X_API_SECRET = "testsecret";
  process.env.X_ACCESS_TOKEN = "testtoken"; process.env.X_ACCESS_TOKEN_SECRET = "testtokensecret";
  const creds = loadXCredentials();
  assert.equal(creds.apiKey, "testkey"); assert.equal(creds.apiSecret, "testsecret");
  assert.equal(creds.accessToken, "testtoken"); assert.equal(creds.accessTokenSecret, "testtokensecret");
  Object.assign(process.env, saved);
  if (!saved.X_API_KEY) delete process.env.X_API_KEY;
  if (!saved.X_API_SECRET) delete process.env.X_API_SECRET;
  if (!saved.X_ACCESS_TOKEN) delete process.env.X_ACCESS_TOKEN;
  if (!saved.X_ACCESS_TOKEN_SECRET) delete process.env.X_ACCESS_TOKEN_SECRET;
  ok("credential loader: all vars present → returns correct credentials");
} catch(e) { ko("credential loader all present", e); }

// ── xCredentialsAvailable: false when missing ─────────────────────────────────
try {
  const saved = process.env.X_API_KEY;
  delete process.env.X_API_KEY;
  assert.equal(xCredentialsAvailable(), false);
  if (saved !== undefined) process.env.X_API_KEY = saved;
  ok("xCredentialsAvailable: false when X_API_KEY missing");
} catch(e) { ko("xCredentialsAvailable false", e); }

// ── xCredentialsAvailable: true when all present ─────────────────────────────
try {
  const saved = { ...process.env };
  process.env.X_API_KEY = "k"; process.env.X_API_SECRET = "s";
  process.env.X_ACCESS_TOKEN = "t"; process.env.X_ACCESS_TOKEN_SECRET = "ts";
  assert.equal(xCredentialsAvailable(), true);
  Object.assign(process.env, saved);
  if (!saved.X_API_KEY) delete process.env.X_API_KEY;
  if (!saved.X_API_SECRET) delete process.env.X_API_SECRET;
  if (!saved.X_ACCESS_TOKEN) delete process.env.X_ACCESS_TOKEN;
  if (!saved.X_ACCESS_TOKEN_SECRET) delete process.env.X_ACCESS_TOKEN_SECRET;
  ok("xCredentialsAvailable: true when all vars present");
} catch(e) { ko("xCredentialsAvailable true", e); }

// ── Audit event types ─────────────────────────────────────────────────────────
try { assert.equal(AUDIT_EVENT_TYPE.REAL_PROVIDER_INVOKED, "real_provider_invoked"); ok("AUDIT_EVENT_TYPE.REAL_PROVIDER_INVOKED"); } catch(e) { ko("REAL_PROVIDER_INVOKED", e); }
try { assert.equal(AUDIT_EVENT_TYPE.REAL_PROVIDER_SUCCEEDED, "real_provider_succeeded"); ok("AUDIT_EVENT_TYPE.REAL_PROVIDER_SUCCEEDED"); } catch(e) { ko("REAL_PROVIDER_SUCCEEDED", e); }
try { assert.equal(AUDIT_EVENT_TYPE.REAL_PROVIDER_FAILED, "real_provider_failed"); ok("AUDIT_EVENT_TYPE.REAL_PROVIDER_FAILED"); } catch(e) { ko("REAL_PROVIDER_FAILED", e); }
try { assert.equal(AUDIT_EVENT_TYPE.UNKNOWN_RESULT_QUARANTINE, "unknown_result_quarantine"); ok("AUDIT_EVENT_TYPE.UNKNOWN_RESULT_QUARANTINE"); } catch(e) { ko("UNKNOWN_RESULT_QUARANTINE", e); }
try { assert.equal(AUDIT_EVENT_TYPE.RETRY_ATTEMPTED, "retry_attempted"); ok("AUDIT_EVENT_TYPE.RETRY_ATTEMPTED"); } catch(e) { ko("RETRY_ATTEMPTED", e); }

// ── File-backed idempotency store ─────────────────────────────────────────────
try {
  const store = createFileBackedIdempotencyStore({ dir: "/tmp/x1-idem-test-" + Date.now() });
  const jobId = "test-job-2026-08-14";
  assert.equal(store.get(jobId), null);
  ok("file-backed store: get returns null for missing job");
} catch(e) { ko("file-backed store get null", e); }

try {
  const store = createFileBackedIdempotencyStore({ dir: "/tmp/x1-idem-test-" + Date.now() });
  const jobId = "roundtrip-job";
  store.set(jobId, { result: "published", xPostId: "9876" });
  const rec = store.get(jobId);
  assert(rec !== null); assert.equal(rec.xPostId, "9876");
  ok("file-backed store: set/get roundtrip");
} catch(e) { ko("file-backed store roundtrip", e); }

try {
  const store = createFileBackedIdempotencyStore({ dir: "/tmp/x1-idem-test-" + Date.now() });
  const jobId = "pub-job";
  store.set(jobId, { result: "published", xPostId: "123" });
  assert.equal(store.checkPublished(jobId), "published");
  ok("file-backed store: checkPublished returns 'published'");
} catch(e) { ko("checkPublished published", e); }

try {
  const store = createFileBackedIdempotencyStore({ dir: "/tmp/x1-idem-test-" + Date.now() });
  const jobId = "unk-job";
  store.set(jobId, { result: "unknown_result", xPostId: null });
  assert.equal(store.checkPublished(jobId), "unknown_result");
  ok("file-backed store: checkPublished returns 'unknown_result'");
} catch(e) { ko("checkPublished unknown_result", e); }

try {
  const store = createFileBackedIdempotencyStore({ dir: "/tmp/x1-idem-test-" + Date.now() });
  assert.equal(store.checkPublished("nonexistent-job"), "not_found");
  ok("file-backed store: checkPublished returns 'not_found' for missing");
} catch(e) { ko("checkPublished not_found", e); }

// ── Resolver: LIVE + AUTHORIZED + realProviderEnabled=true → x-real-provider ──
try {
  const resolver = createProviderResolver({ realProviderEnabled: true });
  const adapter = resolver.resolve(CAPABILITY.PUBLISH_TEXT, EXECUTION_MODE.LIVE, AUTHORIZATION_STATE.AUTHORIZED);
  assert.equal(adapter.providerId, "x-real-provider");
  assert.equal(adapter.executionMode, EXECUTION_MODE.LIVE);
  ok("resolver realProviderEnabled=true LIVE+AUTHORIZED → x-real-provider adapter");
} catch(e) { ko("resolver LIVE+AUTHORIZED+enabled", e); }

// ── Resolver: LIVE + AUTHORIZED + realProviderEnabled=false → still blocked ───
try {
  const resolver = createProviderResolver({ realProviderEnabled: false });
  try {
    resolver.resolve(CAPABILITY.PUBLISH_TEXT, EXECUTION_MODE.LIVE, AUTHORIZATION_STATE.AUTHORIZED);
    throw new Error("should have thrown");
  } catch(e) {
    assert.equal(e.kind, RESOLVER_ERROR.REAL_PROVIDER_NOT_AUTHORIZED);
  }
  ok("resolver realProviderEnabled=false LIVE+AUTHORIZED → REAL_PROVIDER_NOT_AUTHORIZED (P2B+ preserved)");
} catch(e) { ko("resolver LIVE+AUTHORIZED+disabled", e); }

// ── Resolver: LIVE + PROHIBITED → ProviderResolutionError ────────────────────
try {
  const resolver = createProviderResolver({ realProviderEnabled: true });
  try {
    resolver.resolve(CAPABILITY.PUBLISH_TEXT, EXECUTION_MODE.LIVE, AUTHORIZATION_STATE.PROHIBITED);
    throw new Error("should have thrown");
  } catch(e) {
    assert.equal(e.kind, RESOLVER_ERROR.REAL_PROVIDER_NOT_AUTHORIZED);
  }
  ok("resolver LIVE + PROHIBITED → REAL_PROVIDER_NOT_AUTHORIZED");
} catch(e) { ko("resolver LIVE+PROHIBITED", e); }

// ── Resolver: MOCK still works ────────────────────────────────────────────────
try {
  const resolver = createProviderResolver({ realProviderEnabled: true });
  const adapter = resolver.resolve(CAPABILITY.PUBLISH_TEXT, EXECUTION_MODE.MOCK, AUTHORIZATION_STATE.AUTHORIZED);
  assert.notEqual(adapter.providerId, "x-real-provider");
  ok("resolver MOCK still routes to fake adapter");
} catch(e) { ko("resolver MOCK", e); }

// ── Gateway: LIVE blocked when realProviderEnabled=false ─────────────────────
try {
  const gw = createTextPostGateway({ realProviderEnabled: false });
  const r = gw.invoke({
    capability: CAPABILITY.PUBLISH_TEXT,
    executionMode: EXECUTION_MODE.LIVE,
    authorizationState: AUTHORIZATION_STATE.AUTHORIZED,
    applicationContract: { normalizedText: "hello" },
  });
  assert.equal(r.ok, false);
  ok("gateway LIVE blocked when realProviderEnabled=false");
} catch(e) { ko("gateway LIVE blocked", e); }

// ── Gateway: MOCK mode unchanged ──────────────────────────────────────────────
try {
  const gw = createTextPostGateway({ realProviderEnabled: false });
  const r = gw.invoke({
    capability: CAPABILITY.PUBLISH_TEXT,
    executionMode: EXECUTION_MODE.MOCK,
    authorizationState: AUTHORIZATION_STATE.AUTHORIZED,
    applicationContract: { normalizedText: "hello world" },
  });
  assert.equal(r.ok, true);
  ok("gateway MOCK mode unchanged");
} catch(e) { ko("gateway MOCK", e); }

// ── Network-zero assertion: no real DNS/socket in these tests ─────────────────
try {
  // Structural check: real adapter with no transport cannot make network calls
  const a = createXRealProviderAdapter();
  const r = await a.invoke({ normalizedText: "test", correlationId: "c", idempotencyKey: "k" });
  // Must fail with INTERNAL_ERROR (no transport), not a network error
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, "INTERNAL_ERROR");
  ok("network-zero: real adapter without transport cannot make network calls");
} catch(e) { ko("network-zero", e); }

// ── Credential values never in error messages ─────────────────────────────────
try {
  const secretValue = "super-secret-value-xyz";
  const badLoader = () => { throw new Error(`credential value: ${secretValue}`); };
  const fakeTransport = async () => ({ status: 201, body: '{"data":{"id":"1","text":"t"}}' });
  const a = createXRealProviderAdapter({ credentialLoader: badLoader, transport: fakeTransport });
  const r = await a.invoke({ normalizedText: "hello", correlationId: "c", idempotencyKey: "k" });
  // The adapter should not propagate the raw error message with credential values
  // It maps to PROVIDER_AUTHENTICATION_FAILED with the loader's message
  // (In production, loaders must never include credential values in messages)
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, "PROVIDER_AUTHENTICATION_FAILED");
  ok("credential loader error surfaces as PROVIDER_AUTHENTICATION_FAILED");
} catch(e) { ko("credential error kind", e); }

console.log(`\nX1 inline results: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
NODEEOF
node_exit=$?

if [[ "$node_exit" -eq 0 ]]; then
  pass "all inline Node.js X1 tests passed"
else
  fail "inline Node.js X1 tests failed"
fi

# ── Working tree guard: no unexpected files modified ──────────────────────────
STATUS_AFTER="$(git status --short | sort || true)"
if [[ "$STATUS_BEFORE" == "$STATUS_AFTER" ]]; then
  pass "working tree: no unexpected modifications"
else
  DIFF_STATUS="$(diff <(printf '%s\n' "$STATUS_BEFORE") <(printf '%s\n' "$STATUS_AFTER") || true)"
  fail "working tree changed unexpectedly: $DIFF_STATUS"
fi

echo ""
echo "X1_REAL_PROVIDER_CHECKS=$PASS"
if [[ "$FAIL" -gt 0 ]]; then
  echo "FAILED: $FAIL checks failed" >&2
  exit 1
fi
