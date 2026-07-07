# ADR-0012: Provider Contract Catalog Extension Strategy

## Status

Accepted（v1.69.0 — Provider Contract Definition Governance）

## Context

[ADR-0011](./ADR-0011-public-contract-catalog-future-layer-scope.md)（v1.68.0）により、Public Contract Catalog の current authority は **Application Layer `extract*PublicContract()`** のみと決定された。Provider Contract Definition Phase では、Provider Production Implementation **前** に additive extension strategy を確定する必要がある。

Provider Layer Contract の **Authority** は既存 [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md) にあり、新しい Contract SSOT を作成してはならない。v1.69.0 は **Governance / Design Evidence** のみ — Catalog 実作業・Provider 実装は禁止。

## Decision

### Prerequisite

本 ADR は **ADR-0011 を前提** とする。ADR-0011 の Application-only catalog authority を **維持** する。

### Current Catalog Authority（v1.69.0 — unchanged）

| Item | Decision |
|------|----------|
| **Current catalog authority** | Application Layer `extract*PublicContract()` registrations **only** |
| **`publicContracts[]` semantics** | **Unchanged** — no field removal, type change, or semantic redefinition |
| **`compatibilityMatrix` semantics** | **Unchanged** |
| **Catalog schema** | **No breaking change** |
| **Catalog generator**（`src/lib/public_contract_catalog.js`） | **No change in v1.69.0** |
| **Catalog JSON / Markdown reports** | **No change in v1.69.0** |
| **Provider Contract registration** | **Deferred** until Governance-approved Catalog extension Release |

### Future Additive Extension Model

Provider Contract は既存 `publicContracts[]` に **混在させない**。

将来の Governance-approved Catalog extension Release では、**additive extension model** として独立配列 `providerContracts[]` を採用する:

```text
public-contract-catalog.json (future extension — NOT v1.69.0) =
  publicContracts[]        — Application Layer extract*PublicContract() [UNCHANGED semantics]
  compatibilityMatrix    — Application Layer matrix [UNCHANGED semantics]
  providerContracts[]    — NEW additive array — Provider Contract registrations only
```

| Rule | Requirement |
|------|-------------|
| **Separation** | Provider contracts **MUST NOT** be registered inside `publicContracts[]` |
| **Additive only** | `providerContracts[]` is **new** — does not modify existing Application entries |
| **Authority reference** | Each provider contract entry references [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md) — no semantic redefinition |
| **Registration gate** | Catalog generator / reports update **only after** ADR-0012 + Governance Release approval |

### Provider Contract Definition Authority

| Rule | Requirement |
|------|-------------|
| **SSOT** | [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md) — Input / Output / Error / Capability / Configuration |
| **No duplicate SSOT** | ADR-0012 / PROVIDER_CONTRACT_DEFINITION_REVIEW are **strategy + evidence** — not contract redefinition |
| **Raw response prohibition** | Provider raw HTTP/SDK response **MUST NOT** appear in contract shapes |
| **Credential exclusion** | Secret / token / credential **MUST NOT** appear in Provider Contract |
| **Non-ownership** | Provider does **not** own Runtime / Scheduler / OAuth authority |

### Deferred Operational Semantics（unchanged）

Cross-layer semantics remain **deferred** per FUTURE_ENTRY_CRITERIA §Deferred Operational Semantics:

| Concern | v1.69.0 Status |
|---------|----------------|
| Cross-layer retry coordination | **Deferred** — no Retry Engine |
| Recovery | **Deferred** — no Recovery Engine |
| Cross-layer idempotency | **Deferred** — ownership ADR required |
| Duplicate interaction handling | **Deferred** — unowned |

**Provider-local retry**（rate limit / auth / retry inside Provider/Adapter per P5）と **cross-layer retry coordination** を **区別** する。v1.69.0 では **retry execution semantics を新規定義しない**。

### Rollback / Supersession

| Condition | Action |
|-----------|--------|
| `providerContracts[]` strategy rejected before Catalog Release | Revert to ADR-0011 Application-only authority; no catalog change |
| Breaking change proposed to `publicContracts[]` | **Reject** — requires separate Major version ADR |
| ADR-0012 superseded | New ADR must preserve Application contract backward compatibility |
| Premature Catalog registration without Governance Release | **Rollback** catalog extension; revert to Application-only reports |

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Register Provider in `publicContracts[]` | Blurs Application authority; breaking semantics risk |
| Catalog extension in v1.69.0 | Generator/reports change prohibited; evidence-only release |
| New Provider Contract SSOT document | Duplicates PROVIDER_LAYER_DESIGN authority |
| Machine-readable runtime schema now | Premature implementation |
| Resolve cross-layer retry in ADR-0012 | Deferred operational semantics boundary violation |
| Mix Provider + Interaction contracts in one array | Authority ambiguity; traceability gap |

## Consequences

### Positive

- P4 Satisfied at governance level — additive `providerContracts[]` strategy documented
- G-24 Satisfied — Provider Entry Criteria aggregate PASS（G-25 excepted）
- CL-013 further mitigated — extension path defined; catalog gap intentional until Release
- Application catalog backward compatibility preserved

### Negative / Remaining Exposure

- Catalog JSON still lacks `providerContracts[]` until future Release
- Generator update deferred — implementation cannot bypass
- G-25 Non-Goals Release still **Not Satisfied**
- Provider Production Implementation **Not Yet Authorized**
- CL-004 / CL-005 / CL-006 exposure **unchanged**

## Compliance Impact

- ARCHITECTURE_COMPLIANCE_CHECKLIST §Provider Contract Definition Governance added
- PROVIDER_LAYER_DESIGN authority maintained — no duplicate SSOT
- P4 / G-24 evidence in PROVIDER_CONTRACT_DEFINITION_REVIEW.md

## Compatibility Impact

- `publicContracts[]` — **no change**
- `compatibilityMatrix` — **no change**
- Future `providerContracts[]` — additive only per COMPATIBILITY_POLICY Minor rules

## Risk Impact

| ID | Impact |
|----|--------|
| CL-013 | Remaining Exposure → **Low–Medium** — extension strategy defined; catalog gap until Release |
| PR-004 | Mitigation updated → ADR-0011 + ADR-0012 bypass prohibition |
| CL-004 / CL-005 / CL-006 | **Unchanged** — deferred |
| PR-002 / PR-005 | **Unchanged** — G-25 blockers |

## Review Trigger

- Governance-approved Catalog extension Release proposed
- `providerContracts[]` schema draft requires COMPATIBILITY_POLICY review
- Provider Production Implementation ADR proposed — requires G-25 Satisfied + catalog Release
- Cross-layer retry ADR affects Provider boundary — update non-ownership table
