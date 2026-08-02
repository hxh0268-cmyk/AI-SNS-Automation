# Error and Redaction Model

**Document type:** P2A Error Taxonomy and Redaction Specification
**Lifecycle:** P2A — Boundary Specifications **Complete** / IR **A.GO**; lifecycle closure **In Progress**（versionless; **Not Assigned**）
**Authority:** [ADR-0024](../adr/ADR-0024-bounded-productization-entry.md)
**Related:** [SECRET_HANDLING_POLICY.md](./SECRET_HANDLING_POLICY.md), [EXTERNAL_IO_BOUNDARY.md](./EXTERNAL_IO_BOUNDARY.md)

---

## 1. Purpose

Define structured error categories, retryability, operator actions, future publication-state mapping, audit categories, safe messages, redacted technical detail, and quarantine requirements for credential and External IO paths.

P2A does **not** implement error types in runtime code.

## 2. Redaction invariant

If redaction cannot be applied confidently → **fail closed**（do not emit the raw payload）.

## 3. Redaction targets

Always redact before log / report / audit / exception serialization:

- Authorization header
- Access token
- Refresh token
- Client secret
- Cookies
- Signed URL
- Request signature
- Secret query value
- Sensitive request body
- Sensitive response body
- Environment variable **value**

## 4. Error category matrix

| Category | Retryable | Operator action | Future publication state | Audit category | Safe message（example） | Redacted technical detail | Quarantine |
| -------- | --------- | --------------- | ------------------------ | -------------- | ---------------------- | ------------------------- | ---------- |
| `CONFIGURATION_MISSING` | No | Fix config references | Not Published | config | Configuration incomplete | Missing config keys（names only） | No |
| `CREDENTIAL_MISSING` | No | Configure credential reference | Not Published | credential | Credential not available | Reference ID missing | No |
| `CREDENTIAL_INVALID` | No | Rotate / replace credential | Not Published | credential | Credential rejected | Provider code（redacted） | No |
| `CREDENTIAL_EXPIRED` | No | Rotate credential | Not Published | credential | Credential expired | Expiry class only | No |
| `PROVIDER_DISABLED` | No | Do not enable without auth | Not Published | enablement | Provider disabled | Flag name | No |
| `ACCOUNT_NOT_ALLOWED` | No | Fix account binding | Not Published | binding | Account not allowed | Account reference | No |
| `HOST_NOT_ALLOWED` | No | Do not bypass allowlist | Not Published | allowlist | Host not allowed | Host classname / policy ID | No |
| `ENDPOINT_NOT_ALLOWED` | No | Do not invent endpoints | Not Published | allowlist | Endpoint not allowed | Template ID | No |
| `METHOD_NOT_ALLOWED` | No | Use allowlisted method | Not Published | allowlist | Method not allowed | Method token | No |
| `REQUEST_INVALID` | No | Fix payload / schema | Not Published | validation | Request invalid | Schema path（no secrets） | No |
| `TIMEOUT` | Conditional | Inspect UNKNOWN path | See note | io | Request timed out | Timeout stage | **If request may have been sent → treat as UNKNOWN_RESULT** |
| `RATE_LIMITED` | Yes（ceiling） | Back off | Not Published until success | io | Rate limited | Retry-after class | No |
| `PROVIDER_REJECTED` | No（unless classified） | Fix content/permissions | Failed | io | Provider rejected | Redacted Provider code | No |
| `PROVIDER_UNAVAILABLE` | Yes（ceiling） | Retry later | Not Published | io | Provider unavailable | Availability class | No |
| `UNKNOWN_RESULT` | No auto-assume success | Manual reconcile | Quarantine | io | Result unknown | Correlation ID | **Yes** |
| `RESPONSE_INVALID` | No | Investigate schema | Quarantine / Failed | io | Response invalid | Schema mismatch class | Prefer quarantine |
| `KILL_SWITCH_ACTIVE` | No | Keep disabled / intentional enable only | Not Published | enablement | Kill switch active | Switch level | No |
| `POLICY_BLOCKED` | No | Respect policy | Not Published | policy | Policy blocked | Policy ID | No |

### TIMEOUT note

If a timeout occurs **before** any bytes could have been sent, treat as non-Published retryable/non-retryable per local policy. If a timeout occurs **after** a request may have reached the Provider, escalate to `UNKNOWN_RESULT` + quarantine.

## 5. Retry boundary

- Retry only when `Retryable = Yes` and attempt &lt; ceiling
- Never silent retry
- Never retry `UNKNOWN_RESULT` as a way to “confirm” success without idempotency controls
- Idempotency key must be stable for the logical publication

## 6. Safe message rules

- Safe messages are for operators/users
- Must not include secret values or raw Authorization material
- Must not include full Provider payloads

## 7. Audit mapping

Audit stores: category, correlation ID, publication ID, attempt, endpoint policy ID, redacted error code, result category.

Audit must not store secret values or unrestricted bodies.

## 8. Explicit non-goals

- Implementing exception classes in P2A
- Enabling network to observe live Provider codes
- Weakening redaction for debugging convenience

---

## Document Control

| Field | Value |
| ----- | ----- |
| Status | **Complete** — P2A Boundary Specifications（IR **A.GO**）; lifecycle closure **In Progress**（versionless） |
| Version | **Not Assigned** |
| External IO / Real Provider | **Prohibited** |
