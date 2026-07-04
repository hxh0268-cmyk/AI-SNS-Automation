# Future Layer Boundaries

Future Layer 群（Provider / Adapter / Runtime / Scheduler 等）の **責務・境界・依存方向・公開契約・データ所有・副作用・Runtime Isolation・Testing Boundary** を定義する Design Only 基準書です。将来の実装を **安全に設計** するための Boundary Design であり、**Implementation Ready（Level 4）ではありません**。

> **重要（v1.52.0）:** 本書は **Boundary Design** のみ。Production Code / Provider / Runtime / Scheduler / OAuth / SNS API / Database / Queue / Worker / Cloud Runtime / Cache / Real Metrics / Real Automation / Background Job / Message Broker の **実装を許可しません**。

---

## Purpose

- Future Layer 各コンポーネントの **責務境界** を明文化する
- **Allowed / Forbidden Dependencies** を固定し、Application Layer 侵食を防ぐ
- Public Contract / Data Ownership / Side Effect / Runtime Isolation / Testing の **境界ルール** を定義する
- [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) および [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) と接続する
- **Current Maturity Level 2.5** を維持し、Level 4 到達を **宣言しない**

---

## Scope

- Future Layer Map（14 領域）
- 各 Layer Boundary（Responsibility / Owns / Dependencies / Entry Criteria 参照）
- Allowed Dependency Direction / Forbidden Dependencies
- Public Contract / Data Ownership / Side Effect / Runtime Isolation / Testing / Documentation Boundaries
- Future Entry Criteria + Governance Flow Integration

Platform Layer / Application Layer の **既存 Public Contract** は変更しません。

---

## Non Goals

- 本書は **実装計画・実装ロードマップ** ではない
- Boundary 定義は **Entry Criteria 充足** または **Non-Goals 解除** を意味しない
- **Production Ready** / **Operational Excellence** を宣言するものではない
- Quality Pipeline PASS 数だけで Boundary 承認とみなさない
- Database を **source of truth** に昇格させない（承認前）
- **Level 4 Implementation Ready** 到達を意味しない

---

## Current Maturity

```text
Current Maturity: Level 2.5 — Governance Complete, Future Design Ready
```

| 項目 | v1.52.0 状態 |
|------|--------------|
| Level 3 Future Design | **進行中**（Future Layer Boundaries 追加） |
| Level 4 Implementation Ready | **未到達** |
| Future Layer 実装 | **Prohibited**（全領域） |
| Boundary 文書 | **Completed**（本書） |

---

## Boundary Design Principles

| 原則 | 内容 |
|------|------|
| Architecture First | Layer / Dependency / Invariants を最優先 |
| Public Contract First | 接続は Catalog 公開 Contract のみ |
| Pure Functions where possible | Application Foundation は deterministic 維持 |
| Side Effect Minimum | 副作用は承認 Future Layer に隔離 |
| Provider Isolation | Provider 固有ロジックは Application 非公開 |
| Runtime Isolation | Runtime 選択が Public Contract を変えない |
| Backward Compatibility | Breaking change 原則禁止 |
| Governance First | 変更は [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) 経由 |
| Machine Readable First | Catalog JSON = Contract Source |
| JSON = Source | artifact JSON が正 |
| Markdown = View | 人間可読は派生 |
| CLI = Summary | 実行結果は要約表示 |

---

## Future Layer Map

```text
Future Layer（Design Only — v1.52.0 全領域 Implementation Status: Prohibited）
├── Provider
├── Adapter
├── Runtime
├── Scheduler
├── OAuth
├── SNS API
├── External API
├── Database
├── Queue
├── Worker
├── Cloud Runtime
├── Cache
├── Real Metrics
└── Real Automation
```

詳細境界は以下各節。Application Layer / Platform Layer は **Future Layer Map の外**（Completed）。

---

## Provider Layer Boundary

| 項目 | 定義 |
|------|------|
| **Responsibility** | 外部サービス（LLM / Image / Metrics API）への接続抽象化 |
| **Owns** | Provider client config、retry/rate-limit（Provider 内）、Mock/Real 切替 flag |
| **Does Not Own** | Business workflow、Content generation logic、Public Contract schema |
| **Allowed Inputs** | Application Public Contract JSON、Provider config（env/secret 参照のみ） |
| **Allowed Outputs** | Raw provider response → **Adapter 経由** で正規化 |
| **Allowed Dependencies** | External API（Provider 内）、Adapter（出力方向） |
| **Forbidden Dependencies** | Application Layer 直接 import、Runtime domain logic、Scheduler |
| **Public Contract Impact** | 新 Provider Contract は Catalog additive 追加のみ（ADR 必須） |
| **Entry Criteria Reference** | [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — Provider Entry Criteria |
| **Implementation Status** | **Prohibited** |

---

## Adapter Layer Boundary

| 項目 | 定義 |
|------|------|
| **Responsibility** | Provider response ↔ Public Contract shape 変換 |
| **Owns** | Mapping rules、normalization、error shape 変換 |
| **Does Not Own** | Auth token storage、Business rules、Foundation pure functions |
| **Allowed Inputs** | Provider raw output、Target Public Contract schema |
| **Allowed Outputs** | Foundation-compatible JSON |
| **Allowed Dependencies** | Provider（入力）、Public Contract definitions |
| **Forbidden Dependencies** | Application workflow orchestration、Database writes |
| **Public Contract Impact** | Adapter は Contract **実装詳細** — Catalog に漏らさない |
| **Entry Criteria Reference** | Provider Entry Criteria（Adapter は Provider とセット） |
| **Implementation Status** | **Prohibited** |

---

## Runtime Layer Boundary

| 項目 | 定義 |
|------|------|
| **Responsibility** | Foundation pipeline の実行オーケストレーション（local / CI / cloud） |
| **Owns** | Invoke 順序、artifact I/O パス、exit code 集約 |
| **Does Not Own** | Domain logic、Provider-specific behavior、Content generation |
| **Allowed Inputs** | Public Contract JSON artifacts、CLI config |
| **Allowed Outputs** | Updated artifacts、execution summary |
| **Allowed Dependencies** | Foundation CLIs（pure invoke）、filesystem I/O |
| **Forbidden Dependencies** | Provider 直接呼び出し（Runtime 内）、Application 内部 module |
| **Public Contract Impact** | Runtime 選択は Contract に **影響しない**（replaceable） |
| **Entry Criteria Reference** | [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — Runtime Entry Criteria |
| **Implementation Status** | **Prohibited** |

---

## Scheduler Layer Boundary

| 項目 | 定義 |
|------|------|
| **Responsibility** | 将来: cron / trigger による pipeline 起動 |
| **Owns** | Schedule spec、trigger metadata、idempotency key（設計） |
| **Does Not Own** | Content generation logic、Provider auth、Business workflow |
| **Allowed Inputs** | Schedule Public Contract（将来 schema）、Runtime invoke 要求 |
| **Allowed Outputs** | Runtime 起動イベント（transport のみ） |
| **Allowed Dependencies** | Runtime（下位）、Queue（将来・承認後） |
| **Forbidden Dependencies** | Application Foundation 直接変更、Content Generation 内部 |
| **Public Contract Impact** | schedule-spec JSON schema（将来・Catalog 登録） |
| **Entry Criteria Reference** | [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — Scheduler Entry Criteria |
| **Implementation Status** | **Prohibited** |

---

## OAuth Layer Boundary

| 項目 | 定義 |
|------|------|
| **Responsibility** | 将来: OAuth token 取得・refresh 抽象化 |
| **Owns** | Token lifecycle（secret store 外参照）、scope 最小化 |
| **Does Not Own** | SNS publishing behavior、Application business rules |
| **Allowed Inputs** | OAuth config（env/secret）、scope definition |
| **Allowed Outputs** | Valid access token（Adapter/Provider へ・非 Public） |
| **Allowed Dependencies** | External OAuth provider |
| **Forbidden Dependencies** | Public Contract への secret 埋込、Application Layer |
| **Public Contract Impact** | OAuth token は **Private** — Catalog 非公開 |
| **Entry Criteria Reference** | [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — OAuth Entry Criteria |
| **Implementation Status** | **Prohibited** |

---

## SNS API Layer Boundary

| 項目 | 定義 |
|------|------|
| **Responsibility** | 将来: SNS プラットフォーム API 接続（Provider+Adapter 経由） |
| **Owns** | SNS request/response mapping、rate limit 遵守 |
| **Does Not Own** | Content generation、自動投稿 decision（Real Automation 領域） |
| **Allowed Inputs** | Publishing Public Contract、OAuth token（Adapter 経由） |
| **Allowed Outputs** | SNS API response 正規化 JSON |
| **Allowed Dependencies** | Provider、Adapter、OAuth（承認後） |
| **Forbidden Dependencies** | Application Layer 直接 HTTP、Content Generation 内部 |
| **Public Contract Impact** | sns-api contract（将来・Catalog additive） |
| **Entry Criteria Reference** | [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — SNS API Entry Criteria |
| **Implementation Status** | **Prohibited** |

---

## External API Layer Boundary

| 項目 | 定義 |
|------|------|
| **Responsibility** | LLM / Image / Metrics 等の外部 API（Provider 抽象化下） |
| **Owns** | HTTP client、timeout/retry（Provider 内） |
| **Does Not Own** | Application Public Contract schema |
| **Allowed Inputs** | Provider config、normalized request |
| **Allowed Outputs** | Raw API response → Adapter |
| **Allowed Dependencies** | Provider Layer のみ（Application 非公開） |
| **Forbidden Dependencies** | Application Layer 直接 external fetch |
| **Public Contract Impact** | External API detail は Private — Catalog に URL/key 漏洩禁止 |
| **Entry Criteria Reference** | [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — External API Entry Criteria |
| **Implementation Status** | **Prohibited** |

---

## Database Layer Boundary

| 項目 | 定義 |
|------|------|
| **Responsibility** | 将来: 補助永続化（**JSON Source 優先**） |
| **Owns** | 承認後の schema migration、connection pool（設計） |
| **Does Not Own** | Source of truth（v1.52.0 時点 JSON が正） |
| **Allowed Inputs** | Normalized JSON snapshot（書込みは Entry Criteria 後） |
| **Allowed Outputs** | Query result → JSON 再 Export |
| **Allowed Dependencies** | Runtime（I/O 経由）、承認 ADR |
| **Forbidden Dependencies** | Application Foundation 直接 SQL、schema 前提の Application 変更 |
| **Public Contract Impact** | DB schema は **Private** — Public Contract は JSON shape のみ |
| **Entry Criteria Reference** | [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — Database Entry Criteria |
| **Implementation Status** | **Prohibited** |

---

## Queue Layer Boundary

| 項目 | 定義 |
|------|------|
| **Responsibility** | 将来: 非同期メッセージ transport |
| **Owns** | Message envelope、DLQ 方針（設計） |
| **Does Not Own** | Source of truth、Business workflow state |
| **Allowed Inputs** | JSON artifact payload（Foundation output） |
| **Allowed Outputs** | Delivered message → Worker |
| **Allowed Dependencies** | Worker、Runtime、Scheduler（承認後） |
| **Forbidden Dependencies** | Governance Flow バイパス、Application 直接 enqueue |
| **Public Contract Impact** | queue-message envelope schema（将来・Private 可） |
| **Entry Criteria Reference** | [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — Queue Entry Criteria |
| **Implementation Status** | **Prohibited** |

---

## Worker Layer Boundary

| 項目 | 定義 |
|------|------|
| **Responsibility** | 将来: Queue メッセージ消費・Runtime invoke |
| **Owns** | Concurrency、heartbeat（設計） |
| **Does Not Own** | Data ownership、Domain logic |
| **Allowed Inputs** | Queue message、Runtime invoke spec |
| **Allowed Outputs** | Runtime 実行結果、status report |
| **Allowed Dependencies** | Runtime、Queue |
| **Forbidden Dependencies** | Application 内部 module、Provider 直接 |
| **Public Contract Impact** | Worker health contract（将来・Operational） |
| **Entry Criteria Reference** | [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — Worker Entry Criteria |
| **Implementation Status** | **Prohibited** |

---

## Cloud Runtime Boundary

| 項目 | 定義 |
|------|------|
| **Responsibility** | 将来: cloud 上での Runtime 実行 |
| **Owns** | Cloud deploy unit、IAM 境界（設計） |
| **Does Not Own** | Domain logic、Local deterministic foundation |
| **Allowed Inputs** | Runtime spec、artifacts |
| **Allowed Outputs** | Cloud execution logs、artifacts |
| **Allowed Dependencies** | Runtime abstraction（local 完了後） |
| **Forbidden Dependencies** | Cloud 必須化 of local foundation、vendor lock-in 無 ADR |
| **Public Contract Impact** | Cloud Runtime は Contract **非影響** |
| **Entry Criteria Reference** | [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — Cloud Runtime Entry Criteria |
| **Implementation Status** | **Prohibited** |

---

## Cache Boundary

| 項目 | 定義 |
|------|------|
| **Responsibility** | 将来: derived data の高速参照 |
| **Owns** | Cache key、TTL 方針 |
| **Does Not Own** | Source of truth、Authoritative state |
| **Allowed Inputs** | JSON artifact hash、derived computation result |
| **Allowed Outputs** | Cached JSON（miss 時は recompute） |
| **Allowed Dependencies** | Provider/Runtime（読取加速のみ） |
| **Forbidden Dependencies** | Cache を SoT 代替、Application 状態保存 |
| **Public Contract Impact** | Cache は Public Contract **外**（透明） |
| **Entry Criteria Reference** | External API / Provider Entry Criteria（間接） |
| **Implementation Status** | **Prohibited** |

---

## Real Metrics Boundary

| 項目 | 定義 |
|------|------|
| **Responsibility** | 将来: 実投稿・実エンゲージメント metrics |
| **Owns** | Real metrics ingestion（Privacy ADR 後） |
| **Does Not Own** | Developer Automation metrics（Platform 分離） |
| **Allowed Inputs** | SNS API / External metrics（承認後） |
| **Allowed Outputs** | Metrics Public Contract JSON |
| **Allowed Dependencies** | Provider、Adapter、SNS API |
| **Forbidden Dependencies** | Platform metrics 混同、PII 無 ADR 公開 |
| **Public Contract Impact** | real-metrics contract（将来・Catalog） |
| **Entry Criteria Reference** | [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — Real Metrics Entry Criteria |
| **Implementation Status** | **Prohibited** |

---

## Real Automation Boundary

| 項目 | 定義 |
|------|------|
| **Responsibility** | 将来: Continuous Improvement 結果に基づく自動アクション |
| **Owns** | Approval gate、automation spec（Human-in-the-loop 初期） |
| **Does Not Own** | Content generation core、自動投稿（Explicit Non-Goal 直到 Release） |
| **Allowed Inputs** | Continuous Improvement Public Contract |
| **Allowed Outputs** | Draft update 要求（非 auto-post） |
| **Allowed Dependencies** | Application Foundation output、Runtime |
| **Forbidden Dependencies** | Level 4 前の自動投稿、Governance バイパス |
| **Public Contract Impact** | automation-spec contract（将来・ADR 必須） |
| **Entry Criteria Reference** | [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — Real Automation Entry Criteria |
| **Implementation Status** | **Prohibited** |

---

## Allowed Dependency Direction

```text
Application Layer
  ↓ (Public Contract JSON only — no direct Future import)
Future Layer:
  Real Automation → Runtime → Foundation CLIs
  Scheduler → Runtime → Foundation CLIs
  Worker → Runtime
  Queue → Worker
  Provider → External API
  Adapter → Provider output
  Runtime → Foundation (invoke only)
  OAuth → (private token to Provider/Adapter)
  SNS API → Provider + Adapter + OAuth
  Database → Runtime I/O (approved only)
  Cloud Runtime → Runtime abstraction
  Cache → (transparent read-through)
  Real Metrics → Provider / SNS API
```

**原則:**

- Application Layer must **not** depend on Provider / Runtime / Scheduler **directly**
- Future Layers must depend on **Public Contracts**, not private internals
- Provider must **not** own business workflow logic
- Runtime must **not** own provider-specific behavior
- Scheduler must **not** own content generation logic
- OAuth must **not** own SNS publishing behavior
- Database must **not** become source of truth **before approved**
- Queue / Worker must **not** bypass [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md)

---

## Forbidden Dependencies

| 禁止 | 理由 |
|------|------|
| Direct external API calls from Application Layer | Provider Isolation 違反 |
| Provider logic inside Application Layer | Layer 侵食 |
| Runtime behavior inside Provider | 責務逆転 |
| Scheduler behavior inside Content Generation | Domain 混同 |
| OAuth secrets inside public contracts | Security 違反 |
| Database schema assumptions before Database Entry Criteria | SoT 未承認 |
| Queue / Worker side effects before approval | Non-Goals 違反 |
| Real Automation before Level 4 | Maturity Gate 未通過 |
| Cache as source of truth | Data Ownership 違反 |
| Background Job / Message Broker without Governance Flow | Process バイパス |

---

## Public Contract Boundaries

- [Public Contract Catalog](../../reports/public-contract-catalog/latest/public-contract-catalog.json) と **整合必須**
- Future Layers は **Public Contract を通じて** Application と接続
- Private implementation details（Provider URL、OAuth token、DB connection）は **公開禁止**
- Breaking change は **原則禁止** — 例外は [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md) + ADR
- Public Contract 変更時: ADR + Compatibility Review + [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) 必須

---

## Data Ownership Boundaries

| データ | 所有者（v1.52.0） |
|--------|-------------------|
| Foundation output JSON | **JSON Source — source of truth** |
| Public Contract Catalog | Governance Layer |
| Database rows | **未所有**（SoT ではない — 承認前） |
| Cache entries | **Derived only** — 再計算可能 |
| Queue messages | **Transport only** — SoT ではない |
| Worker state | **Ownership なし** — Runtime 委譲 |
| Provider raw response | **正規化後のみ** Foundation へ |

---

## Side Effect Boundaries

- Side effects are **isolated to approved future layers only**（現時点: 全 Future Layer **未承認**）
- Application Layer remains **deterministic where possible**
- External IO requires **Future Entry Criteria approval** + Non-Goals Release
- **Background execution remains prohibited**（v1.52.0）
- Side effect 追加は [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) — implementation enabling change 分類

---

## Runtime Isolation Boundaries

- **Runtime selection must not affect Public Contract**
- Runtime implementation must be **replaceable**（local / CI / cloud）
- **Cloud Runtime is not required** for local deterministic foundation
- Runtime must **not own domain logic** — orchestration のみ
- Developer Automation Workflow（Platform）≠ Future Runtime

---

## Testing Boundaries

Boundary 関連の Machine Check（Quality Pipeline）は以下を検証:

| 検証 | 内容 |
|------|------|
| 文書存在 | FUTURE_LAYER_BOUNDARIES.md |
| 必須見出し | Purpose 〜 Related Documents |
| 実装禁止 | Implementation Status: Prohibited |
| Level 4 未宣言 | Current Maturity Level 2.5 |
| 依存方向 | Allowed Dependency Direction 節 |
| 禁止依存 | Forbidden Dependencies 節 |
| 統合 | Future Entry Criteria + Governance Flow 参照 |

Test 471–482（v1.52.0）。PASS 数 ≠ Boundary 承認。

---

## Documentation Boundaries

Boundary 変更時の **必須更新**:

| 文書 | 更新内容 |
|------|----------|
| [docs/architecture/README.md](./README.md) | 文書数・インデックス |
| [README.md](../../README.md) | バージョンセクション |
| [docs/CHANGELOG.md](../CHANGELOG.md) | 設計判断 |
| [docs/VERSION.md](../VERSION.md) | Current Version・PASS 数 |

[FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) との **矛盾禁止** — 矛盾時は Governance Flow で ADR。

---

## Future Entry Criteria Integration

- 各 Layer Boundary は対応 **Entry Criteria 節** を参照（上表 Entry Criteria Reference）
- Boundary 定義 ≠ Entry Criteria **充足**
- Entry Criteria 完了 ≠ **Level 4** 自動到達
- Level 4 には Entry Criteria Gate **全項目** + Governance Flow **全 Review** が必要

---

## Governance Flow Integration

- 境界変更は [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) — **future layer design change** または **implementation enabling change** 分類
- Implementation-enabling 変更には **ADR + Risk + Compatibility + Public Contract + Compliance Review** 必須
- Boundary 文書追加（v1.52.0 型）は **architecture governance change** — Production Code 変更なし

---

## Completion Criteria

Future Layer Boundaries 文書の完成条件（v1.52.0）:

- [x] FUTURE_LAYER_BOUNDARIES.md 存在
- [x] 全必須見出し・14 Future Layer 境界定義
- [x] Architecture Documents **23** 必須文書
- [x] Quality Pipeline **482 PASS**（Test 471–482）
- [x] Production Code **変更なし**
- [x] Level 4 **未宣言**
- [x] Implementation **Prohibited** 維持

---

## Prohibited Shortcuts

| Shortcut | 理由 |
|----------|------|
| Boundary 定義 = Implementation 許可 | Non-Goals 違反 |
| Application から Provider 直接 import | Forbidden Dependencies |
| Database を SoT に昇格（未承認） | Data Ownership 違反 |
| Public Contract に secret 記載 | Security 違反 |
| PASS 数だけで Level 4 宣言 | [QUALITY_GOVERNANCE.md](./QUALITY_GOVERNANCE.md) 違反 |
| Governance Flow 省略 | Process 違反 |
| 一括 Future Layer 解除 | Entry Criteria 違反 |

---

## Related Documents

| 文書 | 関係 |
|------|------|
| [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) | 将来設計構想 |
| [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) | Entry Gate（What） |
| [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) | Review Process（How） |
| [NON_GOALS.md](./NON_GOALS.md) | 実装禁止 |
| [LAYER_MODEL.md](./LAYER_MODEL.md) | Layer 構造 |
| [DEPENDENCY_RULES.md](./DEPENDENCY_RULES.md) | 依存方向 |
| [ARCHITECTURE_MATURITY_MODEL.md](./ARCHITECTURE_MATURITY_MODEL.md) | 成熟度 |
