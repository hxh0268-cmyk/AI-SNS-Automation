# ADR-0009: Level 4 Entry Strategy

## Status

Accepted（v1.67.0 — Formal Level 4 Entry Review）

## Context

v1.66.0 で Architecture Governance Stabilization が完了し、Core Layer Design（v1.54–v1.59）および Cross Layer Design（v1.60–v1.65）が Complete となった。Final Architecture Review（Decision B）remediation 後、Formal Level 4 Entry Review を実施可能な baseline が整った。

Level 4 到達には複数の Future Layer（Provider / Runtime / Scheduler / Automation / Workflow / Event）および Cross Layer operational semantics（Retry / Recovery / Idempotency 等）が関与する。Repository 全体を一括で Level 4 Implementation Ready と宣言する方式は、以下のリスクを伴う:

- Domain ごとの Entry Criteria / Non-Goals Release / ADR / Risk / Compatibility レビューが省略される
- Public Contract Catalog scope 拡張が未整理のまま実装が始まる
- Retry / Recovery / Idempotency 等の deferred operational semantics が ad hoc 実装される
- Quality Pipeline PASS のみで Implementation Ready と誤判定される

## Decision

**Repository-wide Level 4 一括解除は採用しない。**

**Domain-based Incremental Level 4 Entry** を採用する。

### Entry Strategy

| 項目 | 決定 |
|------|------|
| **Entry Strategy** | Domain-based Incremental Level 4 Entry |
| **First Target Domain** | **Provider Layer Entry Preparation** |
| **Provider Production Implementation** | **まだ開始しない** |
| **Level 4 Implementation Ready（repository-wide）** | **Not Yet** |
| **Public Contract Catalog scope ADR** | **v1.67.0 では作成しない** — Provider Entry Preparation フェーズへ分離 |

### Recommended Domain Sequence

```text
Provider → Runtime → Scheduler → Automation → Workflow → Event
```

各 Domain は独立した Entry Preparation サイクルを経て、当該 Domain の Entry Criteria PASS + Non-Goals Release + ADR + Reviews 完了後にのみ Production Implementation を検討する。

### Provider Entry Preparation Requirements

Provider Entry Preparation フェーズ（Production Implementation **前**）では以下が必要:

| Requirement | Authority |
|-------------|-----------|
| Domain-specific ADR | ARCHITECTURE_DECISIONS / docs/adr/ |
| Compatibility Review | COMPATIBILITY_POLICY / CHANGE_GOVERNANCE |
| Risk Review | RISK_REGISTER |
| Compliance Review | ARCHITECTURE_COMPLIANCE_CHECKLIST |
| Non-Goals Release（Provider scope） | NON_GOALS + domain ADR |
| Provider Entry Criteria PASS | FUTURE_ENTRY_CRITERIA §Provider Entry Criteria |

### Prohibited at v1.67.0

- Provider Production Implementation
- Runtime / Scheduler / Automation / Workflow / Event Production Implementation
- Public Contract Catalog scope 拡張（Future Layer / Interaction contracts）
- Runtime machine-readable schema 作成
- Repository-wide Level 4 Implementation Ready 宣言

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Repository-wide Level 4 unlock | Domain reviews bypassed; premature implementation risk |
| Cross Layer implementation first | Core Layer dependency order violated |
| Public Contract Catalog extension in v1.67.0 | Scope ADR not yet written; Provider phase is correct sequencing |
| Immediate Provider Production Implementation | Provider Entry Criteria / Non-Goals Release not PASS |

## Consequences

### Positive

- Level 4 Entry Decision が Governance Evidence として固定される（[LEVEL_4_ENTRY_REVIEW.md](../architecture/LEVEL_4_ENTRY_REVIEW.md)）
- Domain ごとに Entry Criteria / Reviews を段階的に満たせる
- Public Contract Catalog scope ADR を Provider フェーズで適切に分離できる
- Deferred operational semantics（Retry / Recovery / Idempotency）の premature implementation を防止

### Negative / Remaining Exposure

- Repository-wide Level 4 Implementation Ready は **未到達** のまま
- Provider Entry Preparation 完了まで Provider 実装は禁止
- 各 Domain で個別 ADR / Review が必要 —  governance overhead 増加
- CL-004, CL-005, CL-006, CL-013（RISK_REGISTER）の exposure は Domain Entry まで継続

## Review Trigger

- Provider Entry Preparation 完了時 — Provider Production Implementation ADR 要否を再評価
- Public Contract Catalog scope 拡張着手前 — dedicated Catalog Scope ADR 必須
- 別 Domain（Runtime 等）への First Target Domain 変更要求時
- Repository-wide Level 4 Implementation Ready 宣言要求時 — 全 Core Layer Domain Entry Criteria PASS を再検証
