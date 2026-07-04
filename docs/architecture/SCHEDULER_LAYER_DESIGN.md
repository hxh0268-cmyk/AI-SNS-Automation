# Scheduler Layer Design

Future **Scheduler Layer** の実行タイミング・トリガー・スケジューリング契約を定義する Architecture Design 基準書です。Runtime の **上位** に位置し、**Scheduler 実装ではありません**。

> **重要（v1.56.0）:** 本書は **Design Only**。Production Code 変更なし。**Implementation Ready（Level 4）ではありません。** [RUNTIME_LAYER_DESIGN.md](./RUNTIME_LAYER_DESIGN.md) の Runtime 責務は **変更しません**。

---

## 責務分離（固定）

```text
Provider
= 外部 capability を抽象化し、安定した Provider Contract を提供する

Runtime
= Provider を含む各 Layer の実行・ライフサイクル・オーケストレーションを管理する

Scheduler
= Runtime をいつ・どの条件で起動するかを決定する Scheduling Contract を提供する
```

---

## Scheduler Purpose

Scheduler Layer は、Runtime を **いつ・どの条件で・どの Scheduling Context で・どの Execution Policy に基づいて** 起動・委譲するかを決定する Future Layer 設計領域です。

- **Timing / trigger decision** — 実行タイミングと起動条件
- **Scheduling Contract** 構築 — Runtime へ渡す **execution request**（実行結果ではない）
- **Scheduling Context** 作成
- **Execution Policy** 選択
- **Runtime delegation decision** — Runtime への委譲のみ

Scheduler は **実行そのものを担当しない**。Lifecycle / orchestration / Provider coordination は **Runtime の責務**。

---

## Scheduler Scope

| 対象 | 内容 |
|------|------|
| Scheduling Contract | Runtime 委譲用契約 |
| Trigger interpretation | triggerType / triggerSource 解釈 |
| Scheduling Context construction | schedule 単位コンテキスト |
| Execution Policy selection | 実行ポリシー選択 |
| Runtime delegation decision | Runtime execution request |
| Time-based scheduling design | 時刻・間隔トリガー（設計） |
| Event-based scheduling design | イベントトリガー（設計） |
| Manual execution design | 手動起動境界 |
| Retry policy boundary definition | retry 選択・委譲境界 |
| Queue / Worker boundary definition | 将来 Layer との接続点 |
| Future Automation boundary definition | Automation との境界 |

Application / Platform Layer の **既存 Public Contract** は変更しません。

---

## Scheduler Non-Goals

- **Cron implementation** — cron daemon / npm cron script 禁止
- **Queue implementation** — enqueue / dequeue 実装禁止
- **Worker implementation** — Worker 起動・lifecycle 禁止
- **Runtime implementation** — [RUNTIME_LAYER_DESIGN.md](./RUNTIME_LAYER_DESIGN.md) 非変更
- **Provider invocation** — Provider 直接呼び出し禁止
- **External API calls** — 外部 API 直接呼び出し禁止
- **OAuth flow execution** — OAuth 実行禁止
- **SNS API calls** — SNS API 呼び出し禁止
- **Database persistence** — DB 永続化禁止
- **Real automation** — 本番 Automation 実行禁止
- **Background job processing** — Background Job 処理禁止
- **Message broker operation** — Message Broker 操作禁止
- **Production Code** 変更禁止
- **Level 4 Implementation Ready** 到達を意味しない

---

## Relationship to Future Layer Boundaries

| 観点 | 内容 |
|------|------|
| 前提 | [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) — **Scheduler Layer Boundary** |
| 本書 | Boundary の **詳細化** — Boundary **非変更** |
| 責務 | Scheduling / trigger decision のみ — Runtime execution は **侵害しない** |
| 依存 | Scheduler → Runtime delegation（将来） |

---

## Relationship to Layer Interaction Model

| 観点 | 内容 |
|------|------|
| Command / Query | Scheduler は **Command intent**（execution request）を Runtime へ — Query path 非所有 |
| Sync / Async | 設計前提 — Queue/Worker **未実装**（v1.56.0） |
| Error | Scheduler は scheduling 失敗を記録 — Runtime execution error は Runtime 所有 |
| Retry | **Retry Policy Boundary** のみ — retry **実行**は Runtime / Queue / Worker |
| Timeout | Scheduler は scheduling window — Runtime deadline は Runtime 所有 |
| Event | Event trigger は Scheduler が **解釈** — event 処理実装は将来 Layer |

---

## Relationship to Runtime Layer Design

| Layer | 責務 |
|-------|------|
| **Scheduler** | いつ・条件・Scheduling Context・Execution Policy → **Runtime 委譲** |
| **Runtime** | Execution context、lifecycle、orchestration、Provider coordination |

- Scheduler は **Runtime lifecycle を所有しない**
- Scheduler は **Runtime execution request** を Scheduling Contract 経由で渡す（将来）
- Runtime 責務変更 **禁止** — 矛盾時は Governance Flow + ADR
- [RUNTIME_LAYER_DESIGN.md](./RUNTIME_LAYER_DESIGN.md) §20 Runtime Scheduler Boundary と **整合**

---

## Scheduler Principles

| 原則 | 内容 |
|------|------|
| Scheduling Contract First | すべての trigger は Contract で Runtime へ |
| No Execution Ownership | 実行 lifecycle は Runtime |
| No Provider Invocation | Provider は Runtime 経由のみ |
| No Direct External API | External IO は Provider+Adapter |
| Explicit Trigger Source | triggerSource は明示的 |
| Context Isolation | Scheduling context は schedule 単位 |
| Policy Before Delegation | Execution Policy 選択後に委譲 |
| Idempotency Awareness | idempotencyKey で重複 trigger 設計 |
| Observable Schedules | 各 schedule に observability 観測点 |
| Governance First | 変更は [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) 経由 |

---

## Scheduler Responsibility

### Scheduler の責務

| 責務 | 説明 |
|------|------|
| Trigger interpretation | time / event / manual trigger 解釈 |
| Scheduling Contract 構築 | Runtime 委譲用契約 |
| Scheduling Context 作成 | scheduleId、constraints、correlation |
| Execution Policy 選択 | 実行ポリシー決定 |
| Runtime delegation | execution request 委譲（将来） |
| Retry policy boundary | retry 方針 **選択・委譲境界** |
| Queue / Worker boundary | 将来 handoff **意図・境界** のみ |
| Automation boundary | Automation 条件と Runtime 起動条件の境界 |

### Scheduler の責務ではないもの

| 非責務 | 所属 |
|--------|------|
| Runtime lifecycle | Runtime Layer |
| Provider orchestration | Runtime Layer |
| Provider capability | Provider Layer |
| Queue enqueue/dequeue | Queue Layer（将来） |
| Worker lifecycle | Worker Layer（将来） |
| Retry execution / backoff | Runtime / Queue / Worker（将来） |
| Business logic | Application Layer |
| Execution result | Runtime output |

---

## Scheduling Contract

Scheduler の出力は **Runtime に渡す Scheduling Contract** であり、**実行結果ではない**。

設計上の概念（**実装コード・JSON schema は v1.56.0 時点で追加しない**）:

| フィールド | 説明 |
|------------|------|
| `scheduleId` | 一意スケジュール ID |
| `triggerType` | time / event / manual |
| `triggerSource` | トリガー発生源識別 |
| `targetRuntimeContract` | Runtime execution contract 参照 |
| `schedulingContext` | §Scheduling Context |
| `executionPolicy` | §Execution Policy |
| `requestedAt` | 委譲要求時刻（設計） |
| `constraints` | window / max concurrency 等 |
| `idempotencyKey` | 重複 trigger 防止 |
| `correlationId` | observability 相関 ID |

---

## Scheduling Model

```text
Trigger (time | event | manual)
  → Scheduler validates trigger
  → Scheduler builds Scheduling Context
  → Scheduler selects Execution Policy
  → Scheduler builds Scheduling Contract
  → Scheduler delegates execution request to Runtime (future)
  → Runtime owns execution lifecycle
```

- Scheduler は **schedule graph / cron expression を解釈する設計** のみ — Cron **実装なし**
- 同一 trigger の **重複委譲** は idempotencyKey + policy で抑制（設計）

---

## Trigger Model

| triggerType | 意味 |
|-------------|------|
| `time` | 時刻・間隔ベース |
| `event` | 外部・内部イベント |
| `manual` | 明示的オペレータ / CLI 要求 |

Trigger は **Scheduling Contract** の入力。Trigger 解釈後のみ Runtime 委譲。

---

## Trigger Sources

| 来源（設計） | 例 |
|--------------|-----|
| `time.cron_like` | 日次 batch window（将来 — cron 非実装） |
| `time.interval` | 固定間隔（設計） |
| `event.foundation_complete` | Foundation CLI 完了イベント（将来） |
| `event.governance_approved` | Governance 承認イベント（将来） |
| `manual.operator` | 手動実行要求 |
| `manual.cli` | Foundation CLI 相当の明示 invoke（境界定義のみ） |

Scheduler は triggerSource を **検証** — 未承認 source は委譲しない（設計）。

---

## Scheduling Context

Scheduling Context は **単一 schedule / trigger 評価** のメタデータ:

| 要素 | 内容 |
|------|------|
| `scheduleId` | スケジュール ID |
| `evaluatedAt` | 評価時刻（設計） |
| `triggerType` / `triggerSource` | トリガー情報 |
| `environmentRef` | local / ci / cloud（将来 — 値のみ） |
| `constraintsRef` | 実行制約 |
| `correlationId` | トレース相関 |
| `idempotencyKey` | 重複防止 |

Context は **shared mutable global 禁止** — schedule スコープのみ。

---

## Execution Policy

Execution Policy は Runtime 委譲時の **実行方針**（設計）:

| ポリシー要素 | 説明 |
|--------------|------|
| `priority` | 相対優先度（将来） |
| `concurrencyLimit` | 同時 Runtime run 上限（設計） |
| `retryPolicyRef` | §Retry Policy Boundary 参照 |
| `queueHandoffRef` | Queue 経由が必要か（境界のみ） |
| `manualApprovalRequired` | 手動承認 gate（Automation 整合） |

Policy **選択**は Scheduler — Policy **実行**は Runtime / Queue / Worker。

---

## Runtime Coordination

```text
Scheduler
  → build Scheduling Contract
  → validate targetRuntimeContract reference
  → delegate execution request to Runtime (future)
Runtime
  → accept request → create Execution Context
  → lifecycle / orchestration / Provider coordination
```

- Scheduler は Runtime に **execution request** を委譲する
- Runtime の lifecycle / orchestration / provider coordination は **Scheduler の責務ではない**
- Scheduler は Runtime の **running / completed / failed** 状態を **所有しない**
- Runtime から Scheduler への callback は observability event のみ（設計）

---

## Job Ownership

| 概念 | 所有者 |
|------|--------|
| Schedule definition | Scheduler（設計メタデータ） |
| Scheduling Contract | Scheduler 出力 → Runtime 入力 |
| Execution run / lifecycle | **Runtime** |
| Queue message | Queue Layer（将来） |
| Worker assignment | Worker Layer（将来） |
| Business outcome | Application Layer |

「Job」は **Scheduling Contract + Runtime run** の組み合わせとして設計上参照 — Scheduler は job **実行**を所有しない。

---

## Queue Boundary

Queue は **将来 Layer**。

| ルール | 内容 |
|--------|------|
| Q1 | Scheduler は Queue を **所有しない** |
| Q2 | Scheduler は Queue への **enqueue 実装を定義しない** |
| Q3 | Scheduler は Queue に渡す **意図・境界のみ** 定義（`queueHandoffRef`） |
| Q4 | 将来 Queue Layer が enqueue / dequeue / visibility timeout を所有 |
| Q5 | Scheduler → Queue は **optional handoff path**（ADR + Entry Criteria 後） |

---

## Worker Boundary

Worker は **将来 Layer**。

| ルール | 内容 |
|--------|------|
| W1 | Scheduler は Worker を **起動しない** |
| W2 | Worker lifecycle は **Scheduler の責務ではない** |
| W3 | Worker は Queue message 消費 → Runtime invoke（[RUNTIME_LAYER_DESIGN.md](./RUNTIME_LAYER_DESIGN.md) §22 整合） |
| W4 | Scheduler は Worker 数・slot を **管理しない** |

---

## Retry Policy Boundary

| 観点 | 所有者 |
|------|--------|
| Retry policy **選択・委譲境界** | Scheduler（Execution Policy 内 `retryPolicyRef`） |
| Retry **実行** | Runtime（orchestration-level） |
| Retry **backoff / re-enqueue** | Queue / Worker（将来） |
| Provider transient retry | Provider Layer |

Scheduler は retry policy を **定義・選択**できるが、retry の **実行・backoff・再実行制御**は Runtime / Queue / Worker 側の将来責務として **分離**する。

---

## Time-based Scheduling

設計モデル（**Cron 実装なし**）:

- **Schedule window** — 許可実行時間帯
- **Interval** — 最小間隔（設計値）
- **Missed trigger** — window 外は skip または manual へ（ADR 定義）
- **Clock source** — 単一 authority（将来 Cloud Runtime）

```text
Time Trigger
  -> Scheduler evaluates schedule
  -> Scheduler builds Scheduling Context
  -> Scheduler selects Execution Policy
  -> Scheduler delegates execution request to Runtime
  -> Runtime owns execution lifecycle
```

---

## Event-based Scheduling

```text
Event Trigger
  -> Scheduler validates trigger source
  -> Scheduler builds Scheduling Context
  -> Scheduler delegates to Runtime
```

- Event payload は **Scheduling Context 入力** — business 解釈は Application
- 未検証 event source → **委譲しない**
- Event ordering / dedup は Scheduler policy（設計）

---

## Manual Execution

```text
Manual Request
  -> Scheduler validates request boundary
  -> Scheduler builds Scheduling Context
  -> Scheduler delegates to Runtime
```

- Manual trigger は **明示的 operator intent** が必要
- Scheduler は request boundary（権限・Non-Goals）を **検証** — 認可実装は将来
- Manual は Production Automation **前**の唯一許可 path 設計（Level 4 前）

---

## Future Automation Boundary

Automation は **将来 Layer**。

| 観点 | 内容 |
|------|------|
| Automation | Continuous Improvement 等に基づく **action intent**（将来） |
| Scheduler | Automation 条件と Runtime 起動条件の **境界** を定義 |
| 禁止 | Scheduler が Automation workflow を **実装しない** |
| 禁止 | Automation が Provider / Runtime lifecycle を直接操作 |
| Human-in-the-loop | Level 4 前は approval gate 必須（Provider / Runtime Design 整合） |

---

## Scheduler Side Effect Rules

| ルール | 内容 |
|--------|------|
| S1 | Scheduler 自身の side effect = **Scheduling Contract 出力 + observability event** のみ |
| S2 | Hidden side effect **禁止** |
| S3 | External API / SNS / OAuth **禁止** |
| S4 | Database write **禁止** |
| S5 | Background execution **禁止**（v1.56.0） |
| S6 | Public Contract **mutation 禁止** |

---

## Scheduler State Ownership

| 状態 | 所有者 |
|------|--------|
| Schedule definition metadata | Scheduler（設計 — 将来永続化は Entry Criteria 後） |
| Last trigger evaluation | Scheduler coordination flags（in-memory 設計のみ） |
| Runtime lifecycle state | **Runtime** |
| Queue message state | Queue（将来） |
| Application artifact JSON | Application |

Scheduler は execution state を **source of truth として保持しない**。

---

## Scheduler Observability

観測点（設計 — Real Metrics **非実装**）:

| Event | 意味 |
|-------|------|
| `scheduler_trigger_received` | trigger 受信 |
| `scheduler_trigger_validated` | trigger 検証通過 |
| `scheduler_context_built` | Scheduling Context 完成 |
| `scheduler_policy_selected` | Execution Policy 選択 |
| `scheduler_contract_built` | Scheduling Contract 完成 |
| `scheduler_runtime_delegated` | Runtime 委譲（将来） |
| `scheduler_delegation_skipped` | 制約により skip |
| `scheduler_delegation_failed` | scheduling 失敗（execution 失敗ではない） |

---

## Scheduler Testing Strategy

Design / Machine Check（**実 Scheduler 実行なし**）:

| 検証 | 内容 |
|------|------|
| Contract validation | Scheduling Contract 概念整合 |
| Boundary validation | Runtime / Queue / Worker 責務非侵食 |
| Trigger model | time / event / manual path |
| Policy boundary | retry / queue handoff 分離 |
| Compatibility | Runtime / Boundaries / Interaction 整合 |
| Documentation | Quality Pipeline Test 521–540 |

---

## Scheduler Anti-Patterns

| Anti-Pattern | 問題 |
|--------------|------|
| Scheduler directly invokes Provider | Layer 混同 — Provider は Runtime 経由 |
| Scheduler owns Runtime lifecycle | 責務逆転 |
| Scheduler implements Queue | Queue Layer 侵食 |
| Scheduler implements Worker | Worker Layer 侵食 |
| Scheduler performs external API calls | Boundary 違反 |
| Scheduler stores execution state as source of truth | Ownership 違反 |
| Scheduler performs retry execution | Retry 責務混同 |
| Scheduler mutates Public Contracts | Governance 違反 |
| Scheduler bypasses Governance Flow | Process 短絡 |
| Scheduler introduces production automation before Level 4 | Maturity 違反 |

---

## Sequence Examples

Architecture Sequence（**実装なし**）。

### Time-based Scheduling

```text
Time Trigger
  -> Scheduler evaluates schedule
  -> Scheduler builds Scheduling Context
  -> Scheduler selects Execution Policy
  -> Scheduler delegates execution request to Runtime
  -> Runtime owns execution lifecycle
```

### Event-based Scheduling

```text
Event Trigger
  -> Scheduler validates trigger source
  -> Scheduler builds Scheduling Context
  -> Scheduler delegates to Runtime
```

### Manual Execution

```text
Manual Request
  -> Scheduler validates request boundary
  -> Scheduler builds Scheduling Context
  -> Scheduler delegates to Runtime
```

### Future Queue Coordination

```text
Scheduler
  -> defines queue handoff boundary
  -> does not implement queue
  -> future Queue Layer owns queue behavior
```

---

## Governance Flow Integration

- Scheduler Layer Design 変更 = **future layer design change**（[GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md)）
- Scheduler **実装** = implementation enabling change — 全 Review + [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) Scheduler Entry Criteria
- v1.56.0 = architecture governance change — **Production Code 変更なし**

---

## Future Entry Criteria Integration

- [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — **Scheduler Entry Criteria** が実装 Gate
- 本書は Entry Criteria の **設計詳細**
- Scheduler Design 完成 ≠ Level 4 自動到達
- Runtime Entry Criteria とは **独立** — Scheduler → Runtime は両方 Gate 後

---

## Compatibility Requirements

- Application Foundation CLI / JSON output **後方互換**
- Runtime Layer Design **非変更**
- Scheduling Contract 追加は **additive default**
- Breaking change → ADR + [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md)

---

## Completion Criteria

Scheduler Layer Design 文書の完成条件（v1.56.0）:

- [x] SCHEDULER_LAYER_DESIGN.md 存在（必須見出しすべて）
- [x] Runtime Layer Design **非変更**
- [x] Scheduler **実装なし**
- [x] Production Code **変更なし**
- [x] Architecture Documents **27** 必須文書
- [x] Quality Pipeline **540 PASS**（Test 521–540）
- [x] Level 4 **未宣言**

---

## Related Documents

| 文書 | 関係 |
|------|------|
| [RUNTIME_LAYER_DESIGN.md](./RUNTIME_LAYER_DESIGN.md) | Runtime 下位 — 委譲先 |
| [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md) | Provider — Scheduler 非 invoke |
| [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) | Scheduler Boundary |
| [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) | Interaction ルール |
| [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) | Scheduler Entry Gate |
| [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) | Review Process |
| [NON_GOALS.md](./NON_GOALS.md) | 実装禁止 |
