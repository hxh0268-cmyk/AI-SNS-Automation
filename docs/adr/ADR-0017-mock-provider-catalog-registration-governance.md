# ADR-0017: Mock Provider Catalog Registration Governance Decision

## Status

Accepted（v1.75.0 — Mock Provider Catalog Registration Governance）

## Context

[ADR-0015](./ADR-0015-provider-public-contract-catalog-extension-release.md)（v1.72.0）により `providerContracts[]` abstract authority registration が完了した。[ADR-0016](./ADR-0016-mock-provider-production-implementation-authorization.md)（v1.73.0）により Mock Provider Production Implementation が **Authorized** され、**Decision B** として concrete `providerContracts[]` registration は **separate Catalog Governance Release** に deferred された。

[v1.74.0](../VERSION.md) により Mock Provider Production Implementation が **Implemented**（`src/lib/mock_provider.js`）。Catalog Registration Architecture Review / Evidence Collection（post-v1.74.0）は **DECISION A** — Proceed directly with a Catalog Registration Governance Release を返した。

v1.75.0 は **Governance / Review / Evidence Release のみ**。`public_contract_catalog.js` / `mock_provider.js` / validator / schema / catalog version の **production 変更は禁止**。

## Problem

Implemented Mock Provider（`text-generation-mock-provider`）は production module として存在するが、Public Contract Catalog JSON traceability には **未登録** のままである。現行 validator は concrete Mock registration を **意図的に拒否** する。ADR-0016 Decision B は governance 決定なしの直接 registration を禁止した。

Catalog traceability gap（CL-013 partial）、PR-004 bypass risk、PR-006 Application mock conflation risk が concrete registration policy 未定義のまま残存する。

## Evidence

| Evidence | Source |
|----------|--------|
| Mock Provider implemented | `src/lib/mock_provider.js` — v1.74.0 / 917 PASS |
| Abstract authority registered | `provider-abstract-contract-authority` — ADR-0015 |
| Validator blocks concrete mock | `PROVIDER_FORBIDDEN_ID_PATTERNS`, `registrationKind` restriction — `public_contract_catalog.js` |
| Decision B deferred registration | ADR-0016 §Provider Catalog Registration Decision |
| Architecture Review DECISION A | Catalog Registration Architecture Review — governance release authorized |
| Implementation providerId | `text-generation-mock-provider` |
| Implementation capability | `text_generation` query only |

## Decision

### Release Type

| Item | Decision |
|------|----------|
| **Release scope** | **Governance only** — Mock Provider Catalog Registration governance + evidence |
| **Production code** | **No change** |
| **`public_contract_catalog.js`** | **No change** |
| **`mock_provider.js`** | **No change** |
| **Concrete `providerContracts[]` registration** | **Not executed** |
| **Mock Provider Catalog Registration Governance** | **Complete** — this ADR |
| **Mock Provider Catalog Registration** | **Authorized** — future separate Implementation Release only |
| **Mock Provider Catalog Registration execution** | **Not Started** |
| **Provider Production Ready** | **Not Declared** |
| **Repository-wide Level 4 Implementation Ready** | **Not Declared** |

### Decision Scope

| State | v1.75.0 |
|-------|---------|
| Mock Provider Production Implementation | **Implemented**（maintained — v1.74.0） |
| Mock Provider Catalog Registration **Governed** | **Yes** — this ADR |
| Mock Provider Catalog Registration **Authorized** | **Yes** — future separate Implementation Release |
| Mock Provider Catalog Registration **Registered** | **No** |
| Provider Production Ready | **Not Declared** |
| Repository-wide L4 Ready | **Not Declared** |

**Critical distinction:**

```text
Governance Complete ≠ Catalog Registration Authorized ≠ Catalog Registered ≠ Production Ready
```

---

## G1. Registration Necessity

| Item | Decision |
|------|----------|
| Concrete `providerContracts[]` entry required? | **Yes** — for implemented Mock Provider traceability |
| Timing | **Future Implementation Release** — not v1.75.0 |
| Rationale | CL-013 traceability completion; PR-006 identity disambiguation; ADR-0016 Decision B closure |

**Evidence:** Implemented module exists without catalog JSON traceability. Abstract authority alone does not bind concrete implementation identity.

---

## G2. Registration Scope

Minimum governed registration scope — **exact match to v1.74.0 implementation only**:

| Field | Governed Value |
|-------|----------------|
| `providerId` | `text-generation-mock-provider` |
| `providerVersion` | `1.0` |
| `capability` | `text_generation`（query only） |
| `implementationModule` | `src/lib/mock_provider.js` |
| `providerType` | `mock` |
| `layer` | `provider` |

**Prohibited in scope:** additional capabilities, Real Provider fields, external service references, speculative future Provider abstractions.

---

## G3. Registration Kind

| Item | Decision |
|------|----------|
| Governed `registrationKind` | `concrete-mock-provider-implementation` |
| Distinct from abstract | **Yes** — `abstract-contract-authority` preserved separately |
| Real Provider ambiguity | **Avoided** — `mock` providerType + kind prefix |
| Application mock ambiguity | **Avoided** — catalog entry references Provider Layer module only |

Future validator **may** accept `registrationKind: concrete-mock-provider-implementation` for governed Mock entries only. Validator change **not authorized in v1.75.0**.

---

## G4. Catalog Identity Mapping

| Mapping | Decision |
|---------|----------|
| Implementation `providerId` | `text-generation-mock-provider` |
| Catalog entry `providerId` | **Same** — 1:1 identity, no separate catalog alias |
| Contract authority SSOT | [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md) §8–§14 — **unchanged** |
| Abstract authority entry | `provider-abstract-contract-authority` — **preserved** |
| Implementation module | `src/lib/mock_provider.js` |
| Capability declaration | `text_generation` — single capability, query only |
| Application mocks | `generateMockAIIdeas` / `generateMockContentDrafts` — **not** catalog entries |

**Rule:** One concrete catalog entry per implemented Mock Provider module. No duplicate or conflicting authority IDs.

---

## G5. Validator Policy（Future Implementation Authorization）

Future Catalog Registration Implementation Release **may** authorize the following validator changes — **not in v1.75.0**:

| Policy Area | Future Authorized Change |
|-------------|-------------------------|
| Entry count | `PROVIDER_CONTRACT_DEFINITIONS.length` → **2**（abstract + concrete mock） |
| `registrationKind` | Allow `concrete-mock-provider-implementation` for governed mock entries |
| Forbidden ID patterns | **Whitelist** `text-generation-mock-provider` — exempt from `/mock-provider/i` and generic `mock-*` rejection |
| Generic mock patterns | **Maintained** for unauthorized IDs |
| Abstract entry | **Preserved** — validation rules unchanged |
| Concrete entry validation | Must match G2 scope exactly; `implementationStatus: implemented` |
| Sensitive fields | **Maintained** — credential/secret field rejection |
| Real Provider patterns | **Maintained** — `real-*`, SNS, OpenAI, Gemini patterns still forbidden |

---

## G6. Schema Version Impact

| Item | Decision |
|------|----------|
| `schema` | `public-contract-catalog/1.0` — **unchanged** |
| Rationale | ADR-0012 additive-only model; new `providerContracts[]` entry is additive |
| Schema bump required? | **No** |

---

## G7. Catalog Version Impact

| Item | Decision |
|------|----------|
| `catalogVersion` | `1.0` — **unchanged** at governance level |
| Future implementation | May record additive registration without version bump per ADR-0015 precedent |
| Catalog version bump required? | **No** — evidence-based; additive extension sufficient |

---

## G8. Backward Compatibility

| Consumer / Artifact | Requirement |
|---------------------|-------------|
| Application `publicContracts[]` | **Unchanged** |
| `compatibilityMatrix` | **Unchanged** |
| Abstract authority entry | **Preserved** |
| Legacy catalog normalization | **Maintained** — abstract entry default if missing |
| Catalog generator | Additive output extension only |
| Compliance validation | Extended for second entry when implemented |
| Traceability | Concrete entry adds traceability; no removal |

---

## G9. Migration Requirement

| Item | Decision |
|------|----------|
| Consumer migration required? | **No** |
| Rationale | Additive `providerContracts[]` entry; Application contracts unaffected; existing consumers ignore unknown provider entries |
| Legacy catalog files | Normalize path unchanged for abstract authority |

---

## G10. Risk Treatment

| ID | v1.75.0 Effect |
|----|----------------|
| PR-004 | **Low** — validator policy defined before implementation; bypass prohibition maintained |
| PR-005 | **Medium** — reframed: Governed / Authorized / Registered / Production Ready distinction explicit |
| PR-006 | **Medium** — identity mapping closes Application mock conflation at governance level |
| CL-013 | **Mitigated at governance** — registration policy defined; concrete JSON traceability pending Implementation Release |
| CL-004 / CL-005 / CL-006 | **Unchanged — deferred** |

---

## G11. Forbidden Scope

Explicitly **preserved** in v1.75.0 and future registration Implementation Release scope boundary:

| Item | Status |
|------|--------|
| Real Provider | **Prohibited** |
| External IO | **Prohibited** |
| Credentials / secrets | **Prohibited** |
| Runtime / Scheduler / Adapter | **Prohibited** |
| Retry / recovery execution | **Not authorized** |
| Idempotency / duplicate handling | **Deferred** |
| Provider Production Ready declaration | **Not Declared** |
| Repository-wide L4 declaration | **Not Declared** |

---

## G12. Future Implementation Authorization

| Item | Decision |
|------|----------|
| Separate Implementation Release authorized? | **Yes** — Mock Provider Catalog Registration Implementation Release |
| Prerequisites | v1.75.0 Governance Complete + this ADR + Review |
| Implementation scope | `public_contract_catalog.js` validator + `PROVIDER_CONTRACT_DEFINITIONS` additive entry only |
| Not authorized in Implementation Release | Real Provider, schema bump, Application contract changes, `mock_provider.js` behavior changes |

**Governance Complete ≠ Catalog Registered**

---

## Consequences

### Positive

- Concrete registration policy defined before production catalog changes
- Validator policy explicit — reduces PR-004 bypass risk
- Identity mapping closes PR-006 governance gap
- ADR-0016 Decision B closure path established

### Negative / Accepted

- Catalog JSON traceability gap remains until Implementation Release
- Validator still blocks registration until Implementation Release
- Two-step process（Governance → Implementation）adds release overhead

---

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Register immediately in v1.75.0 | Violates governance-only scope; bypasses validator policy definition |
| Remain deferred indefinitely | Contradicts ADR-0016 Decision B and Architecture Review DECISION A |
| Separate catalog alias ID | Creates PR-006 duplicate identity risk |
| Schema / catalog version bump | No breaking change justified per ADR-0012 / ADR-0015 precedent |
| Provider Production Ready declaration | Not evidenced; out of scope |

---

## Compliance

- ADR-0011 additive catalog strategy — **aligned**
- ADR-0012 extension strategy — **aligned**
- ADR-0015 abstract authority — **preserved**
- ADR-0016 Decision B — **closed at governance level**
- PROVIDER_LAYER_DESIGN.md — **SSOT maintained**
- Application catalog backward compatibility — **maintained**

---

## Follow-up

| Item | Owner | Release |
|------|-------|---------|
| Mock Provider Catalog Registration Implementation | Future Release | post-v1.75.0 approval |
| Validator policy implementation | Future Release | per G5 |
| Quality Pipeline registration tests | Future Release | post-implementation |
| Provider Production Ready assessment | **Not scheduled** | separate authorization |

---

## Quality Pipeline

v1.75.0 adds governance evidence tests（Test 918–945）.

---

## Related Documents

- [MOCK_PROVIDER_CATALOG_REGISTRATION_GOVERNANCE_REVIEW.md](../architecture/MOCK_PROVIDER_CATALOG_REGISTRATION_GOVERNANCE_REVIEW.md)
- [ADR-0016](./ADR-0016-mock-provider-production-implementation-authorization.md)
- [ADR-0015](./ADR-0015-provider-public-contract-catalog-extension-release.md)
- [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md)
