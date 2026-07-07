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

### Decision Chain（Provider Domain — v1.68.0–v1.69.0）

```text
ADR-0010 Provider Entry Preparation
  → ADR-0011 Catalog scope（Application-only authority）
    → ADR-0012 providerContracts[] additive extension strategy
      → PROVIDER_CONTRACT_DEFINITION_REVIEW（evidence — not SSOT）
        → Future: Governance-approved Catalog extension Release
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

新判断は ADR 追加後、本ファイルの Accepted Decisions に summary を追記します。
