# ADR-0021: Image Generation Mock Provider Implementation Authorization Decision

## Status

Accepted（v1.81.0 — Image Generation Mock Provider Implementation Authorization Governance — governance-only release candidate）

## Context

[v1.80.0](../VERSION.md) により `image-generation-mock-provider` の bounded **Provider Expansion Entry Authorization** が記録された（ADR-0020 / DECISION G）。**Implementation Authorization** は **Not Granted** のまま。Bounded canonical Mock Provider（`text-generation-mock-provider`）の Formal Decision **READY**（v1.78.0）は **preserved**。

Read-Only Evidence Investigation と Governance Planning により、Class 1 bounded deterministic local mock の **Implementation Authorization** を governance-only で記録する証拠が整備可能と判定された。v1.81.0 は **Governance / Implementation Authorization Decision Release のみ**。production code、`mock_provider.js`、`image_generation.js`、`public_contract_catalog.js`、`authorizedImplementationPaths` の **変更は禁止**。

## Decision Question

Should `image-generation-mock-provider` receive **bounded Provider Implementation Authorization** under ADR-0020 Class 1, without authorizing implementation execution in v1.81.0, catalog registration, External IO, credentials, Real Provider, Application Layer integration, or cross-layer operational integration?

**Answer: Yes — DECISION H.**

## Repository Evidence

| Evidence | Source |
|----------|--------|
| v1.80.0 baseline | commit `2d2ad1e`, tag `v1.80.0`, 1114 PASS |
| Expansion Entry Authorized | ADR-0020 / DECISION G |
| Bounded text mock READY | `PROVIDER_PRODUCTION_READINESS_REVIEW.md` — preserved |
| Text mock impl precedent | ADR-0016 / `mock_provider.js` — structural pattern only |
| `image_generation` capability | `PROVIDER_LAYER_DESIGN.md` §12 |
| Application foundation | `src/lib/image_generation.js` — independent; not Provider |
| Abstract Provider contract | `provider-abstract-contract-authority` — sufficient |
| Catalog | 2 entries — unchanged |
| Real Provider prohibited | ADR-0013, `NON_GOALS.md` |
| PR-006 pattern | ADR-0020 identity distinction |

## Decision

### Release Type

| Item | Decision |
|------|----------|
| **Release scope** | **Governance only** — per-candidate Implementation Authorization Decision |
| **Production code** | **No change** |
| **`mock_provider.js`** | **No change** |
| **`image_generation.js`** | **No change** |
| **`public_contract_catalog.js`** | **No change** |
| **`authorizedImplementationPaths`** | **No change** |
| **Provider Contracts count** | **2**（unchanged） |
| **catalogVersion** | **1.0**（unchanged） |
| **catalog schema** | **unchanged** |
| **Provider Expansion Entry Authorization** | **Maintained** — bounded — `image-generation-mock-provider` |
| **Implementation Authorization** | **Granted** — bounded — future separate Implementation Release only |
| **Implementation execution** | **Not Started** |
| **Catalog registration** | **Not authorized** |
| **Provider Production Ready（global）** | **Not Declared** |
| **Repository-wide Level 4** | **Not Declared** |

### DECISION H — Grant Bounded Implementation Authorization

```text
Provider Expansion Entry Authorized (v1.80.0)
  → Implementation Authorized (v1.81.0)
    for image-generation-mock-provider only
```

**Critical distinction:**

```text
Implementation Authorized
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
| **Implementation kind** | `mock`（governed candidate type — **does not mean implementation exists in v1.81.0**） |

## Governance Owner

**Architecture Governance — Provider Domain Implementation Authorization Decision Authority**

## Operational Characteristics

| Characteristic | Classification |
|----------------|----------------|
| Determinism | **Required** |
| Locality | **In-memory / local only** |
| Bounded scope | **Per-candidate only** |
| External IO | **none / prohibited** |
| Credentials | **none / prohibited** |
| Side effects | **command-mock-local-only / zero external effects** |

## PR-006 Identity Distinction

```text
src/lib/image_generation.js (Application Layer image-generation foundation)
≠
image-generation-mock-provider (Provider Layer governed candidate identity)
```

- `image_generation.js` remains an **Application Layer foundation**
- Future Provider **must not** replace, wrap, invoke, or import `image_generation.js`
- Future Provider **must not** trigger Application Layer execution
- Plain serialized data compatibility **does not** create module dependency
- Integration **not authorized**
- Conflation is a **PR-006 semantic drift violation**

### PLANNED AUTHORIZED IMPLEMENTATION PATH

**Documentation only — not created, not implemented, not registered, not operational:**

`src/lib/image_generation_mock_provider.js`

Future dedicated Provider module — separate from `mock_provider.js` and `image_generation.js`.

## Input Semantics（Future Implementation Authorization Boundary）

The future Provider may accept a plain normalized request derived from or structurally compatible with approved image-generation input data, but **must not** depend on or execute the Application Layer image-generation module.

| Requirement | Policy |
|-------------|--------|
| Request envelope | Plain object with explicit `capability` |
| Input data | Plain serializable object |
| Executable dependency | **Prohibited** |
| Module reference | **Prohibited** — no import of `image_generation.js` |
| Credentials / secrets | **Prohibited** in input |
| Runtime / Scheduler / Adapter / Workflow / Event / Automation / publishing control fields | **Prohibited** |
| Complete `image-generation/1.0` contract | **Not required** on every request — bounded subset sufficient |
| Determinism | Equivalent valid input → stable output |
| Testability | Invoke without Application pipeline |

## Output Semantics（Future Implementation Authorization Boundary）

### Required semantic minimum

| Element | Requirement |
|---------|-------------|
| Success envelope | Normalized `ok: true` + provider identity + capability + result |
| Error envelope | Normalized `ok: false` + provider identity + structured error |
| providerId / providerVersion | **Required** |
| Result metadata | Deterministic in-memory only |
| Stability | Equivalent valid input → equivalent output |
| Raw exceptions | **Prohibited** at public boundary |

### Prohibited result content

- image binary data
- image files / filesystem paths
- externally hosted URLs
- credentials / secrets
- API responses
- publishing instructions
- runtime execution controls
- external side-effect records

### Illustrative non-binding detail

Representative candidate fields such as prompt metadata echoes, counts, or stable digests **may** appear in a future implementation — **not frozen** by this ADR. Implementation release may choose minimal metadata sufficient to prove deterministic normalization and `image_generation` capability behavior **without** performing real image generation.

```text
Required semantic minimum ≠ illustrative future implementation detail
```

## Failure Semantics（Future Implementation Authorization Boundary）

| Category | Authorized error kind（structural reuse from text mock pattern） |
|----------|------------------------------------------------------------------|
| Malformed request | `validation_error` |
| Missing capability | `validation_error` |
| Unsupported capability | `unsupported_capability` |
| Invalid input object | `validation_error` |
| Unknown / forbidden top-level fields | `validation_error` |
| Prohibited credential/secret/runtime fields | `validation_error` |
| Internal deterministic mock failure | `validation_error`（normalized before boundary） |
| Raw exception leakage | **Prohibited** |

```text
Provider-level failure semantics ≠ Runtime retry/recovery ≠ External IO failure handling
```

**Runtime retry/recovery** and **External IO failure handling** are **not authorized**.

## Provider Contract Decision

**Existing abstract Provider contract is sufficient** — implementation-specific image-generation Mock Provider semantics are documented in this ADR and the Review artifact.

| Item | v1.81.0 |
|------|---------|
| New Provider contract | **No** |
| Provider Contracts | **2** |
| catalogVersion | **1.0** |
| Application public contracts | **Unchanged** |

## Scope In

- Bounded **Implementation Authorization** for `image-generation-mock-provider`
- Governance artifacts: ADR-0021 + Review
- Input / output / failure semantic boundaries
- E1–E25 / B1–B25 disposition for Implementation Authorization scope
- PR-006 identity mapping
- **PLANNED AUTHORIZED IMPLEMENTATION PATH** documentation only
- Quality Pipeline governance evidence

## Scope Out

- Provider implementation（v1.81.0）
- Creation of `src/lib/image_generation_mock_provider.js`
- Catalog registration of `image-generation-mock-provider`
- `authorizedImplementationPaths` mutation
- External IO / credentials / Real Provider
- Application Layer integration
- Cross-layer operational integration
- SNS publishing / automatic publishing / background publishing
- Global Provider Production Ready / repository-wide Level 4
- Maturity advancement beyond Level 3.19

## E1–E25 Relationship

| Range | Disposition |
|-------|-------------|
| E1–E9 | **SATISFIED** — candidate identity / scope / classifications documented |
| E10–E12 | **NOT APPLICABLE** — bounded local mock |
| E13–E25 | **SATISFIED** — bounded Implementation Authorization governance scope |

Full table: [IMAGE_GENERATION_MOCK_PROVIDER_IMPLEMENTATION_AUTHORIZATION_REVIEW.md](../architecture/IMAGE_GENERATION_MOCK_PROVIDER_IMPLEMENTATION_AUTHORIZATION_REVIEW.md) §Entry Criteria E1–E25.

```text
Governance evidence complete ≠ implementation evidence complete
```

## B1–B25 Relationship

| Range | Disposition |
|-------|-------------|
| B1–B8 | **CLEAR** |
| B9–B11 | **NOT APPLICABLE** — bounded local mock |
| B12–B15 | **CLEAR** |
| B16 | **NOT APPLICABLE** — mock scope |
| B17–B25 | **CLEAR** |

Full table: [IMAGE_GENERATION_MOCK_PROVIDER_IMPLEMENTATION_AUTHORIZATION_REVIEW.md](../architecture/IMAGE_GENERATION_MOCK_PROVIDER_IMPLEMENTATION_AUTHORIZATION_REVIEW.md) §Blocking Conditions B1–B25.

**No ACTIVE BLOCKER** remains for bounded Implementation Authorization.

## CL-004 / CL-005 / CL-006 Relationship

| ID | Global state | Candidate applicability |
|----|--------------|-------------------------|
| CL-004 | **Deferred** | **NOT APPLICABLE** — no retry/recovery execution |
| CL-005 | **Deferred** | **NOT APPLICABLE** — no side-effecting IO |
| CL-006 | **Deferred** | **NOT APPLICABLE** — no interaction lifecycle |

## PR-004 / PR-005 / PR-006 Relationship

| ID | Disposition |
|----|-------------|
| PR-004 | Implementation Authorization **does not** permit catalog registration |
| PR-005 | Implementation Authorized ≠ Implemented ≠ Catalog Registered ≠ Production Ready |
| PR-006 | `image_generation.js` ≠ `image-generation-mock-provider` — separate module boundary required |

## Catalog Implications

- **No catalog change in v1.81.0**
- Provider Contracts: **2**
- catalogVersion: **1.0**
- Catalog validator: **unchanged**
- Future catalog registration requires **separate Catalog Registration Governance** after implementation

```text
Implementation Authorization ≠ Catalog Registration Authorization
```

## Human Approval Gate

**Preserved** — authorized future implementation cannot:

- publish to SNS
- prepare or execute automatic publishing
- call SNS APIs
- bypass Human Approval Gate
- publish from dry-run or apply
- create background publishing paths
- perform external image generation
- trigger publishing indirectly through another layer

## Architecture Maturity

**Level 3.19** — unchanged.

- Governance authorization ≠ implementation
- Implementation ≠ catalog registration
- Catalog registration ≠ production readiness
- Bounded production readiness ≠ global production readiness
- **No Level 4 claim authorized**

## Alternatives Considered

| Alternative | Rejected because |
|-------------|------------------|
| Defer Implementation Authorization | Evidence and planning support bounded grant |
| Implement in v1.81.0 | Violates governance-only release scope |
| Grant + catalog in same release | Violates PR-004 / PR-005 |
| Extend `mock_provider.js` | PR-006 conflation risk Major |
| Import/wrap `image_generation.js` | PR-006 violation |

## Consequences

- `image-generation-mock-provider` — **Implementation Authorized**（bounded）
- Implementation execution — **Not Started**
- Catalog registration — **Not Authorized**
- Bounded text mock READY — **Preserved**
- Real Provider / External IO — **remain prohibited**
- CL-004/005/006 — **remain globally Deferred**

## Implementation Acceptance Obligations（Future Release）

Future Implementation Release **must** satisfy（documented — not executed in v1.81.0）:

- Dedicated module at PLANNED AUTHORIZED IMPLEMENTATION PATH
- No import/wrap/replace `image_generation.js`
- Deterministic in-memory normalization only
- Provider-level failure semantics per this ADR
- Implementation tests separate from governance tests
- `authorizedImplementationPaths` update in separate authorized release only

## Rollback / Supersession

**Governance rollback:** Revert v1.81.0 artifacts; candidate returns to Expansion Entry Authorized without Implementation Authorization.

**Future implementation rollback:**

- Remove dedicated Provider module
- Revert implementation tests
- No data migration / persistent state / external cleanup
- No catalog rollback during implementation-only phase
- No Application public-contract rollback

**Reversibility rating: HIGH**

**Supersession / reopening:** PR-006 conflation; unauthorized catalog entry; implementation before authorization; state compression without ADR; scope violation.

## Future Gates

**Image Generation Mock Provider Implementation** — separate Implementation Release; then **Catalog Registration Governance** per ADR-0017 pattern.

## Explicit Non-Claims

- Does **not** implement Provider production code in v1.81.0
- Does **not** create `src/lib/image_generation_mock_provider.js`
- Does **not** authorize catalog registration
- Does **not** authorize External IO / credentials / Real Provider
- Does **not** authorize Application ↔ Provider integration
- Does **not** declare global Provider Production Ready
- Does **not** declare repository-wide Level 4
- Does **not** modify bounded `text-generation-mock-provider` Formal Decision **READY**
- Does **not** resolve CL-004 / CL-005 / CL-006 globally
- Does **not** claim normalized metadata schema is already implemented

## Related Documents

- [IMAGE_GENERATION_MOCK_PROVIDER_IMPLEMENTATION_AUTHORIZATION_REVIEW.md](../architecture/IMAGE_GENERATION_MOCK_PROVIDER_IMPLEMENTATION_AUTHORIZATION_REVIEW.md)
- [ADR-0020](./ADR-0020-image-generation-mock-provider-expansion-entry-decision.md)
- [ADR-0016](./ADR-0016-mock-provider-production-implementation-authorization.md)
- [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md)
- [RISK_REGISTER.md](../architecture/RISK_REGISTER.md)
