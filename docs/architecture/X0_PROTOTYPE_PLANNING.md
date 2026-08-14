# X0 — Prototype Planning / Real IO Authorization

**Document type:** X0 Prototype Planning + Real IO Authorization Design
**Lifecycle:** X0 — **Planning Complete**; X1 Implementation **Pending Human Authorization**
**Authority:** [ADR-0024](../adr/ADR-0024-bounded-productization-entry.md) + this document
**Supersedes:** Nothing. Existing governance preserved.
**Related:** [PRODUCT_PROVIDER_SELECTION.md](./PRODUCT_PROVIDER_SELECTION.md), [P2_THREAT_MODEL.md](./P2_THREAT_MODEL.md), [EXTERNAL_IO_BOUNDARY.md](./EXTERNAL_IO_BOUNDARY.md), [SECURITY_CREDENTIAL_BOUNDARY.md](./SECURITY_CREDENTIAL_BOUNDARY.md), [P3_APPROVAL_RECORD_SPEC.md](./P3_APPROVAL_RECORD_SPEC.md), [P3_IMPL_AUTH.md](./P3_IMPL_AUTH.md)

---

## Primary Prototype Goal

```text
指定した内容から X 向け Post を生成し、
指定 X アカウントへ実際に 1 件公開できる
X Single-Post Prototype を最短で完成・リリースする
```

**最優先:** 完璧な SNS 基盤 ではなく **安全に実 X 投稿を 1 件成功させること**

---

## 1. Prototype Definition of Done (12 items)

| # | DoD |
|---|-----|
| DoD-01 | 投稿テーマまたは原稿を入力できる |
| DoD-02 | X 向け投稿文を生成できる |
| DoD-03 | 投稿内容を validation できる（280字・禁止パターン等） |
| DoD-04 | Human Approval を通せる（actor / timestamp / contentDigest） |
| DoD-05 | X 公式 API（`POST /2/tweets`）を使用して実アカウントへ 1 件 Post できる |
| DoD-06 | 成功時に X Post ID を保存できる |
| DoD-07 | 同一ジョブの重複投稿を防止できる（idempotency key） |
| DoD-08 | 投稿失敗時に安全停止できる（UNKNOWN_RESULT quarantine） |
| DoD-09 | kill switch で公開を即時禁止できる（default OFF） |
| DoD-10 | credentials / secrets を repository・audit log・生成成果物に保存しない |
| DoD-11 | 毎日 08:00 JST に自動実行できる（GitHub Actions cron） |
| DoD-12 | Quality Pipeline 1232+ PASS / Catalog baseline 維持 |

---

## 2. Gap Analysis — Current HEAD → Prototype

| Capability | Current State | Gap |
|-----------|---------------|-----|
| Content validation | ✅ `text_post_content.js` | None |
| Kill switch | ✅ `text_post_kill_switch.js` (default OFF) | None |
| In-memory approval | ✅ `text_post_service.approve()` | P3B CLI not yet built |
| Gateway / Resolver boundary | ✅ P2B+ (MOCK mode only) | LIVE mode blocked by design |
| Fake Adapter | ✅ `x_text_post_fake_adapter.js` | Real adapter absent |
| Idempotency | ✅ In-memory store | File-backed persistence needed |
| Audit events | ✅ In-memory sink | File/DB persistence for production |
| Credential types | ✅ `credential_reference.js` (reference only) | Value resolution + storage absent |
| Real X Adapter | ❌ Not implemented | **New: X1** |
| Credential handling (OAuth 1.0a) | ❌ Prohibited | **Lift: X1** |
| `POST /2/tweets` endpoint | ❌ Not approved | **Approve: X0 (this doc)** |
| File-backed approval CLI | ❌ P3B not yet built | **New: X3** |
| Content generation | ✅ Existing pipeline | Integrate: X3 |
| Scheduler | ❌ Not wired | **New: X4** |
| Human Approval Workflow | Partial (in-memory) | P3B CLI: X3 |

---

## 3. Bounded Authorization Model

### 3.1 What this document authorizes

This document constitutes the **X0 Prototype Authorization Record** for:

| Item | Decision |
|------|----------|
| X Real Provider | **AUTHORIZED** (Prototype scope only; single account; text-only) |
| `POST /2/tweets` endpoint | **APPROVED** (only endpoint; see §5) |
| OAuth 1.0a User Context | **AUTHORIZED** (single-account, long-lived token; see §4) |
| External IO (HTTPS to `api.x.com`) | **AUTHORIZED** (kill-switch gated; see §5) |
| Credential value handling | **AUTHORIZED** (local env only; never committed; see §10) |

### 3.2 What remains prohibited

| Item | Status |
|------|--------|
| Any X API endpoint except `POST /2/tweets` | **PROHIBITED** |
| `tweet.read` / `search` / `DM` / `user mutation` | **PROHIBITED** |
| OAuth 2.0 (unless explicitly re-authorized) | **NOT SELECTED** for Prototype |
| Multiple providers | **PROHIBITED** |
| Automatic SNS publishing without kill-switch gate | **PROHIBITED** |
| Credentials in any committed file | **PROHIBITED** |
| Parallel / concurrent publish jobs | **PROHIBITED** |
| Image / video / media upload | **PROHIBITED** |
| Reply / Quote / Repost / Thread | **PROHIBITED** |
| URL-bearing Posts | **PROHIBITED** unless separately approved |
| force push | **PROHIBITED** |

### 3.3 Mandatory Entry Conditions acceptance (PRODUCT_PROVIDER_SELECTION.md §5)

| # | Entry Condition | Acceptance |
|---|-----------------|-----------|
| 1 | Credit purchase / spend-policy acceptance | **Accepted** — operator purchases credits before X1 |
| 2 | Standard create-price acceptance as planning baseline | **Accepted** — public rate; Console confirmation required at X1 |
| 3 | URL-bearing Posts prohibited | **Accepted** — text-only; no URL |
| 4 | Confirmation read-back cost acceptance | **Accepted** — no read-back in Prototype (Post ID from create response) |
| 5 | Live Developer Console rate confirmation | **Required before X1** |
| 6 | Price-change review / kill-stop trigger | **Accepted** — kill switch covers this |
| 7 | Least-privilege OAuth scope freeze | **Accepted** — `tweet.write` + `users.read` only (see §4) |
| 8 | Token lifecycle / refresh / revocation | **Accepted** — see §4 |
| 9 | Credential isolation and account binding | **Accepted** — see §10 |
| 10–20 | Reliability conditions | **Accepted** — see §11–§13 |
| 21–25 | Testing conditions | **Accepted** — see §9 |
| 26–30 | Governance conditions | **Accepted** — this document + X1 ADR |

---

## 4. Minimum X API Permissions / Scopes

### 4.1 Authentication method

**Selected for Prototype: OAuth 1.0a User Context**

Rationale: single-account, long-lived access token, no interactive refresh flow during normal operation. Simpler than OAuth 2.0 PKCE for a single-account Prototype.

| Credential | Type | Storage |
|-----------|------|---------|
| Consumer API Key | App credential (reference safe) | `.env` (gitignored) |
| Consumer API Secret | Secret value | `.env` (gitignored) |
| Access Token | User-level token | `.env` (gitignored) |
| Access Token Secret | Secret value | `.env` (gitignored) |

### 4.2 OAuth scopes (frozen)

```text
tweet.write   ← create Post only
users.read    ← account identity verification only
```

**Explicitly NOT requested:**

```text
tweet.read        — not needed (Post ID from create response)
dm.read           — PROHIBITED
dm.write          — PROHIBITED
follows.read      — PROHIBITED
follows.write     — PROHIBITED
like.read         — PROHIBITED
like.write        — PROHIBITED
offline.access    — not needed for OAuth 1.0a
```

### 4.3 Scope freeze enforcement

The Real Provider Adapter MUST NOT request, accept, or use any scope beyond `tweet.write` + `users.read`. Scope expansion requires a separate ADR.

---

## 5. External IO Authorization Boundary

### 5.1 Approved endpoint

| Field | Value |
|-------|-------|
| Scheme | `https` only |
| Host | `api.x.com` |
| Port | `443` |
| Method | `POST` |
| Path | `/2/tweets` |
| Body | `{ "text": "<normalizedText>" }` — schema-validated; no URL fields |
| Max body size | ≤ 280 UTF-8 characters |
| Response | `{ "data": { "id": string, "text": string } }` — validated |

**All other paths, methods, and query parameters on `api.x.com` are PROHIBITED.**

### 5.2 Network policy

| Topic | Policy |
|-------|--------|
| Redirects | Disabled (no redirect follow) |
| TLS | Certificate verification ON |
| Connect timeout | 10 seconds |
| Request timeout | 30 seconds |
| DNS | Resolve `api.x.com` only |
| Proxy | No open/unvalidated proxy |
| Correlation ID | Required on every attempt |
| User-Agent | Policy-controlled (identify as Prototype) |
| Retry | See §12 |
| Kill switch | Checked immediately before network call |

### 5.3 Zero-network invariant for dry-run / approval phase

Dry-run and approval steps MUST NOT perform any DNS, socket, or HTTP operation. Network is enabled only after kill switch is ON, approval is validated, and idempotency check passes.

---

## 6. Exact Implementation Allowlist (X1–X4)

### X1 new files

```text
src/lib/x_real_provider_adapter.js    — Real X Provider Adapter
src/lib/x_oauth_client.js             — OAuth 1.0a signing + HTTP client
src/lib/x_credential_loader.js        — Load credentials from env; never commit values
scripts/test_x_real_provider.sh       — Offline unit tests (no network)
config/delivery/x1_impl_manifest.json
```

### X1 modifications to existing files

```text
src/lib/text_post_provider_resolver.js  — Add LIVE branch for X Real Provider
src/lib/text_post_gateway.js            — Unlock EXECUTION_MODE.LIVE gating
src/lib/text_post_idempotency.js        — Add file-backed store (persist across runs)
src/lib/text_post_audit.js              — Add real-publish event types
scripts/test_quality_pipeline.sh        — TP-AUX hook for X1 tests
```

### X2 new files

```text
scripts/smoke_test_x_post.sh            — Fixed-text smoke test script (manual run only)
tmp/smoke/                              — Smoke test result record (gitignored)
config/delivery/x2_smoke_manifest.json
```

### X3 new files (P3B CLI + content integration)

```text
src/lib/text_post_approval_record.js    — From P3B spec (§3.1 format)
src/lib/text_post_approval_file_store.js
src/text_post_approve.js                — Approval CLI
src/lib/x_content_generator.js          — Content Brief → Draft → X-specific normalization
scripts/test_text_post_approval.sh
config/delivery/x3_impl_manifest.json
```

### X4 new files (Scheduler + full pipeline)

```text
.github/workflows/x_daily_post.yml     — 08:00 JST cron workflow
src/lib/x_daily_job.js                 — Daily job orchestrator
src/lib/x_publish_record.js            — Persistent publish ledger (jobId → Post ID)
tmp/publish-records/                    — Gitignored publish records
config/delivery/x4_impl_manifest.json
```

---

## 7. Forbidden Paths / Actions

```text
FORBIDDEN paths in any P3B/X1–X4 commit:
  .env                          — secret values
  src/lib/x_api_provider.js     — superseded naming
  src/lib/oauth_handler.js      — replaced by x_oauth_client.js
  src/lib/credential_resolver.js
  src/lib/token_store.js
  Any file containing raw bearer tokens or credential values
  Any non-allowlisted X API endpoint path
  force push flags
  git tag (unless X5 release)
```

```text
FORBIDDEN actions:
  tweet.read  / search / timeline queries
  DM read / write
  follower / following operations
  User profile mutation
  Media upload
  Automatic blind retry on UNKNOWN_RESULT
  Publishing without kill-switch check
  Publishing without approved approval record
  Storing secrets in audit events / reports / JSON records
```

---

## 8. Real Provider Adapter Interface

```js
// src/lib/x_real_provider_adapter.js

export const providerId = "x-real-provider";
export const providerVersion = "1.0.0";

// Policy flags (mirrors mock provider pattern)
export const policy = {
  executionMode: "live",
  networkAccess: true,          // authorized in X0
  endpointAllowlist: ["POST /2/tweets"],
  credentialAccess: true,       // OAuth 1.0a env-only
  filesystemAccess: false,
  realProvider: true,
  externalIOEnabled: true,      // kill-switch gated
  automaticPublishing: false,   // human approval required
};

// Interface:
// invoke({ normalizedText, correlationId, idempotencyKey, requestedAt })
//   → { ok: true,  result: { status: "published", xPostId: string, ... } }
//   | { ok: false, error: { kind: ERROR_KIND, message: string } }
//
// Preconditions enforced by adapter:
//   - kill switch ON (checked by Service, verified by Adapter)
//   - normalizedText ≤ 280 chars, no URL (validated upstream)
//   - No forbidden fields in request
//   - correlationId and idempotencyKey present
//
// Post-conditions:
//   - On success: xPostId is present and non-empty
//   - On timeout after send: returns UNKNOWN_RESULT (never assumes success)
//   - On any error: error.message contains no secret values
```

**Resolver extension (text_post_provider_resolver.js):**

```text
EXECUTION_MODE.LIVE + authorizationState === AUTHORIZED
  → x_real_provider_adapter (only if REAL_PROVIDER_ENABLED flag = true)
  → else → REAL_PROVIDER_NOT_AUTHORIZED (structural block preserved)
```

---

## 9. Fixed-Text Smoke Test Procedure (X2)

Goal: prove `POST /2/tweets` works with a real X account, before adding content generation complexity.

```text
Step 1  Set env:
          X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET
          REAL_PUBLISH_ENABLED=true

Step 2  Run smoke test:
          bash scripts/smoke_test_x_post.sh \
            --text "Smoke test [$(date -u +%Y-%m-%dT%H:%M:%SZ)] - delete after verify" \
            --actor "operator-name" \
            --dry-run     ← preview first

Step 3  Inspect dry-run output:
          correlationId, contentDigest, approvalRecord path, kill-switch state

Step 4  Run with --execute:
          bash scripts/smoke_test_x_post.sh \
            --text "..." --actor "operator-name" --execute

Step 5  Verify:
          xPostId is non-empty in result record (tmp/smoke/result-<corr>.json)
          Post is visible on X account
          Quality Pipeline still 1232+ PASS

Step 6  Delete test post manually on X (cleanup policy)

Step 7  Record result: smoke_test_x_post_result.md (committed as evidence)
```

---

## 10. Human Approval Integration

### X2 (smoke test)

Uses existing **in-memory `approve()`** from `text_post_service.js`. No CLI needed for smoke test. Operator passes `--actor` flag directly.

### X3 (full pipeline)

Uses **P3B file-backed approval** (`text_post_approve.js` CLI):

```
Draft → Validate → [text_post_approve.js --actor <id>]
                        ↓ writes tmp/approvals/approval-<corrId>.json
                   [publish --approval tmp/approvals/approval-<corrId>.json]
                        ↓ §6.3 cross-session 6-step validation
                   Kill switch → Idempotency → Real X Adapter → POST /2/tweets
```

Automatic approval: **PROHIBITED**. `--actor` must be a human-supplied identity string.

---

## 11. Idempotency Design

```text
jobId format:   "daily-post-YYYY-MM-DD"  (date-based; 1 per day)
idempotencyKey: sha256(jobId + contentDigest)

File-backed publish ledger: tmp/publish-records/<jobId>.json
{
  "jobId": "daily-post-2026-08-12",
  "contentDigest": "<64-hex>",
  "publishAttempt": 1,
  "xPostId": "<id>",
  "publishedAt": "<ISO-8601>",
  "result": "published",
  "failureCategory": null
}

Pre-publish check:
  1. If ledger file exists AND result === "published" AND xPostId present
     → SKIP (already published today) — no network call
  2. If ledger file exists AND result === "unknown_result"
     → QUARANTINE — operator resolution required before retry

X API does NOT provide native idempotency key for POST /2/tweets.
App-side ledger is the sole idempotency mechanism.
```

---

## 12. Retry / Failure Handling

| Condition | Category | Retry | Post-retry action |
|-----------|----------|-------|-------------------|
| 5xx server error | `PROVIDER_TRANSIENT_FAILURE` | Yes (max 3, exp backoff 2s/4s/8s) | Fail if ceiling reached |
| 429 Rate limit | `PROVIDER_RATE_LIMITED` | Yes (1 retry after Retry-After) | Fail if still limited |
| Timeout **before** request sent | `TIMEOUT` | Yes (1 retry) | Fail if repeated |
| Timeout **after** request may have sent | `UNKNOWN_RESULT` | **NO** | Quarantine; operator resolves |
| 4xx rejection (content / auth) | `PROVIDER_REJECTED` | **NO** | Fail; report category |
| Kill switch OFF | `KILL_SWITCH_DISABLED` | **NO** | Fail; operator re-enables |
| Approval invalid | `APPROVAL_CONTENT_MISMATCH` | **NO** | Re-approve required |
| Already published (ledger) | — | **NO** | Return cached xPostId |
| UNKNOWN_RESULT quarantine active | — | **NO** | Operator clears quarantine |

**No infinite retry. No silent retry. No retry on UNKNOWN_RESULT.**

---

## 13. Kill-Switch Behavior

```text
Default: OFF (REAL_PUBLISH_ENABLED=false)

Hierarchy:
  Level 1: Global  REAL_PUBLISH_ENABLED env flag
  Level 2: Per-run --enable-live flag (smoke test / scheduler)
  Level 3: Kill switch object (killSwitch.isEnabled())

Check order (immediately before network call):
  1. REAL_PUBLISH_ENABLED === "true"         → else: KILL_SWITCH_DISABLED
  2. killSwitch.isEnabled() === true          → else: KILL_SWITCH_DISABLED
  3. Idempotency check passes                 → else: DUPLICATE_REJECTED / QUARANTINE
  4. POST /2/tweets

Disable (emergency):
  → Set REAL_PUBLISH_ENABLED=false in env / GitHub Actions secret
  → No X credentials needed to disable
  → Scheduler job fails cleanly; no partial publish

Audit: every kill-switch enable/disable is logged (no secret values).
```

---

## 14. Audit / Result Record

### Per-publish record (committed to `tmp/publish-records/`, gitignored)

```json
{
  "jobId": "daily-post-2026-08-12",
  "scheduledAt": "2026-08-12T23:00:00Z",
  "contentDigest": "<64-hex>",
  "actorId": "operator-name",
  "approvalState": "approved",
  "approvedAt": "2026-08-12T22:55:00Z",
  "publishAttempt": 1,
  "xPostId": "1234567890123456789",
  "publishedAt": "2026-08-12T23:00:05Z",
  "result": "published",
  "failureCategory": null
}
```

**Secret / token fields: PROHIBITED in all records.**

### Audit events (in-memory + optional file sink)

```text
draft_created / validation_passed / validation_failed
approval_record_written / approval_record_validated / approval_record_invalid
publish_requested / kill_switch_rejected
real_provider_invoked / real_provider_succeeded / real_provider_failed
unknown_result_quarantine / duplicate_rejected / retry_attempted
```

---

## 15. Scheduler Architecture

```yaml
# .github/workflows/x_daily_post.yml
name: X Daily Post
on:
  schedule:
    - cron: "0 23 * * *"    # 23:00 UTC = 08:00 JST (+9)
  workflow_dispatch:         # manual trigger
concurrency:
  group: x-daily-post
  cancel-in-progress: false  # never cancel in-flight post
jobs:
  post:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: node src/lib/x_daily_job.js
        env:
          X_API_KEY:             ${{ secrets.X_API_KEY }}
          X_API_SECRET:          ${{ secrets.X_API_SECRET }}
          X_ACCESS_TOKEN:        ${{ secrets.X_ACCESS_TOKEN }}
          X_ACCESS_TOKEN_SECRET: ${{ secrets.X_ACCESS_TOKEN_SECRET }}
          REAL_PUBLISH_ENABLED:  ${{ secrets.REAL_PUBLISH_ENABLED }}
          CONTENT_TOPIC:         ${{ vars.CONTENT_TOPIC }}
```

**Concurrency:** `cancel-in-progress: false` — never cancel a running post job mid-flight.

**Secrets:** injected by GitHub Actions; never echoed to logs.

---

## 16. Phase-by-Phase Definition of Done

| Phase | Definition of Done |
|-------|-------------------|
| **X0** (this doc) | Planning complete; Real IO authorization designed; all 30 entry conditions accepted; A.GO |
| **X1** | Real X Adapter posts to X in LIVE mode; OAuth 1.0a credential loading from env; Quality 1232+ PASS; no smoke test yet |
| **X2** | Fixed-text smoke test succeeds; xPostId recorded; test post deleted; Quality PASS |
| **X3** | Content generation → validation → P3B approval → Real X post; end-to-end pipeline working |
| **X4** | Scheduler runs at 08:00 JST; idempotency prevents duplicates; failure handling proven; retry ceiling works |
| **X5** | Release; operational verification; DoD-01–12 all satisfied |

---

## 17. Lightweight Risk Register

| ID | Threat | L | I | Mitigation | Milestone |
|----|--------|---|---|-----------|-----------|
| R-01 | Credential committed to Git | M | H | `.gitignore` + credential_reference model; forbidden path in all manifests | X1 |
| R-02 | Duplicate post (same day) | M | H | File-backed idempotency ledger; pre-publish check | X1/X4 |
| R-03 | UNKNOWN_RESULT after timeout | M | H | `UNKNOWN_RESULT` category; quarantine; no auto-retry; operator resolves | X1 |
| R-04 | Rate limit exceeded | L | M | Bounded retry (1 attempt after Retry-After); ceiling | X1 |
| R-05 | URL in post (cost surcharge) | M | M | Content validation rejects URLs; `UNSUPPORTED_FEATURE` | X3 |
| R-06 | Kill-switch bypass | M | H | Pre-network check; default OFF; disable requires no credential | X1 |
| R-07 | Secrets in audit / logs | M | H | Audit field allowlist; error message sanitization | X1 |
| R-08 | Excessive API scopes | M | M | Scope freeze: `tweet.write` + `users.read` only; no scope expansion without ADR | X1 |
| R-09 | Scheduler concurrent runs | L | H | `concurrency` group; `cancel-in-progress: false` | X4 |
| R-10 | Token expiry / revocation | M | M | Credential expiry detection; `CREDENTIAL_INVALID` → halt; rotation procedure | X1 |
| R-11 | X API pricing change | M | M | Price-change trigger; kill-switch | Ongoing |
| R-12 | Approval bypass | M | H | P3B: `validateApprovalRecord()` required; no --actor = APPROVAL_REQUIRED | X3 |

---

## 18. Estimated Remaining Phases

```
X0  Planning / Authorization  ← CURRENT (this document)
X1  Real Provider Adapter + Credential Boundary
X2  Fixed-Text Smoke Test
X3  Content Generation + Validation + Approval Integration
X4  Scheduler + Idempotency + Failure Handling
X5  Prototype Release + Operational Verification
────────────────────────────────────────────────
Total remaining: 5 phases (X1–X5)
```

P3B (Human Approval CLI) is integrated into X3, not a separate phase. P3B and X3 overlap intentionally to minimize total phase count.

---

## 19. Shortest Path: HEAD → First Real X Post

```
[NOW]   HEAD = d5912c6 (P3-ImplAuth granted)

Step 1  X0 commit / publish (this document)       ← 1 commit

Step 2  X1: Real X Adapter + Credential loading
          src/lib/x_real_provider_adapter.js       ← OAuth 1.0a sign + POST /2/tweets
          src/lib/x_oauth_client.js                ← HMAC-SHA1 signing
          src/lib/x_credential_loader.js           ← env read only
          Extend resolver for LIVE mode
          File-backed idempotency store
          X1 offline tests (no network)
          dg commit → dg publish                   ← 1 commit

Step 3  X2: Smoke Test (manual)
          Set env credentials (local .env)
          bash scripts/smoke_test_x_post.sh --dry-run
          bash scripts/smoke_test_x_post.sh --execute
          Verify xPostId → delete test post
          Commit smoke evidence                     ← 1 commit

[FIRST REAL X POST ACHIEVED after X2]

Total from NOW: 3 commits / 2–4 developer days
```

---

## 20. Shortest Path: First X Post → Daily 08:00 Automation

```
[X2 complete]  First real X Post achieved

Step 4  X3: Content Generation + Approval
          src/lib/x_content_generator.js
          P3B approval CLI (text_post_approve.js)
          End-to-end: topic → draft → validate → approve → publish
          dg commit → dg publish                   ← 1 commit

Step 5  X4: Scheduler + Full Pipeline
          .github/workflows/x_daily_post.yml
          src/lib/x_daily_job.js
          src/lib/x_publish_record.js
          Idempotency hardening
          Failure handling / UNKNOWN_RESULT quarantine
          Retry ceiling tests
          dg commit → dg publish                   ← 1 commit

Step 6  X5: Release
          Operational verification (manual 08:00 run)
          DoD-01–12 checklist
          All 30 entry conditions satisfied evidence
          dg commit → dg publish → tag v1.88.0     ← 1 commit

[DAILY 08:00 AUTOMATION ACHIEVED at X5]

Total from X2: 3 commits / 3–7 developer days
Total from NOW: 6 commits / 5–11 developer days
```

---

## Governance Markers

```text
Primary Goal:  X Single-Post Prototype
Real Provider: AUTHORIZED (X only; POST /2/tweets only; kill-switch gated)
External IO:   AUTHORIZED (api.x.com:443/2/tweets only; kill-switch gated)
Credentials:   AUTHORIZED (OAuth 1.0a; env only; never committed)
Instagram:     Historical / NOT FIT (unchanged)
Threads:       Deferred (unchanged)
P2B+:          Complete / Published (preserved)
P3-ImplAuth:   Granted (preserved)
Catalog:       No change required (X Real Provider: separate ADR at X1)
Version:       Not Assigned (X0 versionless)
Force push:    PROHIBITED
```

---

## Document Control

| Field | Value |
| ----- | ----- |
| Status | **X0 Planning Complete — Authorization Designed** |
| X Real Provider | **AUTHORIZED** (Prototype scope; X1 ADR required for formal record) |
| `POST /2/tweets` | **APPROVED** |
| OAuth 1.0a | **AUTHORIZED** |
| External IO | **AUTHORIZED** (kill-switch gated; api.x.com only) |
| Next Phase | **X1 — Real Provider Adapter + Credential Boundary** |

---

## Decision

**A. GO**

根拠:

1. X はすでに P2-R4 Outcome D — Conditional Recommendation。30 の Entry Conditions を本書で全件 Accept。
2. 認可スコープは最小限（`POST /2/tweets` 1 エンドポイント / `tweet.write` + `users.read` のみ）。
3. 既存の P2B+ / P3 基盤（Gateway, Resolver, Kill Switch, Approval）を完全に再利用。巻き戻し不要。
4. Kill switch default-OFF により実投稿はオペレーターが明示的に有効化するまで発生しない。
5. Credential は env only / never committed — SECRET_HANDLING_POLICY.md 準拠。
6. 最短経路: 6 commits / 5–11 developer days で DoD-01–12 達成可能。
7. 既存 Quality 1232 PASS / Catalog baseline は破壊しない。

**X1 実装を開始する前に、X1 ADR（X Real Provider 正式認可記録）の commit が必要。**
