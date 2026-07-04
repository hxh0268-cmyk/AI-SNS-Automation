# Runtime Layer Design

Future **Runtime Layer** の実行・ライフサイクル・オーケストレーションを定義する Architecture Design 基準書です。Provider を含む各 Layer の **上位実行契約** として機能し、**Runtime 実装ではありません**。

> **重要（v1.55.0）:** 本書は **Design Only**。Production Code 変更なし。**Implementation Ready（Level 4）ではありません。** [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md) の Provider 責務は **変更しません**。

---

## 1. Purpose

Runtime Layer は、将来の pipeline / Provider invoke / Foundation CLI 実行について **execution contract** を定義する Future Layer 設計領域です。

- **Execution context** の作成・管理
- **Lifecycle transition**（開始・実行・完了・失敗・取消）
- **Orchestration** — invoke 順序・依存（business logic 非所有）
- **Cancellation / timeout / retry coordination**
- **Error propagation policy** — Provider 出力の正規化結果を Application へ
- **Observability event** 契約（Real Metrics 非実装）
- Provider / Scheduler / Automation / Worker との **接続点** 定義

Runtime は Provider の **上位** に位置し、Provider は external capability 抽象化・安定 Contract 提供に専念する。

---

## 2. Scope

| 対象 | 内容 |
|------|------|
| Runtime Principles / Responsibility | 責務・非責務 |
| Execution Contract / Lifecycle / Context | 実行モデル |
| Orchestration / Resource / State | 所有境界 |
| Cancellation / Timeout / Retry / Error | 協調ルール |
| Provider / Scheduler / Automation / Worker Boundary | 接続点 |
| Side Effect / Observability / Testing / Anti-Patterns | Design Only |
| Sequence Examples | 成功 / 失敗 / 取消 |
| Governance / Entry Criteria / Compatibility | 統合 |

Application / Platform Layer の **既存 Public Contract** は変更しません。

---

## 3. Non-Goals

- **Runtime implementation** — コード・npm script 追加禁止
- **Scheduler / Worker / Queue / Adapter** 実装禁止
- **Provider implementation** — [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md) 非変更
- **OAuth / SNS API / External API** 直接呼び出し禁止
- **Database / Cloud Runtime / Cache / Real Metrics / Real Automation** 禁止
- **Background Job / Message Broker** 禁止
- **Production Code** 変更禁止
- **Level 4 Implementation Ready** 到達を意味しない

---

## 4. Relationship to Future Layer Boundaries

| 観点 | 内容 |
|------|------|
| 前提 | [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) — **Runtime Layer Boundary** |
| 本書 | Boundary の **詳細化** — Boundary **非変更** |
| 責務 | Runtime orchestration のみ — Provider capability 実装は **侵害しない** |
| 依存 | Runtime → Foundation CLI invoke / Provider Contract（将来） |

---

## 5. Relationship to Layer Interaction Model

| 観点 | 内容 |
|------|------|
| Request / Response | [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) §7 |
| Command / Query | Runtime は Command orchestration — Query は副作用なし path |
| Retry / Timeout | **Runtime が coordination 所有** — Provider は Provider 内 retry のみ |
| Error | Runtime は Error Contract で Application へ — raw leak 禁止 |
| Async | 設計前提のみ — Queue/Worker **未実装**（v1.55.0） |

---

## 6. Relationship to Provider Layer Design

| Layer | 責務 |
|-------|------|
| **Provider** | External capability 抽象化、Input/Output/Error Contract、Adapter 経由正規化 |
| **Runtime** | Execution context、lifecycle、orchestration、timeout/cancel/retry **coordination** |

- Runtime は **Provider capability を実装しない**
- Runtime は Provider を **invoke** する設計（将来）— Provider Contract を入力/output
- Provider 責務変更 **禁止** — 矛盾時は Governance Flow + ADR

---

## 7. Runtime Principles

| 原則 | 内容 |
|------|------|
| Execution Contract First | すべての run は Runtime Contract で開始 |
| No Business Logic | Domain rules は Application Foundation |
| No Provider Capability | Capability 実装は Provider Layer |
| No Direct External API | External IO は Provider+Adapter のみ |
| Context Isolation | Execution context は run 単位 |
| Explicit Lifecycle | 状態遷移は明示的 |
| Coordinated Retry | Retry owner を曖昧にしない |
| Coordinated Timeout | Timeout owner を曖昧にしない |
| Observable Runs | 各 run に observability 観測点 |
| Governance First | 変更は [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) 経由 |

---

## 8. Runtime Responsibility

### Runtime の責務

| 責務 | 説明 |
|------|------|
| Execution contract 定義 | run spec / result contract |
| Execution context 作成・管理 | run id、env ref、deadline |
| Lifecycle transition | pending → running → completed / failed / cancelled |
| Orchestration | Foundation CLI / Provider invoke 順序 |
| Cancellation coordination | cancel signal 伝播 |
| Timeout coordination | pipeline / step deadline |
| Retry coordination | idempotent step retry ポリシー |
| Error propagation | normalized Error Contract へ |
| Observability event 契約 | run 単位イベント |
| State mutation 境界 | Runtime-owned state のみ |

### Runtime の責務ではないもの

| 非責務 | 所属 |
|--------|------|
| Business logic | Application Layer |
| Provider capability 実装 | Provider Layer |
| Scheduler timing decision | Scheduler Layer |
| Worker queue 実装 | Queue / Worker Layer |
| OAuth / credential storage | OAuth / secret store |
| Database persistence | Database Layer（未承認） |
| Content generation | Application Foundation |

---

## 9. Runtime Execution Contract

Runtime run は以下 Contract を持つ（設計）:

| フィールド | 説明 |
|------------|------|
| `run_id` | 一意実行 ID |
| `run_spec` | 入力 Public Contract 参照 + parameters |
| `execution_context_ref` | §11 |
| `required_capabilities` | Provider capability 要求一覧（将来） |
| `deadline` | 全体 timeout |
| `cancellation_policy` | 取消可能節 |
| `result_contract` | 出力 schema 参照 |
| `error_contract` | Error schema 参照 |

JSON = Source — artifact として永続化可能（将来）。

---

## 10. Runtime Lifecycle

```text
pending → validated → running → { completed | failed | cancelled }
```

| 状態 | 意味 |
|------|------|
| `pending` | run 受付、validation 前 |
| `validated` | Contract 検証通過 |
| `running` | orchestration 実行中 |
| `completed` | 正常終了、result 記録 |
| `failed` | Error Contract 記録 |
| `cancelled` | 取消完了 |

Illegal transition → Error Contract。Lifecycle は **Runtime が所有**。

---

## 11. Runtime Execution Context

Execution Context は **単一 run** の実行環境メタデータ:

| 要素 | 内容 |
|------|------|
| `run_id` | 実行 ID |
| `started_at` | 開始時刻（設計） |
| `deadline` | 絶対 timeout |
| `environment_ref` | local / ci / cloud（将来 — 値のみ、実装なし） |
| `trace_ref` | observability 相関 ID |
| `cancellation_token_ref` | 取消信号（設計） |
| `parent_run_id` | ネスト run（将来） |

Context は **shared mutable global 禁止** — run スコープのみ。

---

## 12. Runtime Orchestration Model

Orchestration = **invoke 順序と依存** のみ:

```text
Runtime
  → validate run_spec
  → create execution_context
  → invoke Foundation CLI step(s)  [pure / deterministic]
  → resolve Provider capability (future)
  → invoke Provider via Contract (future)
  → aggregate results
  → record result / emit events
  → transition lifecycle → completed | failed | cancelled
```

- **DAG / step graph** は run_spec で宣言（将来 schema）
- Runtime は **step 内 business rule を解釈しない**
- Parallel step は ADR + Entry Criteria 後（将来）

---

## 13. Runtime Resource Ownership

| リソース | 所有者 |
|----------|--------|
| Execution context | Runtime |
| Run state (lifecycle) | Runtime |
| Foundation artifact JSON | Application（Runtime は read/write orchestration のみ） |
| Provider connection pool | Provider（将来） |
| CPU / memory 割当 | Runtime config（将来 Cloud Runtime） |
| Queue / Worker slot | Worker Layer（将来） |

Runtime は **long-lived resource pool** を v1.55.0 時点では **所有しない**（設計のみ）。

---

## 14. Runtime State Management

- **Runtime-owned state:** lifecycle、execution context、in-run coordination flags
- **Application-owned state:** Foundation output JSON、`state.json` checkpoint（Platform/App 領域）
- Runtime は Application state を **直接 mutation しない** — Contract 経由のみ
- Cross-run state は **Database 禁止**（未承認）— artifact JSON が正

---

## 15. Runtime Cancellation Rules

| ルール | 内容 |
|--------|------|
| C1 | Cancel は **外部 signal**（Scheduler / user / Automation 将来）または timeout |
| C2 | Cancel 伝播: Runtime → running step → Provider（将来） |
| C3 | Cancel 後は **新 step 開始禁止** |
| C4 | Partial result は result contract で explicit 記録 |
| C5 | Cancelled は **failed ではない** — 別 lifecycle 終端 |

---

## 16. Runtime Timeout Rules

| 所有者 | Timeout 種別 |
|--------|--------------|
| Runtime | **Pipeline / run deadline** |
| Provider | API call timeout（Provider 内 — [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md)） |
| Scheduler | Trigger window（将来） |

- Runtime deadline 超過 → `failed` + `provider_timeout` 相当または `runtime_timeout` kind（設計）
- **Silent timeout 禁止**
- Nested timeout: 子 deadline ≤ 親 deadline

---

## 17. Runtime Retry Coordination

| Layer | Retry 責任 |
|-------|------------|
| Provider | Transient external failure（Provider 内） |
| Runtime | **Idempotent step** の orchestration-level retry |
| Application | **Retry しない** |

Runtime retry 条件（設計）:

- Step が **idempotent** と宣言されている
- Error kind が retryable（ADR 定義）
- Max attempts / backoff は run_spec または Runtime policy
- **Hidden retry 禁止** — observability `runtime_retry_requested` 必須

---

## 18. Runtime Error Handling

| ポリシー | 内容 |
|----------|------|
| E1 | Provider Error → Runtime が **正規化済み** Error Contract で記録 |
| E2 | Foundation CLI 非零 exit → failed + error summary |
| E3 | **User-facing vs system-facing** 分離（Interaction Model 整合） |
| E4 | Error は **握りつぶさない** — lifecycle → failed |
| E5 | Partial failure は result + error 両方 explicit |

Runtime は **business meaning of error を解釈しない** — Contract mapping のみ。

---

## 19. Runtime Provider Interaction

```text
Runtime
  → resolve required_capability from run_spec
  → select Provider (mock default — future)
  → build Provider Input Contract
  → invoke Provider (future — no direct API)
  ← Provider Output Contract or Error Contract (via Adapter)
  → map to run result_contract
```

- Runtime **never** calls external API directly
- Provider selection は Runtime policy — Provider は **self-select しない**
- Unsupported capability → failed + `unsupported_capability`

---

## 20. Runtime Scheduler Boundary

| 観点 | 内容 |
|------|------|
| Scheduler | **timing / trigger decision** のみ |
| Runtime | trigger 受信 → run 開始 |
| 禁止 | Scheduler が Provider / Foundation を直接 invoke |
| 接続 | `scheduler.triggered` event → Runtime `pending` run（将来） |

---

## 21. Runtime Automation Boundary

| 観点 | 内容 |
|------|------|
| Automation | Continuous Improvement 等に基づく **action intent**（将来） |
| Runtime | intent を **run_spec** に変換して orchestration |
| 禁止 | Automation が Provider を直接呼ぶ |
| Human-in-the-loop | 初期 Automation は approval gate 必須（Provider Design 整合） |

---

## 22. Runtime Worker Boundary

| 観点 | 内容 |
|------|------|
| Worker | Queue message 消費 → Runtime invoke 要求 |
| Runtime | Worker から **run_spec** を受け orchestration |
| 禁止 | Runtime が Queue を **実装しない** |
| 禁止 | Worker が business logic を所有 |

---

## 23. Runtime Side Effect Rules

| ルール | 内容 |
|--------|------|
| S1 | Foundation pure step → **副作用なし** |
| S2 | Provider Command invoke → side effect は Provider 宣言に従う |
| S3 | Runtime 自身の side effect = **artifact I/O + event emit** のみ |
| S4 | Hidden side effect **禁止** |
| S5 | Background execution **禁止**（v1.55.0） |

---

## 24. Runtime Observability

観測点（設計 — Real Metrics **非実装**）:

| Event | 意味 |
|-------|------|
| `runtime_run_accepted` | pending 受付 |
| `runtime_run_validated` | Contract 検証通過 |
| `runtime_run_started` | running 開始 |
| `runtime_provider_resolved` | capability → Provider 解決 |
| `runtime_provider_invoked` | Provider invoke（将来） |
| `runtime_step_completed` | orchestration step 完了 |
| `runtime_run_completed` | completed |
| `runtime_run_failed` | failed |
| `runtime_run_cancelled` | cancelled |
| `runtime_retry_requested` | retry coordination |
| `runtime_timeout_occurred` | deadline 超過 |

---

## 25. Runtime Testing Strategy

Design / Machine Check（**実 Runtime 実行なし**）:

| 検証 | 内容 |
|------|------|
| Contract validation | Execution / result / error schema |
| Lifecycle validation | 合法遷移のみ |
| Boundary validation | Provider 責務非侵食 |
| Cancellation / timeout policy | 文書整合 |
| Provider interaction model | Contract 接続点 |
| Compatibility | Boundary / Provider / Interaction 整合 |
| Documentation | Quality Pipeline Test 506–520 |

---

## 26. Runtime Anti-Patterns

| Anti-Pattern | 問題 |
|--------------|------|
| Runtime owning business logic | Layer 混同 |
| Runtime implementing Provider capability | 責務逆転 |
| Runtime calling external API directly | Boundary 違反 |
| Runtime owning Scheduler timing | 責務混同 |
| Runtime implementing Worker queue | Queue 侵食 |
| Hidden retry / timeout | Coordination 不明 |
| Shared mutable global context | Coupling |
| Application state direct mutation | Ownership 違反 |
| Provider responsibility redefinition | Provider Design 破壊 |
| Async hidden in sync run contract | Interaction 違反 |

---

## 27. Sequence Examples

Architecture Sequence（**実装なし**）。

### 27.1 Success Sequence

```text
1. Scheduler (future) → trigger event
2. Runtime → create Execution Context (run_id, deadline)
3. Runtime → validate run_spec → lifecycle: validated → running
4. Runtime → resolve required Provider capability (e.g. text_generation)
5. Runtime → invoke Provider with Input Contract (future)
6. Provider → Adapter → normalized Output Contract
7. Runtime → record execution result (JSON artifact)
8. Runtime → emit observability events (started, provider_invoked, completed)
9. Runtime → lifecycle: completed
```

### 27.2 Failure Sequence

```text
1. Runtime → running
2. Runtime → invoke Provider (future)
3. Provider → external_api_error (normalized)
4. Runtime → retry coordination (if idempotent + retryable)
5. Retry exhausted → record Error Contract
6. Runtime → emit runtime_run_failed
7. Runtime → lifecycle: failed
```

### 27.3 Cancellation Sequence

```text
1. Runtime → running
2. External cancel signal OR deadline approaching
3. Runtime → propagate cancellation to active step
4. Runtime → no new steps started
5. Runtime → record partial result (if policy allows)
6. Runtime → emit runtime_run_cancelled
7. Runtime → lifecycle: cancelled
```

---

## 28. Governance Flow Integration

- Runtime Layer Design 変更 = **future layer design change**（[GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md)）
- Runtime **実装** = implementation enabling change — 全 Review + [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) Runtime Entry Criteria
- v1.55.0 = architecture governance change — **Production Code 変更なし**

---

## 29. Future Entry Criteria Integration

- [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — **Runtime Entry Criteria** が実装 Gate
- 本書は Entry Criteria の **設計詳細**
- Runtime Design 完成 ≠ Level 4 自動到達
- Provider Entry Criteria とは **独立** — Runtime invoke Provider は両方 Gate 後

---

## 30. Compatibility Requirements

- Application Foundation CLI / JSON output **後方互換**
- Provider Layer Design **非変更**
- Runtime Contract 追加は **additive default**
- Breaking change → ADR + [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md)

---

## 31. Completion Criteria

Runtime Layer Design 文書の完成条件（v1.55.0）:

- [x] RUNTIME_LAYER_DESIGN.md 存在（§1–§31）
- [x] Provider Layer Design **非変更**
- [x] Runtime **実装なし**
- [x] Production Code **変更なし**
- [x] Architecture Documents **26** 必須文書
- [x] Quality Pipeline **520 PASS**（Test 506–520）
- [x] Level 4 **未宣言**

---

## Related Documents

| 文書 | 関係 |
|------|------|
| [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md) | Provider 下位 Contract |
| [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) | Runtime Boundary |
| [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) | Interaction ルール |
| [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) | Runtime Entry Gate |
| [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) | Review Process |
| [NON_GOALS.md](./NON_GOALS.md) | 実装禁止 |
