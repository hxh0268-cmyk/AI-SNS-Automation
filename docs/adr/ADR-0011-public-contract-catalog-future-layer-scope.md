# ADR-0011: Public Contract Catalog Future Layer Scope

## Status

Accepted（v1.68.0 — Provider Entry Preparation Governance）

## Context

v1.48.0 以降、Public Contract Catalog（`reports/public-contract-catalog/latest/public-contract-catalog.json`）は **Application Layer** `extract*PublicContract()` 関数を authority として登録している。

v1.67.0 Formal Level 4 Entry Review（Conditionally Ready）により、First Target Domain = Provider Layer Entry Preparation が決定された。CL-013（Public Contract traceability gap）および G-26（Catalog scope decision）は **intentional deferral** として記録されていたが、Provider Entry Preparation フェーズで **scope decision を公式化** する必要がある。

Provider Production Implementation 前に、Catalog への Future Layer contract 追加方針を決定し、**v1.68.0 では Catalog 実作業を行わない**。

## Decision

### Current Catalog Authority（v1.68.0 — unchanged）

| Item | Authority |
|------|-----------|
| **Catalog scope** | **Application Layer `extract*PublicContract()` only** |
| **Catalog JSON / Markdown / generator** | **No changes in v1.68.0** |
| **Future Layer contracts** | **Not registered** |
| **Provider contracts** | **Not registered** |
| **Interaction / Cross Layer contracts** | **Not registered** |

```text
public-contract-catalog.json authority (v1.68.0) =
  Application Layer extract*PublicContract() registrations ONLY
```

### What v1.68.0 Does NOT Do

- Catalog schema change
- Catalog generator（`src/lib/public_contract_catalog.js`）change
- `reports/public-contract-catalog/latest/*` regeneration or content change
- Future Layer / Provider / Interaction contract registration
- Machine-readable runtime schema creation

### Provider Contract Definition Phase（future — after v1.68.0）

Before Provider Production Implementation, a **Contract Definition Phase** MUST evaluate:

| Step | Requirement |
|------|-------------|
| 1 | Provider Output Contract shape defined（Design + ADR） |
| 2 | **Additive extension strategy** for Catalog — no breaking changes to Application contracts |
| 3 | Compatibility Review per COMPATIBILITY_POLICY |
| 4 | Dedicated Catalog extension ADR or amendment to ADR-0011 |
| 5 | Catalog generator / reports update **only after** governance approval |

**Additive extension strategy（planned, not executed）:**

- New Provider contracts added as **new catalog entries** — not replacing Application entries
- Application Layer contracts remain backward compatible
- Optional fields only for existing contracts; no removal or type change

### G-26 / CL-013 Resolution（Governance Level）

| ID | Before v1.68.0 | After v1.68.0 |
|----|----------------|---------------|
| **G-26** | Partially Satisfied | **Satisfied** — scope decision recorded（本 ADR） |
| **CL-013** | High exposure — intentional deferral | **Mitigated at governance** — decision + additive strategy documented; **catalog gap remains until Contract Definition Phase** |

**CL-013 is not "resolved"** — traceability gap in catalog JSON persists by design until Contract Definition Phase execution.

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Add Provider contracts to Catalog in v1.68.0 | No contract shapes finalized; generator change prohibited |
| Extend Catalog to all Future Layer designs | Scope explosion; Application authority blurred |
| Defer scope decision further | G-26 blocked; Provider prep incomplete |
| Repository-wide catalog Major version bump | No implementation scope; premature |

## Consequences

### Positive

- G-26 Satisfied at governance level
- CL-013 mitigation path documented
- Catalog generator / reports protected from premature change
- Provider P4 "registration plan" satisfied at planning level（ADR-0010）

### Negative / Remaining Exposure

- Catalog JSON still lacks Future Layer / Provider entries
- Contract Definition Phase work remains before implementation
- Additive extension **not validated** until generator update + CI pass
- Implementation MUST NOT bypass Catalog governance

## Review Trigger

- Provider Contract Definition Phase start — evaluate additive extension ADR
- Catalog schema Major change proposed — COMPATIBILITY_POLICY review
- Interaction / Cross Layer contract registration request — separate scope ADR
- Application contract breaking change pressure — reject or Major version per VERSIONING_POLICY
