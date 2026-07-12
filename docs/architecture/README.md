# Architecture Governance

AI-SNS-Automation の **Architecture Governance** 正式基準書です。v1.49.0 Architecture Documentation Foundation 以降、本ディレクトリは README の補足ではなく、長期保守・将来拡張・Public Contract・Compatibility・Version・変更判断の **唯一の公式 Governance 入口** です。

---

## Governance Scope

Architecture Documentation = **Architecture Governance** として、**48 必須 Governance 文書**（v1.49.0 新規 15 + 更新 2 + Release 前改善 3 + v1.50.0 Future Entry Criteria 1 + v1.51.0 Governance Flow 1 + v1.52.0 Future Layer Boundaries 1 + v1.53.0 Layer Interaction Model foundation 1 + v1.54.0 Provider Layer Design 1 + v1.55.0 Runtime Layer Design 1 + v1.56.0 Scheduler Layer Design 1 + v1.57.0 Automation Layer Design 1 + v1.58.0 Workflow Layer Design 1 + v1.59.0 Event Layer Design 1 + v1.60.0 Cross Layer Interaction Model Design 1 + v1.61.0 Interaction Lifecycle Design 1 + v1.62.0 Interaction Context Design 1 + v1.63.0 Interaction State Model Design 1 + v1.64.0 Interaction Error Model Design 1 + v1.65.0 Interaction Metadata Model Design 1 + v1.67.0 Level 4 Entry Review 1 + v1.68.0 Provider Entry Preparation Review 1 + v1.69.0 Provider Contract Definition Review 1 + v1.70.0 Provider Non-Goals Release Review 1 + v1.71.0 Provider Level 4 Implementation Ready Review 1 + v1.72.0 Provider Public Contract Catalog Extension Review 1 + v1.73.0 Mock Provider Production Implementation Authorization Review 1 + v1.75.0 Mock Provider Catalog Registration Governance Review 1 + v1.77.0 Provider Production Readiness Review 1 + v1.79.0 Provider Expansion Entry Review 1 + v1.80.0 Image Generation Mock Provider Expansion Entry Review 1 + v1.81.0 Image Generation Mock Provider Implementation Authorization Review 1）を固定します。

**Current Maturity:** **Level 3.19 — Image Generation Mock Provider Implementation Authorization Governance Release Complete**（v1.81.0 — `image-generation-mock-provider` Implementation Authorization **Granted** bounded / Implementation execution **Not Started** / Provider Production Ready **Not Declared**）

> **Inventory note:** 行 #24（v1.53.0 foundation）と行 #31（v1.60.0 Cross Layer 統合）は同一ファイル [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) の **リリース系譜** を示す。実効 Governance 文書数は **41**（重複ファイルカウントではない）。

| # | 領域 | 文書 | v1.49.0 |
|---|------|------|---------|
| 1 | 入口 | [README.md](./README.md) | 更新 |
| 2 | 全体構造 | [OVERVIEW.md](./OVERVIEW.md) | 新規 |
| 3 | レイヤー構造 | [LAYER_MODEL.md](./LAYER_MODEL.md) | 更新 |
| 4 | 不変条件 | [LAYER_INVARIANTS.md](./LAYER_INVARIANTS.md) | 新規 |
| 5 | 依存ルール | [DEPENDENCY_RULES.md](./DEPENDENCY_RULES.md) | 新規 |
| 6 | Public Contract | [PUBLIC_CONTRACT_POLICY.md](./PUBLIC_CONTRACT_POLICY.md) | 新規 |
| 7 | Catalog 利用 | [CATALOG_USAGE.md](./CATALOG_USAGE.md) | 新規 |
| 8 | 互換性 | [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md) | 新規 |
| 9 | バージョン | [VERSIONING_POLICY.md](./VERSIONING_POLICY.md) | 新規 |
| 10 | 非推奨 | [DEPRECATION_POLICY.md](./DEPRECATION_POLICY.md) | 新規 |
| 11 | 変更判断 | [CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) | 新規 |
| 12 | 拡張方針 | [EXTENSION_GUIDE.md](./EXTENSION_GUIDE.md) | 新規 |
| 13 | 将来設計 | [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) | 新規 |
| 14 | 非目標 | [NON_GOALS.md](./NON_GOALS.md) | 新規 |
| 15 | 設計判断 | [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) | 新規 |
| 16 | 拡張チェック | [EXTENSION_CHECKLIST.md](./EXTENSION_CHECKLIST.md) | 新規 |
| 17 | リスク | [RISK_REGISTER.md](./RISK_REGISTER.md) | 新規 |
| 18 | 適合確認 | [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md) | 追加改善 |
| 19 | 品質 Governance | [QUALITY_GOVERNANCE.md](./QUALITY_GOVERNANCE.md) | Release 前改善 |
| 20 | 成熟度 | [ARCHITECTURE_MATURITY_MODEL.md](./ARCHITECTURE_MATURITY_MODEL.md) | Release 前改善 |
| 21 | Future Entry Gate | [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) | v1.50.0 |
| 22 | Governance Process | [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) | v1.51.0 |
| 23 | Future Layer Boundaries | [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) | v1.52.0 |
| 24 | Layer Interaction Model Design | [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) | v1.60.0（v1.53.0 foundation を Cross Layer 統合） |
| 25 | Provider Layer Design | [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md) | v1.54.0 |
| 26 | Runtime Layer Design | [RUNTIME_LAYER_DESIGN.md](./RUNTIME_LAYER_DESIGN.md) | v1.55.0 |
| 27 | Scheduler Layer Design | [SCHEDULER_LAYER_DESIGN.md](./SCHEDULER_LAYER_DESIGN.md) | v1.56.0 |
| 28 | Automation Layer Design | [AUTOMATION_LAYER_DESIGN.md](./AUTOMATION_LAYER_DESIGN.md) | v1.57.0 |
| 29 | Workflow Layer Design | [WORKFLOW_LAYER_DESIGN.md](./WORKFLOW_LAYER_DESIGN.md) | v1.58.0 |
| 30 | Event Layer Design | [EVENT_LAYER_DESIGN.md](./EVENT_LAYER_DESIGN.md) | v1.59.0 |
| 31 | Cross Layer Interaction Model Design | [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) | v1.60.0 |
| 32 | Interaction Lifecycle Design | [INTERACTION_LIFECYCLE_DESIGN.md](./INTERACTION_LIFECYCLE_DESIGN.md) | v1.61.0 |
| 33 | Interaction Context Design | [INTERACTION_CONTEXT_DESIGN.md](./INTERACTION_CONTEXT_DESIGN.md) | v1.62.0 |
| 34 | Interaction State Model Design | [INTERACTION_STATE_MODEL.md](./INTERACTION_STATE_MODEL.md) | v1.63.0 |
| 35 | Interaction Error Model Design | [INTERACTION_ERROR_MODEL.md](./INTERACTION_ERROR_MODEL.md) | v1.64.0 |
| 36 | Interaction Metadata Model Design | [INTERACTION_METADATA_MODEL.md](./INTERACTION_METADATA_MODEL.md) | v1.65.0 |
| 37 | Level 4 Entry Review | [LEVEL_4_ENTRY_REVIEW.md](./LEVEL_4_ENTRY_REVIEW.md) | v1.67.0 |
| 38 | Provider Entry Preparation Review | [PROVIDER_ENTRY_PREPARATION_REVIEW.md](./PROVIDER_ENTRY_PREPARATION_REVIEW.md) | v1.68.0 |
| 39 | Provider Contract Definition Review | [PROVIDER_CONTRACT_DEFINITION_REVIEW.md](./PROVIDER_CONTRACT_DEFINITION_REVIEW.md) | v1.69.0 |
| 40 | Provider Non-Goals Release Review | [PROVIDER_NON_GOALS_RELEASE_REVIEW.md](./PROVIDER_NON_GOALS_RELEASE_REVIEW.md) | v1.70.0 |
| 41 | Provider Level 4 Implementation Ready Review | [PROVIDER_LEVEL_4_IMPLEMENTATION_READY_REVIEW.md](./PROVIDER_LEVEL_4_IMPLEMENTATION_READY_REVIEW.md) | v1.71.0 |
| 42 | Provider Public Contract Catalog Extension Review | [PROVIDER_PUBLIC_CONTRACT_CATALOG_EXTENSION_REVIEW.md](./PROVIDER_PUBLIC_CONTRACT_CATALOG_EXTENSION_REVIEW.md) | v1.72.0 |
| 43 | Mock Provider Production Implementation Authorization Review | [MOCK_PROVIDER_PRODUCTION_IMPLEMENTATION_AUTHORIZATION_REVIEW.md](./MOCK_PROVIDER_PRODUCTION_IMPLEMENTATION_AUTHORIZATION_REVIEW.md) | v1.73.0 |
| 44 | Mock Provider Catalog Registration Governance Review | [MOCK_PROVIDER_CATALOG_REGISTRATION_GOVERNANCE_REVIEW.md](./MOCK_PROVIDER_CATALOG_REGISTRATION_GOVERNANCE_REVIEW.md) | v1.75.0 |
| 45 | Provider Production Readiness Review | [PROVIDER_PRODUCTION_READINESS_REVIEW.md](./PROVIDER_PRODUCTION_READINESS_REVIEW.md) | v1.77.0 |
| 46 | Provider Expansion Entry Review | [PROVIDER_EXPANSION_ENTRY_REVIEW.md](./PROVIDER_EXPANSION_ENTRY_REVIEW.md) | v1.79.0 |
| 47 | Image Generation Mock Provider Expansion Entry Review | [IMAGE_GENERATION_MOCK_PROVIDER_EXPANSION_ENTRY_REVIEW.md](./IMAGE_GENERATION_MOCK_PROVIDER_EXPANSION_ENTRY_REVIEW.md) | v1.80.0 |
| 48 | Image Generation Mock Provider Implementation Authorization Review | [IMAGE_GENERATION_MOCK_PROVIDER_IMPLEMENTATION_AUTHORIZATION_REVIEW.md](./IMAGE_GENERATION_MOCK_PROVIDER_IMPLEMENTATION_AUTHORIZATION_REVIEW.md) | v1.81.0 |

**文書の役割分担:**

| 文書 | 役割 |
|------|------|
| [IMAGE_GENERATION_MOCK_PROVIDER_IMPLEMENTATION_AUTHORIZATION_REVIEW.md](./IMAGE_GENERATION_MOCK_PROVIDER_IMPLEMENTATION_AUTHORIZATION_REVIEW.md) | **Image Generation Mock Provider Implementation Authorization Review** — per-candidate DECISION H / E1–E25 / B1–B25 / Implementation Authorization **Granted** bounded（v1.81.0） |
| [IMAGE_GENERATION_MOCK_PROVIDER_EXPANSION_ENTRY_REVIEW.md](./IMAGE_GENERATION_MOCK_PROVIDER_EXPANSION_ENTRY_REVIEW.md) | **Image Generation Mock Provider Expansion Entry Review** — per-candidate DECISION G / E1–E25 / B1–B25 / Expansion Entry **Authorized** bounded（v1.80.0） |
| [PROVIDER_EXPANSION_ENTRY_REVIEW.md](./PROVIDER_EXPANSION_ENTRY_REVIEW.md) | **Provider Expansion Entry Review** — expansion taxonomy / entry criteria / blocking conditions（v1.79.0） |
| [PROVIDER_PRODUCTION_READINESS_REVIEW.md](./PROVIDER_PRODUCTION_READINESS_REVIEW.md) | **Provider Production Readiness Review** — review entry / evidence model / blocking conditions / Production Ready **Not Declared**（v1.77.0） |
| [MOCK_PROVIDER_CATALOG_REGISTRATION_GOVERNANCE_REVIEW.md](./MOCK_PROVIDER_CATALOG_REGISTRATION_GOVERNANCE_REVIEW.md) | **Catalog Registration Governance Review** — registration policy / validator policy / identity mapping（v1.75.0） |
| [MOCK_PROVIDER_PRODUCTION_IMPLEMENTATION_AUTHORIZATION_REVIEW.md](./MOCK_PROVIDER_PRODUCTION_IMPLEMENTATION_AUTHORIZATION_REVIEW.md) | **Mock Provider Authorization Review** — implementation boundaries / Authorized vs Started（v1.73.0） |
| [PROVIDER_PUBLIC_CONTRACT_CATALOG_EXTENSION_REVIEW.md](./PROVIDER_PUBLIC_CONTRACT_CATALOG_EXTENSION_REVIEW.md) | **Catalog Extension Review** — `providerContracts[]` registration / backward compatibility（v1.72.0） |
| [PROVIDER_LEVEL_4_IMPLEMENTATION_READY_REVIEW.md](./PROVIDER_LEVEL_4_IMPLEMENTATION_READY_REVIEW.md) | **Provider L4 Implementation Ready Review** — U1–U8 / G-07/08/18 applicability / domain-specific Declared（v1.71.0） |
| [PROVIDER_NON_GOALS_RELEASE_REVIEW.md](./PROVIDER_NON_GOALS_RELEASE_REVIEW.md) | **Provider Non-Goals Release Review** — NG1–NG6 / G-25 evidence / Mock vs Real boundary（v1.70.0） |
| [PROVIDER_CONTRACT_DEFINITION_REVIEW.md](./PROVIDER_CONTRACT_DEFINITION_REVIEW.md) | **Provider Contract Definition Review** — P4 / G-24 evidence / `providerContracts[]` strategy（v1.69.0 — **not** Contract SSOT） |
| [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md) | **Provider Contract Authority SSOT** — Input / Output / Error / Capability（Design Only — v1.54.0） |
| [PROVIDER_ENTRY_PREPARATION_REVIEW.md](./PROVIDER_ENTRY_PREPARATION_REVIEW.md) | **Provider Entry Preparation Review** — P1–P6 / U1–U8 / Gate update / Not Yet Authorized evidence（v1.68.0） |
| [LEVEL_4_ENTRY_REVIEW.md](./LEVEL_4_ENTRY_REVIEW.md) | **Formal Level 4 Entry Review** — Entry Decision / G-01–G-27 evaluation / Conditionally Ready evidence（v1.67.0） |
| [ARCHITECTURE_MATURITY_MODEL.md](./ARCHITECTURE_MATURITY_MODEL.md) | **成熟度 Level 0–6** — 現在位置と未到達段階 |
| [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) | **Level 3→4 Entry Gate** — Future 実装着手前条件 |
| [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) | **Governance Process** — レビュー・承認の実行順序 |
| [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) | **Future Layer 境界** — 責務・依存・データ所有・副作用 |
| [INTERACTION_METADATA_MODEL.md](./INTERACTION_METADATA_MODEL.md) | **Interaction Metadata Model** — Supplemental Descriptive Information / Namespace / Ownership / Boundaries（Design Only — v1.65.0） |
| [INTERACTION_ERROR_MODEL.md](./INTERACTION_ERROR_MODEL.md) | **Interaction Error Model** — Failure Information / Classification / Ownership / Propagation / Boundaries（Design Only — v1.64.0） |
| [INTERACTION_STATE_MODEL.md](./INTERACTION_STATE_MODEL.md) | **Interaction State Model** — State Information / lifecycleState / stateRevision / Ownership / Consistency（Design Only — v1.63.0） |
| [INTERACTION_CONTEXT_DESIGN.md](./INTERACTION_CONTEXT_DESIGN.md) | **Interaction Context** — Context Contract / Ownership / Read-Write-Mutation / Compatibility（Design Only — v1.62.0） |
| [INTERACTION_LIFECYCLE_DESIGN.md](./INTERACTION_LIFECYCLE_DESIGN.md) | **Interaction Lifecycle** — Cross-Layer Lifecycle Contract / States / Transitions（Design Only — v1.61.0） |
| [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) | **Cross Layer Interaction Model** — Core Layer 間 Interaction / Dependency / Boundary（Design Only — v1.60.0） |
| [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md) | **Provider Layer 設計** — Contract / Capability / Credential（Design Only） |
| [RUNTIME_LAYER_DESIGN.md](./RUNTIME_LAYER_DESIGN.md) | **Runtime Layer 設計** — Execution Contract / Lifecycle / Orchestration（Design Only） |
| [SCHEDULER_LAYER_DESIGN.md](./SCHEDULER_LAYER_DESIGN.md) | **Scheduler Layer 設計** — Scheduling Contract / Trigger / Execution Policy（Design Only） |
| [AUTOMATION_LAYER_DESIGN.md](./AUTOMATION_LAYER_DESIGN.md) | **Automation Layer 設計** — Workflow Intent / Automation Contract / Boundary（Design Only） |
| [WORKFLOW_LAYER_DESIGN.md](./WORKFLOW_LAYER_DESIGN.md) | **Workflow Layer 設計** — Structure / Step / Dependency / Transition（Design Only） |
| [EVENT_LAYER_DESIGN.md](./EVENT_LAYER_DESIGN.md) | **Event Layer 設計** — Trigger / Signal / Event Contract / Classification（Design Only） |
| [QUALITY_GOVERNANCE.md](./QUALITY_GOVERNANCE.md) | **Machine Check vs Governance Check** — PASS 数の位置づけ |
| [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md) | 変更・release 時の **運用適合確認**（Read + Verify） |
| [EXTENSION_CHECKLIST.md](./EXTENSION_CHECKLIST.md) | Foundation 追加時の **技術確認** |
| [LAYER_MODEL.md](./LAYER_MODEL.md) | Layer **構造** と **依存方向**（What / How layers relate） |
| [LAYER_INVARIANTS.md](./LAYER_INVARIANTS.md) | 破ってはいけない **不変条件**（Must never break） |
| [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) | **将来設計**（Design Only — 実装前の構想） |
| [NON_GOALS.md](./NON_GOALS.md) | **現時点の実装禁止**（What not to build now） |

---

## 固定原則

- **MVP First** — 最小構成で公式基準を確立する
- **Machine Readable First** — Public Contract Catalog（JSON）を Source とする
- **JSON = Source / Markdown = View / CLI = Summary**
- **Pure Functions / Side Effect Minimum**
- **Public Contract First / Backward Compatibility**
- **Official Docs First / Claude Code First / Architecture First / Governance First**

---

## 現在フェーズ（v1.81.0 — Image Generation Mock Provider Implementation Authorization Governance Release）

| Layer | 状態 |
|-------|------|
| Platform Layer（Developer Automation） | **Completed**（v1.40.0、保守のみ） |
| Application Layer（Content Pipeline） | **Completed**（v1.47.0） |
| Governance Layer（Catalog + Docs + Process + Boundaries） | **Completed**（v1.48.0–v1.53.0） |
| **Core Layer Design**（Provider / Runtime / Scheduler / Automation / Workflow / Event） | **Complete**（v1.54.0–v1.59.0 — Design Only） |
| **Cross Layer Design**（Interaction Model + Lifecycle + Context + State + Error + Metadata） | **Complete**（v1.60.0–v1.65.0 — Design Only） |
| **Architecture Governance Stabilization** | **Complete**（v1.66.0） |
| **Formal Level 4 Entry Review** | **Complete**（v1.67.0 — Conditionally Ready） |
| **Provider Entry Preparation** | **Governance Complete**（v1.68.0） |
| **Provider Contract Definition** | **Governance Complete**（v1.69.0） |
| **Provider Non-Goals Release Decision** | **Governance Complete**（v1.70.0） |
| **Provider Level 4 Implementation Ready** | **Declared**（v1.71.0 — **domain-specific** — ADR-0014） |
| **Provider Public Contract Catalog Extension** | **Complete**（v1.72.0 — ADR-0015） |
| **Mock Provider Production Implementation Authorization** | **Granted**（v1.73.0 — ADR-0016） |
| **Mock Provider Production Implementation** | **Implemented**（v1.74.0） |
| **Mock Provider Catalog Registration Governance** | **Complete**（v1.75.0 — ADR-0017） |
| **Mock Provider Catalog Registration Implementation** | **Implemented**（v1.76.0） |
| **Mock Provider Catalog Registration** | **Registered**（ADR-0017 — `text-generation-mock-provider`） |
| **Provider Production Readiness Review Governance** | **Complete**（v1.77.0 — ADR-0018） |
| **Provider Production Readiness Review Entry** | **Authorized**（DECISION A） |
| **PPRR-F001 Remediation** | **Complete**（DECISION B/C） |
| **Provider Production Readiness Assessment** | **Complete** — Formal Decision **READY**（bounded scope） |
| **ChatGPT Final Decision Review** | **Accepted**（DECISION D） |
| **Provider Expansion Entry Governance** | **Established**（v1.79.0 — ADR-0019） |
| **image-generation-mock-provider Expansion Entry** | **Authorized**（bounded — v1.80.0 — ADR-0020 / DECISION G） |
| **image-generation-mock-provider Implementation Authorization** | **Granted**（bounded — v1.81.0 — ADR-0021 / DECISION H） |
| **Implementation execution** | **Not Started** |
| **Repository-wide Level 4 Implementation Ready** | **Not Declared** |
| **Provider Production Ready** | **Not Declared**（global） |
| **Provider Production Implementation** | **Not Started**（Real Provider scope） |
| Future Infrastructure（Queue / Worker / Receiver / Adapter 等） | **Boundary Only** — 実装禁止 |

Provider / Adapter / Runtime / Scheduler / SNS API / OAuth / Database / Queue / Worker / Cloud Runtime / Real Metrics / Real Automation は **Future Architecture**（[FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) — 将来設計）として記述し、**現時点では [NON_GOALS.md](./NON_GOALS.md) により実装禁止** です。

---

## レガシー参照（v1.37.1 以前）

以下は Developer Automation 初期の Documentation MVP として残しています。Governance 判断は **本 README および v1.49.0 以降の正式基準書** を優先してください。

| ファイル | 内容 |
|----------|------|
| [PRINCIPLES.md](./PRINCIPLES.md) | Developer Automation Rules（初期版） |
| [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md) | 設計〜実装フロー |
| [ROADMAP.md](./ROADMAP.md) | 初期ロードマップ |

---

## ADR との関係

| 種別 | 場所 | 役割 |
|------|------|------|
| Architecture Governance | `docs/architecture/` | 公式基準・不変条件・変更判断 |
| ADR | `docs/adr/` | 個別設計決定の記録 |
| Public Contract Catalog | `reports/public-contract-catalog/latest/` | Machine Readable な Contract 一覧 |

個別 ADR は [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) から辿ります。

---

## 推奨読了順序

1. [OVERVIEW.md](./OVERVIEW.md)
2. [LAYER_MODEL.md](./LAYER_MODEL.md) + [LAYER_INVARIANTS.md](./LAYER_INVARIANTS.md)
3. [PUBLIC_CONTRACT_POLICY.md](./PUBLIC_CONTRACT_POLICY.md) + [CATALOG_USAGE.md](./CATALOG_USAGE.md)
4. [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md) + [VERSIONING_POLICY.md](./VERSIONING_POLICY.md) + [DEPRECATION_POLICY.md](./DEPRECATION_POLICY.md)
5. [CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) + [QUALITY_GOVERNANCE.md](./QUALITY_GOVERNANCE.md) + [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) + [ARCHITECTURE_MATURITY_MODEL.md](./ARCHITECTURE_MATURITY_MODEL.md) + [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md) + [EXTENSION_GUIDE.md](./EXTENSION_GUIDE.md) + [EXTENSION_CHECKLIST.md](./EXTENSION_CHECKLIST.md)
6. [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) + [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) + [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md) + [RUNTIME_LAYER_DESIGN.md](./RUNTIME_LAYER_DESIGN.md) + [SCHEDULER_LAYER_DESIGN.md](./SCHEDULER_LAYER_DESIGN.md) + [AUTOMATION_LAYER_DESIGN.md](./AUTOMATION_LAYER_DESIGN.md) + [WORKFLOW_LAYER_DESIGN.md](./WORKFLOW_LAYER_DESIGN.md) + [EVENT_LAYER_DESIGN.md](./EVENT_LAYER_DESIGN.md) + [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) + [INTERACTION_LIFECYCLE_DESIGN.md](./INTERACTION_LIFECYCLE_DESIGN.md) + [INTERACTION_CONTEXT_DESIGN.md](./INTERACTION_CONTEXT_DESIGN.md) + [INTERACTION_STATE_MODEL.md](./INTERACTION_STATE_MODEL.md) + [INTERACTION_ERROR_MODEL.md](./INTERACTION_ERROR_MODEL.md) + [INTERACTION_METADATA_MODEL.md](./INTERACTION_METADATA_MODEL.md) + [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) + [NON_GOALS.md](./NON_GOALS.md) + [RISK_REGISTER.md](./RISK_REGISTER.md)
