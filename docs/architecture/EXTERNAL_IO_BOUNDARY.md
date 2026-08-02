# External IO Boundary

**Document type:** P2A External IO Boundary Specification
**Lifecycle:** P2A — Boundary Specifications **Complete** / IR **A.GO**; lifecycle closure **In Progress**（versionless; **Not Assigned**）
**Authority:** [ADR-0024](../adr/ADR-0024-bounded-productization-entry.md)
**Related:** [PROVIDER_ENDPOINT_ALLOWLIST.md](./PROVIDER_ENDPOINT_ALLOWLIST.md), [SECURITY_CREDENTIAL_BOUNDARY.md](./SECURITY_CREDENTIAL_BOUNDARY.md), [PRODUCT_PROVIDER_SELECTION.md](./PRODUCT_PROVIDER_SELECTION.md)

---

## 1. Purpose

Define the deny-by-default External IO boundary for a future single-Provider text publishing path.

**Current authorization state:** External IO = **Prohibited**. This document is specification only.

## 2. Future single-Provider boundary

| Item | Value |
| ---- | ----- |
| Count | **1** |
| Recommended Provider | **Instagram** |
| Status | **Recommended ≠ Authorized** |
| Threads / X / others | Deferred |

## 3. Deny by default

- No host, method, or endpoint is permitted unless present on an authorized allowlist
- Missing enable flags = **OFF**
- Unknown Provider / host / endpoint / method → reject

## 4. Future permitted IO categories（separate authorization only）

- Official Provider API hosts only
- Authentication / token endpoint（if required by future contract）
- Text publication creation
- Publication result retrieval
- Account / identity validation
- Minimal rate-limit metadata
- Minimal health / permission validation

## 5. Explicitly prohibited IO

- Arbitrary HTTP
- User-provided URLs
- Unregistered hosts
- Multiple Providers
- Browser automation
- Scraping
- Comments / DMs / follower retrieval / engagement analytics
- Image / video / media upload
- URL shortening
- Redirect chasing outside allowlist
- Webhook receivers
- Automatic publishing
- Silent retry
- Credential discovery

## 6. Network request policy（Planning recommendations）

| Topic | Policy |
| ----- | ------ |
| Scheme | `https` only（Planning recommendation） |
| Host | Allowlisted exact hosts only |
| Port | Allowlisted（default 443） |
| Methods | Allowlisted per endpoint template |
| Endpoint templates | Narrow templates; no arbitrary path passthrough |
| Content-Type | Allowlisted per template |
| Request body | Schema-validated; size-limited |
| Response | Schema-validated; size-limited |
| Connect timeout | Required（numeric TBD in Implementation） |
| Request timeout | Required |
| Redirects | Disabled **or** each hop re-validated against allowlist |
| TLS | Certificate verification **on** |
| Proxy | No open/unvalidated proxy |
| DNS / rebinding | Resolve only for allowlisted hosts; reject surprising targets |
| Correlation ID | Required on every future attempt |
| Idempotency key | Required for publication attempts |
| User-Agent | Policy-controlled |
| Retry | Only classified retryable errors; ceiling required |
| Cancellation | Supported; cooperative abort |
| Kill-switch | Checked immediately before network |
| Logging | Structured + redacted |

## 7. Host / method / endpoint allowlists

Canonical model: [PROVIDER_ENDPOINT_ALLOWLIST.md](./PROVIDER_ENDPOINT_ALLOWLIST.md).

**Concrete Meta hosts/endpoints remain TBD until P2-R1 — Official Instagram Contract-Fit Research**（official Meta primary documentation only）. Do not invent hosts in P2A.

## 8. Dry-run zero-network invariant

Dry-run **shares** validation, approval checks, content hash, Provider/account selection, endpoint selection, payload construction, idempotency-key generation, policy evaluation, audit generation.

Dry-run **must not**:

- Secret value retrieval（default）
- DNS resolution
- Socket connection
- HTTP request
- Provider resource creation
- Provider post ID generation
- Published state generation

Result: non-Published; explicit `DRY_RUN`; redacted simulated metadata; no false Provider success; no network fallback; no retry.

## 9. Enablement and kill-switch hierarchy

All default **OFF**. Missing flag = OFF.

1. Global real-publish enable
2. Provider enable
3. Environment enable
4. Account enable
5. Workflow enable
6. Publication eligibility
7. Immediate cancellation

Rules:

- Credentials alone do not enable
- Approval alone does not enable
- Configuration alone does not enable
- Kill-switch checked **immediately before network**
- Emergency disable wins
- Disable requires no Provider credential
- Dry-run usable while real IO disabled
- Enable/disable changes audited
- Timeout with uncertain Provider effect → `UNKNOWN_RESULT` + quarantine（never assume Published）

P2A does **not** implement flags.

## 10. Retry boundary

- Retry only when category is retryable（see [ERROR_REDACTION_MODEL.md](./ERROR_REDACTION_MODEL.md)）
- Ceiling required; no infinite retry
- Silent retry prohibited
- Idempotency key must be stable across retries of the same logical publication

## 11. Unknown-result and quarantine

| Situation | Category | Publication state |
| --------- | -------- | ----------------- |
| Timeout after request may have been sent | `UNKNOWN_RESULT` | Quarantine / not Published |
| Ambiguous Provider response | `UNKNOWN_RESULT` / `RESPONSE_INVALID` | Quarantine |
| Clear rejection | `PROVIDER_REJECTED` | Failed（not Published） |

## 12. Structured / redacted logs

All IO logs must pass redaction. Redaction failure → fail closed（do not emit raw payload）.

## 13. Explicit non-goals

- Enabling External IO in P2A
- Implementing HTTP clients / gateways
- Finalizing concrete Meta endpoints without P2-R1
- Automatic SNS publishing
- Multi-Provider IO

## 14. Future gates

| Gate | Before |
| ---- | ------ |
| P2-R1 | Concrete host/endpoint tables |
| P2D | Gateway abstraction（still no network） |
| Separate External IO authorization | Any live request |
| P4 | Real Provider adapter（default-disabled） |

---

## Document Control

| Field | Value |
| ----- | ----- |
| Status | **Complete** — P2A Boundary Specifications（IR **A.GO**）; lifecycle closure **In Progress**（versionless） |
| External IO | **Prohibited**（current） |
| Instagram | Recommended ≠ Authorized |
| Version | **Not Assigned** |
