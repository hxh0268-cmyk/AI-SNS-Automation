# Interaction Context Design

Cross-Layer Interaction が Layer 間を移動する際に **保持・参照・受け渡し** される情報を Architecture Contract として定義する Design 基準書です。**Context は Lifecycle State を所有しません。** **Context object / DB schema / production implementation ではありません。**

> **重要（v1.62.0）:** 本書は **Design Only**。Production Code 変更なし。**State Model / Error Model / Metadata Model は v1.62.0 では定義しません**（境界のみ）。Level 4 Implementation Ready **未到達**。

---

## 1. Purpose

- Interaction が Layer 間を移動する際の **Context Contract** を固定する
- Context **保持情報 / 受け渡し可能情報 / Layer 別 read-write 境界** を明文化する
- [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) と [INTERACTION_LIFECYCLE_DESIGN.md](./INTERACTION_LIFECYCLE_DESIGN.md) を **変更せず接続** する
- Context と Lifecycle / State / Error / Metadata の **混同を禁止** する
- **Level 3.3 — Interaction Context Complete** への到達点とする

---

## 2. Scope

| 対象 | 内容 |
|------|------|
| Context Principles / Definition | 規範的原則と契約定義 |
| Context vs Lifecycle / State / Error / Metadata | 分離境界 |
| Minimal / Required / Optional / Forbidden Fields | フィールド契約 |
| Ownership / Read / Write / Mutation / Immutability / Visibility / Propagation | 操作境界 |
| Layer-Specific Context Access | Event … Provider |
| Approval / Waiting / Retry / Timeout / Cancellation / Completion / Failure Context Rules | 参照境界のみ |
| Compatibility / Governance / Examples / Anti-Patterns | Design Only |

Application / Platform Layer の **既存 Public Contract** は変更しません。

---

## 3. Non-Goals

本書は以下を **行わない**（MUST NOT）:

- **Context implementation** / **Context object implementation**
- **Runtime / Workflow / Scheduler / Automation / Event / Provider implementation**
- **State Machine / State Model / Error Model / Metadata Model** 定義（境界のみ）
- **Retry engine / Timeout engine / Background job**
- **Database / Queue / Worker / Message Broker / Event Receiver / Webhook Receiver**
- **Adapter / OAuth / SNS API / External API / Cloud Runtime / Cache / Metrics implementation**
- Lifecycle state の **Context 内実体保存**
- Individual Core Layer **責務の再定義**
- **Production Code** 変更
- **Level 4 Implementation Ready** 到達の宣言

---

## 4. Design Status

| 観点 | 状態 |
|------|------|
| **Design Status** | **Design Only** |
| Release | v1.62.0 |
| Phase | Future Architecture Design Phase |
| Prerequisites | Layer Interaction Model（v1.60.0）+ Interaction Lifecycle（v1.61.0） |
| **Current Maturity** | **Level 3.3 — Interaction Context Complete** |
| Implementation | **Prohibited** |
| Production Code | **unchanged** / **no implementation scope** |

---

## 5. Relationship to Layer Interaction Model

| 観点 | 内容 |
|------|------|
| 前提 | [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) — Interaction chain / boundary |
| 本書 | Interaction 上を流れる **Context 情報契約** |
| 変更 | Interaction Model の責務 **非変更** |
| 整合 | Context propagation MUST follow adjacent boundary rules |

---

## 6. Relationship to Interaction Lifecycle

| 観点 | Interaction Lifecycle | Interaction Context（本書） |
|------|----------------------|---------------------------|
| 定義 | Interaction が **通る状態** | Interaction が **保持・受け渡す情報** |
| 所有 | Lifecycle state ownership | Context field ownership |
| 関係 | Lifecycle は Context を **内包しない** | Context は Lifecycle State を **所有しない** |

---

## 7. Context Principles

| 原則 | 規範 |
|------|------|
| **Contract Only** | Context は architecture contract — 実装オブジェクトではない |
| **Minimal by Default** | Context MUST start minimal — optional extension only |
| **Layer-Bounded Mutation** | Each layer MAY mutate only owned scope |
| **No Lifecycle in Context** | Context MUST NOT store lifecycle state entity |
| **No State Model in v1.62.0** | State representation は将来契約 |
| **Reference Not Payload** | errorRef / metadataRef — classification payload 非所有 |
| **Immutability of Upstream** | Upstream context MUST NOT be destructively altered |
| **Terminal Finality** | Post-terminal context mutation MUST NOT occur |
| **Compatibility Versioned** | compatibilityVersion MUST be required |

---

## 8. Context Definition

**Interaction Context** = cross-layer interaction instance に付随する **情報契約**（declarative field set）。

Context は:

- Interaction が **保持する情報** の契約
- Layer 間で **参照・受け渡し** される情報の契約
- **Mutation / visibility / compatibility** 境界を持つ

Context は **実装オブジェクト・DB 行・queue message ではない**。

---

## 9. Context vs Lifecycle

| 観点 | Context | Lifecycle |
|------|---------|-----------|
| 役割 | 保持・受け渡し **情報** | **状態遷移** 契約 |
| 例 | interactionId, workflowRef | Created, Running, Completed |
| 所有 | Context field ownership | Lifecycle state ownership |
| 規範 | **Context は Lifecycle State を所有しない** | Lifecycle は Context schema を **定義しない** |

---

## 10. Context vs State

| 観点 | Context | State（将来 State Model） |
|------|---------|---------------------------|
| 役割 | 参照・受け渡し可能な **情報契約** | 状態 **表現・構造・保存** の将来契約 |
| v1.62.0 | **定義する** | **定義しない** |
| 境界 | state persistence structure **禁止** | 将来 Interaction State Model で定義 |

---

## 11. Context vs Error

| 観点 | Context | Error（将来 Error Model） |
|------|---------|---------------------------|
| 役割 | error classification **非所有** | classification / propagation / recovery |
| v1.62.0 | **errorRef** 参照境界のみ | **定義しない** |
| 禁止 | error classification object / stack trace | — |

---

## 12. Context vs Metadata

| 観点 | Context | Metadata（将来 Metadata Model） |
|------|---------|----------------------------------|
| 役割 | trace / audit / diagnostic **非所有** | observability payload 将来契約 |
| v1.62.0 | **metadataRef** 参照境界のみ | **定義しない** |
| 禁止 | diagnostic logs / metrics payload | — |

---

## 13. Minimal Context Contract

最小 Context Contract（**pseudo-contract — 実装なし**）:

```text
interactionId:        "<opaque-id>"
interactionType:      "<contract-type>"
sourceLayer:          "Event"
targetLayer:          "Automation"
compatibilityVersion: "1.62.0"
originatingEventRef:  "<event-contract-ref>"
inputRef:             "<input-contract-ref>"
```

---

## 14. Required Context Fields

| Field | 意味 | Owner |
|-------|------|-------|
| `interactionId` | Interaction instance 識別 | Event（初期）→ read-only downstream |
| `interactionType` | Interaction 種別 | Event |
| `sourceLayer` | 発生 Layer | Event |
| `targetLayer` | 次隣接 Layer | Event |
| `compatibilityVersion` | Context contract version | Event（初期） |
| `originatingEventRef` | 起源 Event contract ref | Event |

---

## 15. Optional Context Fields

| Field | 意味 | 追加 Layer |
|-------|------|------------|
| `automationRef` | Automation contract ref | Automation |
| `workflowRef` | Workflow contract ref | Workflow |
| `schedulerRef` | Scheduler contract ref | Scheduler |
| `runtimeRef` | Runtime contract ref | Runtime |
| `providerCapabilityRef` | Provider capability ref | Runtime（宣言） |
| `approvalContext` | Approval requirement 宣言 | Automation |
| `waitingContext` | Waiting type 宣言 | Automation / Scheduler / Runtime |
| `inputRef` / `outputRef` | I/O contract refs | 各 Layer（所有範囲内） |
| `constraintRef` | Timing / policy constraint ref | Scheduler |
| `errorRef` | Error model 参照（payload 非所有） | Runtime |
| `metadataRef` | Metadata model 参照 | Any（declaration only） |

Optional field 追加は **additive compatible**。

---

## 16. Forbidden Context Fields

以下 MUST NOT appear in Context Contract:

| Forbidden | Reason |
|-----------|--------|
| lifecycle state の **実体** | Lifecycle 所有 |
| state persistence structure | State Model 領域 |
| retry engine state | Implementation |
| timeout engine state | Implementation |
| error classification object | Error Model 領域 |
| stack trace | Error / diagnostic |
| diagnostic logs | Metadata 領域 |
| provider credentials | Security |
| OAuth tokens | Security |
| raw external API response | Provider internal |
| database record implementation | Storage |
| queue message implementation | Queue 領域 |
| worker execution state | Worker 領域 |
| metrics payload | Metadata 領域 |
| cache payload | Cache 領域 |
| private provider internals | Provider boundary |
| implementation-only metadata | Metadata 領域 |

---

## 17. Context Ownership

| Layer | Owns |
|-------|------|
| **Event** | Initial context creation — through **Validated** |
| **Automation** | automationRef / approvalContext additions |
| **Workflow** | workflowRef / stepRef / dependencyRef / transitionRef |
| **Scheduler** | schedulerRef / scheduleRef / triggerRef / constraintRef |
| **Runtime** | runtimeRef / providerCapabilityRef declaration / errorRef |
| **Provider** | **No ownership** — read minimal refs only |

---

## 18. Context Read Rules

| Rule | 規範 |
|------|------|
| **CR-01** | Layer MAY read contract-declared fields for its boundary |
| **CR-02** | Layer MUST NOT read forbidden fields |
| **CR-03** | Provider MAY read capabilityRef / inputRef minimum only |
| **CR-04** | Downstream MUST NOT read upstream private implementation |
| **CR-05** | Unknown optional fields MUST be ignored by older consumers |

---

## 19. Context Write Rules

| Rule | 規範 |
|------|------|
| **CW-01** | Layer MAY write only owned optional fields |
| **CW-02** | Required fields MUST NOT be removed after creation |
| **CW-03** | Event MUST NOT write downstream-owned fields |
| **CW-04** | Provider MUST NOT write Context |
| **CW-05** | Post-terminal write MUST NOT occur |

---

## 20. Context Mutation Rules

| Rule | 規範 |
|------|------|
| **CM-01** | Context mutation MUST follow Layer boundary |
| **CM-02** | Each Layer MAY append/update **only owned scope** |
| **CM-03** | Upstream Context MUST NOT be **destructively** changed |
| **CM-04** | Downstream Context MUST NOT be **pre-written** by upstream |
| **CM-05** | Terminal lifecycle 後の mutation **禁止** |
| **CM-06** | Context mutation is **NOT** substitute for State transition |
| **CM-07** | Context mutation is **NOT** substitute for Error recovery |
| **CM-08** | Context mutation is **NOT** substitute for Metadata logging |

---

## 21. Context Immutability Rules

| Field / Scope | Immutability |
|---------------|--------------|
| `interactionId` | Immutable after Created |
| `originatingEventRef` | Immutable after Event phase |
| `compatibilityVersion` | Immutable after creation |
| Upstream required fields | MUST NOT be overwritten downstream |
| Terminal snapshot | Immutable after terminal lifecycle |

---

## 22. Context Visibility Rules

| Rule | 規範 |
|------|------|
| **CV-01** | Visibility MUST match Layer Interaction Model adjacency |
| **CV-02** | Foreign layer internal fields MUST NOT be exposed |
| **CV-03** | Forbidden fields MUST NOT be visible |
| **CV-04** | waitingContext type MUST be visible to owning wait resolver |

---

## 23. Context Propagation Rules

| Rule | 規範 |
|------|------|
| **CP-01** | Context propagates **down** Event → … → Runtime via contract refs |
| **CP-02** | Propagation MUST NOT skip layers |
| **CP-03** | Each hop MUST preserve required fields |
| **CP-04** | Provider receives **minimal read subset** via Runtime only |

---

## 24. Context Boundary Crossing Rules

| Crossing | Rule |
|----------|------|
| Event → Automation | Initial context handoff |
| Automation → Workflow | automationRef + optional approvalContext |
| Workflow → Scheduler | workflowRef + structure refs |
| Scheduler → Runtime | schedulerRef + constraintRef |
| Runtime → Provider | **read-only** capabilityRef / inputRef — Provider **no mutation** |
| Skip-layer | **MUST NOT** |

---

## 25. Layer-Specific Context Access

| Layer | Read | Write | MUST NOT |
|-------|------|-------|----------|
| Event | — | Initial create | Downstream mutation |
| Automation | intent / approval | automation fields | scheduler/runtime/provider fields |
| Workflow | structure refs | workflow fields | runtime execution context |
| Scheduler | timing refs | scheduler fields | workflow intent change |
| Runtime | execution refs | runtime fields | credentials / lifecycle state in context |
| Provider | minimal capability/input | **none** | Any mutation |

---

## 26. Event Context Boundary

| 規範 | 内容 |
|------|------|
| Event MAY | Participate in **initial context creation** |
| Event responsibility | Through **Validated** — aligns with Lifecycle |
| Event MUST NOT | Change downstream context after handoff |
| Event MUST NOT | Embed lifecycle state entity |

---

## 27. Automation Context Boundary

| 規範 | 内容 |
|------|------|
| Automation MAY read | automation intent / approval requirement |
| Automation MAY add | automationRef / approvalContext |
| Automation MUST NOT | Write scheduler / runtime / provider context directly |
| Automation MUST NOT | Overwrite Event required fields destructively |

---

## 28. Workflow Context Boundary

| 規範 | 内容 |
|------|------|
| Workflow MAY handle | workflowRef / stepRef / dependencyRef / transitionRef |
| Workflow MUST NOT | Write runtime execution context |
| Workflow MUST NOT | Read provider capability internals |

---

## 29. Scheduler Context Boundary

| 規範 | 内容 |
|------|------|
| Scheduler MAY handle | scheduleRef / triggerRef / timing constraintRef |
| Scheduler MUST NOT | Change workflow intent / structure |
| Scheduler MUST NOT | Write runtime result into Context |

---

## 30. Runtime Context Boundary

| 規範 | 内容 |
|------|------|
| Runtime MAY handle | runtimeRef / execution preparation refs |
| Runtime MAY declare | providerCapabilityRef / errorRef |
| Runtime MUST NOT | Write provider credentials to Context |
| Runtime MUST NOT | Store lifecycle state in Context |

---

## 31. Provider Context Boundary

| 規範 | 内容 |
|------|------|
| Provider MAY read | Minimal capabilityRef / inputRef |
| Provider MUST NOT | Own Context |
| Provider MUST NOT | Mutate Context |
| Provider MUST NOT | Hold lifecycle state |

---

## 32. Approval Context Rules

- `approvalContext` declares approval **requirement** — not approval execution
- Owned by Automation boundary
- MUST NOT contain credentials or execution state

---

## 33. Waiting Context Rules

- `waitingContext` declares wait **type** — not wait queue
- Typed: approval-wait / scheduler-wait / runtime-wait / external-wait
- MUST NOT implement queue or worker state

---

## 34. Retry Context Rules

- Retry context MAY declare retry **policy ref** — not retry engine state
- MUST NOT store retry engine internals
- MUST NOT mutate Completed terminal context

---

## 35. Timeout Context Rules

- Timeout context MAY declare timeout **policy ref** — not timeout engine state
- Timeout outcome belongs to Lifecycle — not Context engine

---

## 36. Cancellation Context Rules

- Cancellation MAY be declared via bounded context flag/ref
- MUST be explicit — MUST NOT silently mutate upstream intent

---

## 37. Completion Context Rules

- `outputRef` MAY be set at completion boundary
- Completion Context MUST NOT imply lifecycle state stored in Context
- Completed lifecycle + outputRef declaration are separate contracts

---

## 38. Failure Context Rules

- `errorRef` MAY reference future Error Model — **not** error classification object
- Failure Context MUST NOT include stack trace or diagnostic logs

---

## 39. Compatibility Rules

| Rule | 規範 |
|------|------|
| **CC-01** | Required field removal **禁止** |
| **CC-02** | Required field semantic change **禁止** |
| **CC-03** | Optional field addition **compatible** |
| **CC-04** | Optional → required promotion **breaking** |
| **CC-05** | Field rename **breaking** |
| **CC-06** | Field semantic change **breaking** |
| **CC-07** | Unknown optional fields MUST be ignored by older consumers |
| **CC-08** | `compatibilityVersion` MUST be required |
| **CC-09** | Context contract MUST carry version compatibility |

---

## 40. Version Compatibility

- Follows [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md)
- `compatibilityVersion` format aligns with governance semver policy
- Additive optional fields default for minor context revisions

---

## 41. Governance Integration

| 文書 | Integration |
|------|-------------|
| [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) | Context contract changes |
| [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md) | Release verification |
| [CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) | Breaking field changes |

---

## 42. Future Entry Criteria Integration

- Level 3→4 MUST validate Context Design against Interaction Model + Lifecycle
- State / Error / Metadata Models MUST NOT break Context boundaries when added
- Implementation MUST NOT begin until Entry Criteria pass

---

## 43. Context Examples

### Minimal Context Example

```text
interactionId: "ix-001"
interactionType: "event-to-automation"
sourceLayer: "Event"
targetLayer: "Automation"
compatibilityVersion: "1.62.0"
originatingEventRef: "evt-abc"
inputRef: "payload-ref-1"
```

### Automation Context Extension Example

```text
# extends Minimal
automationRef: "auto-intent-42"
approvalContext: { required: true, gate: "human-policy-A" }
```

### Scheduler Context Extension Example

```text
# extends Workflow handoff
schedulerRef: "sched-7"
constraintRef: "cron-ref-daily-0900"
waitingContext: { type: "scheduler-wait" }
```

### Runtime Context Extension Example

```text
runtimeRef: "rt-exec-99"
providerCapabilityRef: "cap-post-publish"
errorRef: "err-model-ref-future"
outputRef: "out-ref-1"
```

### Forbidden Context Example

```text
# FORBIDDEN — do not use
lifecycleState: "Running"          # lifecycle entity in context
oauthToken: "secret-xxx"           # credentials
rawApiResponse: { ... }            # provider internal
retryEngineState: { attempt: 3 }  # engine implementation
metricsPayload: { ... }            # metadata payload
```

---

## 44. Anti-Patterns

| Anti-Pattern | Why forbidden |
|--------------|---------------|
| **Treating Context as lifecycle state** | Ownership confusion |
| **Treating Context as state persistence** | State Model violation |
| **Treating Context as error model** | Error Model violation |
| **Treating Context as metadata model** | Metadata Model violation |
| **Storing credentials in Context** | Security violation |
| **Storing raw provider responses in Context** | Provider boundary violation |
| **Letting Provider mutate Context** | Provider MUST NOT write |
| **Allowing Runtime to overwrite Automation intent** | Upstream destruction |
| **Allowing Scheduler to rewrite Workflow structure** | Layer boundary violation |
| **Using Context mutation as retry engine** | Implementation premature |
| **Using Context mutation as timeout engine** | Implementation premature |
| **Using Context as queue message implementation** | Infrastructure premature |
| **Using Context as database schema** | Storage premature |
| **Using Context as observability payload** | Metadata Model violation |

---

## 45. Testing Strategy

| 観点 | v1.62.0 |
|------|---------|
| Scope | Documentation / field / boundary verification |
| Machine checks | Quality Pipeline Test 641–660 |
| Implementation tests | **MUST NOT** add |
| Context object tests | **MUST NOT** add |

---

## 46. Observability

| Point | v1.62.0 |
|-------|---------|
| Context fields | Declared in contract — not metrics payload |
| metadataRef | Future Metadata Model hook |
| Real trace / audit | **Future** — not in Context payload |
| correlationId | MAY appear as optional ref — not diagnostic log |

---

## 47. Completion Criteria

Interaction Context Design 文書の完成条件（v1.62.0）:

- [x] INTERACTION_CONTEXT_DESIGN.md 存在（§1–§47）
- [x] Minimal / Required / Optional / Forbidden fields 定義
- [x] Context vs Lifecycle / State / Error / Metadata 分離
- [x] Read / Write / Mutation / Ownership rules 定義
- [x] Layer-specific boundaries 定義
- [x] Individual Core Layer 責務 **非再定義**
- [x] Production Code **変更なし** / **no implementation scope**
- [x] Level 4 Implementation Ready **未到達**
- [x] Quality Pipeline **660 PASS**（Test 641–660）
- [x] Architecture Governance **33** 必須文書

---

## Related Documents

| 文書 | 関係 |
|------|------|
| [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) | Interaction boundary prerequisite |
| [INTERACTION_LIFECYCLE_DESIGN.md](./INTERACTION_LIFECYCLE_DESIGN.md) | Lifecycle prerequisite |
| [EVENT_LAYER_DESIGN.md](./EVENT_LAYER_DESIGN.md) | Event classification |
| [NON_GOALS.md](./NON_GOALS.md) | 実装禁止 |
