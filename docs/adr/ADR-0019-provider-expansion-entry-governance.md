# ADR-0019: Provider Expansion Entry Governance Decision

## Status

Accepted（v1.79.0 — Provider Expansion Entry Governance — governance-only release candidate）

## Context

[v1.78.0](../VERSION.md) により bounded canonical Mock Provider（`text-generation-mock-provider`）の Formal Provider Production Readiness Assessment が **Complete** — Formal Decision **READY**（DECISION D/E accepted）。PPRR-F001 は **CLOSED AS REMEDIATED FOR THE BOUNDED MOCK PROVIDER ASSESSMENT**。

Next Provider Roadmap Decision（post–v1.78.0）により **PROCEED TO PROVIDER EXPANSION ENTRY GOVERNANCE** が記録された。Repository evidence は、Provider domain の incremental governance chain（v1.68 Entry Preparation → v1.78 bounded assessment）完了後、**scope expansion** に進む前に formal **expansion entry governance** が必要であることを示す。

ADR-0018 Follow-up は `Provider Production Ready declaration | Not scheduled | separate authorization` と記録。Bounded Formal Assessment **READY** ≠ global Provider Production Ready ≠ Real Provider authorization ≠ External IO authorization。

v1.79.0 は **Governance / Expansion Entry Framework Release のみ**。production code、`mock_provider.js`、`public_contract_catalog.js` provider entry count、schema、catalogVersion の **変更は禁止**。

## Problem

Bounded Mock Provider は **Implemented**, **Registered**, and **formally assessed READY** であるが、Provider domain の **expansion beyond the bounded mock** は未定義のまま。Expansion candidate taxonomy、entry criteria、blocking conditions、state distinctions、deferred-risk reassessment が単一 authority として固定されていないと、PR-005（state conflation）および PR-002（premature Real Provider IO）の drift risk が残る。

`PROVIDER_PRODUCTION_READINESS_REVIEW.md` §Future reopening triggers は Real Provider authorization / External IO introduction を明示。これらは **separate expansion entry authorization** を要求する。

## Evidence

| Evidence | Source |
|----------|--------|
| v1.78.0 baseline | commit `6f46587`, tag `v1.78.0`, 1042 PASS |
| Bounded assessment READY | `PROVIDER_PRODUCTION_READINESS_REVIEW.md` §Formal Decision |
| Roadmap decision | Next Provider Roadmap Decision — PROCEED TO PROVIDER EXPANSION ENTRY GOVERNANCE |
| Real Provider prohibited | ADR-0013, `NON_GOALS.md` |
| CL-004/005/006 deferred | `FUTURE_ENTRY_CRITERIA.md` §Deferred Operational Semantics |
| Incremental entry pattern | ADR-0009 domain-based incremental; v1.68–v1.78 chain |
| Catalog | 2 entries — abstract authority + `text-generation-mock-provider` |

## Decision

### Release Type

| Item | Decision |
|------|----------|
| **Release scope** | **Governance only** — Provider Expansion Entry framework |
| **Production code** | **No change** |
| **`mock_provider.js`** | **No change** |
| **`public_contract_catalog.js`** | **No change**（no new provider entries） |
| **Provider Expansion Entry Governance** | **Established** — this ADR + review artifact |
| **Provider Expansion Entry Authorization** | **Not granted** — framework only; per-candidate authorization future |
| **Implementation Authorization** | **Not granted** |
| **Provider Production Ready（global）** | **Not Declared** |
| **Repository-wide Level 4 Implementation Ready** | **Not Declared** |

### Expansion Entry Governance Authorization

**DECISION F — Establish Provider Expansion Entry Governance**

This ADR authorizes:

- Formal expansion definition and candidate taxonomy
- Expansion entry criteria and blocking conditions
- State model extensions preventing governance conflation
- Deferred-risk reassessment framework（CL-004/005/006, PR-004/005/006）
- Required future evidence model before per-candidate authorization

This ADR **does not** authorize:

- Real Provider implementation
- External IO implementation or enablement
- Credential / secret-store implementation
- Runtime / Scheduler / Adapter implementation
- Catalog registration of new provider entries
- Global Provider Production Ready declaration
- Repository-wide Level 4 declaration
- Automatic SNS publishing

### Authorized Scope

**In scope:** Expansion definition; candidate classes 1–5; entry criteria E1–E25; blocking conditions; state model; risk reassessment; authorization matrix; required future artifacts; exit criteria; explicit non-claims.

**Out of scope:** Real Provider; External IO; credentials; Runtime; Scheduler; Automation; Workflow; Event operational implementation; retry/recovery/idempotency **implementation**; repository-wide L4; automatic publishing.

### Expansion Candidate Classes

| Class | Description | v1.79.0 Status |
|-------|-------------|----------------|
| **Class 1** | Additional deterministic local Mock Providers | **Identifiable** — governance consideration only |
| **Class 2** | Provider contract / catalog profile expansion | **Identifiable** — no concrete external impl |
| **Class 3** | Real Provider preparation（design/governance only） | **Considerable** — implementation **prohibited** |
| **Class 4** | External IO entry preparation | **Considerable** — IO **prohibited** |
| **Class 5** | Cross-layer Provider integration preparation | **Considerable** — operational impl **prohibited** |

### State Model

```text
Provider Expansion Identified
≠ Provider Expansion Entry Governed
≠ Provider Expansion Entry Authorized
≠ Implementation Authorized
≠ Implemented
≠ Catalog Registered
≠ Review Entry Authorized
≠ Formally Assessed
≠ Bounded Production Ready
≠ Global Provider Production Ready

Provider Domain Level 4 Ready ≠ Repository-wide Level 4
Bounded Mock Formal READY ≠ Expansion Entry Authorized
Governance Entry ≠ Implementation Authorization
```

State compression is **explicitly prohibited**（PR-005 control）.

### Relationship to v1.78.0 Bounded READY

| Item | Relationship |
|------|--------------|
| Bounded Mock Formal Decision **READY** | **Preserved** — unchanged by this ADR |
| PPRR-F001 | **Bounded closure preserved** — not reopened |
| Expansion beyond mock | **Requires separate per-candidate authorization** after entry criteria satisfied |
| Bounded READY → Real Provider | **Explicitly prohibited inference** |

### Relationship to Real Provider / External IO

| Item | Status |
|------|--------|
| Real Provider | **Prohibited / Deferred** — Class 3 governance-only consideration |
| External IO | **Prohibited** — Class 4 governance-only consideration |
| Class 3/4 implementation | **Blocked** until separate ADR + entry authorization per candidate |

### Human Approval Gate

git commit / tag / push automation **not authorized**。Automatic SNS publishing **prohibited**。Human Approval Gate **preserved**。

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Proceed directly to Real Provider implementation | ADR-0013 prohibits; PR-002; no entry criteria |
| Global Provider Production Ready declaration | Bounded READY ≠ global; separate authorization required |
| External IO Governance as standalone implementation release | IO prohibited; must be subordinate to expansion entry framework |
| Skip expansion entry; add catalog entries directly | PR-004 bypass risk; catalog-before-authorization blocked |
| Defer expansion governance indefinitely | Roadmap decision; reopening triggers documented |

## Consequences

- Provider Expansion Entry governance **established**
- Bounded Mock READY **preserved**
- Real Provider / External IO **remain prohibited**
- CL-004/005/006 **remain Deferred** globally
- Per-candidate expansion authorization **requires future formal decision**
- Production code **unchanged**
- Provider catalog **unchanged**（2 entries）

## Compliance

- ADR-0013 Real Provider prohibition — **maintained**
- ADR-0016/0017/0018 Mock chain — **maintained**
- v1.78.0 bounded READY — **preserved**
- Application catalog backward compatibility — **maintained**

## Follow-up

| Item | Owner | Release |
|------|-------|---------|
| Per-candidate Expansion Entry Authorization | Future Release | post–formal candidate selection |
| Real Provider implementation | **Prohibited** | separate ADR + authorization |
| External IO implementation | **Prohibited** | separate ADR + authorization |
| CL-004/005/006 resolution | **Deferred** | separate ADR when scope triggers |
| Provider Production Ready（global） | **Not scheduled** | separate authorization |

## Reopening / Supersession Conditions

This framework is **reopened** if:

- Expansion entry criteria materially violated without disposition
- Unauthorized catalog provider entry added
- Bounded Mock READY conflated with global Production Ready
- Real Provider or External IO implemented without per-candidate authorization
- State model compression introduced without ADR

## Quality Pipeline

v1.79.0 adds governance evidence tests（Test 1043–1074）.

## Related Documents

- [PROVIDER_EXPANSION_ENTRY_REVIEW.md](../architecture/PROVIDER_EXPANSION_ENTRY_REVIEW.md)
- [PROVIDER_PRODUCTION_READINESS_REVIEW.md](../architecture/PROVIDER_PRODUCTION_READINESS_REVIEW.md)
- [ADR-0018](./ADR-0018-provider-production-readiness-review-governance.md)
- [RISK_REGISTER.md](../architecture/RISK_REGISTER.md)
