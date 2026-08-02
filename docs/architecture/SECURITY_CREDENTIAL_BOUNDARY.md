# Security Credential Boundary

**Document type:** P2A Security / Credential Boundary Specification
**Lifecycle:** P2A — Boundary Specifications **Complete** / IR **A.GO**; lifecycle closure **In Progress**（versionless; **Not Assigned**）
**Authority:** [ADR-0024](../adr/ADR-0024-bounded-productization-entry.md); P2 Planning A.GO
**Related:** [SECRET_HANDLING_POLICY.md](./SECRET_HANDLING_POLICY.md), [EXTERNAL_IO_BOUNDARY.md](./EXTERNAL_IO_BOUNDARY.md), [PRODUCT_MVP_BOUNDARY.md](./PRODUCT_MVP_BOUNDARY.md)

---

## 1. Purpose

Define the credential and secret-material boundary for the future Bounded Text Publishing MVP so that a single Provider can be connected safely **without** authorizing Real Provider, External IO, network calls, OAuth, or credential creation in this phase.

## 2. Scope

### In scope（specification）

- Credential types and classification
- Credential **reference** vs credential **value**
- Resolution model and fail-closed behavior
- Storage strategy recommendation（MVP）
- Environment / account binding
- Rotation / revocation
- Dry-run credential behavior
- Audit boundary for credential events
- Explicit non-goals and future gates

### Out of scope（not authorized by P2A）

- Credential resolver implementation
- Secret store implementation
- Credential creation / input / token acquisition
- OAuth flows
- Provider adapter implementation
- Real Provider / External IO authorization
- Catalog changes
- Version assignment

## 3. Credential types（MVP candidates）

| Type | Role |
| ---- | ---- |
| Provider access token | Short-lived or long-lived access material for the selected Provider |
| Refresh token | Optional renewal material（if required by future Provider contract） |
| App / client ID | Non-secret or low-sensitivity identity of the application |
| Client secret | High-sensitivity application secret（if required） |
| Account / page identity | Explicit binding target（reference preferred） |
| Environment selector | `local` / `ci` / `test` / `production`（or equivalent） |
| Credential reference ID | Opaque handle used in config and audit |

Webhook secrets are **out of MVP** unless separately authorized.

## 4. Credential value vs credential reference

```text
CredentialReference  = name / ID / locator / metadata（non-secret）
CredentialValue      = secret material（runtime-only）
```

| Surface | May hold reference | May hold value |
| ------- | ------------------ | -------------- |
| Configuration | Yes | **No** |
| Domain / publication objects | Yes（IDs only） | **No** |
| Audit events | Yes | **No** |
| Exceptions / logs / reports / snapshots | Presence / redacted codes only | **No** |
| Dry-run outputs | References / planned metadata only | **No** |
| Future Adapter call site | Transient use only | Runtime-only |

## 5. Runtime-only secret material

Secret values:

- exist only after successful resolution
- have minimized lifetime
- must not be serialized
- must not be cloned into durable state
- must be discarded after the authorized use window

## 6. Credential resolution model

```text
CredentialReference
  → CredentialResolver
  → SecretStore
  → Runtime-only Secret Material
  → Future Provider Adapter（not authorized in P2A）
```

Invariants:

1. Domain / publication objects never hold secret values.
2. Audit never holds secret values.
3. Exceptions never include secret values.
4. `reports/` and snapshots never include secret values.
5. Dry-run resolves secret values only if unavoidable; default is **no value resolution**.
6. Missing credential → fail closed **before** any network attempt.
7. Wrong environment credential → reject.
8. Wrong account binding → reject.
9. Credentials alone do **not** enable publishing（see kill-switch hierarchy in [EXTERNAL_IO_BOUNDARY.md](./EXTERNAL_IO_BOUNDARY.md)）.

## 7. Storage strategy comparison

| Store | Local | CI | Production | Rotation | Revocation | Auditability | Accidental log risk | Complexity | MVP |
| ----- | ----- | -- | ---------- | -------- | ---------- | ------------ | ------------------- | ---------- | --- |
| Environment variables | Strong | Strong | Weak | Manual | Manual | Medium | High if logged | Low | **Recommended MVP local/CI** |
| OS Keychain / OS secret store | Strong | Weak | Medium | Medium | Medium | Medium | Low | Medium | Later candidate |
| CI secret store | N/A | Strong | N/A | Platform | Platform | Platform | Low（presence-only） | Low | **CI** |
| Local encrypted configuration | Medium | Weak | Medium | Medium | Medium | Medium | Medium | High | Not first |
| External secret manager | Medium | Medium | Strong | Strong | Strong | Strong | Low | High | Deferred（cloud secret store Non-Goal） |

## 8. MVP storage recommendation

**Planning recommendation（not an Implementation authorization）:**

- Local development: environment variables by **name**, values never committed
- CI: CI secret store; workflows must not echo values
- Production: deferred; do not implement cloud secret manager in P2A–P2D
- Configuration files store **references / names only**

## 9. Environment separation

- Test and production credentials must be distinct
- Resolver must know the active environment
- Production references must not resolve in test/local unless explicitly authorized later
- Environment confusion is fail closed

## 10. Account binding

- Every future real publication path requires an explicit account / page binding
- Binding is a reference, not a secret dump
- Wrong or unbound account → `ACCOUNT_NOT_ALLOWED`

## 11. Least privilege

- Request only Provider permissions required for text publication of the selected Provider
- Do not request media, DM, scrape, or analytics scopes for MVP
- Excessive permissions are a threat（see [P2_THREAT_MODEL.md](./P2_THREAT_MODEL.md)）

## 12. Presence validation

- Before any future network execution: validate that required references resolve to present material
- Presence validation may return boolean / category codes only
- Presence validation must not print values

## 13. Rotation

- References remain stable where possible; values rotate underneath
- Rotation events are audited（reference ID only）
- Stale credentials map to `CREDENTIAL_INVALID` / `CREDENTIAL_EXPIRED`

## 14. Revocation

- Revocation must be possible without Provider network when disabling local enablement
- Revoked references fail closed
- Revocation is audited

## 15. Serialization prohibition

Secret values must not be written to:

- Git
- JSON/YAML config intended for commit
- Quality reports
- Developer handoff reports
- Pipeline snapshots
- Audit payloads
- Exception messages

## 16. Logging / exception / report prohibition

See [SECRET_HANDLING_POLICY.md](./SECRET_HANDLING_POLICY.md) and [ERROR_REDACTION_MODEL.md](./ERROR_REDACTION_MODEL.md).

## 17. Dry-run credential behavior

Dry-run **may**:

- validate reference names / binding / environment policy
- emit planned（redacted）request metadata

Dry-run **must not**（default）:

- retrieve secret values
- perform DNS / socket / HTTP
- claim Provider success

## 18. Audit boundary

### Event candidates（future Implementation）

- credential reference configured
- credential presence validation
- credential resolution success / failure
- rotation
- revocation
- Provider enable / disable
- account allowlist change
- endpoint allowlist change
- dry-run planned
- network start
- network completion
- timeout
- unknown result
- Provider rejection
- redaction applied
- kill switch change
- policy denial

### Permitted fields

- credential reference ID
- Provider ID
- environment
- account reference
- correlation ID
- publication ID
- attempt
- endpoint policy ID
- result category
- redacted error code

### Forbidden fields

- secret value
- raw Authorization
- refresh token
- client secret
- unrestricted request / response body

## 19. Failure behavior

| Condition | Category | Network |
| --------- | -------- | ------- |
| Missing required credential | `CREDENTIAL_MISSING` | Must not start |
| Invalid credential material | `CREDENTIAL_INVALID` | Must not start / abort |
| Expired credential | `CREDENTIAL_EXPIRED` | Must not start / abort |
| Wrong environment | `POLICY_BLOCKED` / configuration error | Must not start |
| Wrong account | `ACCOUNT_NOT_ALLOWED` | Must not start |

## 20. Explicit non-goals

- Implementing resolver / stores in P2A
- Creating or collecting real credentials
- Authorizing Real Provider or External IO
- Registering Real Provider in Catalog
- Automatic SNS publishing

## 21. Future implementation gates

| Gate | Required before |
| ---- | --------------- |
| P2A Independent Review A.GO | Treating specs as review-complete |
| Version assignment（if any） | Separate Implementation authorization — **not assigned** now |
| P2B / P2C types & resolver abstraction | Separate authorization |
| P2-R1 concrete hosts | Endpoint allowlist finalization |
| P4 Real Provider Adapter | Separate authorization; default-disabled |
| External IO enablement | Separate authorization; kill-switch OFF by default |

---

## Document Control

| Field | Value |
| ----- | ----- |
| Status | **Complete** — P2A Boundary Specifications（IR **A.GO**）; lifecycle closure **In Progress**（versionless） |
| Real Provider / External IO | **Prohibited** |
| Version | **Not Assigned** |
| Mutation | Requires ADR-0024-aligned governance update |
