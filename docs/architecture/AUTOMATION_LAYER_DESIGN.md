# Automation Layer Design

Future **Automation Layer** の workflow intent・automation contract・automation boundary を定義する Architecture Design 基準書です。**Automation 実装ではありません**。

> **重要（v1.57.0）:** 本書は **Design Only**。Production Code 変更なし。**Implementation Ready（Level 4）ではありません。** Scheduler / Runtime / Provider 各 Layer Design の責務は **変更しません**。

---

## Layer Responsibility（固定）

```text
Provider   = 外部 capability を抽象化する
Runtime    = execution lifecycle / orchestration / execution context を管理する
Scheduler  = Runtime をいつ・どの条件で起動するかを管理する
Automation = workflow intent / automation contract / automation boundary / approval boundary を定義する
```

Automation は **実行しない**。Scheduler の timing decision、Runtime の lifecycle、Provider invoke は **Automation の責務ではない**。

---

## Automation Purpose

Automation Layer は **「何を自動化したいのか」** を Architecture Contract として定義する Future Layer 設計領域です。

- **Workflow intent** — 自動化したい業務意図（実行ではない）
- **Automation contract** — Scheduler / Runtime へ渡す設計上の契約参照
- **Automation boundary** — 各 Layer との責務境界
- **Approval boundary** — Human-in-the-loop gate 設計

Automation Layer は実行を担当しません。Scheduler / Runtime / Provider / Queue / Worker を **所有・実装しません**。

---

## Automation Scope

| 対象 | 内容 |
|------|------|
| Automation Contract | architecture contract のみ |
| Automation Intent Model | intent 分類・宣言 |
| Workflow / Trigger Boundary | workflow 範囲・trigger 意図 |
| Scheduler / Runtime / Provider Boundary | 委譲境界 |
| Adapter Boundary | Adapter 経由原則（Automation 非 invoke） |
| State / Side Effect Boundary | 状態・副作用の非所有 |
| Queue / Worker Boundary | 将来 Layer 接続点 |
| Manual / Scheduled / Event-based Automation | 設計パターン |
| Human Approval Boundary | 承認 gate |
| Observability / Testing / Anti-Patterns | Design Only |

Application / Platform Layer の **既存 Public Contract** は変更しません。

---

## Automation Non-Goals

Automation は以下を **行わない**（Non-Goals）:

- **実行しない** — execution lifecycle 非所有
- **Scheduler を持たない** — timing / trigger decision 非所有
- **Runtime を持たない** — orchestration 非所有
- **Provider を呼ばない** — direct Provider invocation 禁止
- **Queue を管理しない** — queue implementation 禁止
- **Worker を管理しない** — worker lifecycle 禁止
- **Webhook を受信しない** — webhook receiver 禁止
- **Cron を持たない** — cron implementation 禁止
- **Background Job を持たない** — background job 禁止
- **Message Broker を持たない** — message broker 禁止
- **External API を呼ばない** — external API call 禁止
- **Real Automation を実装しない** — 本番自動実行禁止
- **Side Effect を発生させない** — side effect 禁止
- **Production Code** 変更禁止
- **Level 4 Implementation Ready** 到達を意味しない

---

## Relationship to Future Layer Boundaries

| 観点 | 内容 |
|------|------|
| 前提 | [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) — **Real Automation Boundary** |
| 本書 | Boundary の **詳細化** — Boundary **非変更** |
| 責務 | Automation intent / contract のみ — 下位 Layer execution は **侵害しない** |

---

## Relationship to Layer Interaction Model

| 観点 | 内容 |
|------|------|
| Command / Query | Automation は **intent 宣言** — Command execution は Scheduler / Runtime |
| Event | Event-based automation は **intent 設計** — event 処理実装は Scheduler |
| Error | Automation contract 検証失敗のみ Automation 領域 |
| Async | Queue/Worker 経由は **境界定義のみ** — 未実装（v1.57.0） |

---

## Relationship to Provider Layer Design

| 観点 | 内容 |
|------|------|
| Provider | External capability 抽象化 — [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md) |
| Automation | Provider を **直接呼び出さない** |
| 経路 | Automation → Scheduler Contract → Runtime → Provider（将来） |

Provider 責務変更 **禁止**。

---

## Relationship to Runtime Layer Design

| 観点 | 内容 |
|------|------|
| Runtime | execution lifecycle / orchestration — [RUNTIME_LAYER_DESIGN.md](./RUNTIME_LAYER_DESIGN.md) |
| Automation | `targetRuntimeContract` **参照のみ** — Runtime **生成しない** |
| 禁止 | Automation 内の **execution logic** — lifecycle 非所有 |

Runtime 責務変更 **禁止**。

---

## Relationship to Scheduler Layer Design

| 観点 | 内容 |
|------|------|
| Scheduler | timing / trigger / Scheduling Contract — [SCHEDULER_LAYER_DESIGN.md](./SCHEDULER_LAYER_DESIGN.md) |
| Automation | `targetSchedulerContract` **参照のみ** — Scheduler **生成しない** |
| 禁止 | Automation 内の **scheduling logic** — trigger timing 非所有 |

Scheduler 責務変更 **禁止**。

---

## Automation Principles

| 原則 | 内容 |
|------|------|
| Intent First | 自動化は intent から始まる |
| Contract Not Execution | 出力は Architecture Contract のみ |
| No Direct Provider | Provider は Runtime 経由のみ |
| No Scheduler Ownership | timing decision は Scheduler |
| No Runtime Ownership | execution は Runtime |
| Explicit Approval | 高リスク intent は approval gate |
| Boundary Explicit | 各 Layer 境界を曖昧にしない |
| No Side Effect | Automation 自身は副作用なし |
| Observable Intent | intent 宣言に observability 要件 |
| Governance First | 変更は [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) 経由 |

---

## Automation Responsibility

### Automation の責務

| 責務 | 説明 |
|------|------|
| Workflow intent 定義 | 何を自動化したいか |
| Automation contract 定義 | Architecture Contract |
| Automation boundary 定義 | Layer 間境界 |
| Approval boundary 定義 | Human approval 要件 |
| Automation type 分類 | manual / scheduled / event / approval（設計） |

### Automation の責務ではないもの

| 非責務 | 所属 |
|--------|------|
| Execution / orchestration | Runtime |
| Scheduling / trigger timing | Scheduler |
| Provider capability | Provider |
| Queue / Worker | 将来 Layer |
| Business rule 実行 | Application Foundation |
| External IO | Provider + Adapter |

---

## Automation Contract

Automation Contract は **Architecture Contract のみ** — **実装を持たない**。

| フィールド | 説明 |
|------------|------|
| `automationId` | 一意 automation 識別子 |
| `automationType` | §Automation Type 参照 |
| `workflowIntent` | 自動化したい業務意図（宣言） |
| `targetSchedulerContract` | Scheduler へ委譲する契約参照 |
| `targetRuntimeContract` | Runtime 実行契約参照（間接 — Scheduler 経由） |
| `approvalRequirement` | 承認要否・gate 種別 |
| `stateRequirement` | 必要 state 宣言（所有は Application） |
| `sideEffectExpectation` | 期待副作用の **宣言**（Automation は発生させない） |
| `observabilityRequirement` | 観測要件 |
| `compatibilityRequirement` | Public Contract 互換要件 |

JSON schema / 実装コードは **v1.57.0 時点で追加しない**。

---

## Automation Intent Model

```text
Operator / System Policy
  → declares workflowIntent
  → selects automationType
  → builds Automation Contract
  → (optional) Human Approval
  → delegates targetSchedulerContract to Scheduler (future)
  → Scheduler delegates targetRuntimeContract to Runtime (future)
```

Intent は **宣言** — 解釈・実行は下位 Layer。

---

## Automation Type

将来拡張例（**実装ではない**）:

| automationType | 意味 |
|----------------|------|
| `manualAutomation` | 明示的 operator 起動 intent |
| `scheduledAutomation` | 時刻・間隔ベース intent |
| `eventBasedAutomation` | イベント駆動 intent |
| `approvalRequiredAutomation` | 承認 gate 必須 intent |

---

## Workflow Boundary

- Automation は **workflow の intent 範囲** を宣言する
- Workflow **実行 graph** は Runtime orchestration（将来）
- Automation は workflow step を **実装しない**
- Cross-workflow coupling は Governance + ADR

---

## Trigger Boundary

- Trigger **意図** は Automation Contract に含めうる
- Trigger **解釈・timing** は Scheduler — Automation は **scheduling logic を持たない**
- Event trigger の **受信・検証実装** は Scheduler / 将来 ingress — Automation 非所有

---

## Scheduler Boundary

| ルール | 内容 |
|--------|------|
| SB1 | Automation は `targetSchedulerContract` **参照を定義** |
| SB2 | Automation は Scheduler **を生成しない** |
| SB3 | Automation は **scheduling logic を持たない** — timing / trigger decision 非所有 |
| SB4 | Scheduler timing decision は [SCHEDULER_LAYER_DESIGN.md](./SCHEDULER_LAYER_DESIGN.md) 不变 |

---

## Runtime Boundary

| ルール | 内容 |
|--------|------|
| RB1 | Automation は `targetRuntimeContract` **参照を定義** |
| RB2 | Automation は Runtime **を生成しない** |
| RB3 | Automation は **execution logic を持たない** — lifecycle / orchestration 非所有 |
| RB4 | Runtime execution は [RUNTIME_LAYER_DESIGN.md](./RUNTIME_LAYER_DESIGN.md) 不变 |

---

## Provider Boundary

| ルール | 内容 |
|--------|------|
| PB1 | Automation は Provider を **直接呼び出さない** |
| PB2 | Provider invoke は Runtime → Provider path のみ（将来） |
| PB3 | Automation は Provider capability を **定義・実装しない** |
| PB4 | **Provider direct call 禁止** — Anti-Pattern |

---

## Adapter Boundary

- External capability へは **Provider + Adapter** のみ
- Automation は Adapter を **invoke しない**
- Adapter 選択は Provider / Runtime 領域

---

## State Boundary

| 状態 | 所有者 |
|------|--------|
| Automation contract metadata | Automation（設計 — 永続化は Entry Criteria 後） |
| Application artifact / checkpoint | Application |
| Runtime lifecycle state | Runtime |
| Scheduler evaluation state | Scheduler |
| Queue / Worker state | 将来 Layer |

Automation は execution state を **source of truth として保持しない**。

---

## Side Effect Boundary

| ルール | 内容 |
|--------|------|
| SE1 | Automation 自身は **Side Effect を発生させない** |
| SE2 | `sideEffectExpectation` は **宣言のみ** — 実行は Runtime / Provider path |
| SE3 | External API / Database / SNS **禁止** |
| SE4 | Hidden side effect **禁止** |

---

## Queue Boundary

| ルール | 内容 |
|--------|------|
| QB1 | Automation は Queue を **管理しない** |
| QB2 | Automation は Queue を **生成しない** |
| QB3 | **queue implementation 禁止** — enqueue / dequeue 定義なし |
| QB4 | Queue handoff 意図は Scheduler / Runtime contract 参照のみ |

---

## Worker Boundary

| ルール | 内容 |
|--------|------|
| WB1 | Automation は Worker を **管理しない** |
| WB2 | Automation は Worker を **生成しない** |
| WB3 | **worker implementation 禁止** — Worker lifecycle 非所有 |
| WB4 | Worker は Queue → Runtime path（将来）

---

## Manual Automation

設計パターン（**実装なし**）:

```text
Automation Intent
  ↓
Scheduler Contract
  ↓
Runtime Contract
```

- Operator が workflowIntent を宣言
- `automationType`: `manualAutomation`
- Scheduler manual trigger path へ委譲（将来）

---

## Scheduled Automation

```text
Automation Intent
  ↓
Scheduler Trigger Contract
  ↓
Runtime Contract
```

- 時刻・間隔 intent を宣言 — **Cron 非実装**
- `automationType`: `scheduledAutomation`
- Scheduler time-based path へ委譲（将来）

---

## Event-based Automation

```text
Automation Intent
  ↓
Scheduler Event Contract
  ↓
Runtime Contract
```

- イベント駆動 intent を宣言 — **Webhook receiver 非実装**
- `automationType`: `eventBasedAutomation`
- Scheduler event trigger path へ委譲（将来）

---

## Human Approval Boundary

| ルール | 内容 |
|--------|------|
| HA1 | `approvalRequiredAutomation` は **Human Approval** gate 必須 |
| HA2 | Approval **記録実装**は Entry Criteria 後 — v1.57.0 は boundary のみ |
| HA3 | Level 4 前の Real Automation は **approval gate 必須** |
| HA4 | Approval なし委譲 **禁止**（policy 違反 intent） |

```text
Automation Intent
  ↓
Human Approval
  ↓
Scheduler Contract
  ↓
Runtime Contract
```

---

## Observability

観測点（設計 — Real Metrics **非実装**）:

| Event | 意味 |
|-------|------|
| `automation_intent_declared` | intent 宣言 |
| `automation_contract_built` | Contract 完成 |
| `automation_approval_required` | 承認待ち |
| `automation_approval_granted` | 承認通過 |
| `automation_scheduler_delegated` | Scheduler 委譲（将来） |
| `automation_rejected` | boundary / policy 違反 |

---

## Testing Strategy

Design / Machine Check（**実 Automation 実行なし**）:

| 検証 | 内容 |
|------|------|
| Contract fields | automationId / workflowIntent / target* |
| Boundary validation | Provider / Runtime / Scheduler 非侵食 |
| Non-Goals | 実装禁止整合 |
| Sequence | intent → scheduler → runtime path |
| Documentation | Quality Pipeline Test 541–560 |

---

## Anti-Patterns

| Anti-Pattern | 問題 |
|--------------|------|
| Automation から Provider を直接呼ぶ | Provider Boundary 違反 |
| Automation が Runtime を生成する | Runtime Boundary 違反 |
| Automation が Scheduler の判断を行う | Scheduler Boundary 違反 |
| Automation が Queue を生成する | Queue Boundary 違反 |
| Automation が Worker を生成する | Worker Boundary 違反 |
| Automation が実処理を書く | execution logic 混同 |
| Automation が API を呼ぶ | External API 禁止 |
| Automation が Database を更新する | State / Side Effect 違反 |
| Automation が外部状態を変更する | Side Effect 違反 |
| Automation bypasses Governance Flow | Process 短絡 |
| Real Automation before Level 4 | Maturity 違反 |

---

## Sequence Examples

Architecture Sequence（**実装なし** — Runtime / Scheduler **未実装**）。

### Manual Automation

```text
Automation Intent
  ↓
Scheduler Contract
  ↓
Runtime Contract
```

### Scheduled Automation

```text
Automation Intent
  ↓
Scheduler Trigger Contract
  ↓
Runtime Contract
```

### Event-based Automation

```text
Automation Intent
  ↓
Scheduler Event Contract
  ↓
Runtime Contract
```

### Approval Required Automation

```text
Automation Intent
  ↓
Human Approval
  ↓
Scheduler Contract
  ↓
Runtime Contract
```

---

## Governance Flow Integration

- Automation Layer Design 変更 = **future layer design change**（[GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md)）
- Automation **実装** = implementation enabling change — [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) Real Automation Entry Criteria
- v1.57.0 = architecture governance change — **Production Code 変更なし**

---

## Future Entry Criteria Integration

- [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — **Real Automation Entry Criteria** が実装 Gate
- 本書は Entry Criteria の **設計詳細**
- Automation Design 完成 ≠ Level 4 自動到達
- Scheduler / Runtime Entry Criteria とは **独立** — 全 Gate 後に Real Automation

---

## Compatibility Requirements

- Application Foundation CLI / JSON output **後方互換**
- Scheduler / Runtime / Provider Layer Design **非変更**
- Automation Contract 追加は **additive default**
- Breaking change → ADR + [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md)

---

## Completion Criteria

Automation Layer Design 文書の完成条件（v1.57.0）:

- [x] AUTOMATION_LAYER_DESIGN.md 存在（必須見出しすべて）
- [x] Scheduler / Runtime / Provider 責務 **非変更**
- [x] Automation **実装なし**
- [x] Production Code **変更なし**
- [x] Architecture Documents **28** 必須文書
- [x] Quality Pipeline **560 PASS**（Test 541–560）
- [x] Level 4 **未宣言**

---

## Related Documents

| 文書 | 関係 |
|------|------|
| [SCHEDULER_LAYER_DESIGN.md](./SCHEDULER_LAYER_DESIGN.md) | Scheduler — 委譲先 |
| [RUNTIME_LAYER_DESIGN.md](./RUNTIME_LAYER_DESIGN.md) | Runtime — 間接参照 |
| [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md) | Provider — 非 invoke |
| [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) | Real Automation Boundary |
| [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) | Real Automation Entry Gate |
| [NON_GOALS.md](./NON_GOALS.md) | 実装禁止 |
