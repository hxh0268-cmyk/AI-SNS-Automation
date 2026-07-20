# Architecture Decisions

Architecture Decision Record（ADR）形式で採用判断を記録する Architecture Governance 基準書です。

---

## ADR Format

新 ADR は `docs/adr/ADR-NNNN-{slug}.md` に追加します。

```markdown
# ADR-NNNN: Title

## Status
Accepted | Deprecated | Superseded

## Context
背景と問題

## Decision
採用した判断

## Alternatives Considered
検討した他案

## Consequences
正の結果 / 負の結果 / リスク

## Review Trigger
将来見直す条件
```

---

## Accepted Decisions

### v1.49.0 Primary Decisions

v1.49.0 Architecture Documentation Foundation の **主要 ADR（最低 3 件）**:

#### ADR-GOV-005: Architecture Documentation = Governance

| 項目 | 内容 |
|------|------|
| **Status** | Accepted（v1.49.0） |
| **Context** | Catalog だけでは変更判断・Non-Goal・Future 設計の公式基準が不足 |
| **Decision** | `docs/architecture/` を Architecture Governance **正式基準書** とする（README 補足ではない） |
| **Alternatives** | README only / wiki / external Confluence |
| **Consequences** | 17 必須 Governance 文書の保守コスト。Claude Code First 判断基準の一元化 |
| **Review Trigger** | v2 Provider 実装開始時に Governance Flow 文書追加検討 |

#### ADR-GOV-006: Future Architecture is Design Only

| 項目 | 内容 |
|------|------|
| **Status** | Accepted（v1.49.0） |
| **Context** | Provider / Runtime 実装圧力と Governance 完成タイミングの衝突 |
| **Decision** | Future Layer は [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) に **設計のみ** 記述。実装は [NON_GOALS.md](./NON_GOALS.md) で禁止 |
| **Alternatives** | v1.49 で Provider MVP 着手 / 設計文書なしで口頭判断 |
| **Consequences** | v2 Epic まで実装延期。境界明確化 |
| **Review Trigger** | v2.0-design Epic 承認時 |

#### ADR-GOV-007: Public Contract Catalog as Change Decision Entry Point

| 項目 | 内容 |
|------|------|
| **Status** | Accepted（v1.49.0） |
| **Context** | 文書のみでは Contract / Matrix drift が検出困難 |
| **Decision** | 変更判断時は **Public Contract Catalog JSON** を最初の入口とし、続けて Mandatory Policy Review を実施 |
| **Alternatives** | docs-only review / ad-hoc grep |
| **Consequences** | `npm run public-contract:catalog` 再生成が変更フローに組み込まれる |
| **Review Trigger** | Catalog schema Major 変更時 |

---

### Historical Decisions

#### ADR-GOV-001: Public Contract First

| 項目 | 内容 |
|------|------|
| **Status** | Accepted |
| **Context** | Foundation 間の内部結合が増加し、変更コストが肥大化 |
| **Decision** | 下流は upstream `extract*PublicContract()` のみ参照 |
| **Alternatives** | 共有 lib 直接 import / monolith builder |
| **Consequences** | boilerplate 増加。変更局所化・テスト容易性向上 |
| **Review Trigger** | Performance 問題が Public Contract 経由で解決不能な場合 |

#### ADR-GOV-002: JSON Source Markdown View CLI Summary

| 項目 | 内容 |
|------|------|
| **Status** | Accepted |
| **Context** | 出力形式乱立リスク |
| **Decision** | JSON = Source / Markdown = View / CLI = Summary 固定 |
| **Alternatives** | Markdown first / DB first |
| **Consequences** | artifact ファイル増加。Machine Readable 一貫性 |
| **Review Trigger** | Real-time streaming 要件発生時 |

#### ADR-GOV-003: Platform Application Layer Separation

| 項目 | 内容 |
|------|------|
| **Status** | Accepted |
| **Context** | Developer Automation と SNS Content の関心混在 |
| **Decision** | Platform v1.40 Completed。Application v1.47 Completed。相互非依存 |
| **Alternatives** | 単一 Layer / shared internal modules |
| **Consequences** | 2 パイプライン維持。Provider 追加時の境界明確 |
| **Review Trigger** | 統合 UX 要件が Layer 分離コストを上回る場合 |

#### ADR-GOV-004: Public Contract Catalog as Machine Readable Governance

| 項目 | 内容 |
|------|------|
| **Status** | Accepted（v1.48.0） |
| **Context** | 7 Foundation 完成後、Contract 一覧が文書のみでは drift リスク |
| **Decision** | `public-contract-catalog.json` を Governance Source とする |
| **Alternatives** | docs-only / JSON Schema registry 外部サービス |
| **Consequences** | Catalog generator 保守。CI 検証可能 |
| **Review Trigger** | Foundation 数 > 20 で Catalog schema Major 検討 |

---

## Related ADRs

Platform / Application 個別 ADR は `docs/adr/` を参照:

- [ADR-0007](../adr/ADR-0007-developer-analytics-layer-architecture.md) — Developer Analytics Layer
- [ADR-0008](../adr/ADR-0008-dashboard-public-contract.md) — Dashboard Public Contract
- [ADR-0009](../adr/ADR-0009-level-4-entry-strategy.md) — Level 4 Entry Strategy（v1.67.0）
- [ADR-0010](../adr/ADR-0010-provider-layer-entry-preparation.md) — Provider Layer Entry Preparation（v1.68.0）
- [ADR-0011](../adr/ADR-0011-public-contract-catalog-future-layer-scope.md) — Public Contract Catalog Future Layer Scope（v1.68.0）

### v1.67.0 Level 4 Entry Review Decision

| 項目 | 内容 |
|------|------|
| **Status** | Accepted（v1.67.0） |
| **Context** | v1.66.0 governance baseline; Formal Level 4 Entry Review required before domain entry |
| **Decision** | Domain-based Incremental Level 4 Entry; First Target Domain = Provider Layer Entry Preparation |
| **Alternatives** | Repository-wide Level 4 unlock — rejected |
| **Consequences** | Entry path approved conditionally; Production Implementation prohibited; Catalog scope ADR deferred |
| **Review Trigger** | Provider Entry Preparation completion |

Full record: [LEVEL_4_ENTRY_REVIEW.md](./LEVEL_4_ENTRY_REVIEW.md) + [ADR-0009](../adr/ADR-0009-level-4-entry-strategy.md)

### v1.68.0 Provider Entry Preparation Governance

| 項目 | 内容 |
|------|------|
| **Status** | Accepted（v1.68.0） |
| **Context** | v1.67.0 Conditionally Ready; First Target Domain = Provider Entry Preparation |
| **Decision** | ADR-0010 Provider prep boundaries; ADR-0011 Catalog scope; Production Implementation prohibited |
| **Alternatives** | Immediate Provider impl / Catalog extension now — rejected |
| **Consequences** | Provider Entry Preparation Governance Complete; G-26 Satisfied; G-25 Not Satisfied（Reason: Pending separate Provider Non-Goals Release Decision） |
| **Review Trigger** | Non-Goals Release ADR / Contract Definition Phase |

- [ADR-0012](../adr/ADR-0012-provider-contract-catalog-extension-strategy.md) — Provider Contract Catalog Extension Strategy（v1.69.0）
- [ADR-0013](../adr/ADR-0013-provider-non-goals-release-decision.md) — Provider Non-Goals Release Decision（v1.70.0）
- [ADR-0014](../adr/ADR-0014-provider-level-4-implementation-ready-decision.md) — Provider Level 4 Implementation Ready Decision（v1.71.0）
- [ADR-0015](../adr/ADR-0015-provider-public-contract-catalog-extension-release.md) — Provider Public Contract Catalog Extension Release（v1.72.0）
- [ADR-0016](../adr/ADR-0016-mock-provider-production-implementation-authorization.md) — Mock Provider Production Implementation Authorization Decision（v1.73.0）
- [ADR-0017](../adr/ADR-0017-mock-provider-catalog-registration-governance.md) — Mock Provider Catalog Registration Governance Decision（v1.75.0）
- [ADR-0018](../adr/ADR-0018-provider-production-readiness-review-governance.md) — Provider Production Readiness Review Governance Decision（v1.77.0）
- [ADR-0019](../adr/ADR-0019-provider-expansion-entry-governance.md) — Provider Expansion Entry Governance Decision（v1.79.0）
- [ADR-0020](../adr/ADR-0020-image-generation-mock-provider-expansion-entry-decision.md) — Image Generation Mock Provider Expansion Entry Decision（v1.80.0）
- [ADR-0022](../adr/ADR-0022-image-generation-mock-provider-catalog-registration-governance.md) — Image Generation Mock Provider Catalog Registration Governance Decision（v1.83.0）
- [ADR-0021](../adr/ADR-0021-image-generation-mock-provider-implementation-authorization-decision.md) — Image Generation Mock Provider Implementation Authorization Decision（v1.81.0）
- [ADR-0023](../adr/ADR-0023-repository-baseline-inventory-authority.md) — Repository Baseline Inventory Authority Decision（Accepted — v1.86.0 **Released**; v1.86.1 Identity Reconciliation **Released**; v1.86.2 released-state reconciliation **Released**; v1.86.3 released-state reconciliation **Released**; v1.86.4 released-state reconciliation **Released**; v1.86.5 released-state reconciliation **Released**; v1.86.6 released-state reconciliation **Released**; corrective v1.86.7 Implementation）

### Decision Chain（Provider Domain — v1.68.0–v1.75.0）

```text
ADR-0010 Provider Entry Preparation
  → ADR-0011 Catalog scope（Application-only authority）
    → ADR-0012 providerContracts[] additive extension strategy
      → PROVIDER_CONTRACT_DEFINITION_REVIEW（evidence — not SSOT）
        → ADR-0013 Provider Non-Goals Release（Mock partial release only）
          → PROVIDER_NON_GOALS_RELEASE_REVIEW（evidence）
            → ADR-0014 Provider Level 4 Implementation Ready（domain-specific Declared）
              → PROVIDER_LEVEL_4_IMPLEMENTATION_READY_REVIEW（evidence）
                → ADR-0015 Provider Public Contract Catalog Extension Release
                  → PROVIDER_PUBLIC_CONTRACT_CATALOG_EXTENSION_REVIEW（evidence）
                    → ADR-0016 Mock Provider Production Implementation Authorization
                      → MOCK_PROVIDER_PRODUCTION_IMPLEMENTATION_AUTHORIZATION_REVIEW（evidence）
                        → Mock Provider Production Implementation Release（v1.74.0 — code）
                          → ADR-0017 Mock Provider Catalog Registration Governance
                            → MOCK_PROVIDER_CATALOG_REGISTRATION_GOVERNANCE_REVIEW（evidence）
                              → v1.76.0 Mock Provider Catalog Registration Implementation
                              → v1.77.0 Provider Production Readiness Review Governance
                              → Future: Provider Production Readiness formal assessment
```

### v1.69.0 Provider Contract Definition Governance

| 項目 | 内容 |
|------|------|
| **Status** | Accepted（v1.69.0） |
| **Context** | v1.68.0 Provider Entry Preparation Complete; P4 Partially Satisfied; catalog unchanged |
| **Decision** | `providerContracts[]` additive strategy; PROVIDER_LAYER_DESIGN authority maintained; catalog unchanged |
| **Alternatives** | Provider in publicContracts[] / catalog change now — rejected |
| **Consequences** | P4 Satisfied; G-24 Satisfied; G-25 Not Satisfied; Provider Production Not Yet Authorized |
| **Review Trigger** | Catalog extension Release / Provider Non-Goals Release ADR |

Full record: [PROVIDER_CONTRACT_DEFINITION_REVIEW.md](./PROVIDER_CONTRACT_DEFINITION_REVIEW.md) + [ADR-0012](../adr/ADR-0012-provider-contract-catalog-extension-strategy.md)

### v1.70.0 Provider Non-Goals Release Decision Governance

| 項目 | 内容 |
|------|------|
| **Status** | Accepted（v1.70.0） |
| **Context** | v1.69.0 Contract Definition Complete; G-25 Not Satisfied; Provider broad Non-Goals |
| **Decision** | Mock Provider broad Non-Goal partial release only; Real Provider prohibited; Production Not Started |
| **Alternatives** | Full Provider release / immediate Mock impl — rejected |
| **Consequences** | G-25 Satisfied; L4 Implementation Ready Not Declared; G-23 Not Satisfied |
| **Review Trigger** | Provider Level 4 Implementation Ready Review |

Full record: [PROVIDER_NON_GOALS_RELEASE_REVIEW.md](./PROVIDER_NON_GOALS_RELEASE_REVIEW.md) + [ADR-0013](../adr/ADR-0013-provider-non-goals-release-decision.md)

### v1.71.0 Provider Level 4 Implementation Ready Decision Governance

| 項目 | 内容 |
|------|------|
| **Status** | Accepted（v1.71.0） |
| **Context** | v1.70.0 Non-Goals Release Complete; G-24/25/26 Satisfied; G-23 Not Satisfied |
| **Decision** | Provider domain L4 Implementation Ready **Declared**; repository-wide **Not Declared**; Production Not Started |
| **Alternatives** | Repository-wide L4 / Mock impl in same release — rejected |
| **Consequences** | U1–U8 Satisfied; Catalog Extension prerequisite; PR-005 reframed |
| **Review Trigger** | Catalog Extension Release / Mock Provider Production Implementation |

Full record: [PROVIDER_LEVEL_4_IMPLEMENTATION_READY_REVIEW.md](./PROVIDER_LEVEL_4_IMPLEMENTATION_READY_REVIEW.md) + [ADR-0014](../adr/ADR-0014-provider-level-4-implementation-ready-decision.md)

### v1.72.0 Provider Public Contract Catalog Extension Release

| 項目 | 内容 |
|------|------|
| **Status** | Accepted（v1.72.0） |
| **Context** | v1.71.0 L4 Ready Declared; Catalog Extension prerequisite documented; `providerContracts[]` deferred |
| **Decision** | Additive `providerContracts[]` registration — abstract authority only; Application catalog unchanged |
| **Alternatives** | Mock Provider registration / schema 2.0 / publicContracts[] mix — rejected |
| **Consequences** | CL-013 mitigated; PR-004 mitigated; Production still Not Started |
| **Review Trigger** | Mock Provider Production Implementation Release |

Full record: [PROVIDER_PUBLIC_CONTRACT_CATALOG_EXTENSION_REVIEW.md](./PROVIDER_PUBLIC_CONTRACT_CATALOG_EXTENSION_REVIEW.md) + [ADR-0015](../adr/ADR-0015-provider-public-contract-catalog-extension-release.md)

### v1.73.0 Mock Provider Production Implementation Authorization Governance

| 項目 | 内容 |
|------|------|
| **Status** | Accepted（v1.73.0） |
| **Context** | v1.72.0 Catalog Extension Complete; Mock Production Not Authorized; Provider Production Implementation ADR gap |
| **Decision** | Mock Provider Production Implementation **Authorized** — future separate Implementation Release; **Not Started** |
| **Alternatives** | Bundle Mock impl / concrete catalog registration now — rejected |
| **Consequences** | PR-005 reframed; PR-006 added; concrete catalog registration Decision B deferred |
| **Review Trigger** | Mock Provider Production Implementation Release（code）/ concrete catalog registration |

Full record: [MOCK_PROVIDER_PRODUCTION_IMPLEMENTATION_AUTHORIZATION_REVIEW.md](./MOCK_PROVIDER_PRODUCTION_IMPLEMENTATION_AUTHORIZATION_REVIEW.md) + [ADR-0016](../adr/ADR-0016-mock-provider-production-implementation-authorization.md)

### v1.75.0 Mock Provider Catalog Registration Governance

| 項目 | 内容 |
|------|------|
| **Decision** | Mock Provider Catalog Registration **Governed** + **Authorized** — concrete registration policy defined |
| **ADR** | [ADR-0017](../adr/ADR-0017-mock-provider-catalog-registration-governance.md) |
| **Review** | [MOCK_PROVIDER_CATALOG_REGISTRATION_GOVERNANCE_REVIEW.md](./MOCK_PROVIDER_CATALOG_REGISTRATION_GOVERNANCE_REVIEW.md) |
| **Consequences** | ADR-0016 Decision B closed at governance level; validator policy defined; catalog registration **Not Started** |
| **Review Trigger** | Mock Provider Catalog Registration Implementation Release |

Full record: [MOCK_PROVIDER_CATALOG_REGISTRATION_GOVERNANCE_REVIEW.md](./MOCK_PROVIDER_CATALOG_REGISTRATION_GOVERNANCE_REVIEW.md) + [ADR-0017](../adr/ADR-0017-mock-provider-catalog-registration-governance.md)

### v1.76.0 Mock Provider Catalog Registration Implementation

| Item | Decision |
|------|----------|
| **Decision** | Mock Provider Catalog Registration **Implemented** + **Registered** — governed concrete entry in `providerContracts[]` |
| **ADR** | [ADR-0017](../adr/ADR-0017-mock-provider-catalog-registration-governance.md) G5 |
| **Scope** | `text-generation-mock-provider` only — abstract authority preserved |
| **Review Trigger** | follow-on Provider Layer work per Architecture Review |

Full record: [CHANGELOG.md](../CHANGELOG.md) §v1.76.0 + `src/lib/public_contract_catalog.js`

### v1.77.0 Provider Production Readiness Review Governance

| Item | Decision |
|------|----------|
| **Decision** | Provider Production Readiness Review Entry **Authorized** — governance framework established |
| **ADR** | [ADR-0018](../adr/ADR-0018-provider-production-readiness-review-governance.md) |
| **Review** | [PROVIDER_PRODUCTION_READINESS_REVIEW.md](./PROVIDER_PRODUCTION_READINESS_REVIEW.md) |
| **Consequences** | Assessment In Progress; Production Ready **Not Declared**; production code unchanged |
| **Review Trigger** | Provider Production Readiness formal assessment |

Full record: [PROVIDER_PRODUCTION_READINESS_REVIEW.md](./PROVIDER_PRODUCTION_READINESS_REVIEW.md) + [ADR-0018](../adr/ADR-0018-provider-production-readiness-review-governance.md)

### Post–v1.77.0 Assessment Preparation — DECISION B PPRR-F001 Remediation

| Item | Decision |
|------|----------|
| **Decision** | **DECISION B — Remediation Required** before Formal Readiness Decision |
| **Finding** | PPRR-F001 — abstract authority profile validation gap |
| **Disposition** | **Option 1 — Full-Profile Validator Implementation**（`GOVERNED_ABSTRACT_AUTHORITY_SCOPE`） |
| **Rejected** | Option 2 alone（documentation ambiguity）; Option 3 alone（risk acceptance） |
| **Scope** | Validator remediation only — schema/catalogVersion frozen; Mock Provider unchanged |
| **Consequences** | PPRR-F001 remediated; Formal Readiness Decision resumes after validation |

Full record: [PROVIDER_PRODUCTION_READINESS_REVIEW.md](./PROVIDER_PRODUCTION_READINESS_REVIEW.md) §Architecture Review Decision — Assessment Preparation

### Post–DECISION C — Formal Provider Production Readiness Assessment

| Item | Decision |
|------|----------|
| **Decision** | **DECISION C — PPRR-F001 Remediation Accepted** |
| **Formal Assessment** | **READY**（bounded canonical Mock Provider scope） |
| **Assessment date** | 2026-07-10 |
| **D1–D13** | All **SATISFIED** for bounded scope |
| **PPRR-F001** | **CLOSED AS REMEDIATED FOR THE BOUNDED MOCK PROVIDER ASSESSMENT** |
| **Provider Production Ready（global）** | **Not Declared** |
| **Repository-wide Level 4** | **Not Declared** |
| **Consequences** | Bounded Mock Provider meets assessed criteria; Real Provider / External IO remain prohibited |

Full record: [PROVIDER_PRODUCTION_READINESS_REVIEW.md](./PROVIDER_PRODUCTION_READINESS_REVIEW.md) §Formal Provider Production Readiness Assessment

### Post–DECISION D — Formal Assessment Acceptance（v1.78.0）

| Item | Decision |
|------|----------|
| **Decision** | **DECISION D — FORMAL PROVIDER PRODUCTION READINESS ASSESSMENT ACCEPTED** |
| **Release** | v1.78.0 — Provider Production Readiness Assessment Decision Release |
| **Formal Decision** | **READY**（bounded canonical Mock Provider scope） |
| **Maturity** | **Level 3.19** |
| **Provider Production Ready（global）** | **Not Declared** |
| **Repository-wide Level 4** | **Not Declared** |
| **Consequences** | Release candidate prepared; Human Approval Gate preserved |

Full record: [PROVIDER_PRODUCTION_READINESS_REVIEW.md](./PROVIDER_PRODUCTION_READINESS_REVIEW.md) §Architecture Review Decision — Formal Assessment Acceptance

### Post–DECISION F — Provider Expansion Entry Governance（v1.79.0）

| Item | Decision |
|------|----------|
| **Decision** | **DECISION F — ESTABLISH PROVIDER EXPANSION ENTRY GOVERNANCE** |
| **Release** | v1.79.0 — Provider Expansion Entry Governance Release |
| **ADR** | [ADR-0019](../adr/ADR-0019-provider-expansion-entry-governance.md) |
| **Review** | [PROVIDER_EXPANSION_ENTRY_REVIEW.md](./PROVIDER_EXPANSION_ENTRY_REVIEW.md) |
| **Scope** | Governance-only — expansion taxonomy / entry criteria / blocking conditions |
| **Expansion Entry Authorization** | **Not Granted**（per-candidate — future） |
| **Implementation Authorization** | **Not Granted** |
| **Maturity** | **Level 3.19**（unchanged） |
| **Bounded Mock Formal Decision READY** | **Preserved**（v1.78.0） |
| **Provider Production Ready（global）** | **Not Declared** |
| **Repository-wide Level 4** | **Not Declared** |
| **Consequences** | Expansion framework established; Real Provider / External IO remain prohibited |

Full record: [PROVIDER_EXPANSION_ENTRY_REVIEW.md](./PROVIDER_EXPANSION_ENTRY_REVIEW.md) + [ADR-0019](../adr/ADR-0019-provider-expansion-entry-governance.md)

### Post–DECISION G — Image Generation Mock Provider Expansion Entry Authorization（v1.80.0）

| Item | Decision |
|------|----------|
| **Decision** | **DECISION G — GRANT BOUNDED PROVIDER EXPANSION ENTRY AUTHORIZATION** |
| **Release** | v1.80.0 — Image Generation Mock Provider Expansion Entry Decision Governance Release |
| **ADR** | [ADR-0020](../adr/ADR-0020-image-generation-mock-provider-expansion-entry-decision.md) |
| **Review** | [IMAGE_GENERATION_MOCK_PROVIDER_EXPANSION_ENTRY_REVIEW.md](./IMAGE_GENERATION_MOCK_PROVIDER_EXPANSION_ENTRY_REVIEW.md) |
| **Candidate** | `image-generation-mock-provider`（Class 1） |
| **Expansion Entry Authorization** | **Granted**（bounded — per-candidate only） |
| **Implementation Authorization** | **Not Granted** |
| **Catalog registration** | **Not Authorized** |
| **Maturity** | **Level 3.19**（unchanged） |
| **Bounded text mock READY** | **Preserved** |
| **Provider Production Ready（global）** | **Not Declared** |
| **Repository-wide Level 4** | **Not Declared** |
| **Consequences** | Per-candidate entry authorized; implementation / catalog / IO remain prohibited |

Full record: [IMAGE_GENERATION_MOCK_PROVIDER_EXPANSION_ENTRY_REVIEW.md](./IMAGE_GENERATION_MOCK_PROVIDER_EXPANSION_ENTRY_REVIEW.md) + [ADR-0020](../adr/ADR-0020-image-generation-mock-provider-expansion-entry-decision.md)

### Post–DECISION H — Image Generation Mock Provider Implementation Authorization（v1.81.0）

| Item | Decision |
|------|----------|
| **Decision** | **DECISION H — GRANT BOUNDED IMPLEMENTATION AUTHORIZATION** |
| **Release** | v1.81.0 — Image Generation Mock Provider Implementation Authorization Governance Release |
| **ADR** | [ADR-0021](../adr/ADR-0021-image-generation-mock-provider-implementation-authorization-decision.md) |
| **Review** | [IMAGE_GENERATION_MOCK_PROVIDER_IMPLEMENTATION_AUTHORIZATION_REVIEW.md](./IMAGE_GENERATION_MOCK_PROVIDER_IMPLEMENTATION_AUTHORIZATION_REVIEW.md) |
| **Candidate** | `image-generation-mock-provider`（Class 1 — mock） |
| **Implementation Authorization** | **Granted**（bounded — per-candidate only） |
| **Implementation execution** | **Not Started** |
| **Catalog registration** | **Not Authorized** |
| **Maturity** | **Level 3.19**（unchanged） |
| **Bounded text mock READY** | **Preserved** |
| **Provider Production Ready（global）** | **Not Declared** |
| **Repository-wide Level 4** | **Not Declared** |
| **Consequences** | Future implementation authorized; catalog / IO / integration remain prohibited |

Full record: [IMAGE_GENERATION_MOCK_PROVIDER_IMPLEMENTATION_AUTHORIZATION_REVIEW.md](./IMAGE_GENERATION_MOCK_PROVIDER_IMPLEMENTATION_AUTHORIZATION_REVIEW.md) + [ADR-0021](../adr/ADR-0021-image-generation-mock-provider-implementation-authorization-decision.md)

### Post–ADR-0022 — Image Generation Mock Provider Catalog Registration Governance（v1.83.0）

| Item | Decision |
|------|----------|
| **Release** | v1.83.0 — Image Generation Mock Provider Catalog Registration Governance Release |
| **ADR** | [ADR-0022](../adr/ADR-0022-image-generation-mock-provider-catalog-registration-governance.md) |
| **Review** | [IMAGE_GENERATION_MOCK_PROVIDER_CATALOG_REGISTRATION_GOVERNANCE_REVIEW.md](./IMAGE_GENERATION_MOCK_PROVIDER_CATALOG_REGISTRATION_GOVERNANCE_REVIEW.md) |
| **Candidate** | `image-generation-mock-provider` / `1.0.0` / `image_generation` |
| **Catalog Registration Governance** | **Complete** |
| **Catalog Registration** | **Authorized / Not Started** |
| **Catalog Registered** | **NO** |
| **Closed-world multi-mock validator** | **Governed** — not implemented |
| **Maturity** | **Level 3.19**（unchanged — sub-release label） |
| **Bounded text mock READY** | **Preserved** |
| **Provider Production Ready（global）** | **Not Declared** |
| **Repository-wide Level 4** | **Not Declared** |
| **Consequences** | Registration policy defined; v1.84.0 implementation authorized; catalog / IO / Production Ready remain prohibited |

Full record: [IMAGE_GENERATION_MOCK_PROVIDER_CATALOG_REGISTRATION_GOVERNANCE_REVIEW.md](./IMAGE_GENERATION_MOCK_PROVIDER_CATALOG_REGISTRATION_GOVERNANCE_REVIEW.md) + [ADR-0022](../adr/ADR-0022-image-generation-mock-provider-catalog-registration-governance.md)

### Post–ADR-0022 — Image Generation Mock Provider Catalog Registration Implementation（v1.84.0）

| Item | Decision |
|------|----------|
| **Release** | v1.84.0 — Image Generation Mock Provider Catalog Registration Implementation Release |
| **ADR** | [ADR-0022](../adr/ADR-0022-image-generation-mock-provider-catalog-registration-governance.md) |
| **Candidate** | `image-generation-mock-provider` / `1.0.0` / `image_generation` |
| **Catalog Registration Governance** | **Complete** |
| **Catalog Registration** | **Registered** |
| **Catalog Registered** | **YES** |
| **Closed-world two-ID validator** | **Implemented** |
| **Maturity** | **Level 3.19**（unchanged — sub-release label） |
| **Bounded text mock READY** | **Preserved** |
| **Provider Production Ready（global）** | **Not Declared** |
| **Repository-wide Level 4** | **Not Declared** |
| **Consequences** | Image provider catalog JSON traceability implemented; provider modules / IO / Production Ready remain prohibited |

Full record: [ADR-0022](../adr/ADR-0022-image-generation-mock-provider-catalog-registration-governance.md) — G12 implementation in `src/lib/public_contract_catalog.js`

### Post–ADR-0023 — Repository Baseline Inventory Authority（v1.86.0 Released; v1.86.1 Identity Reconciliation Released; v1.86.2 / v1.86.3 / v1.86.4 / v1.86.5 / v1.86.6 Released-State Reconciliation Released）

| Item | Decision |
|------|----------|
| **ADR** | [ADR-0023](../adr/ADR-0023-repository-baseline-inventory-authority.md) |
| **Status** | Accepted（v1.86.0 — Repository Baseline Inventory Authority Governance — **Released**; v1.86.1 Identity Reconciliation — **Released**; v1.86.2 released-state reconciliation — **Released**; v1.86.3 released-state reconciliation — **Released**; v1.86.4 released-state reconciliation — **Released**; v1.86.5 released-state reconciliation — **Released**; v1.86.6 released-state reconciliation — **Released**） |
| **Operational specification** | [BASELINE_SYNCHRONIZATION.md](./BASELINE_SYNCHRONIZATION.md) — Inventory Model / Current Baseline Record / Synchronization Matrix SSOT |
| **Decision** | Adopt Repository Baseline Inventory Authority hierarchy; Current Baseline Record is sole operational authority for recorded baseline values |
| **Authority model** | Repository Baseline Inventory Authority → Current Baseline Record → Synchronization Matrix → Required Derived Targets |
| **Derived targets** | Receive values from the Current Baseline Record only; do not redefine Record field meanings |
| **Reverse synchronization** | **Prohibited** |
| **Distinctions preserved** | Schema / Inventory Model ≠ Current Recorded Values ≠ Pending Release Values ≠ Derived Evidence ≠ Git Evidence ≠ Quality Enforcement |
| **Current Baseline Record population** | **Complete** for released baseline `v1.86.6`（authorized Record values in [BASELINE_SYNCHRONIZATION.md](./BASELINE_SYNCHRONIZATION.md) §6.2.2 — commit `bb26dff…` / tag `v1.86.6`） |
| **Repository-wide Synchronization** | **Complete** under released `v1.86.6`; corrective **v1.86.7** released-state reconciliation current phase **Implementation** / **Not Declared** |
| **Quality Enforcement Correction** | **Complete** — Tests 988 / 1026 / 1034 remediated; Quality **1232 PASS**; D-006 **Remediated**; Independent Review Complete — Decision **A. GO** |
| **v1.86.0 Release** | **Released** — Commit / Tag / Push **Complete**; remote synchronized |
| **v1.86.1 Corrective Release** | **Released** — Commit / Tag / Push **Complete**; Post-Push Review **Complete**; remote synchronized |
| **v1.86.2 Corrective Release** | **Released** — Commit / Tag / Push **Complete**; Post-Push Review **Complete**; remote synchronized |
| **v1.86.3 Corrective Release** | **Released** — Commit / Tag / Push **Complete**; Post-Push Review **Complete**; remote synchronized |
| **v1.86.4 Corrective Release** | **Released** — Commit / Tag / Push **Complete**; Post-Push Review **Complete**; remote synchronized |
| **v1.86.5 Corrective Release** | **Released** — Commit / Tag / Push **Complete**; Post-Push Review **Complete**; remote synchronized |
| **v1.86.6 Corrective Release** | **Released** — Commit / Tag / Push **Complete**; Post-Push Review **Complete**; remote synchronized |
| **v1.86.7 Corrective Release** | **Implementation / Not Declared** — Commit / Tag / Push **Pending** |
| **Provider Production Ready（global）** | **Not Declared** |
| **Repository-wide Level 4** | **Not Declared** |
| **Consequences** | Decision index discovers ADR-0023; Current Baseline Record population for `v1.86.6` is complete; Required Derived Target sync and Quality Enforcement Correction completed for release; Independent Review Complete — Decision **A. GO**; Commit / tag / push for `v1.86.0` / `v1.86.1` / `v1.86.2` / `v1.86.3` / `v1.86.4` / `v1.86.5` / `v1.86.6` **Complete**; corrective `v1.86.7` at **Implementation** with Commit / Tag / Push **Pending**; `ARCHITECTURE_DECISIONS.md` remains index / discovery surface only |

```text
ADR accepted
≠ automatic release declaration（historical planning distinction）
v1.86.0 Released（commit 57b3182… / tag v1.86.0）
≠ v1.86.1 Released（commit a47e892… / tag v1.86.1）
≠ v1.86.2 Released（commit 46b77f8… / tag v1.86.2）
≠ v1.86.3 Released（commit 695a9e2… / tag v1.86.3）
≠ v1.86.4 Released（commit d5907a2… / tag v1.86.4）
≠ v1.86.5 Released（commit 4a53c610… / tag v1.86.5）
≠ v1.86.6 Released（commit bb26dff… / tag v1.86.6）
≠ v1.86.7 released（Pending / Not Declared）
Governance completion approved only after Independent Review
（Independent Review Complete — A. GO）
Quality Enforcement Complete（1232 PASS）
≠ Image Review Entry / Formal Assessment / Production Ready authorized
≠ Commit / tag / push for v1.86.7 authorized
≠ v1.87.0 Assessment started
```

Full record: [ADR-0023](../adr/ADR-0023-repository-baseline-inventory-authority.md) + [BASELINE_SYNCHRONIZATION.md](./BASELINE_SYNCHRONIZATION.md)

新判断は ADR 追加後、本ファイルの Accepted Decisions に summary を追記します。
