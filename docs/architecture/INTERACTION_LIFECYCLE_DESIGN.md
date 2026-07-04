# Interaction Lifecycle Design

Layer Interaction Model 完成後の **Cross-Layer Interaction Lifecycle** を Architecture Contract として定義する Design 基準書です。**Interaction Lifecycle は Runtime Lifecycle ではありません。** 個別 Layer の責務は **再定義しません**。

> **重要（v1.61.0）:** 本書は **Design Only**。Production Code 変更なし。**Concrete state machine implementation ではありません。** Storage / Queue / Worker / execution engine **要件を導入しません。** Level 4 Implementation Ready **未到達**。

---

## 1. Purpose

- [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) で固定した Interaction chain の **共通 Lifecycle Contract** を定義する
- Lifecycle **states / transitions / ownership / terminal outcomes** を Architecture Contract として固定する
- Event → Automation → Workflow → Scheduler → Runtime → Provider chain における **lifecycle start / end / waiting / retry / timeout / cancellation** の設計前提を明文化する
- Future State Model / Future Error Model との **compatibility** を確保する
- **Level 3.2 — Interaction Lifecycle Complete** への到達点とする

---

## 2. Scope

| 対象 | 内容 |
|------|------|
| Lifecycle Principles | 規範的原則 |
| Lifecycle State Definition | Created … Expired 状態集合 |
| Initial / Terminal / Non-Terminal States | 分類と意味 |
| Valid / Invalid State Transitions | 許可・禁止遷移 |
| State / Transition Ownership | Layer 別書き込み範囲 |
| State Visibility / Lifecycle Isolation | 可視性・隔離 |
| Per-layer Lifecycle Boundaries | Event … Provider |
| Waiting / Approval / Scheduler Waiting | 概念定義（wait queue 非実装） |
| Retry / Timeout / Cancellation / Failure / Recovery | 境界のみ |
| Compatibility / Governance / Testing / Observability | Design Only |

Application / Platform Layer の **既存 Public Contract** は変更しません。

---

## 3. Non-Goals

本書は以下を **行わない**（MUST NOT）:

- **Runtime Lifecycle** / **Workflow logic** / **Scheduler logic** / **Automation logic** / **Event logic** / **Provider logic** の実装
- **Concrete state machine implementation**
- **State machine runtime** / **DAG executor** / **Step runner**
- **Storage** / **Database** — lifecycle state **永続化禁止**
- **Queue / Worker / Message Broker** / **Webhook receiver**
- **Retry engine** / **Timeout engine** / **Background job**
- **Adapter / OAuth / SNS API / External API / Cloud Runtime / Cache / Real Metrics**
- Individual Core Layer **責務の再定義**
- **Production Code** 変更
- **Level 4 Implementation Ready** 到達の宣言

---

## 4. Design Status

| 観点 | 状態 |
|------|------|
| **Design Status** | **Design Only** |
| Release | v1.61.0 |
| Prerequisites | Core Layer Design Complete + Layer Interaction Model（v1.60.0） |
| **Current Maturity** | **Level 3.2 — Interaction Lifecycle Complete** |
| Implementation | **Prohibited** |
| Production Code | **unchanged** |

---

## 5. Relationship to Layer Interaction Model

| 観点 | Layer Interaction Model | Interaction Lifecycle（本書） |
|------|-------------------------|----------------------------|
| 定義対象 | Layer 間 **Interaction / Dependency / Boundary** | Interaction の **Lifecycle Contract** |
| 変更関係 | 正（Interaction truth） | Interaction Model を **変更しない** |
| Chain | Event → … → Provider | 同一 chain 上の **state / transition** |
| 実装 | Prohibited | Prohibited |

- Interaction Model が **誰と誰が隣接 contract で通信するか** を定義する
- Interaction Lifecycle が **その通信が lifecycle 上どう進行・終了するか** を定義する
- 矛盾時は Governance Flow + ADR

---

## 6. Lifecycle Principles

| 原則 | 規範 |
|------|------|
| **Not Runtime Lifecycle** | Interaction Lifecycle ≠ Runtime execution lifecycle |
| **Not State Machine Implementation** | 本書は architecture contract — runtime engine ではない |
| **Contract States Only** | States are declarative contract labels |
| **Layer-Bounded Transitions** | Each layer MAY transition only within ownership boundary |
| **Terminal Finality** | Terminal states MUST NOT transition to non-terminal states |
| **Explicit Waiting** | Waiting MUST be typed conceptually — no wait queue implementation |
| **Explicit Outcomes** | Completed / Failed / Aborted / Cancelled / Rejected / Expired MUST be distinguishable |
| **Retry Without Terminal Mutation** | Retry MUST continue controlled path — MUST NOT mutate Completed terminal state |
| **Timeout As Outcome** | Timeout MUST be lifecycle outcome — not timeout engine |
| **Explicit Cancellation** | Cancellation MUST be bounded and explicit |
| **No Storage Requirement** | Lifecycle MUST NOT require persistence in this phase |

---

## 7. Lifecycle State Definition

Interaction Lifecycle states（Architecture Contract — **implementation enum ではない**）:

| State | Class | 概要 |
|-------|-------|------|
| **Created** | Non-Terminal | Interaction instance contract 生成 |
| **Validated** | Non-Terminal | Contract / boundary 検証済み |
| **Accepted** | Non-Terminal | Automation intent 受理 |
| **Scheduled** | Non-Terminal | Scheduler trigger 条件確定 |
| **Prepared** | Non-Terminal | Runtime 実行準備完了（contract 宣言） |
| **Running** | Non-Terminal | Cross-layer interaction 進行中 |
| **Waiting** | Non-Terminal | 明示的待機（typed） |
| **Completed** | **Terminal** | 意図した interaction **正常完了** |
| **Failed** | **Terminal** | 既知 failure boundary 内の失敗 |
| **Cancelled** | **Terminal** | 明示的キャンセル |
| **Aborted** | **Terminal** | 無効 contract / boundary violation / unrecoverable violation |
| **Rejected** | **Terminal** | Intent / validation 拒否 |
| **Expired** | **Terminal** | 有効期限切れ（timeout outcome として表現可能） |

---

## 8. Initial State

| 規範 | 内容 |
|------|------|
| **Lifecycle start condition** | Valid Event classification produces **Created** |
| **Initial State** | **Created** |
| **Entry** | First cross-layer interaction contract instance declaration |
| **Precondition** | Event Layer classification complete — Event responsibility end point 到達後は Automation 所有 |

---

## 9. Terminal States

Terminal states MUST NOT transition to non-terminal states.

| Terminal State | Definition |
|----------------|------------|
| **Completed** | 意図した cross-layer interaction が **正常に完了** |
| **Failed** | Interaction が **既知の failure boundary** 内で失敗 |
| **Cancelled** | **明示的・bounded** なキャンセルにより停止 |
| **Aborted** | 無効 contract / invalid boundary crossing / unrecoverable lifecycle violation により停止 |
| **Rejected** | Validation / intent 拒否 |
| **Expired** | Lifecycle 有効期限切れ — **Timeout outcome** として表現 |

**Lifecycle end condition:** Interaction reaches any terminal state.

---

## 10. Non-Terminal States

| State | Role |
|-------|------|
| Created | Instance birth |
| Validated | Contract validation pass |
| Accepted | Automation accepted intent |
| Scheduled | Scheduler owns timing |
| Prepared | Runtime preparation declared |
| Running | Active cross-layer progression |
| Waiting | Typed pause — approval / scheduler / external gate |

Non-terminal states MAY transition per Valid State Transitions（§11）.

---

## 11. Valid State Transitions

```
Created → Validated | Rejected | Aborted
Validated → Accepted | Rejected | Aborted
Accepted → Scheduled | Waiting | Aborted
Scheduled → Prepared | Waiting | Cancelled | Aborted
Prepared → Running | Cancelled | Aborted
Running → Waiting | Completed | Failed | Cancelled | Aborted | Expired
Waiting → Scheduled | Running | Cancelled | Failed | Aborted | Expired
```

Retry path（controlled — **Completed 不変**）:

```
Failed → Created (new controlled retry instance)   ← contract-level retry declaration
Failed → Running                                   ← only if retry policy declares in-place continuation AND Completed not mutated
```

---

## 12. Invalid State Transitions

| Invalid Transition | Reason |
|--------------------|--------|
| **Completed → *** | Terminal finality violation |
| **Failed → Completed** | Direct skip without controlled retry path |
| **Any Terminal → Non-Terminal** | Terminal finality |
| **Created → Running** | Skip validation / acceptance |
| **Accepted → Running** | Skip Scheduler / Prepared |
| **Event → Running** | Skip-layer lifecycle ownership |
| **Workflow → Provider state** | Skip Scheduler / Runtime |
| **Hidden transition** | Undeclared ownership violation |

---

## 13. State Ownership

| Layer | Writable State Range |
|-------|---------------------|
| **Event** | Created → Validated（**Event responsibility end point = Validated 完了**） |
| **Automation** | Validated → Accepted / Rejected |
| **Workflow** | Accepted 内 structure binding — **Running 前** の structure readiness |
| **Scheduler** | Accepted → Scheduled / Waiting（scheduler-type） |
| **Runtime** | Prepared / Running / Waiting（runtime-type）→ terminal outcomes（contract 宣言） |
| **Provider** | **No lifecycle state ownership** — capability outcome only via Runtime boundary |

---

## 14. Transition Ownership

| Transition | Owner |
|------------|-------|
| Created → Validated | Event（classification complete） |
| Validated → Accepted / Rejected | Automation |
| Accepted → Scheduled | Scheduler |
| Scheduled → Prepared | Runtime（via Scheduler request contract） |
| Prepared → Running | Runtime |
| Running → Waiting | Owning wait type（Automation / Scheduler / Runtime） |
| Running → Completed / Failed / Cancelled / Aborted / Expired | Runtime（outcome declaration contract） |
| Failed → retry path | Declared retry owner — **Retry Boundary**（§27） |

---

## 15. State Visibility Rules

| Rule | 規範 |
|------|------|
| **SV-01** | Each layer MUST see only contract-declared lifecycle fields |
| **SV-02** | Foreign layer internal state MUST NOT be visible |
| **SV-03** | Terminal state MUST be visible to governance observability points |
| **SV-04** | Waiting reason type MUST be declared — not opaque block |

---

## 16. Lifecycle Isolation Rules

| Rule | 規範 |
|------|------|
| **LI-01** | Interaction Lifecycle MUST NOT share mutable store across layers |
| **LI-02** | Lifecycle instances MUST NOT require shared database |
| **LI-03** | Parallel lifecycle instances MUST NOT corrupt each other's terminal states |
| **LI-04** | Lifecycle Isolation MUST align with Layer Interaction Model isolation |

---

## 17. Event Boundary

| 観点 | 規範 |
|------|------|
| Event role | Classification → **Created / Validated** |
| **Event responsibility end point** | **Validated** 到達後 Event lifecycle 責務 **終了** |
| Event MUST NOT | Transition to Accepted / Scheduled / Running / terminal execution outcomes |
| Event MUST NOT | Execute automation or runtime lifecycle |

---

## 18. Automation Boundary

| 観点 | 規範 |
|------|------|
| Automation writable | Validated → Accepted / Rejected |
| Approval Waiting | Automation MAY declare **Waiting**（approval-type） |
| Automation MUST NOT | Direct Running / Provider lifecycle states |
| Automation MUST NOT | Mutate Workflow structure internals as execution |

---

## 19. Workflow Boundary

| 観点 | 規範 |
|------|------|
| Workflow role | Structure readiness before Scheduler — **Running 前** |
| Workflow writable | Structure binding within Accepted phase |
| Workflow MUST NOT | Own trigger timing（Scheduler） |
| Workflow MUST NOT | Execute Runtime or call Provider |

---

## 20. Scheduler Boundary

| 観点 | 規範 |
|------|------|
| **Scheduler writable state range** | Scheduled / scheduler-type Waiting |
| Scheduler role | Accepted → Scheduled |
| Scheduler MUST NOT | Mutate Workflow structure |
| Scheduler MUST NOT | Direct Provider lifecycle |

---

## 21. Runtime Boundary

| 観点 | 規範 |
|------|------|
| **Runtime writable state range** | Prepared / Running / runtime-type Waiting → terminal outcomes |
| **Runtime Execution Boundary** | Running represents cross-layer progression — **not Provider internal execution** |
| Runtime MUST NOT | Rewrite Event classification |
| Runtime MAY | Declare Completed / Failed / Cancelled / Aborted / Expired per contract |

---

## 22. Provider Boundary

| 観点 | 規範 |
|------|------|
| Provider role | Capability outcome — **no lifecycle state ownership** |
| Provider MUST NOT | Own Created / Running / Waiting lifecycle states |
| Provider outcome | Surfaced to Runtime only — Runtime declares terminal lifecycle |

---

## 23. Waiting Rules

**Waiting** = typed conceptual pause — **NOT a wait queue implementation**.

| Wait Type | Owner | Meaning |
|-----------|-------|---------|
| **approval-wait** | Automation | Human / policy approval gate |
| **scheduler-wait** | Scheduler | Timing not yet satisfied |
| **runtime-wait** | Runtime | Execution precondition not met |
| **external-wait** | Contract declaration | External signal expected — receiver **not implemented** |

Waiting MUST declare wait type. Waiting MUST NOT imply queue enqueue.

---

## 24. Approval Waiting Rules

| Rule | 規範 |
|------|------|
| **AW-01** | Approval Waiting MUST originate from Automation boundary |
| **AW-02** | Approval Waiting MUST NOT bypass Workflow structure |
| **AW-03** | Exit from approval-wait MUST transition via declared owner only |
| **AW-04** | Approval execution is **future** — gate declaration only |

---

## 25. Scheduler Waiting Rules

| Rule | 規範 |
|------|------|
| **SW-01** | Scheduler Waiting MUST mean trigger condition not yet met |
| **SW-02** | Scheduler MUST NOT block on Provider |
| **SW-03** | Scheduler Waiting exit → Scheduled or Running per contract |

---

## 26. Runtime Execution Boundary

| 規範 | 内容 |
|------|------|
| **Interaction Lifecycle ≠ Runtime Lifecycle** | Runtime internal phases MUST NOT be conflated with cross-layer lifecycle states |
| Running | Cross-layer interaction progression — not step runner |
| Prepared | Contract declaration that Runtime may receive Scheduler request |
| Runtime MUST NOT | Implement cron / worker / queue in this phase |

---

## 27. Retry Boundary

| 規範 | 内容 |
|------|------|
| **Retry Boundary** | Retry is lifecycle contract — **not retry engine** |
| Retry MUST | Follow controlled path — new instance OR declared in-place continuation |
| Retry MUST NOT | Mutate **Completed** terminal state |
| Retry MUST NOT | Introduce background job / queue |
| Retry owner | MUST be declared in transition ownership |

---

## 28. Timeout Boundary

| 規範 | 内容 |
|------|------|
| **Timeout Boundary** | Timeout is **lifecycle outcome** — **not timeout engine** |
| Timeout outcome | **Expired** and/or **Failed** per contract |
| Timeout MUST NOT | Require timer implementation in v1.61.0 |
| Timeout MUST | Be representable in Future Error Model compatibility |

---

## 29. Cancellation Boundary

| 規範 | 内容 |
|------|------|
| **Cancellation Boundary** | Cancellation MUST be **explicit and bounded** |
| Cancelled | Terminal — intentional stop |
| Who MAY cancel | Declared owner only — typically Runtime or upstream explicit request |
| Cancellation MUST NOT | Silently rewrite Completed |
| Cancellation MUST NOT | Require worker interruption implementation |

---

## 30. Completion Rules

| 規範 | 内容 |
|------|------|
| **Completed definition** | Intended cross-layer interaction finished **successfully** |
| Preconditions | Running → Completed requires all declared layer contracts satisfied |
| Completed MUST | Be terminal and immutable |
| Completed MUST NOT | Imply Provider was called without Runtime |

---

## 31. Failure Boundary

| 規範 | 内容 |
|------|------|
| **Failed definition** | Interaction failed within **known failure boundary** |
| Failed vs Aborted | Failed = expected failure domain; Aborted = contract/boundary violation |
| Failed MUST | Be terminal unless controlled retry declared |
| Failure MUST | Propagate via contract — Future Error Model compatible |

---

## 32. Recovery Principles

| 原則 | 規範 |
|------|------|
| **Recovery ≠ automatic retry engine** | Recovery is declared contract path |
| Retry | Controlled new lifecycle or continuation |
| Aborted / Rejected | Generally non-recoverable without new interaction instance |
| Completed | **No recovery** — terminal finality |
| Future Recovery Model | MUST align with this lifecycle contract |

---

## 33. Lifecycle Compatibility Rules

| 規範 | 内容 |
|------|------|
| **Backward compatibility** | Additive lifecycle states/transitions default |
| **Future State Model compatibility** | States MUST map to future state model without renaming terminal semantics |
| **Future Error Model compatibility** | Failed / Aborted / Expired MUST align with future error taxonomy |
| Breaking change | Governance Flow + ADR required |

---

## 34. Version Compatibility

- Lifecycle contract version MUST be declared in cross-layer references
- [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md) applies
- v1.61.0 adds lifecycle layer — MUST NOT break Application Public Contracts
- Additive states default; removing terminal states MUST NOT occur without major governance review

---

## 35. Governance Integration

| 文書 | Integration |
|------|-------------|
| [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) | Lifecycle contract changes |
| [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md) | Release verification |
| [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) | Interaction prerequisite |
| [CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) | Policy review |

---

## 36. Future Entry Criteria Integration

- Implementation MUST NOT begin until [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) satisfied
- Lifecycle Design MUST be validated against Layer Interaction Model before implementation phase
- Level 4 entry requires Interaction Lifecycle + Interaction Model compliance

---

## 37. State Transition Examples

### Example A: Happy path

```
Created → Validated → Accepted → Scheduled → Prepared → Running → Completed
```

### Example B: Rejection at Automation

```
Created → Validated → Rejected
```

### Example C: Approval wait

```
Accepted → Waiting(approval-wait) → Accepted → Scheduled → … → Completed
```

### Example D: Timeout outcome

```
Running → Expired
```

### Example E: Invalid — terminal reversal

```
Completed → Running   ← INVALID
```

### Example F: Invalid — skip layer

```
Validated → Running   ← INVALID (skip Automation acceptance / Scheduler)
```

---

## 38. Sequence Examples

### Event-driven lifecycle

```
Event: Created → Validated
Automation: Validated → Accepted
Workflow: structure bind (within Accepted)
Scheduler: Accepted → Scheduled
Runtime: Scheduled → Prepared → Running
Runtime: Running → Completed
Provider: (capability via Runtime only — no lifecycle state)
```

### Scheduled workflow lifecycle

```
Event: Scheduled Event → Created → Validated
Automation → Workflow → Scheduler: → Scheduled
Runtime: Prepared → Running → Completed
```

### Manual approval lifecycle

```
Automation: Accepted → Waiting(approval-wait)
Automation: Waiting → Accepted
Scheduler → Runtime → Completed
```

### Failure with controlled retry

```
Runtime: Running → Failed
Retry owner: Failed → Created (new instance)
… → Completed
(Original Completed instances — if any — MUST NOT mutate)
```

### Aborted — boundary violation

```
Workflow attempts Running transition
→ Aborted (invalid boundary crossing)
```

---

## 39. Testing Strategy

| 観点 | v1.61.0 |
|------|---------|
| Scope | Documentation / state / transition / boundary verification |
| Machine checks | Quality Pipeline Test 621–640 |
| Implementation tests | **MUST NOT** add |
| State machine runtime tests | **MUST NOT** add |
| Compliance | Architecture Compliance Checklist |

---

## 40. Observability

| Point | Content |
|-------|---------|
| Lifecycle state | Contract-declared current state |
| Transition | From / to / owner / correlationId |
| Terminal outcome | Completed / Failed / Cancelled / Aborted / Rejected / Expired |
| Waiting type | approval / scheduler / runtime / external |
| Real Metrics | **Future** — not implemented |

---

## 41. Anti-Patterns

| Anti-Pattern | Why forbidden |
|--------------|---------------|
| **Conflating Interaction Lifecycle with Runtime Lifecycle** | Boundary violation |
| **Concrete state machine in this phase** | Implementation premature |
| **Terminal state reversal** | Finality violation |
| **Completed mutation on retry** | Terminal integrity violation |
| **Wait queue implementation** | Infrastructure premature |
| **Timeout engine in design phase** | Implementation premature |
| **Retry engine / background job** | Implementation premature |
| **Lifecycle persistence without ADR** | Storage requirement |
| **Skip-layer lifecycle transition** | Interaction Model violation |
| **Provider lifecycle state ownership** | Provider boundary violation |
| **Hidden transition** | Ownership opacity |

---

## 42. Completion Criteria

Interaction Lifecycle Design 文書の完成条件（v1.61.0）:

- [x] INTERACTION_LIFECYCLE_DESIGN.md 存在（§1–§42）
- [x] Lifecycle states / transitions / ownership 定義
- [x] Waiting / Retry / Timeout / Cancellation / Terminal boundaries 定義
- [x] Individual Core Layer 責務 **非再定義**
- [x] Interaction Lifecycle ≠ Runtime Lifecycle / state machine implementation
- [x] Production Code **変更なし** / **no implementation scope**
- [x] Level 4 Implementation Ready **未到達**
- [x] Quality Pipeline **640 PASS**（Test 621–640）
- [x] Architecture Governance **32** 必須文書

---

## Related Documents

| 文書 | 関係 |
|------|------|
| [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) | Interaction prerequisite |
| [EVENT_LAYER_DESIGN.md](./EVENT_LAYER_DESIGN.md) | Event classification |
| [AUTOMATION_LAYER_DESIGN.md](./AUTOMATION_LAYER_DESIGN.md) | Automation intent |
| [WORKFLOW_LAYER_DESIGN.md](./WORKFLOW_LAYER_DESIGN.md) | Workflow structure |
| [SCHEDULER_LAYER_DESIGN.md](./SCHEDULER_LAYER_DESIGN.md) | Scheduler trigger |
| [RUNTIME_LAYER_DESIGN.md](./RUNTIME_LAYER_DESIGN.md) | Runtime execution |
| [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md) | Provider capability |
| [NON_GOALS.md](./NON_GOALS.md) | 実装禁止 |
