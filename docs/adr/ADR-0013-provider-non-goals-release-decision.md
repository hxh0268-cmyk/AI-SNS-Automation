# ADR-0013: Provider Non-Goals Release Decision

## Status

Accepted（v1.70.0 — Provider Non-Goals Release Decision Governance）

## Context

[ADR-0010](./ADR-0010-provider-layer-entry-preparation.md)（v1.68.0）、[ADR-0011](./ADR-0011-public-contract-catalog-future-layer-scope.md)、[ADR-0012](./ADR-0012-provider-contract-catalog-extension-strategy.md)（v1.69.0）により、Provider Entry Preparation と Contract Definition Governance が完了した。G-24（Provider Entry Criteria P1–P6）は **Satisfied** だが、G-25（Non-Goals Release）は v1.69.0 まで **Not Satisfied** であり、[NON_GOALS.md](../architecture/NON_GOALS.md) の Provider 節により Mock / Real Provider 実装は broad Non-Goal として禁止されていた。

v1.70.0 は **Governance / Design Evidence Release のみ**。Provider Production Implementation、Mock Provider 実装、Real Provider 実装、Catalog generator / reports 変更は **禁止**。

## Decision

### Release Type

| Item | Decision |
|------|----------|
| **Release scope** | **Governance only** — Non-Goals Release Decision + evidence artifacts |
| **Production code** | **No change** |
| **Catalog generator / reports** | **No change** |
| **Provider Production Implementation** | **Not Started** |
| **Mock Provider Production Implementation** | **Not Started** |

### Non-Goals Release Scope（Provider target domain only）

**Release Provider Non-Goals only for Mock Provider Level 4 entry preparation gate.**

| Area | v1.70.0 Decision |
|------|------------------|
| **Mock Provider** | Removed from **broad** Non-Goals **only** for future Provider Level 4 implementation gate — **not** immediate implementation authorization |
| **Real Provider external IO** | **Remains prohibited** — LLM / Image / Metrics 等の実接続は Non-Goal のまま |
| **OAuth** | **Prohibited** |
| **SNS API** | **Prohibited** |
| **External API** | **Prohibited** |
| **Database** | **Prohibited** |
| **Queue** | **Prohibited** |
| **Worker** | **Prohibited** |
| **Cloud Runtime** | **Prohibited** |
| **Real Automation** | **Prohibited** |
| **Runtime implementation** | **Prohibited** |
| **Scheduler implementation** | **Prohibited** |
| **Automation implementation** | **Prohibited** |
| **Workflow implementation** | **Prohibited** |
| **Event implementation** | **Prohibited** |
| **Public Contract Catalog extension** | **Deferred** — ADR-0012 `providerContracts[]` registration not in v1.70.0 |

### Mock Provider Implementation Gate

Mock Provider **Production Implementation** requires a **later Provider Level 4 Implementation Ready Decision** — separate governance artifact. v1.70.0 Non-Goals Release **≠** Implementation Ready **≠** implementation authorization.

### Prerequisites（satisfied by prior releases）

| Prerequisite | Evidence |
|--------------|----------|
| ADR-0010 Provider boundaries | [PROVIDER_ENTRY_PREPARATION_REVIEW.md](../architecture/PROVIDER_ENTRY_PREPARATION_REVIEW.md) |
| ADR-0011 Catalog scope | G-26 Satisfied |
| ADR-0012 Contract extension strategy | [PROVIDER_CONTRACT_DEFINITION_REVIEW.md](../architecture/PROVIDER_CONTRACT_DEFINITION_REVIEW.md) |
| P1–P6 / G-24 | v1.69.0 evidence |
| Contract Authority | [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md) |

### In Scope（v1.70.0）

- ADR-0013 acceptance
- [PROVIDER_NON_GOALS_RELEASE_REVIEW.md](../architecture/PROVIDER_NON_GOALS_RELEASE_REVIEW.md) evidence
- [NON_GOALS.md](../architecture/NON_GOALS.md) Provider section update（Mock / Real distinction）
- [FUTURE_ENTRY_CRITERIA.md](../architecture/FUTURE_ENTRY_CRITERIA.md) G-25 → **Satisfied**（Provider domain）
- [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](../architecture/ARCHITECTURE_COMPLIANCE_CHECKLIST.md) Provider Non-Goals Release section
- [RISK_REGISTER.md](../architecture/RISK_REGISTER.md) PR-002 / PR-005 re-evaluation
- VERSION / CHANGELOG / README release documentation

### Out of Scope（v1.70.0 — prohibited）

- `src/` production code changes（except quality pipeline doc checks if required）
- Mock Provider / Real Provider / Adapter implementation
- Runtime / Scheduler / OAuth / External API / DB / Queue / Worker / Cloud Runtime
- Public Contract Catalog generator or JSON / Markdown reports change
- Provider Level 4 Implementation Ready declaration
- Catalog `providerContracts[]` registration

### Rollback / Supersession

| Condition | Action |
|-----------|--------|
| ADR-0013 rejected before merge | Revert NON_GOALS / FUTURE_ENTRY_CRITERIA; G-25 remains Not Satisfied |
| Mock Provider implementation started without L4 Ready Decision | **Reject** — revert implementation; escalate per RISK_REGISTER PR-005 |
| Real Provider external IO attempted | **Reject** — NON_GOALS prohibition remains; PR-002 Critical |
| ADR-0013 superseded | New ADR must preserve Application Layer backward compatibility and Real Provider prohibition unless explicit separate ADR |

### Compatibility Impact

| Surface | Impact |
|---------|--------|
| Application Layer Public Contracts | **Unchanged** |
| `publicContracts[]` / `compatibilityMatrix` | **Unchanged** |
| Catalog generator / reports | **Unchanged** |
| Provider Contract Authority（PROVIDER_LAYER_DESIGN） | **Unchanged** — no semantic redefinition |
| G-23 Universal Entry Criteria | **Not Satisfied** — repository-wide unchanged |

### Risk Impact

| Risk | v1.70.0 Effect |
|------|----------------|
| PR-002 Premature Real Provider IO | **Remains relevant** — Real Provider still prohibited |
| PR-005 Non-Goals skip | **Mitigated** — G-25 Satisfied; reframed as Implementation Ready confusion risk |
| CL-004 / CL-005 / CL-006 | **Unchanged — deferred** |
| CL-013 Catalog traceability | **Unchanged — deferred** extension until Catalog Release |

### Compliance Impact

- NG1–NG6 evaluated in [PROVIDER_NON_GOALS_RELEASE_REVIEW.md](../architecture/PROVIDER_NON_GOALS_RELEASE_REVIEW.md)
- [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](../architecture/ARCHITECTURE_COMPLIANCE_CHECKLIST.md) Provider Non-Goals Release Compliance section added
- G-25 **Satisfied** for Provider target domain
- G-23 **Not Satisfied** repository-wide — Level 4 Implementation Ready **Not Declared**

### Evidence

| Artifact | Role |
|----------|------|
| [PROVIDER_NON_GOALS_RELEASE_REVIEW.md](../architecture/PROVIDER_NON_GOALS_RELEASE_REVIEW.md) | NG1–NG6 + Final Decision |
| [FUTURE_ENTRY_CRITERIA.md](../architecture/FUTURE_ENTRY_CRITERIA.md) | G-25 gate update |
| [NON_GOALS.md](../architecture/NON_GOALS.md) | Mock / Real distinction |
| [RISK_REGISTER.md](../architecture/RISK_REGISTER.md) | PR-002 / PR-005 update |
| Quality Pipeline | Machine check evidence（NG6） |

## Consequences

### Positive

- G-25 **Satisfied** for Provider domain — Non-Goals Release gate cleared at governance level
- Mock Provider path distinguishable from Real Provider prohibition
- Clear boundary: Non-Goals Release ≠ Implementation Ready ≠ implementation start

### Negative / Trade-offs

- Mock Provider broad Non-Goal partial release may be **misread** as implementation authorization — mitigated by explicit Not Started + L4 Ready Decision requirement
- Catalog `providerContracts[]` still not in JSON — intentional deferred gap
- G-23 repository-wide still **Not Satisfied** — Level 4 Implementation Ready **Not Declared**

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Full Provider Non-Goals release（Mock + Real） | Real Provider external IO risk（PR-002 Critical） |
| No Non-Goals change; defer to implementation release | G-25 remains blocker; conflates governance phases |
| Immediate Mock Provider implementation in v1.70.0 | Violates governance-only scope; requires L4 Ready Decision |
| Catalog extension in same release | Out of scope; ADR-0012 defers registration |

## Related Documents

- [ADR-0010](./ADR-0010-provider-layer-entry-preparation.md)
- [ADR-0011](./ADR-0011-public-contract-catalog-future-layer-scope.md)
- [ADR-0012](./ADR-0012-provider-contract-catalog-extension-strategy.md)
- [FUTURE_ENTRY_CRITERIA.md](../architecture/FUTURE_ENTRY_CRITERIA.md)
- [NON_GOALS.md](../architecture/NON_GOALS.md)
- [RISK_REGISTER.md](../architecture/RISK_REGISTER.md)
- [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](../architecture/ARCHITECTURE_COMPLIANCE_CHECKLIST.md)
- [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md)
- [PROVIDER_ENTRY_PREPARATION_REVIEW.md](../architecture/PROVIDER_ENTRY_PREPARATION_REVIEW.md)
- [PROVIDER_CONTRACT_DEFINITION_REVIEW.md](../architecture/PROVIDER_CONTRACT_DEFINITION_REVIEW.md)
- [PROVIDER_NON_GOALS_RELEASE_REVIEW.md](../architecture/PROVIDER_NON_GOALS_RELEASE_REVIEW.md)
