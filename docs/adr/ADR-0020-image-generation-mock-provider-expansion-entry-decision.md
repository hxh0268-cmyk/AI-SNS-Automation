# ADR-0020: Image Generation Mock Provider Expansion Entry Decision

## Status

Accepted（v1.80.0 — Image Generation Mock Provider Expansion Entry Decision Governance — governance-only release candidate）

## Context

[v1.79.0](../VERSION.md) により Provider Expansion Entry Governance が **Established**（ADR-0019 / DECISION F）。Per-candidate Expansion Entry Authorization は **Not Granted** のまま。Bounded canonical Mock Provider（`text-generation-mock-provider`）の Formal Decision **READY**（v1.78.0）は **preserved**。

Per-Candidate Provider Expansion Decision evidence investigation により **Class 1 — `image-generation-mock-provider`** が primary candidate として **Accepted**。Missing governance evidence（E17 owner, E24/E25 artifacts, PR-006 identity distinction, command-mock side-effect boundary）を v1.80.0 で解消する。

`PROVIDER_LAYER_DESIGN.md` §12 は `image_generation` を **command** capability として定義する。Application Layer `src/lib/image_generation.js` は **Completed** foundation として独立に存在する。Provider Layer には `text-generation-mock-provider` のみが governed concrete mock として registered されている。

v1.80.0 は **Governance / Per-Candidate Expansion Entry Decision Release のみ**。production code、`mock_provider.js`、`image_generation.js`、`public_contract_catalog.js` provider entry count、schema、catalogVersion の **変更は禁止**。

## Decision Question

Should `image-generation-mock-provider` receive **bounded Provider Expansion Entry Authorization** under ADR-0019 Class 1, without granting Implementation Authorization, catalog registration, External IO, credentials, or Real Provider scope?

**Answer: Yes — DECISION G.**

## Repository Evidence

| Evidence | Source |
|----------|--------|
| v1.79.0 baseline | commit `bd115ee`, tag `v1.79.0`, 1074 PASS |
| Expansion framework | ADR-0019 / `PROVIDER_EXPANSION_ENTRY_REVIEW.md` |
| Candidate investigation | Per-Candidate Provider Expansion Decision — Class 1 accepted |
| `image_generation` capability | `PROVIDER_LAYER_DESIGN.md` §12 |
| Application foundation | `src/lib/image_generation.js` — deterministic local prompts |
| Bounded text mock READY | `PROVIDER_PRODUCTION_READINESS_REVIEW.md` — preserved |
| Catalog | 2 entries — unchanged |
| Real Provider prohibited | ADR-0013, `NON_GOALS.md` |
| PR-006 pattern | ADR-0016 Application mock ≠ Provider mock |

## Decision

### Release Type

| Item | Decision |
|------|----------|
| **Release scope** | **Governance only** — per-candidate Expansion Entry Decision |
| **Production code** | **No change** |
| **`mock_provider.js`** | **No change** |
| **`image_generation.js`** | **No change** |
| **`public_contract_catalog.js`** | **No change**（no new provider entries） |
| **Provider Contracts count** | **2**（unchanged） |
| **catalogVersion** | **1.0**（unchanged） |
| **catalog schema** | **unchanged** |
| **Provider Expansion Entry Authorization** | **Granted** — bounded — `image-generation-mock-provider` only |
| **Implementation Authorization** | **Not granted** |
| **Catalog registration** | **Not authorized** |
| **Provider Production Ready（global）** | **Not Declared** |
| **Repository-wide Level 4** | **Not Declared** |

### DECISION G — Grant Bounded Provider Expansion Entry Authorization

```text
Provider Expansion Entry Governed (v1.79.0)
  → Provider Expansion Entry Authorized (v1.80.0)
    for image-generation-mock-provider only
```

**Critical distinction:**

```text
Provider Expansion Entry Authorized
≠ Implementation Authorized
≠ Implemented
≠ Catalog Registered
≠ Review Entry Authorized
≠ Formally Assessed
≠ Bounded Production Ready
≠ Global Provider Production Ready
```

## Exact Candidate Identity

| Field | Value |
|-------|-------|
| **providerId** | `image-generation-mock-provider` |
| **Candidate class** | Class 1 — Additional Deterministic Local Mock Provider |
| **Capability** | `image_generation` |
| **Implementation kind** | `mock`（governed candidate type — **does not mean implementation exists or is authorized**） |

## Governance Owner

**Architecture Governance — Provider Domain Expansion Entry Decision Authority**

（Individual persons are not named per repository convention.）

## Operational Classification

| Characteristic | Classification |
|----------------|----------------|
| Determinism | **required** |
| Execution | **local / in-memory / bounded** |
| External IO | **none / prohibited** |
| Credentials | **none / prohibited** |
| External side effects | **none** |

## Side-Effect Boundary

`image_generation` is a **command-class capability** per `PROVIDER_LAYER_DESIGN.md` §12.

The bounded candidate uses **mock-local-only execution semantics**:

```text
Command-class capability ≠ authorization for external side effects.
```

A future bounded mock — **if separately Implementation Authorized and implemented** — may only produce **deterministic normalized Provider output metadata in memory**.

It must **not**:

- write files
- perform network IO
- access credentials
- invoke external image APIs
- trigger publishing
- cross Runtime, Workflow, Event, Scheduler, or Automation operational boundaries

## External IO Classification

**None / Prohibited** — no outbound HTTP, API, SNS, or adapter IO in entry authorization scope.

## Credential Classification

**None / Prohibited** — no credential requirement, secret store, OAuth, or token handling.

## Determinism Requirement

**Required** — deterministic output derived from bounded `applicationContract` input only.

## PR-006 Identity Distinction

```text
src/lib/image_generation.js (Application Layer image-generation foundation)
≠
image-generation-mock-provider (Provider Layer governed candidate identity)
```

- Does **not** replace `image_generation.js`
- Does **not** wrap `image_generation.js` in v1.80.0
- Integration **not authorized**
- Implementation **not authorized**
- Catalog registration **not authorized**
- Application `publicContracts[]` **unchanged**

Conflation is a **PR-006 semantic drift violation**.

## Authorized Scope

- Bounded **Provider Expansion Entry Authorized** for `image-generation-mock-provider`
- Per-candidate governance record（this ADR + review artifact）
- E1–E25 / B1–B25 disposition for entry scope
- Future implementation **planning** documentation only（not execution）
- Quality Pipeline governance evidence

## Prohibited Scope

- Provider production implementation
- Catalog registration of `image-generation-mock-provider`
- `public_contract_catalog.js` mutation
- External IO / credentials / Real Provider
- Runtime / Workflow / Event / Scheduler / Automation operational integration
- Application Layer integration with Provider Layer
- Automatic SNS publishing / commit / tag / push
- Global Provider Production Ready / repository-wide Level 4
- Maturity advancement beyond Level 3.19

## E1–E25 Relationship

| Range | Disposition |
|-------|-------------|
| E1–E9 | **SATISFIED** |
| E10 | **NOT APPLICABLE** — bounded deterministic local mock entry |
| E11 | **NOT APPLICABLE** — no side-effecting execution authorized |
| E12 | **NOT APPLICABLE** — no interaction lifecycle authorized |
| E13–E25 | **SATISFIED** — bounded Expansion Entry Authorization governance scope |

Full table: [IMAGE_GENERATION_MOCK_PROVIDER_EXPANSION_ENTRY_REVIEW.md](../architecture/IMAGE_GENERATION_MOCK_PROVIDER_EXPANSION_ENTRY_REVIEW.md) §Entry Criteria E1–E25.

## B1–B25 Relationship

| Range | Disposition |
|-------|-------------|
| B1–B3 | **CLEAR** |
| B4 | **NOT APPLICABLE** at entry scope |
| B5–B8 | **CLEAR** |
| B9–B11 | **NOT APPLICABLE** for bounded candidate entry |
| B12–B15 | **CLEAR** |
| B16–B17 | **NOT APPLICABLE** at entry scope |
| B18–B25 | **CLEAR** |

Full table: [IMAGE_GENERATION_MOCK_PROVIDER_EXPANSION_ENTRY_REVIEW.md](../architecture/IMAGE_GENERATION_MOCK_PROVIDER_EXPANSION_ENTRY_REVIEW.md) §Blocking Conditions B1–B25.

## CL-004 / CL-005 / CL-006 Relationship

| Risk | Global state | Candidate applicability |
|------|--------------|-------------------------|
| CL-004 | **Deferred** | **NOT APPLICABLE** — no retry/recovery execution |
| CL-005 | **Deferred** | **NOT APPLICABLE** — no side-effecting IO authorized |
| CL-006 | **Deferred** | **NOT APPLICABLE** — no interaction lifecycle |

Global Deferred states are **not resolved** by this decision.

## PR-004 / PR-005 / PR-006 Relationship

| Risk | Effect |
|------|--------|
| PR-004 | Expansion Entry Authorization **does not** permit catalog registration |
| PR-005 | State distinctions explicit — Entry ≠ Implementation ≠ Registered ≠ Production Ready |
| PR-006 | `image_generation.js` ≠ `image-generation-mock-provider` — identity mapping recorded |

## Catalog Implications

- **No catalog change in v1.80.0**
- Provider Contracts remain **2**
- catalogVersion remains **1.0**
- Future catalog registration requires **separate Implementation Authorization** chain

## Public-Contract Implications

- Application `publicContracts[]` **unchanged**
- `compatibilityMatrix` **unchanged**
- Additive future Provider identity only at implementation stage

## Compatibility

**Backward compatible** — governance-only; no breaking Application contract changes.

## Human Approval Gate

**Preserved** — git commit / tag / push automation **not authorized**. Automatic SNS publishing **prohibited**.

## Architecture Maturity

**Level 3.19** — unchanged. Expansion Entry Authorization is a governance milestone, not Implementation Ready or Production Ready.

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Defer candidate pending more evidence | Investigation + plan established artifact-shaped evidence sufficient |
| Class 2 contract-only expansion | Insufficient standalone value; supporting concern only |
| Class 3 Real Provider preparation | Premature; CL triggers; Real Provider prohibited |
| Class 4 External IO preparation | External IO prohibited; not current step |
| Class 5 cross-layer preparation | Runtime/Scheduler not ready |
| Reject candidate | Evidence supports bounded Class 1 entry |

## Consequences

- `image-generation-mock-provider` — **Provider Expansion Entry Authorized**（bounded）
- Implementation Authorization — **Not Granted**
- Bounded text mock READY — **Preserved**
- Real Provider / External IO — **remain prohibited**
- CL-004/005/006 — **remain globally Deferred**
- Production code — **unchanged**
- Provider catalog — **unchanged**（2 entries）

## Rollback / Supersession

**Rollback:** Revert v1.80.0 governance artifacts; candidate returns to Expansion Identified / Governed only.

**Supersession / reopening:** Candidate scope violation; unauthorized catalog entry; PR-006 conflation; Implementation before authorization; state compression without ADR.

## Follow-Up Decision Point

**Image Generation Mock Provider Implementation Authorization** — separate ADR + review; requires Implementation Authorization; catalog registration governance if following ADR-0017 pattern.

## Explicit Non-Claims

- Does **not** authorize Provider implementation
- Does **not** authorize catalog registration
- Does **not** authorize External IO
- Does **not** authorize credentials
- Does **not** authorize Real Provider
- Does **not** authorize cross-layer operational integration
- Does **not** declare global Provider Production Ready
- Does **not** declare repository-wide Level 4
- Does **not** modify bounded `text-generation-mock-provider` Formal Decision **READY**
- Does **not** resolve CL-004 / CL-005 / CL-006 globally

## Quality Pipeline

v1.80.0 adds governance evidence tests（Test 1075–1114）.

## Related Documents

- [IMAGE_GENERATION_MOCK_PROVIDER_EXPANSION_ENTRY_REVIEW.md](../architecture/IMAGE_GENERATION_MOCK_PROVIDER_EXPANSION_ENTRY_REVIEW.md)
- [ADR-0019](./ADR-0019-provider-expansion-entry-governance.md)
- [PROVIDER_EXPANSION_ENTRY_REVIEW.md](../architecture/PROVIDER_EXPANSION_ENTRY_REVIEW.md)
- [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md)
- [RISK_REGISTER.md](../architecture/RISK_REGISTER.md)
