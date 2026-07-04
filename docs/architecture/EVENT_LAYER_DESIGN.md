# Event Layer Design

Future **Event Layer** の trigger / input / signal concept を Architecture Contract として分類・定義する Design 基準書です。**Event 実装・Event Receiver ではありません**。

> **重要（v1.59.0）:** 本書は **Design Only**。Production Code 変更なし。**Implementation Ready（Level 4）ではありません。** Automation / Workflow / Scheduler / Runtime / Provider 各 Layer Design の責務は **変更しません**。

---

## 1. Purpose

Event Layer は、Future Automation Architecture における **trigger / input / signal concept** を分類し、**Architecture Contract** として定義する Future Layer 設計領域です。

- **Event Contract** — 将来実装前の event 記述契約
- **Event Classification** — Manual / Scheduled / Webhook / SNS / External / Approval / System
- **Input / output boundary** — payload 参照・形状宣言
- **Layer boundary** — Automation / Workflow / Scheduler / Runtime / Provider との責務分離
- **Observability metadata** — 相関・因果・観測要件

Event Layer は **Event を受信・永続化・実行しない**。

---

## 2. Scope

| 対象 | 内容 |
|------|------|
| Event Contract | architecture contract（schema 実装なし） |
| Event Classification | 7 分類と境界 |
| Input / Output Boundary | payloadRef / payloadShape |
| Automation / Workflow / Scheduler / Runtime / Provider Boundary | 委譲・非侵食 |
| Event Receiver / Webhook Receiver / Message Broker Boundary | 設計境界のみ |
| Queue / Worker Boundary | future concern |
| Observability / Testing / Anti-Patterns / Sequence | Design Only |

Application / Platform Layer の **既存 Public Contract** は変更しません。

---

## 3. Non-Goals

Event Layer は以下を **行わない**:

- **Event implementation** / **Event receiver** / **Webhook receiver**
- **SNS Event ingestion** / **External API connector**
- **Runtime / Scheduler / Workflow / Automation / Provider / Adapter implementation**
- **OAuth / SNS API / External API** 呼び出し
- **Database** — Event **永続化禁止**
- **Queue / Worker / Message Broker / Background Job**
- **Cloud Runtime / Cache / Real Metrics / Real Automation**
- **DAG executor / State machine runtime / Cron / Step runner**
- **Production Code** 変更
- **Level 4 Implementation Ready** 到達を意味しない

Event Layer は以下を **直接行ってはいけない**:

- Runtime を起動する / Workflow を実行する / Scheduler を登録する
- Provider / SNS API / External API を呼び出す
- Queue に enqueue する / Worker を起動する
- Webhook を受信する / Event を永続化する

---

## 4. Relationship to Future Layer Boundaries

| 観点 | 内容 |
|------|------|
| 前提 | [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) — Event / trigger 領域 |
| 本書 | trigger / signal **分類 contract** の詳細化 — Boundary **非変更** |
| 責務 | Event 記述・分類のみ — execution / ingestion 実装は **侵害しない** |

---

## 5. Relationship to Layer Interaction Model

| 観点 | 内容 |
|------|------|
| Event | [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) §14 Event Boundaries 整合 |
| Command / Query | Event は **signal 宣言** — Command execution は下位 Layer |
| Async | Event 受信処理は **将来 ingress** — v1.59.0 未実装 |
| Error | Event contract 検証失敗のみ Event 設計領域 |

---

## 6. Relationship to Provider Layer Design

| 観点 | 内容 |
|------|------|
| Provider | capability 抽象化 — [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md) |
| Event | external signal **分類・契約** のみ |
| 禁止 | **Provider direct call 禁止** |
| 解決 | external IO は Provider + Adapter（将来）— Event は **呼び出さない** |

Provider 責務変更 **禁止**。

---

## 7. Relationship to Runtime Layer Design

| 観点 | 内容 |
|------|------|
| Runtime | execution lifecycle — [RUNTIME_LAYER_DESIGN.md](./RUNTIME_LAYER_DESIGN.md) |
| Event | `targetRuntimeContract` **参照宣言** のみ |
| 禁止 | Runtime **起動禁止** — lifecycle / orchestration 非所有 |

Runtime 責務変更 **禁止**。

---

## 8. Relationship to Scheduler Layer Design

| 観点 | 内容 |
|------|------|
| Scheduler | trigger timing — [SCHEDULER_LAYER_DESIGN.md](./SCHEDULER_LAYER_DESIGN.md) |
| Event | Scheduled Event **分類・契約** |
| 禁止 | Scheduler **登録禁止** — trigger 判定・cron 非所有 |

Scheduler 責務変更 **禁止**。

---

## 9. Relationship to Automation Layer Design

| Layer | 責務 |
|-------|------|
| **Automation** | workflow intent / automation contract — [AUTOMATION_LAYER_DESIGN.md](./AUTOMATION_LAYER_DESIGN.md) |
| **Event** | trigger / signal **分類** — automation decisioning 非所有 |

- Event は `targetAutomationContract` **参照** — Automation intent **決定しない**
- **Automation との責務重複を避ける**

Automation 責務変更 **禁止**。

---

## 10. Relationship to Workflow Layer Design

| Layer | 責務 |
|-------|------|
| **Workflow** | structure contract — [WORKFLOW_LAYER_DESIGN.md](./WORKFLOW_LAYER_DESIGN.md) |
| **Event** | signal が workflow を **trigger しうる** 分類（契約のみ） |

- Event は `targetWorkflowContract` **参照** — Workflow **実行しない**
- **Workflow との責務混同を避ける**

Workflow 責務変更 **禁止**。

---

## 11. Event Principles

| 原則 | 内容 |
|------|------|
| Contract Not Implementation | Architecture contract のみ |
| Classification First | eventType / eventClass 明示 |
| No Ingestion | receiver / webhook 非実装 |
| No Persistence | Event 永続化禁止 |
| No Direct Provider | Provider direct call 禁止 |
| No Runtime Start | Runtime 起動禁止 |
| No Schedule Registration | Scheduler 登録禁止 |
| Correlation Explicit | correlationId / causationId |
| Idempotency Aware | idempotencyKey 設計 |
| Governance First | [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) 経由 |

---

## 12. Event Responsibility

### Event Layer の責務

| 責務 | 説明 |
|------|------|
| Event Contract 定義 | architecture contract |
| Event Classification | 7 分類 |
| Input / output boundary | payloadRef / payloadShape |
| Layer target 参照宣言 | target*Contract refs |
| Receiver / broker **境界定義** | 実装なし |
| Observability metadata | 相関・観測要件 |

### Event Layer の責務ではないもの

| 非責務 | 所属 |
|--------|------|
| Event 受信・配送 | Event Receiver（将来 — 未実装） |
| Webhook HTTP 処理 | Webhook Receiver（将来） |
| SNS / External API 呼び出し | Provider + Adapter |
| Scheduler trigger 実行 | Scheduler |
| Runtime execution | Runtime |
| Queue enqueue | Queue（将来） |
| Message routing | Message Broker（将来） |

---

## 13. Event Contract

Event Contract は **Architecture Contract**（**schema file / production code なし**）。

| フィールド | 説明 |
|------------|------|
| `eventId` | 一意 event 識別子 |
| `eventType` | 分類タイプ |
| `eventSource` | 発生源識別 |
| `eventClass` | Manual / Scheduled / Webhook / SNS / External / Approval / System |
| `eventVersion` | contract バージョン |
| `occurredAt` | 発生時刻（設計） |
| `receivedAt` | 受信時刻（設計 — Event Layer は受信しない） |
| `correlationId` | トレース相関 |
| `causationId` | 因果 chain |
| `actor` | 主体宣言 |
| `subject` | 対象宣言 |
| `payloadRef` | payload 参照 |
| `payloadShape` | 形状宣言（schema 実装なし） |
| `metadata` | 追加メタデータ |
| `idempotencyKey` | 重複防止 |
| `compatibilityPolicy` | 互換ポリシー参照 |
| `approvalContext` | Approval Event 用 |
| `targetAutomationContract` | Automation 参照 |
| `targetWorkflowContract` | Workflow 参照 |
| `targetSchedulerContract` | Scheduler 参照 |
| `targetRuntimeContract` | Runtime 参照 |

---

## 14. Event Classification

| eventClass | 概要 |
|------------|------|
| Manual Event | 明示的 operator / CLI signal |
| Scheduled Event | 時刻・間隔 signal（cron 非実装） |
| Webhook Event | 外部 HTTP callback signal（receiver 非実装） |
| SNS Event | SNS 由来 signal（ingestion 非実装） |
| External Event | 外部システム signal（connector 非実装） |
| Approval Event | 承認 gate signal |
| System Event | 内部 system / governance signal |

各分類は §15–§21 で詳述。

---

## 15. Manual Event

| 観点 | 内容 |
|------|------|
| 表すもの | operator 明示 intent / manual trigger signal |
| 関係 Layer | Automation（intent）→ Scheduler manual path（将来） |
| Event 責務 | Manual Event **contract 分類・宣言** |
| 他 Layer 責務 | Scheduler trigger 解釈・Runtime 実行 |
| 禁止 | Event receiver / Runtime 起動 |

---

## 16. Scheduled Event

| 観点 | 内容 |
|------|------|
| 表すもの | 時刻・間隔ベース signal |
| 関係 Layer | Scheduler Scheduled Event contract（将来） |
| Event 責務 | Scheduled Event **分類・契約** |
| 他 Layer 責務 | Scheduler timing / cron（将来） |
| 禁止 | Cron 実装 / Scheduler 登録 |

---

## 17. Webhook Event

| 観点 | 内容 |
|------|------|
| 表すもの | 外部 HTTP callback 由来 signal |
| 関係 Layer | Webhook Receiver（将来）→ Scheduler / Automation |
| Event 責務 | Webhook Event **contract 分類** |
| 他 Layer 責務 | HTTP 受信・検証（**Webhook Receiver Boundary** — 将来） |
| 禁止 | **Webhook を受信しない** |

---

## 18. SNS Event

| 観点 | 内容 |
|------|------|
| 表すもの | SNS プラットフォーム由来 signal |
| 関係 Layer | SNS API / Provider（将来） |
| Event 責務 | SNS Event **分類・契約** |
| 他 Layer 責務 | SNS API 呼び出し・ingestion（**SNS API Boundary** — Provider 経由将来） |
| 禁止 | **SNS API を呼び出さない** / SNS Event ingestion 非実装 |

---

## 19. External Event

| 観点 | 内容 |
|------|------|
| 表すもの | 一般外部システム signal |
| 関係 Layer | External API connector（将来 — Provider + Adapter） |
| Event 責務 | External Event **分類・契約** |
| 他 Layer 責務 | External API IO |
| 禁止 | **External API connector 実装禁止** / direct API call |

---

## 20. Approval Event

| 観点 | 内容 |
|------|------|
| 表すもの | 承認 gate に関する signal |
| 関係 Layer | Automation approval boundary / Workflow approval point |
| Event 責務 | `approvalContext` **宣言** |
| 他 Layer 責務 | 承認 **実行**（将来 gate） |
| 禁止 | 承認処理実行 |

---

## 21. System Event

| 観点 | 内容 |
|------|------|
| 表すもの | governance / platform internal signal |
| 関係 Layer | Governance Flow / observability（設計） |
| Event 責務 | System Event **分類** |
| 他 Layer 責務 | 実処理は該当 Layer |
| 禁止 | Hidden automation |

---

## 22. Event Input Boundary

- `payloadRef` / `payloadShape` は **入力宣言**
- Event Layer は payload を **解析実行しない**
- Input validation 実行は Receiver / Runtime（将来）

---

## 23. Event Output Boundary

- Event Contract 出力は **下位 Layer への参照宣言**
- Event Layer は processing **結果を生成しない**
- Output は Runtime / Application artifact 領域

---

## 24. Automation Boundary

| ルール | 内容 |
|--------|------|
| A1 | `targetAutomationContract` **参照のみ** |
| A2 | Automation intent **決定しない** |
| A3 | **Automation との責務重複を避ける** |

---

## 25. Workflow Boundary

| ルール | 内容 |
|--------|------|
| W1 | `targetWorkflowContract` **参照のみ** |
| W2 | Workflow **実行しない** |
| W3 | **Workflow との責務混同を避ける** |

---

## 26. Scheduler Boundary

| ルール | 内容 |
|--------|------|
| S1 | `targetSchedulerContract` **参照のみ** |
| S2 | Scheduler **登録しない** |
| S3 | **Scheduler との責務混同を避ける** |

---

## 27. Runtime Boundary

| ルール | 内容 |
|--------|------|
| R1 | `targetRuntimeContract` **参照のみ** |
| R2 | Runtime **起動しない** |
| R3 | **Runtime との責務混同を避ける** |

---

## 28. Provider Boundary

| ルール | 内容 |
|--------|------|
| P1 | External capability signal は **分類のみ** |
| P2 | **Provider direct call 禁止** |
| P3 | SNS / External API は Provider + Adapter path（将来） |

---

## 29. Adapter Boundary

- Adapter-specific detail を Event Contract に **埋め込まない**
- External normalization は Provider + Adapter — Event は **signal 宣言**

---

## 30. State Boundary

| ルール | 内容 |
|--------|------|
| ST1 | Event **永続化禁止** |
| ST2 | Event Layer は execution state **source of truth にならない** |
| ST3 | State 所有は Application / Runtime |

---

## 31. Side Effect Boundary

| ルール | 内容 |
|--------|------|
| SE1 | Event Layer 自身は **Side Effect なし** |
| SE2 | Hidden side effect **禁止** |

---

## 32. Queue Boundary

| ルール | 内容 |
|--------|------|
| Q1 | **Queue に enqueue しない** |
| Q2 | Queue は **future implementation concern** |
| Q3 | **Queue / Worker boundary is explicit** — Event は message 送信しない |

---

## 33. Worker Boundary

| ルール | 内容 |
|--------|------|
| WB1 | **Worker を起動しない** |
| WB2 | Worker は **future implementation concern** |
| WB3 | Background execution **禁止** |

---

## 34. Observability

観測（設計 — Real Metrics **非実装**）:

| 要素 | 意味 |
|------|------|
| `correlationId` / `causationId` | 分散トレース相関 |
| `metadata` | 観測タグ |
| Event Layer | contract 宣言のみ — **event 発火実装なし** |

---

## 35. Testing Strategy

Design / Machine Check（**Event receiver 実行なし**）:

| 検証 | 内容 |
|------|------|
| Contract fields | eventId / eventClass / target* |
| Classification | 7 分類整合 |
| Boundary | Receiver / Queue / Provider 非侵食 |
| Documentation | Quality Pipeline Test 581–600 |

---

## 36. Anti-Patterns

| Anti-Pattern | 問題 |
|--------------|------|
| Event Layer as Event Receiver | ingestion 混同 |
| Webhook handling in Event Layer | receiver 侵食 |
| Provider direct call from Event | Boundary 違反 |
| Runtime start from Event | execution 混同 |
| Scheduler registration from Event | trigger ownership 違反 |
| Event persistence as source of truth | State 違反 |
| Message Broker operation in Event Layer | broker 侵食 |
| SNS API call from Event Layer | External API 違反 |
| Mixing event classification with workflow execution | Workflow 混同 |
| Real Automation before Level 4 | Maturity 違反 |

---

## 37. Sequence Examples

Architecture Sequence（**実装なし**）。

### Manual Event → Automation → Scheduler

```text
Manual Event (contract)
  ↓
targetAutomationContract (reference)
  ↓
targetSchedulerContract (reference — Event does not register)
  ↓
Scheduler (future) → Runtime (future)
```

### Webhook Event Boundary

```text
External HTTP (future)
  ↓
Webhook Receiver (future — NOT Event Layer)
  ↓
Webhook Event (contract classification only)
  ↓
Scheduler / Automation (future references)
```

### SNS Event Boundary

```text
SNS Platform (future)
  ↓
SNS ingestion (future — NOT Event Layer)
  ↓
SNS Event (contract)
  ↓
Provider path (future — Event does not call SNS API)
```

---

## 38. Governance Flow Integration

- Event Layer Design 変更 = **future layer design change**（[GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md)）
- Event **実装** = implementation enabling change — Entry Criteria + 全 Review
- v1.59.0 = architecture governance change — **Production Code 変更なし**

---

## 39. Future Entry Criteria Integration

- [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — External API / SNS / Real Automation Entry Gate
- 本書は **Event contract 設計詳細**
- Event Design 完成 ≠ Level 4 自動到達
- **Event Layer Design review 後** に v1.60.0 候補を決定

---

## 40. Compatibility Requirements

- Application Foundation / Public Contract **後方互換**
- Automation / Workflow / Scheduler / Runtime / Provider **非変更**
- Event Contract 追加は **additive default**
- **将来拡張性** — eventClass 追加は additive
- **保守性** — classification と boundary 分離
- Breaking change → ADR + [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md)

---

## 41. Completion Criteria

Event Layer Design 文書の完成条件（v1.59.0）:

- [x] EVENT_LAYER_DESIGN.md 存在（§1–§41）
- [x] 下位 Layer 責務 **非変更**
- [x] Event **実装なし** — receiver / webhook / ingestion **なし**
- [x] Production Code **変更なし**
- [x] Architecture Documents **30** 必須文書
- [x] Quality Pipeline **600 PASS**（Test 581–600）
- [x] Level 4 **未宣言**

---

## Related Documents

| 文書 | 関係 |
|------|------|
| [WORKFLOW_LAYER_DESIGN.md](./WORKFLOW_LAYER_DESIGN.md) | Workflow — 非実行 |
| [AUTOMATION_LAYER_DESIGN.md](./AUTOMATION_LAYER_DESIGN.md) | Automation intent |
| [SCHEDULER_LAYER_DESIGN.md](./SCHEDULER_LAYER_DESIGN.md) | Scheduler trigger |
| [RUNTIME_LAYER_DESIGN.md](./RUNTIME_LAYER_DESIGN.md) | Runtime execution |
| [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md) | Provider — 非 invoke |
| [NON_GOALS.md](./NON_GOALS.md) | 実装禁止 |

---

## Event Receiver / Webhook Receiver / Message Broker Boundary（明示）

| 境界 | Event Layer | 将来 Layer（未実装） |
|------|-------------|---------------------|
| **Event Receiver Boundary** | contract 分類のみ | HTTP/queue ingress が受信 |
| **Webhook Receiver Boundary** | Webhook Event 分類のみ | HTTP webhook 処理 |
| **Message Broker Boundary** | broker 操作禁止 | routing / delivery |

**Event Receiver boundary is explicit:** Event Layer は receiver **ではない**。
