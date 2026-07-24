# Architecture Maturity Model

AI-SNS-Automation の Architecture **成熟度** を定義する Governance 基準書です。現在位置・将来到達点・段階遷移条件を明文化し、Quality Pipeline PASS 数や実装有無と混同しない判断基盤を提供します。

---

## Purpose

- プロジェクトが **どの成熟段階にいるか** を共有する
- **Future Entry Criteria** へ進む前提を可視化する
- **v2 Architecture Completion** までの段階的道筋を固定する
- **Production Ready** / **Operational Excellence** が **未到達** であることを明示する

---

## Scope

- Platform Layer / Application Layer / Governance Layer / Future Layer の成熟度位置づけ
- Level 0〜6 の定義と遷移ルール
- Current Maturity（v1.49.0 時点）の公式宣言
- Quality Governance / Compliance Checklist / Future Entry Criteria との関係

本書は **Architecture Governance** の一部であり、実装ロードマップの代替ではありません。

---

## Non Goals

- 本書は **実装計画** ではない
- Provider / Runtime / Scheduler を **実装可能にする** ものではない（Level 4 到達前）
- **Production Ready** を宣言するものではない
- **Operational Excellence** を宣言するものではない
- Quality Pipeline の **PASS 数だけで成熟度を上げる** ものではない

---

## Maturity Levels

```text
Level 0 Idea
  ↓
Level 1 Foundation
  ↓
Level 2 Governance
  ↓
Level 3 Future Design
  ↓
Level 4 Implementation Ready
  ↓
Level 5 Production Ready
  ↓
Level 6 Operational Excellence
```

各 Level は **累積的** です。上位 Level は下位 Level の完了を前提とします。

---

## Level 0: Idea

**構想段階**

| 項目 | 状態 |
|------|------|
| 目的 | 未確定または草案 |
| Layer | 未定義 |
| Public Contract | 未定義 |
| Governance | 未整備 |

v1.41.0 以前の Application Layer 着手前、または新 Epic の初期ブレインストーム段階。

---

## Level 1: Foundation

**Foundation 実装段階**

| 項目 | 内容 |
|------|------|
| Platform Layer Foundation | Developer Automation Workflow 群（v1.31–v1.40） |
| Application Layer Foundation | Idea → Continuous Improvement（v1.41–v1.47） |
| JSON = Source | artifact JSON が Source of Truth |
| Markdown = View | 人間レビュー用 View |
| CLI = Summary | 実行結果サマリ |
| Pure Function ベース | builder / extract / validate |
| Side Effect Minimum | I/O は pipeline / CLI 層に限定 |

**v1.49.0 時点:** Level 1 **Completed**（Platform + Application Foundation）

---

## Level 2: Governance

**Architecture Governance 完成段階**

| 項目 | 参照 |
|------|------|
| Layer Rule | [LAYER_MODEL.md](./LAYER_MODEL.md) / [LAYER_INVARIANTS.md](./LAYER_INVARIANTS.md) |
| Dependency Rule | [DEPENDENCY_RULES.md](./DEPENDENCY_RULES.md) |
| Public Contract Policy | [PUBLIC_CONTRACT_POLICY.md](./PUBLIC_CONTRACT_POLICY.md) |
| Compatibility Policy | [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md) |
| Versioning Policy | [VERSIONING_POLICY.md](./VERSIONING_POLICY.md) |
| Deprecation Policy | [DEPRECATION_POLICY.md](./DEPRECATION_POLICY.md) |
| Change Governance | [CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) |
| ADR | [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) |
| Risk Register | [RISK_REGISTER.md](./RISK_REGISTER.md) |
| Compliance Checklist | [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md) |
| Quality Governance | [QUALITY_GOVERNANCE.md](./QUALITY_GOVERNANCE.md) |
| Public Contract Catalog | v1.48.0 Machine Readable 一覧 |

**v1.49.0 時点:** Level 2 **Completed**

---

## Level 3: Future Design

**Future Layer を設計する段階**（実装はまだ禁止）

| 項目 | 内容 |
|------|------|
| Future Entry Criteria | Level 4 への Gate 条件（文書化進行中） |
| Governance Flow | Epic 開始〜release の公式フロー（将来整備） |
| Future Layer Boundary | [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) |
| Provider Design | Mock → Real 接続の設計のみ |
| Runtime Design | 実行オーケストレーション設計のみ |
| Scheduler Design | timed trigger 設計のみ |
| Automation Design | pre-publish 改善ループ拡張設計のみ |

**v1.49.0 時点:** Level 3 **入場直前**（Future Design Ready — Entry Criteria 未完成）

**v1.66.0 時点:** Level 3 **Completed** — Core Layer Design（v1.54–v1.59）+ Cross Layer Design（v1.60–v1.65）Complete。Level 3.7 Governance Stabilization Complete。

### Level 3 Sub-Levels（Cross Layer Design progression）

| Sub-Level | Milestone | Release |
|-----------|-----------|---------|
| Level 3.0 | Core Layer Design Complete | v1.59.0 |
| Level 3.2 | Interaction Lifecycle Complete | v1.61.0 |
| Level 3.3 | Interaction Context Complete | v1.62.0 |
| Level 3.4 | Interaction State Model Complete | v1.63.0 |
| Level 3.5 | Interaction Error Model Complete | v1.64.0 |
| Level 3.6 | Interaction Metadata Model Complete / Cross Layer Design Complete | v1.65.0 |
| Level 3.7 | Architecture Governance Stabilized / Level 4 Entry Review Ready | v1.66.0 |
| Level 3.8 | Formal Level 4 Entry Review Complete / Conditionally Ready | v1.67.0 |

Sub-levels are **documentation maturity markers** — not independent implementation authorization.

---

## Level 4: Implementation Ready

**Future Layer 実装開始可能段階**

到達条件（すべて必須）:

- [ ] **Entry Criteria 完了** — Future Entry Criteria 文書化と Governance 承認
- [ ] **ADR 完了** — Provider / Runtime / Scheduler 着手 ADR
- [ ] **Risk Review 完了** — [RISK_REGISTER.md](./RISK_REGISTER.md) 更新
- [ ] **Compatibility Review 完了** — Catalog / Matrix 整合
- [ ] **Public Contract Review 完了** — 破壊的変更なしまたは Deprecation 完了
- [ ] **Compliance Checklist 完了** — [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md)
- [ ] **Non Goals 解除条件完了** — [NON_GOALS.md](./NON_GOALS.md) で明示承認

**v1.49.0 時点:** **未到達**（Implementation Ready ではない）

---

## Level 5: Production Ready

**実運用可能段階**

**v1.49.0 時点: 未到達**

条件例（将来 Epic）:

- Provider 実装完了
- Runtime 実装完了
- Scheduler 実装完了
- OAuth / SNS API 接続完了
- Error Handling
- Observability
- Security Review
- Rollback Plan

---

## Level 6: Operational Excellence

**継続運用改善段階**

**v1.49.0 時点: 未到達**

条件例（将来 Epic）:

- Production Metrics
- Reliability Targets
- Incident Review
- Cost Monitoring
- Security Rotation
- Continuous Improvement Loop（実投稿データ連携）

---

## Current Maturity

```text
Current Maturity: Level 3.19 — Repository Baseline Inventory Authority Complete（v1.86.12 released-state reconciliation Released; prior v1.86.11 released-state reconciliation Released; prior v1.86.10 released-state reconciliation Released; prior v1.86.9 released-state reconciliation Released; prior v1.86.8 released-state reconciliation Released; prior v1.86.7 released-state reconciliation Released; prior v1.86.6 released-state reconciliation Released; prior v1.86.5 released-state reconciliation Released; prior v1.86.4 released-state reconciliation Released; prior v1.86.3 released-state reconciliation Released; prior v1.86.2 released-state reconciliation Released; prior v1.86.1 Identity Reconciliation Released; prior Repository Baseline Inventory Authority Release — v1.86.0; prior Provider Production Readiness SSOT Alignment Complete — v1.85.0; prior Image Catalog Registration Implementation Complete — v1.84.0）
```

| 観点 | 状態 |
|------|------|
| Level 1 Foundation | **Completed** |
| Level 2 Governance | **Completed** |
| Quality Governance | **Completed** |
| Level 3 Future Design | **Completed**（Core + Cross Layer Design — v1.59 / v1.65） |
| Level 3.7 Governance Stabilization | **Completed**（v1.66.0） |
| Level 3.8 Formal Level 4 Entry Review | **Completed**（v1.67.0 — Conditionally Ready） |
| Level 3.9 Provider Entry Preparation | **Completed**（v1.68.0） |
| Level 3.10 Provider Contract Definition | **Completed**（v1.69.0） |
| Level 3.11 Provider Non-Goals Release Decision | **Completed**（v1.70.0） |
| Level 3.12 Provider Level 4 Implementation Ready Decision | **Completed**（v1.71.0） |
| Level 3.13 Provider Public Contract Catalog Extension Release | **Completed**（v1.72.0） |
| Level 3.14 Mock Provider Production Implementation Authorization Governance | **Completed**（v1.73.0） |
| Level 3.15 Mock Provider Production Implementation Release | **Completed**（v1.74.0） |
| Level 3.16 Mock Provider Catalog Registration Governance Release | **Completed**（v1.75.0） |
| Level 3.17 Mock Provider Catalog Registration Implementation Release | **Completed**（v1.76.0） |
| Level 3.18 Provider Production Readiness Review Governance Release | **Completed**（v1.77.0） |
| Level 3.19 Provider Production Readiness Assessment Decision Release | **Completed**（v1.78.0） |
| Level 3.19 Provider Expansion Entry Governance Release | **Completed**（v1.79.0） |
| Level 3.19 Image Generation Mock Provider Expansion Entry Decision Release | **Completed**（v1.80.0） |
| Level 3.19 Image Generation Mock Provider Implementation Authorization Release | **Completed**（v1.81.0） |
| Level 3.19 Image Generation Mock Provider Implementation Release | **Completed**（v1.82.0） |
| Level 3.19 Image Generation Mock Provider Catalog Registration Governance Release | **Completed**（v1.83.0） |
| Level 3.19 Image Generation Mock Provider Catalog Registration Implementation Release | **Completed**（v1.84.0） |
| Level 3.19 Provider Production Readiness SSOT Alignment Release | **Completed**（v1.85.0） |
| Level 3.19 Repository Baseline Inventory Authority Release | **Completed**（v1.86.0） |
| Corrective Identity Reconciliation | **Completed / Released**（v1.86.1） |
| Corrective Released-State Reconciliation（v1.86.1→Record） | **Completed / Released**（v1.86.2） |
| Corrective Released-State Reconciliation（v1.86.2→Record） | **Completed / Released**（v1.86.3） |
| Corrective Released-State Reconciliation（v1.86.3→Record） | **Completed / Released**（v1.86.4） |
| Corrective Released-State Reconciliation（v1.86.4→Record） | **Completed / Released**（v1.86.5） |
| Corrective Released-State Reconciliation（v1.86.5→Record） | **Completed / Released**（v1.86.6） |
| Corrective Released-State Reconciliation（v1.86.6→Record） | **Completed / Released**（v1.86.7） |
| Corrective Released-State Reconciliation（v1.86.7→Record） | **Completed / Released**（v1.86.8） |
| Corrective Released-State Reconciliation（v1.86.8→Record） | **Completed / Released**（v1.86.9） |
| Corrective Released-State Reconciliation（v1.86.9→Record） | **Completed / Released**（v1.86.10） |
| Corrective Released-State Reconciliation（v1.86.10→Record） | **Completed / Released**（v1.86.11） |
| Corrective Released-State Reconciliation（v1.86.11→Record） | **Completed / Released**（v1.86.12） |
| Corrective Released-State Reconciliation（v1.86.12→Record） | **Implementation / Not Declared**（v1.86.13） |
| Final Architecture Review | **Completed**（DECISION D — Formal Assessment Accepted） |
| Level 4 Entry Decision | **Recorded**（Conditionally Ready — ADR-0009） |
| **Provider Level 4 Implementation Ready** | **Declared**（domain-specific — v1.71.0） |
| **Repository-wide Level 4 Implementation Ready** | **Not Declared** |
| **providerContracts[] Catalog Extension** | **Registered**（v1.72.0 — abstract authority only） |
| **Mock Provider Production Implementation Authorization** | **Granted**（v1.73.0 — ADR-0016） |
| **Mock Provider Production Implementation** | **Implemented**（v1.74.0 — `src/lib/mock_provider.js`） |
| **Mock Provider Catalog Registration Governance** | **Complete**（v1.75.0 — ADR-0017） |
| **Mock Provider Catalog Registration Implementation** | **Implemented**（v1.76.0 — `src/lib/public_contract_catalog.js`） |
| **Mock Provider Catalog Registration** | **Registered**（ADR-0017 — `text-generation-mock-provider`） |
| **Provider Production Readiness Review Governance** | **Complete**（v1.77.0 — ADR-0018） |
| **Provider Production Readiness Review Entry** | **Authorized** |
| **Provider Production Readiness Assessment** | **Complete** — Formal Decision **READY**（bounded scope — DECISION D Accepted） |
| **Provider Expansion Entry Governance** | **Established**（v1.79.0 — ADR-0019） |
| **Provider Expansion Entry Authorization** | **Granted**（bounded — `image-generation-mock-provider` — v1.80.0 ADR-0020） |
| **Implementation Authorization** | **Granted**（bounded — `image-generation-mock-provider` — v1.81.0 ADR-0021） |
| **Implementation execution** | **Implemented**（v1.82.0 — `src/lib/image_generation_mock_provider.js`） |
| **Image Catalog Registration Governance** | **Complete**（v1.83.0 — ADR-0022） |
| **Image Catalog Registration** | **Registered**（v1.84.0 — ADR-0022 G12） |
| **Catalog Registered（image provider）** | **YES** |
| **Provider Production Ready** | **Not Declared**（global） |
| Level 5 Production Ready | **Not reached** |
| Level 6 Operational Excellence | **Not reached** |

**Historical:** Level 2.5 — Governance Complete, Future Design Ready（v1.50.0 時点の公式宣言）。

---

## Completed Capabilities

- Developer Automation Platform（Platform Layer v1.40 Completed）
- Application Layer 7 Foundation パイプライン（v1.47 Completed）
- Public Contract Catalog & Compatibility Matrix（v1.48）
- Architecture Governance 37 必須文書群（v1.49–v1.67）
- Core Layer Design Complete（v1.54–v1.59 — Design Only）
- Cross Layer Design Complete（v1.60–v1.65 — Design Only）
- Architecture Governance Stabilization（v1.66.0 — Entry Gate / Compliance / Risk / Review sync）
- Provider Public Contract Catalog Extension Release（v1.72.0 — ADR-0015 / `providerContracts[]` abstract authority）
- Mock Provider Catalog Registration Governance（v1.75.0 — ADR-0017 / registration policy / validator policy）
- Mock Provider Production Implementation Release（v1.74.0 — `src/lib/mock_provider.js` / text_generation query）
- Mock Provider Production Implementation Authorization Governance（v1.73.0 — ADR-0016 / explicit authorization boundaries）
- Provider Level 4 Implementation Ready Decision（v1.71.0 — ADR-0014 / domain-specific Declared）
- Quality Governance（Machine Check vs Governance Check）
- Architecture Compliance Checklist（運用確認 — v1.66.0 Cross Layer sections）
- Quality Pipeline 自動検証（Machine Check — governance consistency tests）

---

## Current Limitations

- Level 4 Implementation Ready **Provider domain Declared**; repository-wide **Not Declared**
- `providerContracts[]` **registered**（abstract authority + text-generation-mock-provider — v1.76.0 + image-generation-mock-provider — v1.84.0）; Real Provider **not registered**
- Mock Provider Catalog Registration **Registered**（text — v1.76.0; image — v1.84.0）
- Provider Production Readiness Assessment **Complete** — Formal Decision **READY**（v1.78.0 — bounded text mock scope only）
- Provider Expansion Entry Governance **Established**（v1.79.0 — ADR-0019）
- `image-generation-mock-provider` Expansion Entry **Authorized**（bounded — v1.80.0 — ADR-0020）; Implementation Authorization **Granted**（bounded — v1.81.0 — ADR-0021）; Implementation **Implemented**（v1.82.0）; Catalog Registration Governance **Complete**（v1.83.0）; Catalog Registration **Registered**（v1.84.0）
- Architecture Maturity numeric level remains **Level 3.19**（sub-release label only）
- **Review Entry Authorized:** **NO**（image provider）
- **Formally Assessed:** **NO**（image provider）
- **Bounded Production Ready:** **NO**
- **Global Provider Production Ready:** **Not Declared**
- Catalog Registered **does not imply** Provider Production Ready
- Human Approval Gate remains **mandatory**（`humanApprovalGateBypass: false`）
- Real Provider / external IO **prohibited**
- Automatic SNS publishing **prohibited**
- Retry / Recovery / cross-layer idempotency **deferred** — ADR required before implementation
- Provider / Runtime / Scheduler / SNS API **未実装** — Provider Non-Goals partial release（Mock gate only）; **Production Not Started**（Real Provider scope）
- Real Metrics / Real Automation **未実装**
- Production / Operational 条件 **未達**
- PASS 数増加のみでは Level 4 以上に進めない
- Further advancement requires a separate authorized phase — not automatically granted by catalog registration

---

## Required Evidence

Maturity Level 判断に必要な Evidence:

| Evidence 種別 | 例 |
|---------------|-----|
| Machine Check | Quality Pipeline 全 PASS |
| Governance Check | Compliance Checklist + Mandatory Policy Review |
| Artifact | Public Contract Catalog JSON、Foundation output JSON |
| Documentation | Governance 文書、ADR、VERSION / CHANGELOG |
| Explicit Non-Declaration | Production Ready / Operational Excellence **未宣言** |

PASS 数は Evidence の **一部** であり、Level 昇格の **十分条件ではない**（[QUALITY_GOVERNANCE.md](./QUALITY_GOVERNANCE.md)）。

---

## Transition Rules

| 遷移 | 条件 |
|------|------|
| 0 → 1 | Foundation schema + extract + JSON/MD/CLI MVP |
| 1 → 2 | Governance 文書群 + Catalog + Compliance + Quality Governance |
| 2 → 3 | Future Architecture 設計 + Non-Goals 整合 |
| 3 → 4 | **Future Entry Criteria** Gate 全項目 PASS + ADR + Compliance |
| 4 → 5 | Provider / Runtime / SNS 実装 + Security + Observability |
| 5 → 6 | Production Metrics + Reliability + Incident プロセス |

Level を **宣言** する際は VERSION / CHANGELOG / ADR に根拠を記録する。

---

## Relationship to Quality Governance

- [QUALITY_GOVERNANCE.md](./QUALITY_GOVERNANCE.md) は Maturity Model の **Evidence 定義の一部** である
- **PASS 数は Maturity Level を直接上げない**
- Maturity Level は **Machine Check + Governance Check + Evidence** により判断する
- Level 2 完了には Quality Governance 整備が含まれる

---

## Relationship to Future Entry Criteria

- **Future Entry Criteria** は **Level 3 → Level 4** に進むための **Gate** である
- **Architecture Maturity Model** は各段階の **位置づけ** を定義する
- **Future Entry Criteria** は **実装開始条件** を定義する（文書整備進行中 — v1.49.0 時点未完了）

Level 3 在住中は [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) と [NON_GOALS.md](./NON_GOALS.md) に従い **Design Only** を維持する。

---

## Relationship to Compliance Checklist

- [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md) は **Level 2+ の運用 Evidence**
- Level 4 移行時は Compliance Checklist の **Provider Runtime Scheduler API Pre Addition** 節が必須
- Maturity 宣言前に Release Pre Check 節を完了する

---

## Completion Criteria

Architecture Maturity Model 文書自体の完成条件（v1.49.0）:

- [x] Level 0〜6 定義
- [x] Current Maturity Level 2.5 宣言
- [x] Implementation Ready / Production Ready / Operational Excellence **未到達** 明記
- [x] Quality Governance / Future Entry Criteria / Compliance Checklist との関係記述
- [x] Quality Pipeline テスト（Test 440–448）

v2 Architecture Completion の完成条件は **別 Epic** で定義する（本書は位置づけのみ）。
