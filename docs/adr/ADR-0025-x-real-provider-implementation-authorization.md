# ADR-0025: X Real Provider Adapter Implementation Authorization

## Status

Accepted（X1 — Real Provider Adapter Implementation Authorization;
versionless governance; implementation **Pending X1 impl commit**）

## Context

### Prior authorization chain

| Document | Role |
|----------|------|
| [ADR-0024](./ADR-0024-bounded-productization-entry.md) | Bounded Productization Entry; Real Provider still Prohibited |
| [PRODUCT_PROVIDER_SELECTION.md](../architecture/PRODUCT_PROVIDER_SELECTION.md) | Outcome D — X Recommended with 30 Entry Conditions |
| [P3_IMPL_AUTH.md](../architecture/P3_IMPL_AUTH.md) | P3 Implementation Authorization granted |
| [X0_PROTOTYPE_PLANNING.md](../architecture/X0_PROTOTYPE_PLANNING.md) | X0 Planning Complete; Real IO Authorization designed; A.GO |
| **This ADR** | **X1 formal implementation authorization record** |

[X0_PROTOTYPE_PLANNING.md](../architecture/X0_PROTOTYPE_PLANNING.md) established:

1. Primary Prototype Goal — publish 1 real post to X safely
2. All 30 Entry Conditions accepted
3. Authorization scope — `POST /2/tweets` only; OAuth 1.0a; kill-switch default-OFF
4. Gap analysis — Real X Adapter absent; credential handling absent
5. Decision — **A.GO**

This ADR constitutes the **formal implementation authorization record** for X1 in the sense of ADR-0016 (Mock Provider) — authorization ≠ implementation. Implementation is a separate X1 impl commit governed by `x1_impl_manifest.json` (to be created at X1 impl commit preparation).

### Why authorize X Real Provider in limited prototype scope

| Reason | Evidence |
|--------|----------|
| X is the sole provider meeting all 30 Entry Conditions | PRODUCT_PROVIDER_SELECTION.md Outcome D |
| Instagram = Historical / NOT FIT | P2-R1 Research |
| Threads = CONDITIONAL FIT / Deferred | P2-R2 Research |
| Existing P2B+ / P3 safety foundations are complete | text_post_gateway.js, kill switch, approval gate |
| Prototype scope is strictly bounded (1 endpoint, 1 provider, kill-switch default-OFF) | §3 below |
| Credentials are env-only; never committed | SECRET_HANDLING_POLICY.md |
| Human approval required before any network call | §6 below |

**Authorization is limited to the X1 implementation allowlist in §10.** It does not authorize X2 (smoke test execution), X3 (content integration), X4 (scheduler), or any capability beyond §10.

---

## 1. Decision

### 1.1 Authorization granted by this ADR

| Item | Decision |
|------|----------|
| X Real Provider Adapter implementation | **AUTHORIZED** (prototype scope; X1 allowlist only) |
| `POST /2/tweets` endpoint implementation | **AUTHORIZED** |
| OAuth 1.0a credential loading from env | **AUTHORIZED** |
| LIVE execution mode unlock in resolver/gateway | **AUTHORIZED** (kill-switch gated) |
| File-backed idempotency store | **AUTHORIZED** |
| X1 offline unit tests (no network) | **AUTHORIZED** |
| Real network call to `api.x.com` | **NOT YET** — authorized at X2 smoke test only |

### 1.2 What remains prohibited

| Item | Status |
|------|--------|
| Any X API endpoint except `POST /2/tweets` | **PROHIBITED** |
| `tweet.read` / search / DM / user mutation / media upload | **PROHIBITED** |
| OAuth 2.0 | **NOT SELECTED** for prototype |
| Multiple providers | **PROHIBITED** |
| Automatic SNS publishing without kill-switch + human approval | **PROHIBITED** |
| Credentials in any committed file | **PROHIBITED** |
| Real network calls in X1 tests | **PROHIBITED** (offline only) |
| X2 smoke test execution | **NOT YET** — requires X2 commit |
| X3 content integration | **NOT YET** — requires X3 commit |
| X4 scheduler | **NOT YET** — requires X4 commit |
| force push | **PROHIBITED** |
| git tag (until X5 release) | **PROHIBITED** |
| Credentials in audit events / reports / JSON records | **PROHIBITED** |

---

## 2. Authorized Endpoint

| Field | Value |
|-------|-------|
| Scheme | `https` only |
| Host | `api.x.com` |
| Port | `443` |
| Method | `POST` |
| Path | `/2/tweets` |
| Body schema | `{ "text": "<normalizedText>" }` — validated; no URL fields |
| Max body size | ≤ 280 UTF-8 characters |
| Response schema | `{ "data": { "id": string, "text": string } }` — validated |

**All other paths, methods, query parameters on `api.x.com` are PROHIBITED.**

---

## 3. Authorized Scopes (frozen)

```text
tweet.write   ← create Post only
users.read    ← account identity verification only
```

**Explicitly NOT requested:**

```text
tweet.read / dm.read / dm.write / follows.read / follows.write
like.read / like.write / offline.access
```

The Real Provider Adapter MUST NOT request, accept, or use any scope beyond `tweet.write` + `users.read`. Scope expansion requires a separate ADR.

---

## 4. Credential Boundary

| Credential | Type | Storage |
|-----------|------|---------|
| Consumer API Key | App credential | `.env` (gitignored) |
| Consumer API Secret | Secret value | `.env` (gitignored) |
| Access Token | User-level token | `.env` (gitignored) |
| Access Token Secret | Secret value | `.env` (gitignored) |

### Invariants

- Credentials MUST NOT appear in any committed file, audit log, report JSON, or generated content.
- `x_credential_loader.js` reads from env only; never writes, caches to disk, or logs values.
- Error messages MUST NOT contain credential values (sanitization required).
- If a credential value appears in any output, that output is a SECURITY VIOLATION — stop and rotate.

---

## 5. External IO Boundary

```text
Authorized:   HTTPS POST to api.x.com:443/2/tweets only
              Kill-switch checked immediately before network call
              TLS certificate verification ON
              No redirect follow
              Connect timeout: 10 seconds
              Request timeout: 30 seconds
              Correlation ID: required on every attempt

Prohibited:   Any other host / path / method
              Open / unvalidated proxy
              DNS other than api.x.com
              Plaintext HTTP
```

### Zero-network invariant

Dry-run and approval steps MUST NOT perform any DNS, socket, or HTTP operation.
Network is enabled only when:

1. `REAL_PUBLISH_ENABLED=true` AND
2. `killSwitch.isEnabled() === true` AND
3. Idempotency check passes (no duplicate ledger entry)

---

## 6. Human Approval Requirement

Every publish attempt requires a validated approval record before any network call.

For X1 (adapter + unit tests only — no real publish yet):
- The adapter interface includes `approvalRecord` validation as a precondition.
- Automatic approval is **PROHIBITED** — `--actor` must be a human-supplied identity string.
- Approval record must include: `actor`, `timestamp`, `contentDigest` (sha256 of normalizedText).

For X2 (smoke test — first real network call):
- Uses in-memory `approve()` from `text_post_service.js`.
- Operator passes `--actor` flag directly.

---

## 7. Idempotency Requirement

```text
jobId format:   "daily-post-YYYY-MM-DD"
idempotencyKey: sha256(jobId + contentDigest)

File-backed ledger: tmp/publish-records/<jobId>.json
{
  "jobId": "...",
  "contentDigest": "<64-hex>",
  "publishAttempt": <n>,
  "xPostId": "<id> | null",
  "publishedAt": "<ISO-8601> | null",
  "result": "published | unknown_result | failed",
  "failureCategory": "<string> | null"
}
```

Pre-publish check:

1. If ledger exists AND `result === "published"` AND `xPostId` present → **SKIP** (already published)
2. If ledger exists AND `result === "unknown_result"` → **QUARANTINE** — operator resolves before retry

X API does not provide native idempotency for `POST /2/tweets`. App-side ledger is the sole mechanism.

File-backed store replaces in-memory store (needed for X4 scheduler cross-session safety).

---

## 8. Retry and UNKNOWN_RESULT Policy

| Condition | Category | Retry | Post-retry |
|-----------|----------|-------|------------|
| 5xx server error | `PROVIDER_TRANSIENT_FAILURE` | Yes (max 3, exp backoff 2s/4s/8s) | Fail if ceiling reached |
| 429 Rate limit | `PROVIDER_RATE_LIMITED` | Yes (1 retry after Retry-After) | Fail if still limited |
| Timeout **before** request sent | `TIMEOUT` | Yes (1 retry) | Fail if repeated |
| Timeout **after** request may have sent | `UNKNOWN_RESULT` | **NO** | Quarantine; operator resolves |
| 4xx rejection | `PROVIDER_REJECTED` | **NO** | Fail; report category |
| Kill switch OFF | `KILL_SWITCH_DISABLED` | **NO** | Fail; operator re-enables |
| Approval invalid | `APPROVAL_CONTENT_MISMATCH` | **NO** | Re-approve required |
| Already published (ledger) | — | **NO** | Return cached xPostId |
| UNKNOWN_RESULT quarantine active | — | **NO** | Operator clears quarantine |

**No infinite retry. No silent retry. No retry on UNKNOWN_RESULT.**

---

## 9. Kill Switch

```text
Default: OFF (REAL_PUBLISH_ENABLED=false)

Check order (immediately before network call):
  1. REAL_PUBLISH_ENABLED === "true"    → else: KILL_SWITCH_DISABLED
  2. killSwitch.isEnabled() === true    → else: KILL_SWITCH_DISABLED
  3. Idempotency check passes           → else: DUPLICATE_REJECTED / QUARANTINE
  4. POST /2/tweets

Emergency disable:
  → Set REAL_PUBLISH_ENABLED=false (env / GitHub Actions secret)
  → No X credentials needed to disable
  → Scheduler job fails cleanly; no partial publish

Audit: every kill-switch enable/disable is logged (no secret values).
```

---

## 10. Audit Requirement

The adapter MUST emit the following events (in-memory sink; optional file sink for X3+):

```text
real_provider_invoked       — correlationId, idempotencyKey, requestedAt; NO credential values
real_provider_succeeded     — xPostId, publishedAt; NO response body beyond id/text
real_provider_failed        — failureCategory, message (sanitized); NO credential values
unknown_result_quarantine   — correlationId; triggered when UNKNOWN_RESULT
duplicate_rejected          — jobId, existing xPostId
retry_attempted             — attempt number, backoff_ms
kill_switch_rejected        — reason
```

**Secret / token fields are PROHIBITED in all audit events.**

---

## 11. Rollback and Disable Procedure

### If X1 implementation is found incorrect before X1 commit/push

1. Do NOT force-push or rewrite published X0 baseline.
2. Correct via bounded remediation under the same X1 manifest.
3. Keep kill switch OFF; no real network calls.

### If X1 is published and a defect is found

1. Set `REAL_PUBLISH_ENABLED=false` immediately (no credentials needed).
2. Do not declare the post published until xPostId is confirmed non-empty.
3. If `UNKNOWN_RESULT` occurs: quarantine the job; do NOT retry automatically.
4. Operator resolves quarantine manually before any retry.
5. If credentials are suspected compromised: revoke on X Developer Portal; rotate before re-enabling.

### Revert path

```text
git revert <x1-commit-sha>   ← creates a new commit reverting X1 changes
dg publish                    ← push revert commit
```

Force-push is PROHIBITED. Revert via new commit only.

---

## 12. X2 Smoke Test Entry Conditions

Before running X2 (`smoke_test_x_post.sh --execute`), the following must be satisfied:

| # | Condition |
|---|-----------|
| 1 | X1 commit published to `main` (this ADR + impl commit both in HEAD) |
| 2 | X API Developer Account created; OAuth 1.0a credentials obtained |
| 3 | Credentials loaded into local `.env` (gitignored; never committed) |
| 4 | Quality 1232+ PASS with X1 tests included |
| 5 | `--dry-run` output inspected: correlationId, contentDigest, approvalRecord path, kill-switch state |
| 6 | Kill switch enabled: `REAL_PUBLISH_ENABLED=true` in `.env` |
| 7 | Operator sets `--actor <identity>` (human identity; not automated) |
| 8 | Text is ≤ 280 UTF-8 chars; no URLs; no forbidden patterns |
| 9 | Idempotency ledger for today's jobId is absent or cleared |
| 10 | X2 smoke result recorded: `tmp/smoke/result-<corrId>.json` |
| 11 | Test post deleted manually on X after verification |
| 12 | Quality PASS re-confirmed after X2 |

---

## 13. X1 Implementation Allowlist

### New files

```text
src/lib/x_real_provider_adapter.js     — Real X Provider Adapter (OAuth 1.0a sign + POST /2/tweets)
src/lib/x_oauth_client.js              — HMAC-SHA1 signing + HTTP client
src/lib/x_credential_loader.js         — Load credentials from env; never log/commit values
scripts/test_x_real_provider.sh        — Offline unit tests (no network)
config/delivery/x1_impl_manifest.json  — X1 impl delivery manifest
```

### Modifications to existing files

```text
src/lib/text_post_provider_resolver.js  — Add LIVE branch: EXECUTION_MODE.LIVE + AUTHORIZED → x_real_provider_adapter
src/lib/text_post_gateway.js            — Unlock EXECUTION_MODE.LIVE gating (kill-switch gated)
src/lib/text_post_idempotency.js        — Add file-backed store (persist across sessions)
src/lib/text_post_audit.js              — Add real-publish event types
scripts/test_quality_pipeline.sh        — TP-AUX hook for X1 offline tests
```

### Forbidden paths (in any X1 impl commit)

```text
.env                              — secret values
src/lib/x_api_provider.js         — superseded naming
src/lib/real_x_provider.js        — superseded naming
src/lib/oauth_handler.js          — replaced by x_oauth_client.js
src/lib/credential_resolver.js    — superseded naming
src/lib/token_store.js            — superseded naming
.github/workflows/x_daily_post.yml — not yet (X4)
src/lib/x_daily_job.js            — not yet (X4)
```

---

## 14. Authorization Preconditions (satisfied at X1 ADR commit)

| Prerequisite | Evidence |
|--------------|----------|
| X Recommended with Entry Conditions | PRODUCT_PROVIDER_SELECTION.md Outcome D |
| All 30 Entry Conditions accepted | X0_PROTOTYPE_PLANNING.md §3 |
| Kill switch design complete | text_post_kill_switch.js; X0_PROTOTYPE_PLANNING.md §13 |
| Human approval gate design complete | text_post_service.js + P3A spec |
| P3 Implementation Authorization | P3_IMPL_AUTH.md |
| Gateway / Resolver boundary (P2B+) | text_post_gateway.js, text_post_provider_resolver.js |
| Quality 1232 PASS | test_quality_pipeline.sh |
| Catalog PASS | public-contract catalog |
| X0 Planning committed and published | f64c4d5488def3f24141d202e94cfaae73b12e80 |

---

## 15. Governance Markers

```text
X Real Provider:     AUTHORIZED (X1 implementation scope; POST /2/tweets only)
External IO:         AUTHORIZED (kill-switch gated; api.x.com:443 only; X2 execution only)
Credentials:         AUTHORIZED (OAuth 1.0a; env-only; never committed)
POST /2/tweets:      APPROVED (only endpoint)
tweet.write + users.read: FROZEN (only scopes)
Automatic Publishing: PROHIBITED
Force push:          PROHIBITED
git tag:             PROHIBITED (until X5)
Instagram:           Historical / NOT FIT (unchanged)
Threads:             Deferred (unchanged)
P2B+:               Complete / Published (preserved)
P3-ImplAuth:        Granted (preserved)
Quality 1232:        PASS (maintained)
Catalog:             No change required (X Real Provider: prototype scope only)
Version:             Not Assigned (X1 ADR versionless)
```

---

## 16. References

- [X0_PROTOTYPE_PLANNING.md](../architecture/X0_PROTOTYPE_PLANNING.md) — Primary authorization design
- [P3_IMPL_AUTH.md](../architecture/P3_IMPL_AUTH.md) — P3 Implementation Authorization
- [P3_APPROVAL_RECORD_SPEC.md](../architecture/P3_APPROVAL_RECORD_SPEC.md) — Approval record format
- [ADR-0024](./ADR-0024-bounded-productization-entry.md) — Bounded Productization Entry
- [ADR-0016](./ADR-0016-mock-provider-production-implementation-authorization.md) — Prior implementation authorization pattern
- [PRODUCT_PROVIDER_SELECTION.md](../architecture/PRODUCT_PROVIDER_SELECTION.md) — Provider selection record
- [SECURITY_CREDENTIAL_BOUNDARY.md](../architecture/SECURITY_CREDENTIAL_BOUNDARY.md) — Credential boundary
- [EXTERNAL_IO_BOUNDARY.md](../architecture/EXTERNAL_IO_BOUNDARY.md) — External IO boundary
- [SECRET_HANDLING_POLICY.md](../architecture/SECRET_HANDLING_POLICY.md) — Secret handling policy
- [PROVIDER_ENDPOINT_ALLOWLIST.md](../architecture/PROVIDER_ENDPOINT_ALLOWLIST.md) — Endpoint allowlist authority
- [P2_THREAT_MODEL.md](../architecture/P2_THREAT_MODEL.md) — Threat model
- [NON_GOALS.md](../architecture/NON_GOALS.md) — Non-goals
