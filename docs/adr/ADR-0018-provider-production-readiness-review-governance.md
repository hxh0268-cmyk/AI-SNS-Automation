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
| **Provider Production Readiness Assessment** | **Complete** — Assessment Decision **READY**（bounded scope） |
| **Bounded Production Ready** | **Not Declared by this ADR** — separate declaration authorization and repository finalization required |
| **Global Production Ready** | **Not Declared** |
| **Repository-wide Level 4 Implementation Ready** | **Not Declared** |

### Review Entry Authorization

**DECISION A — Proceed with Provider Production Readiness Review Entry**

Review entry authorizes:

- Formal evidence collection against defined criteria
- Open finding tracking（PPRR-F001）
- Future readiness decision using defined vocabulary

Review entry **does not** authorize:

- Bounded Production Ready declaration
- Global Production Ready declaration
- Real Provider implementation
- External IO
- Production code changes without separate authorization

### Scope

**In scope:** Provider governance, Mock Provider conformance, catalog traceability, validation controls, compatibility, risks, deferred concerns, readiness criteria.

**Out of scope:** Real Provider, External IO, credentials, Runtime, Scheduler, Adapter, retry/recovery/idempotency implementation, repository-wide L4 declaration.

### State, Assessment, and Declaration Distinctions

The lifecycle state, assessment decision, and declaration scope are separate governance dimensions.

| Dimension | Vocabulary |
|-----------|------------|
| **Lifecycle State** | Governed → Authorized → Implemented → Registered → Review Entry Authorized → Production Readiness Assessed → Production Ready |
| **Assessment Decision** | READY / READY WITH CONDITIONS / DEFERRED / NOT READY |
| **Declaration Scope** | Bounded Production Ready / Global Production Ready |

```text
Governed ≠ Authorized
Authorized ≠ Implemented
Implemented ≠ Registered
Registered ≠ Review Entry Authorized
Review Entry Authorized ≠ Production Readiness Assessed
Production Readiness Assessed ≠ Assessment Decision
Assessment Decision ≠ Production Ready Declaration
Bounded Production Ready ≠ Global Production Ready
Bounded Production Ready ≠ Authorization for Scope Expansion
Provider Production Ready ≠ Repository-wide Level 4
Mock Provider ≠ Real Provider
Catalog Registered ≠ Production Ready
```

### Declaration Scope Governance

A Production Ready declaration is not an automatic consequence of a `READY` assessment decision.

A declaration requires:

1. a completed formal Production Readiness assessment;
2. an assessment decision eligible for declaration;
3. separate declaration authorization;
4. an explicitly identified subject and scope;
5. synchronized repository authority, version, risk, maturity, compliance, and quality evidence.

| Declaration Scope | Governance meaning |
|-------------------|--------------------|
| **Bounded Production Ready** | Declaration applies only to an explicitly identified Provider identity, capability, implementation, execution model, exclusions, and reopening conditions |
| **Global Production Ready** | Declaration applies to the complete governed Provider domain covered by the declaration authority |

A bounded declaration does not authorize Real Provider behavior, External IO, automatic SNS publishing, deferred CL-004 / CL-005 / CL-006 semantics, or any other scope not explicitly included in the declaration.

### Evidence Model

Ten categories defined in [PROVIDER_PRODUCTION_READINESS_REVIEW.md](../architecture/PROVIDER_PRODUCTION_READINESS_REVIEW.md) §Review Evidence Model.

### Blocking Conditions

| Condition | Blocks review entry | Blocks bounded declaration | Blocks global declaration |
|-----------|--------------------|----------------------------|---------------------------|
| PPRR-F001 abstract profile gap | No | Yes until disposition | Yes until disposition |
| CL-004 / CL-005 / CL-006 | No | No for explicitly bounded side-effect-free Mock Provider scope; remain deferred | Yes where the global scope includes affected operational semantics |
| Real Provider / External IO | No（out of Mock scope） | No when explicitly excluded from the bounded declaration | Yes unless separately authorized, implemented, assessed, and declared |

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

CL-004, CL-005, CL-006, Real Provider, External IO, credentials, Runtime, Scheduler, and Adapter remain **intentionally deferred**. They do not block a declaration whose explicit bounded scope excludes them and whose side-effect-free Mock Provider applicability has been formally assessed. They continue to block any declaration scope in which they become applicable.

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Declare Provider Production Ready in v1.77.0 | No assessment evidence; violates Registered ≠ Production Ready |
| Skip review framework; proceed to Real Provider | ADR-0013 prohibits; no authorization |
| Implement abstract profile validation in v1.77.0 | Production code change; out of governance-only scope |
| Defer review entry indefinitely | DECISION A evidence supports entry; framework gap remains |

## Consequences

- Provider Production Readiness Review governance **established**
- Review entry **authorized**
- Formal assessment **complete** — Assessment Decision **READY**（bounded scope）
- PPRR-F001 **closed** for bounded Mock Provider assessment
- PR-006 wording synchronized（registration complete）
- Production code **unchanged**
- Assessment Decision **READY** establishes declaration eligibility only
- Bounded or Global Production Ready requires separate declaration authorization and synchronized repository finalization

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
| Formal Provider Production Readiness Assessment | **Complete** — Assessment Decision **READY**（bounded scope） — DECISION D **Accepted** | 2026-07-10 — Tests 1013–1042 |
| DECISION D | **Accepted** — Formal Assessment **READY**（bounded canonical Mock Provider） |
| Bounded Production Ready declaration | **Documentation finalization pending** | separate declaration authorization + synchronized SSOT |
| Global Production Ready declaration | **Not scheduled** | separate global authorization |
| Real Provider | **Prohibited** | separate authorization |

## v1.85 SSOT Alignment Clarification

This clarification does not retroactively change the v1.77.0 governance decision or the later Formal Assessment result.

It formally separates three concepts that were previously present but not modeled as independent governance dimensions:

1. **Lifecycle State**
2. **Assessment Decision**
3. **Declaration Scope**

The authoritative interpretation is:

```text
Production Readiness Assessed
≠ Assessment Decision
≠ Production Ready Declaration
```

A `READY` assessment decision makes an explicitly assessed scope eligible for a separate declaration review. It does not itself declare that scope Production Ready.

Production Ready declarations use one of two scopes:

- **Bounded Production Ready**
- **Global Production Ready**

At the v1.84.0 repository baseline:

| Item | Status |
|------|--------|
| **Formal Assessment** | **Complete** |
| **Assessment Decision** | **READY**（bounded canonical Mock Provider scope） |
| **Bounded Production Ready** | **Not yet recorded in repository SSOT** |
| **Global Production Ready** | **Not Declared** |
| **Repository-wide Level 4** | **Not Declared** |
| **Real Provider / External IO** | **Prohibited / Not Started** |
| **Automatic SNS Publishing** | **Prohibited** |
| **CL-004 / CL-005 / CL-006** | **Deferred** outside the assessed bounded side-effect-free Mock Provider scope |

The declaration state may change only through a separately authorized declaration review and synchronized documentation finalization.

---

## Quality Pipeline

v1.77.0 adds governance evidence tests（Test 981–1000）. Post-remediation adds Tests 1001–1012. Formal assessment adds Tests 1013–1027（**1027 PASS**）.

## Related Documents

- [PROVIDER_PRODUCTION_READINESS_REVIEW.md](../architecture/PROVIDER_PRODUCTION_READINESS_REVIEW.md)
- [ADR-0017](./ADR-0017-mock-provider-catalog-registration-governance.md)
- [ADR-0016](./ADR-0016-mock-provider-production-implementation-authorization.md)
- [RISK_REGISTER.md](../architecture/RISK_REGISTER.md)
