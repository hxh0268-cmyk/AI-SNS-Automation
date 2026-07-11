# ADR-0018: Provider Production Readiness Review Governance Decision

## Status

Accepted（v1.77.0 — Provider Production Readiness Review Governance）

## Context

[v1.76.0](../VERSION.md) により Mock Provider Catalog Registration が **Registered**（`text-generation-mock-provider` in `providerContracts[]`）。Provider governance chain（v1.68.0 Entry Preparation → v1.76.0 Catalog Registration Implementation）は完了した。

Provider Production Readiness Review Entry Verification（post-v1.76.0）は **DECISION A** — Proceed with Provider Production Readiness Review Entry を返した。Repository evidence は review entry prerequisites を満たすが、formal **Provider Production Readiness Review governance framework** は未定義であった。

ADR-0017 Follow-up は `Provider Production Ready assessment | Not scheduled | separate authorization` と記録。Registered ≠ Production Ready distinction は governance 文書に存在するが、readiness review の scope / entry criteria / evidence model / blocking conditions / decision vocabulary は単一 authority として固定されていなかった。

v1.77.0 は **Governance / Review Framework Release のみ**。production code、validator、schema、catalog version の **変更は禁止**。

## Problem

Mock Provider は **Implemented** かつ **Registered** であるが、Provider Production Ready は **Not Declared** のまま。Readiness review entry と Production Ready declaration の境界、Mock Provider vs Real Provider scope、Provider domain vs repository-wide Level 4 scope が formal review artifact なしでは drift risk を残す（PR-005）。

Architecture Review Entry Verification は open finding PPRR-F001（abstract authority profile validation gap）を記録。Disposition は未定。

## Evidence

| Evidence | Source |
|----------|--------|
| v1.76.0 baseline | commit `ff33917`, tag `v1.76.0`, 980 PASS |
| Mock Provider implemented | `src/lib/mock_provider.js` — v1.74.0 |
| Mock Provider registered | `providerContracts[]` — v1.76.0 |
| Review entry verification | DECISION A — Entry Verification report |
| Abstract authority finding | PPRR-F001 — validator probe |
| Production Ready not declared | `docs/VERSION.md` |
| Real Provider prohibited | ADR-0013, `NON_GOALS.md` |

## Decision

### Release Type

| Item | Decision |
|------|----------|
| **Release scope** | **Governance only** — Provider Production Readiness Review framework |
| **Production code** | **No change** |
| **`mock_provider.js`** | **No change** |
| **`public_contract_catalog.js`** | **No change** |
| **Provider Production Readiness Review Entry** | **Authorized** — this ADR |
| **Provider Production Readiness Assessment** | **Complete** — Formal Decision **READY**（bounded scope） |
| **Provider Production Ready** | **Not Declared**（global declaration not executed） |
| **Repository-wide Level 4 Implementation Ready** | **Not Declared** |

### Review Entry Authorization

**DECISION A — Proceed with Provider Production Readiness Review Entry**

Review entry authorizes:

- Formal evidence collection against defined criteria
- Open finding tracking（PPRR-F001）
- Future readiness decision using defined vocabulary

Review entry **does not** authorize:

- Provider Production Ready declaration
- Real Provider implementation
- External IO
- Production code changes without separate authorization

### Scope

**In scope:** Provider governance, Mock Provider conformance, catalog traceability, validation controls, compatibility, risks, deferred concerns, readiness criteria.

**Out of scope:** Real Provider, External IO, credentials, Runtime, Scheduler, Adapter, retry/recovery/idempotency implementation, repository-wide L4 declaration.

### State Distinctions

```text
Governed ≠ Authorized ≠ Implemented ≠ Registered ≠ Review Entry Authorized ≠ Production Ready
Provider Production Ready ≠ repository-wide Level 4
Mock Provider ≠ Real Provider
```

### Evidence Model

Ten categories defined in [PROVIDER_PRODUCTION_READINESS_REVIEW.md](../architecture/PROVIDER_PRODUCTION_READINESS_REVIEW.md) §Review Evidence Model.

### Blocking Conditions

| Condition | Blocks review entry | Blocks Production Ready |
|-----------|--------------------|-------------------------|
| PPRR-F001 abstract profile gap | No | Yes until disposition |
| CL-004 / CL-005 / CL-006 | No | Yes |
| Real Provider / External IO | No（out of Mock scope） | Yes |

### Decision Vocabulary

- **READY**
- **READY WITH CONDITIONS**（cannot waive major missing production behavior unconditionally）
- **DEFERRED**
- **NOT READY**

**Not decided in v1.77.0.**

### Abstract Authority Validation Open Finding

| Item | Decision |
|------|----------|
| Finding | PPRR-F001 — abstract authority not fully profile-locked |
| Status | **CLOSED AS REMEDIATED FOR THE BOUNDED MOCK PROVIDER ASSESSMENT** |
| Disposition | **Option 1 — Accepted**（DECISION B/C） |
| Production fix | **Implemented** post–v1.77.0 — validator remediation only |

### Deferred Concerns

CL-004, CL-005, CL-006, Real Provider, External IO, credentials, Runtime, Scheduler, Adapter — **intentionally deferred**; documented in review artifact; block Production Ready declaration where applicable.

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Declare Provider Production Ready in v1.77.0 | No assessment evidence; violates Registered ≠ Production Ready |
| Skip review framework; proceed to Real Provider | ADR-0013 prohibits; no authorization |
| Implement abstract profile validation in v1.77.0 | Production code change; out of governance-only scope |
| Defer review entry indefinitely | DECISION A evidence supports entry; framework gap remains |

## Consequences

- Provider Production Readiness Review governance **established**
- Review entry **authorized**; formal assessment **complete** — **READY**（bounded scope）
- PPRR-F001 **closed** for bounded Mock Provider assessment
- PR-006 wording synchronized（registration complete）
- Production code **unchanged**
- Future readiness decision requires formal assessment release

## Compliance

- ADR-0013 Real Provider prohibition — **maintained**
- ADR-0016 Mock authorization — **maintained**
- ADR-0017 registration — **maintained**
- Application catalog backward compatibility — **maintained**

## Follow-up

| Item | Owner | Release |
|------|-------|---------|
| Production Readiness formal assessment | Future Release | post-v1.77.0 Architecture Review |
| PPRR-F001 disposition | **CLOSED AS REMEDIATED FOR THE BOUNDED MOCK PROVIDER ASSESSMENT** | DECISION B/C — `GOVERNED_ABSTRACT_AUTHORITY_SCOPE` validator（Tests 1001–1012） |
| Formal Provider Production Readiness Assessment | **Complete** — **READY**（bounded scope） — DECISION D **Accepted** | 2026-07-10 — Tests 1013–1042 |
| DECISION D | **Accepted** — Formal Assessment **READY**（bounded canonical Mock Provider） |
| Provider Production Ready declaration | **Not scheduled** | separate global authorization |
| Real Provider | **Prohibited** | separate authorization |

## Quality Pipeline

v1.77.0 adds governance evidence tests（Test 981–1000）. Post-remediation adds Tests 1001–1012. Formal assessment adds Tests 1013–1027（**1027 PASS**）.

## Related Documents

- [PROVIDER_PRODUCTION_READINESS_REVIEW.md](../architecture/PROVIDER_PRODUCTION_READINESS_REVIEW.md)
- [ADR-0017](./ADR-0017-mock-provider-catalog-registration-governance.md)
- [ADR-0016](./ADR-0016-mock-provider-production-implementation-authorization.md)
- [RISK_REGISTER.md](../architecture/RISK_REGISTER.md)
