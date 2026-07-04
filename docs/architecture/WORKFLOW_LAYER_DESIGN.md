# Workflow Layer Design

Future **Workflow Layer** の workflow structure / step / dependency / transition / approval point を Architecture Contract として定義する Design 基準書です。**Workflow 実装・Workflow engine ではありません**。

> **重要（v1.58.0）:** 本書は **Design Only**。Production Code 変更なし。**Implementation Ready（Level 4）ではありません。** Automation / Scheduler / Runtime / Provider 各 Layer Design の責務は **変更しません**。

---

## Layer Responsibility（固定）

```text
Provider   = 外部 capability を抽象化する
Runtime    = 実行・lifecycle・orchestration を管理する
Scheduler  = Runtime をいつ・どの条件で起動するかを決定する
Automation = 自動化したい workflow intent / automation contract / automation boundary を定義する
Workflow   = workflow intent を構造化し、step / dependency / transition / approval point を contract として定義する
```

Workflow は **実行しない**。Scheduler / Runtime / Provider の責務を **変更しない**。

---

## 1. Purpose

Workflow Layer は、Automation Layer が扱う **workflow intent** を、将来の実装前 **architecture contract** として構造化する Future Layer 設計領域です。

- **Workflow structure** — step / dependency / transition の宣言
- **Approval point** — 承認が必要な位置・対象・理由（実行ではない）
- **Input / output boundary** — contract 参照
- **State declaration boundary** — 状態宣言（所有・mutation ではない）
- **Observability metadata** — 観測要件
- **Compatibility requirements** — 互換ルール

Workflow は **実行機構ではない**。DAG executor / State machine runtime / Workflow engine **ではない**。

---

## 2. Scope

| 対象 | 内容 |
|------|------|
| Workflow Contract | architecture contract |
| Workflow Step Model | 構造単位（非実行） |
| Dependency / Transition Model | 順序・前提・遷移可能性 |
| Manual / Scheduled / Event-based / Human Approval 分類 | 設計パターン |
| Automation / Scheduler / Runtime / Provider Boundary | 委譲・非侵食 |
| Queue / Worker / Real Automation Boundary | future concern 分離 |
| Observability / Testing / Anti-Patterns | Design Only |

Application / Platform Layer の **既存 Public Contract** は変更しません。

---

## 3. Non-Goals

- **Workflow implementation** — コード・engine 禁止
- **Workflow engine / DAG executor / State machine runtime / Step runner** 禁止
- **Automation / Runtime / Scheduler / Provider implementation** — 各 Layer Design 非変更
- **Provider 直接呼び出し** 禁止
- **Runtime 起動** 禁止
- **Scheduler trigger 登録** 禁止
- **Queue / Worker / Real Automation 所有** 禁止
- **Cron / Webhook receiver / Background Job / Message Broker** 禁止
- **Database / External API / OAuth / SNS API** 禁止
- **Dependency resolution / Transition 実行 / Step 実行** 禁止
- **Production Code** 変更禁止
- **Level 4 Implementation Ready** 到達を意味しない

---

## 4. Relationship to Future Layer Boundaries

| 観点 | 内容 |
|------|------|
| 前提 | [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) — Future Layer Map |
| 本書 | Workflow 構造化 contract の **詳細化** — Boundary **非変更** |
| 責務 | Structure contract のみ — execution / scheduling は **侵害しない** |

---

## 5. Relationship to Layer Interaction Model

| 観点 | 内容 |
|------|------|
| Command / Query | Workflow は **structure 宣言** — Command execution は下位 Layer |
| State | Workflow は **state declaration** — state transition 実行は Runtime |
| Error | Workflow contract 検証失敗のみ Workflow 設計領域 |
| Async | Queue/Worker は **境界のみ** — 未実装（v1.58.0） |

---

## 6. Relationship to Provider Layer Design

| 観点 | 内容 |
|------|------|
| Provider | capability 抽象化 — [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md) |
| Workflow | `providerCapabilityRef` **宣言のみ** |
| 禁止 | **Provider direct invocation 禁止** |
| 解決 | capability 実解決は Runtime / Provider（将来） |

Provider 責務変更 **禁止**。

---

## 7. Relationship to Runtime Layer Design

| 観点 | 内容 |
|------|------|
| Runtime | lifecycle / orchestration — [RUNTIME_LAYER_DESIGN.md](./RUNTIME_LAYER_DESIGN.md) |
| Workflow | contract を Runtime **入力候補** として宣言可能（将来） |
| 禁止 | **Runtime execution responsibility 禁止** — lifecycle / timeout / retry / cancellation 非所有 |

Runtime 責務変更 **禁止**。

---

## 8. Relationship to Scheduler Layer Design

| 観点 | 内容 |
|------|------|
| Scheduler | timing / trigger — [SCHEDULER_LAYER_DESIGN.md](./SCHEDULER_LAYER_DESIGN.md) |
| Workflow | scheduled workflow **構造** を宣言 |
| 禁止 | **Scheduler trigger ownership 禁止** — schedule 登録 / cron / trigger 判定 非所有 |

Scheduler 責務変更 **禁止**。

---

## 9. Relationship to Automation Layer Design

| Layer | 責務 |
|-------|------|
| **Automation** | workflow intent / automation contract / automation boundary |
| **Workflow** | intent の **構造化** — step / dependency / transition / approval point |

- Workflow は Automation の `workflowIntent` を **構造化** — Automation decisioning と **混同しない**
- Automation は **what to automate** — Workflow は **how it is structured**（contract）
- Automation 責務変更 **禁止**

---

## 10. Workflow Principles

| 原則 | 内容 |
|------|------|
| Structure Not Execution | Step は実行単位ではない |
| Contract Not Schema | architecture contract — 実装 schema ではない |
| Intent From Automation | workflowIntentRef は Automation 由来 |
| No Provider Direct Call | Provider direct invocation 禁止 |
| No Runtime Start | Runtime 起動禁止 |
| No Schedule Registration | Scheduler trigger 登録禁止 |
| No Dependency Resolution | dependency resolution 非所有 |
| No Transition Execution | transition は状態を進めない |
| Explicit Approval Points | 承認位置を宣言 — 実行しない |
| Governance First | [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) 経由 |

---

## 11. Workflow Responsibility

### Workflow の責務

| 責務 | 説明 |
|------|------|
| Workflow contract 定義 | structure contract |
| Step / dependency / transition 宣言 | 構造要素 |
| Approval point 宣言 | 位置・対象・理由 |
| Input / output boundary | contract 参照 |
| State declaration | 宣言境界 |
| Observability metadata | 観測要件 |
| workflowType 分類 | manual / scheduled / event / approval |

### Workflow の責務ではないもの

| 非責務 | 所属 |
|--------|------|
| Step 実行 | Runtime |
| Dependency resolution | Runtime（将来） |
| Transition 実行 | Runtime（将来） |
| Schedule 登録 | Scheduler |
| Provider invoke | Runtime → Provider |
| Queue / Worker | 将来 Layer |
| Approval 実行 | 将来 gate（Entry Criteria 後） |
| Automation intent 決定 | Automation |

---

## 12. Workflow Contract

Workflow Contract は **architecture contract**（**実装 schema ではない**）。

| フィールド | 説明 |
|------------|------|
| `workflowId` | 一意 workflow 識別子 |
| `workflowVersion` | contract バージョン |
| `workflowIntentRef` | Automation workflowIntent 参照 |
| `workflowType` | manual / scheduled / eventBased / humanApproval |
| `steps` | Step contract 一覧 |
| `dependencies` | Dependency contract 一覧 |
| `transitions` | Transition contract 一覧 |
| `approvalPoints` | Approval point 一覧 |
| `inputContract` | 入力 boundary 参照 |
| `outputContract` | 出力 boundary 参照 |
| `stateDeclarations` | 状態宣言（mutation ではない） |
| `observabilityMetadata` | 観測メタデータ |
| `compatibilityRules` | 互換ルール参照 |

---

## 13. Workflow Intent Relationship

```text
Automation
  → declares workflowIntent (Automation Contract)
Workflow
  → structures workflowIntentRef into Workflow Contract
  → (future) Automation may reference structured workflow
Scheduler / Runtime
  → (future) consume contracts — not owned by Workflow
```

Workflow は intent を **構造化** — intent の **決定**は Automation。

---

## 14. Workflow Step Model

Step は **実行単位ではない** — 将来 Runtime が扱う可能性のある **構造単位**。

| フィールド | 説明 |
|------------|------|
| `stepId` | 一意 step 識別子 |
| `stepType` | 構造分類（設計） |
| `purpose` | step の目的宣言 |
| `inputRef` | 入力 contract 参照 |
| `outputRef` | 出力 contract 参照 |
| `dependencyRefs` | 依存 step 参照 |
| `approvalRef` | approval point 参照（任意） |
| `runtimeRequirementRef` | Runtime 要件参照（宣言） |
| `providerCapabilityRef` | Provider capability 参照（**invoke しない**） |
| `sideEffectDeclaration` | 副作用期待の **宣言** |

Step は **Provider を呼び出さない**。Step は **実行されない**（Workflow Layer）。

---

## 15. Workflow Dependency Model

Dependency は step 間の **順序・前提・構造関係** を表す contract。

| 要素 | 説明 |
|------|------|
| `dependencyId` | 依存識別子 |
| `fromStepRef` | 前提 step |
| `toStepRef` | 後続 step |
| `dependencyKind` | ordering / prerequisite / structural（設計） |

- **Dependency resolution 禁止** — Workflow Layer の責務外
- 解決は Runtime orchestration（将来）

---

## 16. Workflow Transition Model

Transition は workflow の **構造的な遷移可能性** を表す contract。

| 要素 | 説明 |
|------|------|
| `transitionId` | 遷移識別子 |
| `fromRef` | 起点（step / approval point） |
| `toRef` | 終点 |
| `conditionRef` | 条件宣言（評価実装なし） |

- **State machine runtime ではない**
- **Transition は状態を進めない** — 実行は Runtime（将来）

---

## 17. Workflow Input Boundary

- `inputContract` は Public Contract / Foundation artifact 参照
- Workflow は input を **読み取り実行しない**
- Input validation 実行は Runtime / Application

---

## 18. Workflow Output Boundary

- `outputContract` は期待出力 schema 参照
- Workflow は output を **生成しない**
- Output 生成は Runtime / Application Foundation

---

## 19. Automation Boundary

| ルール | 内容 |
|--------|------|
| AB1 | Workflow は Automation `workflowIntentRef` を **構造化** |
| AB2 | Automation decisioning（自動化するか）を Workflow が **行わない** |
| AB3 | Mixing Automation decisioning with Workflow structure — **Anti-Pattern** |
| AB4 | [AUTOMATION_LAYER_DESIGN.md](./AUTOMATION_LAYER_DESIGN.md) 非変更 |

---

## 20. Scheduler Boundary

| ルール | 内容 |
|--------|------|
| SB1 | Scheduled workflow **構造**を Workflow が宣言 |
| SB2 | **Scheduler trigger ownership 禁止** — schedule 登録・cron・trigger 判定 非所有 |
| SB3 | Scheduler は scheduled workflow を trigger **可能**（将来）— Workflow は登録しない |

---

## 21. Runtime Boundary

| ルール | 内容 |
|--------|------|
| RB1 | Runtime は Workflow contract を **将来実行可能な runtime input** として扱う可能性 |
| RB2 | **Runtime execution responsibility 禁止** — lifecycle / orchestration / timeout / retry / cancellation 非所有 |
| RB3 | Workflow は Runtime を **起動しない** |

---

## 22. Provider Boundary

| ルール | 内容 |
|--------|------|
| PB1 | Step は `providerCapabilityRef` を **宣言可能** |
| PB2 | **Provider direct invocation 禁止** |
| PB3 | Capability 実解決は Runtime / Provider boundary（将来） |

---

## 23. Adapter Boundary

- Adapter-specific API details を Workflow に **埋め込まない**
- External IO は Provider + Adapter — Workflow は **参照宣言のみ**

---

## 24. State Boundary

| ルール | 内容 |
|--------|------|
| ST1 | `stateDeclarations` は **宣言** — source of truth ではない |
| ST2 | **Mutating execution state in Workflow 禁止** |
| ST3 | Execution state 所有は Runtime / Application |

---

## 25. Side Effect Boundary

| ルール | 内容 |
|--------|------|
| SE1 | `sideEffectDeclaration` は **宣言のみ** |
| SE2 | Workflow 自身は **Side Effect を発生させない** |
| SE3 | Side effect 実行は Runtime / Provider path（将来） |

---

## 26. Queue Boundary

| ルール | 内容 |
|--------|------|
| QB1 | Workflow は Queue に **message を送らない** |
| QB2 | Workflow は job を **作らない** |
| QB3 | Queue は **future implementation concern** — Workflow 非所有 |

---

## 27. Worker Boundary

| ルール | 内容 |
|--------|------|
| WB1 | Workflow は Worker を **管理しない** |
| WB2 | **Background execution 禁止** |
| WB3 | Worker は **future implementation concern** |

---

## 28. Approval Point Boundary

| ルール | 内容 |
|--------|------|
| AP1 | Approval point は Automation approval boundary と **接続** |
| AP2 | 承認処理そのものは **実行しない** |
| AP3 | Workflow は **位置・対象・理由を宣言** のみ |
| AP4 | Treating approval points as approval execution — **Anti-Pattern** |

---

## 29. Manual Workflow

- `workflowType`: manual 相当
- 構造 contract のみ — operator trigger は Scheduler / Automation path（将来）

---

## 30. Scheduled Workflow

- `workflowType`: scheduled 相当
- 構造 contract のみ — **cron / schedule 登録は Scheduler** — Workflow 非所有

---

## 31. Event-based Workflow

- `workflowType`: eventBased 相当
- 構造 contract のみ — event 受信は Scheduler / 将来 ingress — Workflow 非所有

---

## 32. Human Approval Workflow

- `workflowType`: humanApproval 相当
- `approvalPoints` 必須宣言
- Approval 実行は将来 gate — Workflow は structure のみ

---

## 33. Observability

観測メタデータ（設計 — Real Metrics **非実装**）:

| メタデータ | 意味 |
|------------|------|
| `traceWorkflowRef` | workflow 相関 |
| `requiredEvents` | 必須 observability event 一覧（設計） |
| `stepObservabilityRefs` | step 単位観測点参照 |

Workflow runtime event 発火は **将来 Runtime** — Workflow は metadata **宣言のみ**。

---

## 34. Testing Strategy

Design / Machine Check（**Workflow engine 実行なし**）:

| 検証 | 内容 |
|------|------|
| Contract fields | workflowId / steps / dependencies |
| Boundary validation | Automation / Runtime / Scheduler / Provider 非侵食 |
| Non-Goals | engine / executor / state machine 禁止 |
| Anti-Patterns | 文書整合 |
| Documentation | Quality Pipeline Test 561–580 |

---

## 35. Anti-Patterns

| Anti-Pattern | 問題 |
|--------------|------|
| Treating Workflow as a runtime engine | 実行混同 |
| Treating Workflow as a DAG executor | executor 侵食 |
| Treating Workflow as a state machine runtime | state machine 侵食 |
| Calling Provider directly from Workflow | Provider Boundary 違反 |
| Registering schedules from Workflow | Scheduler trigger ownership 違反 |
| Mutating execution state in Workflow | State Boundary 違反 |
| Dispatching jobs from Workflow | Queue / Worker 侵食 |
| Embedding adapter-specific API details | Adapter 混同 |
| Mixing Automation decisioning with Workflow structure | Automation 責務混同 |
| Treating approval points as approval execution | Approval 実行混同 |

---

## 36. Sequence Examples

Architecture Sequence（**実装なし**）。

### Manual Workflow

```text
Automation Intent (workflowIntent)
  ↓
Workflow Contract (structure)
  ↓
Automation Contract (targetSchedulerContract — future)
  ↓
Scheduler Contract (future)
  ↓
Runtime Contract (future)
```

### Scheduled Workflow

```text
Automation Intent
  ↓
Workflow Contract (scheduled structure)
  ↓
Scheduler Trigger Contract (future — Workflow does not register)
  ↓
Runtime Contract (future)
```

### Event-based Workflow

```text
Automation Intent
  ↓
Workflow Contract (event structure)
  ↓
Scheduler Event Contract (future)
  ↓
Runtime Contract (future)
```

### Human Approval Workflow

```text
Automation Intent
  ↓
Workflow Contract (approvalPoints declared)
  ↓
Human Approval (future gate — not executed by Workflow)
  ↓
Scheduler Contract (future)
  ↓
Runtime Contract (future)
```

---

## 37. Governance Flow Integration

- Workflow Layer Design 変更 = **future layer design change**（[GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md)）
- Workflow **実装** = implementation enabling change — Entry Criteria + 全 Review
- v1.58.0 = architecture governance change — **Production Code 変更なし**

---

## 38. Future Entry Criteria Integration

- [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — Real Automation / Runtime Entry Criteria が Gate
- 本書は **構造化 contract 設計詳細**
- Workflow Design 完成 ≠ Level 4 自動到達

---

## 39. Compatibility Requirements

- Application Foundation / Public Contract **後方互換**
- Automation / Scheduler / Runtime / Provider Layer Design **非変更**
- Workflow Contract 追加は **additive default**
- Breaking change → ADR + [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md)

---

## 40. Completion Criteria

Workflow Layer Design 文書の完成条件（v1.58.0）:

- [x] WORKFLOW_LAYER_DESIGN.md 存在（§1–§40）
- [x] Automation / Scheduler / Runtime / Provider 責務 **非変更**
- [x] Workflow **実装なし** — engine / DAG executor / state machine runtime **ではない**
- [x] Production Code **変更なし**
- [x] Architecture Documents **29** 必須文書
- [x] Quality Pipeline **580 PASS**（Test 561–580）
- [x] Level 4 **未宣言**

---

## Related Documents

| 文書 | 関係 |
|------|------|
| [AUTOMATION_LAYER_DESIGN.md](./AUTOMATION_LAYER_DESIGN.md) | Automation intent 上流 |
| [SCHEDULER_LAYER_DESIGN.md](./SCHEDULER_LAYER_DESIGN.md) | Scheduler — trigger 非所有 |
| [RUNTIME_LAYER_DESIGN.md](./RUNTIME_LAYER_DESIGN.md) | Runtime — execution 非所有 |
| [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md) | Provider — 非 invoke |
| [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) | Layer 境界 |
| [NON_GOALS.md](./NON_GOALS.md) | 実装禁止 |
