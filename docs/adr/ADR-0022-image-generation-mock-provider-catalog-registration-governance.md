# ADR-0022: Image Generation Mock Provider Catalog Registration Governance Decision

## Status

Accepted（v1.83.0 — Image Generation Mock Provider Catalog Registration Governance）

## Context

[ADR-0017](./ADR-0017-mock-provider-catalog-registration-governance.md)（v1.75.0）により `text-generation-mock-provider` の concrete `providerContracts[]` registration policy が定義され、[v1.76.0](../VERSION.md) で **Registered** となった。

[ADR-0021](./ADR-0021-image-generation-mock-provider-implementation-authorization-decision.md)（v1.81.0）により `image-generation-mock-provider` の bounded **Implementation Authorization** が **Granted** され、**Future Gates** で Catalog Registration Governance per ADR-0017 pattern が明示された。

[v1.82.0](../VERSION.md) により Image Generation Mock Provider Implementation が **Implemented**（`src/lib/image_generation_mock_provider.js` — 1195 PASS）。Catalog Registration Architecture Review / Evidence Collection（post-v1.82.0）は **DECISION A** — Proceed with Image Generation Mock Provider Catalog Registration Governance Release を返した。

v1.83.0 は **Governance / Review / Evidence Release のみ**。`public_contract_catalog.js` / `image_generation_mock_provider.js` / `mock_provider.js` / validator / schema / catalog version の **production 変更は禁止**。

## Problem

Implemented Image Generation Mock Provider（`image-generation-mock-provider`）は production module として存在するが、Public Contract Catalog JSON traceability には **未登録** のままである。現行 validator は `image-generation-mock-provider` を **意図的に拒否** する（`/mock-/` forbidden pattern、`registrationKind` text-mock-only gate、`PROVIDER_CONTRACT_DEFINITIONS` count = 2）。

Catalog traceability gap（CL-013 partial for image provider）、PR-004 bypass risk、PR-006 Application `image_generation.js` conflation risk が image provider concrete registration policy 未定義のまま残存する。

## Evidence

| Evidence | Source |
|----------|--------|
| Image Generation Mock Provider implemented | `src/lib/image_generation_mock_provider.js` — v1.82.0 / 1195 PASS |
| Abstract authority registered | `provider-abstract-contract-authority` — ADR-0015 |
| Text mock registered | `text-generation-mock-provider` — v1.76.0 / ADR-0017 |
| Validator blocks image mock | `isGovernedMockProviderId()` text-only; forbidden patterns — `public_contract_catalog.js` |
| ADR-0021 Future Gates | Catalog Registration Governance per ADR-0017 pattern |
| Implementation providerId | `image-generation-mock-provider` |
| Implementation providerVersion | `1.0.0` |
| Implementation capability | `image_generation` |
| Implementation module | `src/lib/image_generation_mock_provider.js` |
| Human Approval Gate | `humanApprovalGateBypass: false` — module policy |

## Relationship to ADR-0017

ADR-0022 **builds on** ADR-0017 G1–G12 as the primary registration governance precedent. ADR-0017 policies apply **by reference** with image-provider bounded adaptations documented in this ADR. ADR-0017 text-mock registration remains **unchanged**.

## Relationship to ADR-0021

ADR-0021 authorized Implementation and deferred catalog registration. ADR-0021 §Future Gates explicitly requires this governance release before catalog registration. ADR-0021 bounded text mock Formal Decision **READY**（v1.78.0）は **preserved** — image provider registration does not modify text mock readiness.

## Decision

### Release Type

| Item | Decision |
|------|----------|
| **Release scope** | **Governance only** — Image Generation Mock Provider Catalog Registration governance + evidence |
| **Production code** | **No change** |
| **`public_contract_catalog.js`** | **No change** |
| **`image_generation_mock_provider.js`** | **No change** |
| **`mock_provider.js`** | **No change** |
| **Concrete `providerContracts[]` registration** | **Not executed** |
| **Image Catalog Registration Governance** | **Complete** — this ADR |
| **Image Catalog Registration** | **Authorized** — future separate v1.84.0 Implementation Release only |
| **Image Catalog Registration execution** | **Not Started** |
| **Provider Production Ready** | **Not Declared** |
| **Repository-wide Level 4 Implementation Ready** | **Not Declared** |

### Decision Scope

| State | v1.83.0 |
|-------|---------|
| Image Generation Mock Provider Implementation | **Implemented**（maintained — v1.82.0） |
| Image Catalog Registration **Governed** | **Yes** — this ADR |
| Image Catalog Registration **Authorized** | **Yes** — future separate v1.84.0 Implementation Release |
| Image Catalog Registration **Registered** | **No** |
| Provider Production Ready | **Not Declared** |
| Repository-wide L4 Ready | **Not Declared** |

**Critical distinction:**

```text
Governance Complete ≠ Catalog Registration Authorized ≠ Catalog Registered ≠ Production Ready
```

### Authorized Candidate Registration Contract（Future v1.84.0 Only）

```javascript
{
  providerId: "image-generation-mock-provider",
  providerVersion: "1.0.0",
  providerType: "mock",
  layer: "provider",
  registrationKind: "concrete-mock-provider-implementation",
  status: "catalog-registered",
  authorityDocument: "docs/architecture/PROVIDER_LAYER_DESIGN.md",
  inputContractRef: "application-public-contract",
  outputContractRef: "normalized-provider-output",
  errorContractRef: "provider-error-contract",
  capabilityDeclaration: "image_generation",
  implementationModule: "src/lib/image_generation_mock_provider.js",
  implementationStatus: "implemented",
}
```

**Not added to repository in v1.83.0.**

---

## G1. Registration Necessity（REUSE WITH ADAPTATION — per ADR-0017 G1）

| Item | Decision |
|------|----------|
| Concrete `providerContracts[]` entry required? | **Yes** — for implemented `image-generation-mock-provider` traceability |
| Timing | **Future v1.84.0 Implementation Release** — not v1.83.0 |
| Rationale | CL-013 traceability completion for image provider; PR-006 `image_generation.js` disambiguation; ADR-0021 catalog deferral closure |

**Evidence:** Implemented module exists without catalog JSON traceability. Abstract authority and text mock entry do not bind `image-generation-mock-provider`.

---

## G2. Registration Scope（REUSE WITH ADAPTATION — per ADR-0017 G2）

Minimum governed registration scope — **exact match to v1.82.0 implementation only**:

| Field | Governed Value |
|-------|----------------|
| `providerId` | `image-generation-mock-provider` |
| `providerVersion` | `1.0.0` |
| `capabilityDeclaration` | `image_generation` |
| `implementationModule` | `src/lib/image_generation_mock_provider.js` |
| `providerType` | `mock` |
| `layer` | `provider` |

**`providerVersion: "1.0.0"` intentional fidelity:** Implementation exports `"1.0.0"`. This value **must not** be normalized to text mock catalog `"1.0"`. Per-implementation exact-match fidelity is required per ADR-0017 G2 precedent applied to image provider identity.

**Prohibited in scope:** additional capabilities, Real Provider fields, external service references, speculative future Provider abstractions, `image_generation.js` as implementation module.

---

## G3. Registration Kind（REUSE UNCHANGED — per ADR-0017 G3）

| Item | Decision |
|------|----------|
| Governed `registrationKind` | `concrete-mock-provider-implementation` |
| Distinct from abstract | **Yes** — `abstract-contract-authority` preserved separately |
| Distinct from text mock | **Yes** — separate governed entry; same kind |
| Real Provider ambiguity | **Avoided** — `mock` providerType + kind prefix |
| Application ambiguity | **Avoided** — catalog entry references Provider Layer module only; `image_generation.js` excluded |

Future validator **may** accept `registrationKind: concrete-mock-provider-implementation` for governed image mock entry only. Validator change **not authorized in v1.83.0**.

---

## G4. Catalog Identity Mapping（REUSE WITH ADAPTATION — per ADR-0017 G4）

| Mapping | Decision |
|---------|----------|
| Implementation `providerId` | `image-generation-mock-provider` |
| Catalog entry `providerId` | **Same** — 1:1 identity, no separate catalog alias |
| Contract authority SSOT | [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md) §8–§14 — **unchanged** |
| Abstract authority entry | `provider-abstract-contract-authority` — **preserved** |
| Text mock entry | `text-generation-mock-provider` — **preserved** |
| Implementation module | `src/lib/image_generation_mock_provider.js` |
| Capability declaration | `image_generation` — single capability |
| Application layer | `image_generation.js` / Application foundations — **not** catalog entries |

**Rule:** One concrete catalog entry per implemented Mock Provider module. Entry ordering: abstract → text mock → image mock.

---

## G5. Validator Policy（REUSE WITH ADAPTATION — per ADR-0017 G5）

Future v1.84.0 Catalog Registration Implementation Release **may** authorize the following **closed-world multi-mock** validator changes — **not in v1.83.0**:

| Policy Area | Future Authorized Change |
|-------------|-------------------------|
| Entry count | `PROVIDER_CONTRACT_DEFINITIONS.length` → **3**（abstract + text mock + image mock） |
| Governed image scope | `GOVERNED_IMAGE_MOCK_PROVIDER_SCOPE`（or equivalent）— exact G2 match |
| `isGovernedMockProviderId()` | Whitelist exactly: `text-generation-mock-provider`, `image-generation-mock-provider` |
| Forbidden ID patterns | Exempt **only** governed mock IDs from `/mock-/` and related patterns |
| `registrationKind` | Allow `concrete-mock-provider-implementation` for **governed mock IDs only** |
| Per-provider scope validation | Exact field match per governed scope object |
| Generic mock patterns | **Maintained** for unauthorized IDs — **no broad `/^mock-/` acceptance** |
| Abstract entry | **Preserved** — `GOVERNED_ABSTRACT_AUTHORITY_SCOPE` unchanged |
| Text mock scope | **Preserved** — `GOVERNED_MOCK_PROVIDER_SCOPE` unchanged |
| Sensitive fields | **Maintained** — credential/secret field rejection |
| Real Provider patterns | **Maintained** — `real-*`, SNS, OpenAI, Gemini patterns still forbidden |
| Duplicate / unauthorized rejection | **Preserved** |

**Explicitly prohibited:** broad generic mock-provider acceptance; weakening `PROVIDER_FORBIDDEN_REGISTRATION_IDS`; changing abstract authority profile.

---

## G6. Schema Version Impact（REUSE UNCHANGED — per ADR-0017 G6）

| Item | Decision |
|------|----------|
| `schema` | `public-contract-catalog/1.0` — **unchanged** |
| Rationale | ADR-0012 additive-only model; new `providerContracts[]` entry is additive |
| Schema bump required? | **No** |

---

## G7. Catalog Version Impact（REUSE UNCHANGED — per ADR-0017 G7）

| Item | Decision |
|------|----------|
| `catalogVersion` | `1.0` — **unchanged** at governance level |
| Future implementation | May record additive registration without version bump per ADR-0015 / v1.76.0 precedent |
| Catalog version bump required? | **No** |

---

## G8. Backward Compatibility（REUSE UNCHANGED — per ADR-0017 G8）

| Consumer / Artifact | Requirement |
|---------------------|-------------|
| Application `publicContracts[]` | **Unchanged** |
| `compatibilityMatrix` | **Unchanged** |
| Abstract authority entry | **Preserved** |
| Text mock entry | **Preserved** |
| Legacy catalog normalization | **Maintained** |
| Catalog generator | Additive output extension only at v1.84.0 |
| Compliance validation | Extended for third entry when implemented |
| Traceability | Concrete entry adds traceability; no removal |

---

## G9. Migration Requirement（REUSE UNCHANGED — per ADR-0017 G9）

| Item | Decision |
|------|----------|
| Consumer migration required? | **No** |
| Rationale | Additive `providerContracts[]` entry; Application contracts unaffected |
| Legacy catalog files | Normalize path unchanged |

---

## G10. Risk Treatment（REUSE WITH ADAPTATION — per ADR-0017 G10）

| ID | v1.83.0 Effect |
|----|----------------|
| PR-004 | **Low** — validator policy defined before implementation; bypass prohibition maintained |
| PR-005 | **Medium** — Governed / Authorized / Registered / Production Ready distinction explicit for image provider |
| PR-006 | **Medium** — identity mapping closes `image_generation.js` conflation at governance level |
| CL-013 | **Mitigated at governance** — image provider registration policy defined; JSON traceability pending v1.84.0 |
| CL-004 / CL-005 / CL-006 | **Unchanged — deferred** |

---

## G11. Forbidden Scope（REUSE UNCHANGED — per ADR-0017 G11）

Explicitly **preserved** in v1.83.0 and future registration Implementation Release scope boundary:

| Item | Status |
|------|--------|
| Real Provider | **Prohibited** |
| External IO | **Prohibited** |
| Credentials / secrets | **Prohibited** |
| Runtime / Workflow / Event / Scheduler / Automation / publishing | **Prohibited** |
| Human Approval Gate bypass | **Prohibited** |
| Retry / recovery execution | **Not authorized** |
| Provider Production Ready declaration | **Not Declared** |
| Repository-wide L4 declaration | **Not Declared** |
| Review Entry Authorization | **Not Authorized**（image provider） |
| Formal Assessment | **Not Assessed**（image provider） |

---

## G12. Future Implementation Authorization（REUSE WITH ADAPTATION — per ADR-0017 G12）

| Item | Decision |
|------|----------|
| Separate Implementation Release authorized? | **Yes** — v1.84.0 Image Generation Mock Provider Catalog Registration Implementation Release |
| Prerequisites | v1.83.0 Governance Complete + this ADR + Review |
| Implementation scope | `public_contract_catalog.js` validator + `PROVIDER_CONTRACT_DEFINITIONS` additive entry only |
| Not authorized in Implementation Release | Real Provider, schema bump, Application contract changes, `image_generation_mock_provider.js` behavior changes, Production Readiness claims |

**Governance Complete ≠ Catalog Registered**

---

## Architecture Maturity Treatment

| Item | Decision |
|------|----------|
| Numeric maturity | **Level 3.19** — **unchanged** |
| Sub-release label | **Image Generation Mock Provider Catalog Registration Governance Release Complete** |
| Rationale | v1.80.0–v1.82.0 image provider sequence remained on Level 3.19 plateau; no separate maturity governance authorizes numeric increase to 3.20 |
| Level 3.20 | **Not introduced** |

---

## Consequences

### Positive

- Image provider concrete registration policy defined before production catalog changes
- Closed-world multi-mock validator policy explicit — reduces PR-004 bypass risk
- Identity mapping closes PR-006 governance gap for `image_generation.js`
- ADR-0021 catalog deferral closure path established

### Negative / Accepted

- Catalog JSON traceability gap remains until v1.84.0 Implementation Release
- Validator still blocks image mock registration until v1.84.0
- Two-step process（Governance → Implementation）adds release overhead

---

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Register immediately in v1.83.0 | Violates governance-only scope; bypasses validator policy definition |
| Remain deferred indefinitely | Contradicts ADR-0021 Future Gates and Architecture Review DECISION A |
| Separate catalog alias ID | Creates PR-006 duplicate identity risk |
| Normalize `providerVersion` to `1.0` | Violates G2 exact-match-to-implementation rule |
| Schema / catalog version bump | No breaking change justified per ADR-0012 / ADR-0015 precedent |
| Provider Production Ready declaration | Not evidenced; out of scope |
| Broad mock whitelist | Violates closed-world governance boundary |

---

## Compliance

- ADR-0011 additive catalog strategy — **aligned**
- ADR-0012 extension strategy — **aligned**
- ADR-0015 abstract authority — **preserved**
- ADR-0017 precedent — **extended** for image provider
- ADR-0021 Future Gates — **closed at governance level**
- PROVIDER_LAYER_DESIGN.md — **SSOT maintained**
- Application catalog backward compatibility — **maintained**
- Bounded text mock Formal Decision **READY** — **preserved**

---

## Future Gates / Follow-up

| Item | Owner | Release |
|------|-------|---------|
| Image Catalog Registration Implementation | Future Release | v1.84.0 |
| Multi-mock validator policy implementation | Future Release | per G5 |
| Quality Pipeline registration tests | Future Release | post-v1.84.0 implementation |
| Image Provider Production Readiness assessment | **Not scheduled** | separate authorization |

---

## Quality Pipeline

v1.83.0 adds governance evidence tests（Test 1196–1227）.

---

## Related Documents

- [IMAGE_GENERATION_MOCK_PROVIDER_CATALOG_REGISTRATION_GOVERNANCE_REVIEW.md](../architecture/IMAGE_GENERATION_MOCK_PROVIDER_CATALOG_REGISTRATION_GOVERNANCE_REVIEW.md)
- [ADR-0021](./ADR-0021-image-generation-mock-provider-implementation-authorization-decision.md)
- [ADR-0017](./ADR-0017-mock-provider-catalog-registration-governance.md)
- [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md)
