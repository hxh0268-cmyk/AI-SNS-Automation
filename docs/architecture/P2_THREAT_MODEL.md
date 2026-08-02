# P2 Threat Model

**Document type:** P2A Threat Model（Security / Credential / External IO）
**Lifecycle:** P2A — Boundary Specifications **Complete** / IR **A.GO**; lifecycle closure **In Progress**（versionless; **Not Assigned**）
**Authority:** [ADR-0024](../adr/ADR-0024-bounded-productization-entry.md)
**Related:** [SECURITY_CREDENTIAL_BOUNDARY.md](./SECURITY_CREDENTIAL_BOUNDARY.md), [EXTERNAL_IO_BOUNDARY.md](./EXTERNAL_IO_BOUNDARY.md), [ERROR_REDACTION_MODEL.md](./ERROR_REDACTION_MODEL.md)

---

## 1. Purpose

Record threats relevant to Bounded Text Publishing MVP security, credential, and External IO boundaries. Distinguish controls delivered by P2A specs vs later milestones.

Likelihood / Impact: L = Low, M = Medium, H = High.

## 2. Threat register

| ID | Description | L | I | Prevention | Detection | Response | Residual | Blocking milestone |
| -- | ----------- | - | - | ---------- | --------- | -------- | -------- | ------------------ |
| T-01 | Secret committed to Git | M | H | gitignore; never commit `.env`; placeholders only | Secret scanning / review | Rotate; redacted incident | Process residual | P2A policy; ongoing |
| T-02 | Secret logged | H | H | Redaction policy; presence-only validation | Log review | Rotate; fix emitter | Residual if SDK leaks | P2A + P2C redaction impl |
| T-03 | Secret in exception | H | H | Safe errors; no value in messages | Failure fixtures | Rotate | Residual SDK stacks | P2A + P2C |
| T-04 | Secret in reports/snapshots | M | H | reports gitignored + redaction | Report review | Delete local; rotate | Residual local disk | P2A + report scrubbers later |
| T-05 | Production credentials in tests | M | H | Env separation; mocks | CI policy | Revoke prod; fix tests | Process | P2A + CI discipline |
| T-06 | Wrong Provider selected | M | H | One-Provider lock | Policy checks | Block publish | Low if locked | P2A + P2B/P2D |
| T-07 | Wrong account selected | M | H | Account binding | Binding validation | `ACCOUNT_NOT_ALLOWED` | Medium | P2A + later exec |
| T-08 | Arbitrary URL / SSRF | H | H | Deny-by-default allowlist | Reject `HOST_NOT_ALLOWED` | Block | Low if enforced | P2A model; P2D/P4 enforce |
| T-09 | Redirect to untrusted host | M | H | Redirects off or revalidate | Allowlist hop check | Block | Medium until enforced | P2A + P2-R1/P2D |
| T-10 | DNS rebinding | M | H | Resolve allowlisted hosts only | Unexpected target check | Block | Medium | P2D/P4 |
| T-11 | Duplicate publication | M | H | Idempotency key | Duplicate detection | Quarantine / suppress | Medium | P5/P6 |
| T-12 | Retry causes duplicate | M | H | Ceiling + stable idempotency | Attempt counters | Stop retry; quarantine | Medium | P2A policy; P5/P7 |
| T-13 | Unknown result after timeout | M | H | `UNKNOWN_RESULT` + quarantine | Timeout classification | Manual reconcile | Medium | P2A + P6/P7 |
| T-14 | Approval bypass | M | H | Approval workflow（P3） | State machine | Block eligibility | High until P3 | **P3** |
| T-15 | Content changed after approval | M | H | Content hash binding（P3/P5） | Hash mismatch | Re-approve | Medium | **P3/P5** |
| T-16 | Kill-switch bypass | M | H | Pre-network check; default OFF | Audit enablement | Force disable | Medium until enforced | P2A + P2D/P7 |
| T-17 | Disabled Provider enabled | M | H | Multi-level enable hierarchy | Audit | Disable; investigate | Medium | P2A + later |
| T-18 | Environment confusion | M | H | Env tags on refs | Reject wrong env | Fail closed | Medium | P2A + P2C |
| T-19 | Excessive Provider permissions | M | H | Least privilege scopes | Permission review | Reduce scopes | Medium | P2-R1 + P4 |
| T-20 | Stale / compromised credential | M | H | Rotation / revocation | Invalid/expired errors | Rotate; revoke | Ongoing | P2A lifecycle |
| T-21 | Response schema spoof/mismatch | M | H | Response schema validation | `RESPONSE_INVALID` | Quarantine | Medium | P2D/P4 |
| T-22 | Sensitive audit payload | M | H | Audit field allowlist | Audit review | Scrub; rotate if needed | Medium | P2A + audit impl |
| T-23 | Dry-run performs IO | H | H | Zero-network invariant | Dry-run proofs（later tests） | Treat as incident | Low if proven | P2A + Quality later |

## 3. Milestone ownership

| Milestone | Threats primarily addressed |
| --------- | --------------------------- |
| **P2A（specs）** | T-01–T-05, T-08/T-09/T-12/T-13/T-16–T-18/T-20/T-22/T-23 as **policy** |
| **P2-R1** | T-09/T-19 host/scope evidence |
| **P2B/P2C/P2D** | Enforcement types, resolver, gateway, redaction utilities（still no live SNS） |
| **P3** | T-14, T-15 approval integrity |
| **P4** | Adapter under default-disabled; still not auto-publish |
| **P5–P7** | T-11–T-13, T-16 operational controls |

## 4. Explicit non-goals

- Claiming threats are eliminated by documentation alone
- Authorizing Real Provider / External IO to “test” threats
- Inventing concrete Meta endpoints

## 5. Residual risk statement

Documentation reduces ambiguity and sets fail-closed expectations. Residual risk remains until types, gateway, redaction, approval, and enablement controls are implemented under later authorized milestones. Automatic SNS publishing remains impossible by current Non-Goals and enablement defaults.

---

## Document Control

| Field | Value |
| ----- | ----- |
| Status | **Complete** — P2A Boundary Specifications（IR **A.GO**）; lifecycle closure **In Progress**（versionless） |
| Version | **Not Assigned** |
| Real Provider / External IO | **Prohibited** |
