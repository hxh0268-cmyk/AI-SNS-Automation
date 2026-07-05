# Interaction Error Model Design

Cross-Layer Interaction の **failure 情報** の表現・分類・所有・伝播・ガバナンスを Architecture Contract として定義する Design 基準書です。**Error Model は Lifecycle / State / Context を再定義しません。**

> **重要（v1.64.0）:** 本書は **Design Only**。Production Code 変更なし。**Retry Engine / Recovery Engine / Runtime Exception / Logging / Monitoring / Database schema 実装なし。** Level 4 Implementation Ready **未到達**。

**SSOT 分離:**
- **Lifecycle** → [INTERACTION_LIFECYCLE_DESIGN.md](./INTERACTION_LIFECYCLE_DESIGN.md) — states / transitions
- **State Model** → [INTERACTION_STATE_MODEL.md](./INTERACTION_STATE_MODEL.md) — lifecycleState / stateRevision representation
- **Context** → [INTERACTION_CONTEXT_DESIGN.md](./INTERACTION_CONTEXT_DESIGN.md) — information carrier
- **Error Model（本書）** → failure information representation / classification / ownership / propagation

---

## 1. Purpose

- Interaction **failure 情報** の Architecture Contract を定義する
- Error **classification / ownership / read / write / propagation / boundary** rules を明文化する
- Lifecycle / State / Context / Metadata の **責務を侵食しない**
- **Level 3.5 — Interaction Error Model Complete** への到達点とする

---

## 2. Scope

| 対象 | 内容 |
|------|------|
| Error Information Definition / Minimal Contract | Required / Optional / Forbidden fields |
| Error vs Lifecycle / State / Context / Metadata / Runtime Exception | 分離 |
| Classification / Severity / Source Rules | 記述的分類のみ |
| Ownership / Read / Write / Propagation / Immutability / Correlation | 操作ガバナンス |
| Failure / Rejection / Abortion / Expiration / Timeout / Cancellation / Retry / Recovery boundaries | 記述境界 |
| Layer-Specific Error Access | Event … Provider |
| Compatibility / Governance / Examples / Anti-Patterns | Design Only |

---

## 3. Non-Goals

Interaction Error Model は以下 **ではない**（MUST NOT）:

- **Lifecycle** / **State Model** / **Context** / **Metadata Model** 再定義
- **Retry Engine** / **Recovery Engine** 実装
- **Runtime Exception** / **Logging** / **Monitoring** / **Metrics** 実装
- **Database Schema** / **Queue** / **Worker** 実装
- **Provider / Runtime / Scheduler / Workflow / Automation / Event** 実装
- Individual Core Layer **責務の再定義**
- **Production Code** 変更

---

## 4. Design Status

| 観点 | 状態 |
|------|------|
| **Design Status** | **Design Only** |
| Release | v1.64.0 |
| Phase | Future Architecture Design Phase |
| **Current Maturity** | **Level 3.5 — Interaction Error Model Complete** |
| Implementation | **Prohibited** / **no implementation scope** |
| Production Code | **unchanged** |

---

## 5. Architecture Position

```
Layer Interaction Model     → interaction authority
Interaction Lifecycle       → lifecycle states / transitions (SSOT)
Interaction Context         → cross-layer information carrier
Interaction State Model     → state information representation (SSOT)
Interaction Error Model     → failure information (本書)
Future Metadata Model       → observability payload (not v1.64.0)
```

---

## 6. Relationship to Layer Interaction Model

| 観点 | 内容 |
|------|------|
| 前提 | [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) |
| 本書 | Error propagation follows adjacent boundary rules |
| 変更 | Interaction Model **非変更** |

---

## 7. Relationship to Interaction Lifecycle

| 観点 | Lifecycle（SSOT） | Error Model（本書） |
|------|------------------|---------------------|
| 所有 | Lifecycle states / transition semantics | **Descriptive failure information** |
| 規範 | Failed / Rejected / Aborted / Expired / Cancelled — Lifecycle SSOT | Error Model **describes** — MUST NOT redefine |
| 禁止 | — | errorClassification MUST NOT determine transitions **by itself** |
| 禁止 | — | MUST NOT redefine lifecycle failure states |

---

## 8. Relationship to Interaction Context

| 観点 | Context | Error Model |
|------|---------|-------------|
| 役割 | Information **carrier** | Failure **description** |
| contextRef | Context contract reference | Optional loose ref — MUST NOT embed full Context |
| 禁止 | Context as error carrier | Error MUST NOT turn Context into error payload |

---

## 9. Relationship to Interaction State Model

| 観点 | State Model（SSOT） | Error Model |
|------|---------------------|-------------|
| 所有 | lifecycleState / stateRevision representation | lifecycleStateRef / stateRevisionRef **reference only** |
| 禁止 | — | MUST NOT mutate stateRevision from Error Model |
| 禁止 | — | errorClassification MUST NOT be lifecycleState |

---

## 10. Error Model Principles

| 原則 | 規範 |
|------|------|
| **Descriptive Only** | Error describes failure — does not execute retry/recovery |
| **SSOT Respect** | Lifecycle / State / Context semantics unchanged |
| **Owning Layer Writes** | Detecting/normalizing layer owns error write |
| **Append-Only / Immutable** | After publication — governance correction only |
| **Loose References** | lifecycleStateRef / contextRef — not embedded payloads |
| **No Implementation Leakage** | No stack traces / exception classes / provider raw errors |
| **Classification ≠ Transition** | Classification does not alone drive lifecycle transition |

---

## 11. Error Information Definition

**Error Information** = declarative contract describing Interaction failure at an architecture level.

Error Information is:

- NOT a runtime exception object
- NOT a lifecycle state
- NOT state revision mutation
- NOT full Context embedding
- NOT Metadata / logging / metrics payload

---

## 12. Error Model vs Lifecycle

| 観点 | Lifecycle | Error Model |
|------|-----------|-------------|
| Question | WHAT state / transition? | WHAT failure **description**? |
| Failed / Rejected / etc. | **Defined** in Lifecycle Design | **Referenced** via lifecycleStateRef only |
| Transition authority | Lifecycle Design SSOT | Error Model **MUST NOT** own |

---

## 13. Error Model vs State

| 観点 | State | Error |
|------|-------|-------|
| lifecycleState | State Model **represents** | Error **references** via lifecycleStateRef |
| stateRevision | State Model **owns** ordering | stateRevisionRef **reference only** — no mutation |
| 禁止 | — | Error MUST NOT encode State semantics |

---

## 14. Error Model vs Context

| 観点 | Context | Error |
|------|---------|-------|
| Carrier | Cross-layer information propagation | Failure description |
| contextRef | Optional loose reference | MUST NOT embed full Context |
| 禁止 | Using Context as error carrier | — |

---

## 15. Error Model vs Metadata

| 観点 | Metadata（将来） | Error Model |
|------|-----------------|-------------|
| 役割 | trace / audit / diagnostic / observability | failure classification / description |
| metadataRef | Future Metadata Model | **Excluded** from Minimal Contract |
| 禁止 | Error invading Metadata | Metadata MUST NOT become authoritative Error |

---

## 16. Error Model vs Runtime Exception

| 観点 | Runtime Exception（実装） | Error Model |
|------|--------------------------|-------------|
| 性質 | Implementation throwable | Architecture contract |
| Runtime | MAY normalize boundary errors | MUST NOT define exception implementation |
| 禁止 | exceptionClass / stackTrace in contract | — |

---

## 17. Minimal Error Information Contract

```text
interactionId:        "<opaque-id>"
errorId:                "<opaque-error-id>"
errorType:              "<error-type-label>"
errorSourceLayer:       "<Event|Automation|Workflow|Scheduler|Runtime|Provider>"
errorClassification:  "<classification-label>"
```

Optional — §19。Forbidden from Minimal — §20。

---

## 18. Required Error Information

| Field | Semantics |
|-------|-----------|
| **interactionId** | Identity correlation — MUST match Context / State identity |
| **errorId** | Unique error information instance identifier |
| **errorType** | Error type label — architecture contract |
| **errorSourceLayer** | Layer that detected or normalized the error |
| **errorClassification** | Classification label — §21 — does NOT alone determine lifecycle transition |

**No independent compatibilityVersion** in Minimal Error Contract — cross-model compatibility governed centrally（Context governing contract）。

---

## 19. Optional Error Information

| Field | Semantics | Why reference-only |
|-------|-----------|-------------------|
| **lifecycleStateRef** | Reference to Lifecycle state at error time | MUST NOT redefine Lifecycle semantics |
| **stateRevisionRef** | Reference to State revision at error time | MUST NOT mutate State Model |
| **contextRef** | Loose Context contract reference | MUST NOT turn Context into error carrier |

**Explicitly excluded from Minimal Contract** (deferred / forbidden):

| Excluded | Reason |
|----------|--------|
| **providerErrorRef** | Provider implementation coupling risk |
| **retryRef** | Retry Engine predefinition risk |
| **recoveryRef** | Recovery Engine predefinition risk |
| **metadataRef** | Future Metadata Model invasion |
| **compatibilityVersion** | Central cross-model governance |
| **ownerLayerRef** | Conflicts with Lifecycle Transition Ownership |
| **snapshotRef / historyRef / databaseRef** | Storage implementation |
| **exceptionClass / stackTrace** | Runtime implementation leakage |
| **logRef / metricRef / monitoringRef** | Observability implementation |

---

## 20. Forbidden Error Information

MUST NOT appear in Minimal Error Information Contract or public Error propagation:

- providerErrorRef, retryRef, recoveryRef, metadataRef
- compatibilityVersion（independent competing authority）
- ownerLayerRef, snapshotRef, historyRef, databaseRef
- exceptionClass, stackTrace, logRef, metricRef, monitoringRef
- Full Context payload embedding
- Provider-specific raw exception details
- lifecycleState as errorClassification substitute

---

## 21. Error Classification Rules

Classifications（**descriptive only — no implementation**）:

| Classification | 概要 |
|----------------|------|
| **validation_error** | Contract / input validation failure |
| **authorization_error** | Authorization / approval gate failure |
| **capability_error** | Capability not available / mismatched |
| **provider_error** | Provider boundary normalized failure |
| **scheduling_error** | Scheduler boundary failure |
| **runtime_error** | Runtime execution boundary failure |
| **workflow_error** | Workflow structure boundary failure |
| **automation_error** | Automation intent boundary failure |
| **event_error** | Event classification boundary failure |
| **timeout_error** | Timeout outcome description |
| **cancellation_error** | Cancellation outcome description |
| **rejection_error** | Rejection outcome description |
| **expiration_error** | Expiration outcome description |
| **unknown_error** | Unclassified failure |

**Classification does NOT determine lifecycle state transitions by itself.** Lifecycle transition authority remains Lifecycle Design SSOT。

---

## 22. Error Severity Rules

Severity（**descriptive information only**）:

| Severity | Meaning |
|----------|---------|
| **info** | Informational failure context |
| **warning** | Non-blocking concern |
| **recoverable** | Potentially recoverable — **does NOT imply retry** |
| **non_recoverable** | Not recoverable — **does NOT imply abort implementation** |
| **fatal** | Severe failure description — **does NOT imply halt implementation** |

**Severity does NOT imply retry or recovery behavior.**

---

## 23. Error Source Rules

| Rule | 規範 |
|------|------|
| **ES-01** | errorSourceLayer MUST identify detecting/normalizing layer |
| **ES-02** | Provider-originated errors MUST be normalized before crossing Provider boundary |
| **ES-03** | Raw provider errors MUST NOT leak across architecture boundaries |
| **ES-04** | errorSourceLayer MUST NOT be falsified downstream |

---

## 24. Error Ownership

| 規範 | 内容 |
|------|------|
| **Write ownership** | Layer that **detects or normalizes** the error owns writing Error Information |
| **Lifecycle** | Lifecycle state transitions remain **Lifecycle authority** |
| **State** | State mutation remains **State Model** governance |
| **Provider** | MAY provide provider-originated error info — MUST NOT mutate Error Model directly |
| **Runtime** | MAY normalize execution boundary errors — MUST NOT define exception implementation |
| **Scheduler** | MAY describe timeout/cancellation/scheduling boundary errors — MUST NOT implement scheduling |
| **Workflow / Automation / Event** | MAY describe own boundary errors only |

---

## 25. Error Read Rules

| Rule | 規範 |
|------|------|
| **ER-R01** | Read only through **explicit contract boundaries** |
| **ER-R02** | Minimum necessary access per layer responsibility |
| **ER-R03** | No speculative downstream error access |
| **ER-R04** | Provider read minimum normalized error information only |

---

## 26. Error Write Rules

| Rule | 規範 |
|------|------|
| **ER-W01** | Write limited to **owning boundary** |
| **ER-W02** | Detecting/normalizing layer writes initial Error Information |
| **ER-W03** | Downstream MUST NOT rewrite upstream error semantics destructively |
| **ER-W04** | Provider MUST NOT mutate Interaction Error Model directly |
| **ER-W05** | Error write MUST NOT mutate lifecycleState or stateRevision |

---

## 27. Error Propagation Rules

| Rule | 規範 |
|------|------|
| **EP-01** | Propagation MUST preserve errorId, interactionId, errorSourceLayer, errorClassification |
| **EP-02** | Propagation MUST NOT mutate lifecycle semantics |
| **EP-03** | Propagation MUST NOT embed provider-specific implementation details |
| **EP-04** | Error information SHOULD be **append-only or immutable** after publication |
| **EP-05** | Governance-defined correction is the only exception to immutability |

---

## 28. Error Immutability Rules

| 規範 | 内容 |
|------|------|
| Published Error Information | Immutable except governance correction |
| errorId | Immutable once assigned |
| errorClassification at source | MUST NOT be silently rewritten downstream |
| Append-only pattern | New errors get new errorId — do not mutate prior publication |

---

## 29. Error Correlation Rules

| Rule | 規範 |
|------|------|
| **EC-01** | interactionId MUST correlate with Context / State identity |
| **EC-02** | errorId MUST be unique per error information instance |
| **EC-03** | lifecycleStateRef / stateRevisionRef / contextRef are loose correlators — not embedded data |
| **EC-04** | Multiple errors MAY correlate to same interactionId |

---

## 30. Error Boundary Crossing Rules

| Crossing | Rule |
|----------|------|
| Layer → adjacent Layer | Normalized Error Information contract only |
| Provider → Runtime | Normalized provider-originated error — no raw leak |
| Skip-layer | **MUST NOT** |
| Error → Lifecycle | Error **describes** — Lifecycle **decides** transition |
| Error → State | Reference only — no stateRevision mutation |

---

## 31. Lifecycle Failure Boundary

| 観点 | Error Model | Lifecycle Model |
|------|-------------|-----------------|
| 所有 | Descriptive failure information | **Failed** lifecycle state / transition semantics |
| Error Model | Describes failure context | — |
| Lifecycle | — | Owns Failed state and authorized transitions |
| Implementation | Out of scope | Out of scope |

---

## 32. Rejection Boundary

| 観点 | Error Model | Lifecycle |
|------|-------------|-----------|
| Classification | **rejection_error** | **Rejected** terminal state — SSOT |
| Error Model | Describes rejection context | — |
| Lifecycle | — | Owns Rejected semantics |

---

## 33. Abortion Boundary

| 観点 | Error Model | Lifecycle |
|------|-------------|-----------|
| Classification | boundary violation description | **Aborted** terminal state — SSOT |
| Error Model | Describes abortion context | — |
| Lifecycle | — | Owns Aborted semantics |

---

## 34. Expiration Boundary

| 観点 | Error Model | Lifecycle |
|------|-------------|-----------|
| Classification | **expiration_error** | **Expired** terminal state — SSOT |
| Error Model | Describes expiration context | — |
| Lifecycle | — | Owns Expired semantics |

---

## 35. Timeout Error Boundary

| 観点 | Error Model | Lifecycle / Scheduler |
|------|-------------|----------------------|
| Classification | **timeout_error** | Expired / Failed outcomes — Lifecycle SSOT |
| Scheduler | MAY describe scheduling timeout boundary error | MUST NOT implement timeout engine |
| Error Model | Descriptive only | — |

---

## 36. Cancellation Error Boundary

| 観点 | Error Model | Lifecycle |
|------|-------------|-----------|
| Classification | **cancellation_error** | **Cancelled** terminal state — SSOT |
| Error Model | Describes cancellation context | — |
| Implementation | Out of scope | Out of scope |

---

## 37. Retry Error Boundary

| 観点 | Error Model | Retry Engine |
|------|-------------|--------------|
| 役割 | MAY describe recoverable failure context | **Not defined** — not implemented |
| retryRef | **Excluded** from Minimal Contract | — |
| 禁止 | Defining retry logic | — |

**Retry Error Boundary:** Error describes failure — Retry Engine **out of scope**。

---

## 38. Recovery Error Boundary

| 観点 | Error Model | Recovery Engine |
|------|-------------|-----------------|
| 役割 | MAY describe recovery-relevant failure | **Not defined** — not implemented |
| recoveryRef | **Excluded** from Minimal Contract | — |
| 禁止 | Defining recovery logic | — |
| 禁止 | Recovery inventing Lifecycle state | Lifecycle SSOT |

**Recovery Error Boundary:** Error describes failure — Recovery Engine **out of scope**。

---

## 39. Layer-Specific Error Access

| Layer | Write | Read | MUST NOT |
|-------|-------|------|----------|
| Event | Event boundary errors | Responsibility scope | Downstream error mutation |
| Automation | Automation boundary errors | Responsibility scope | Pre-write Workflow/Scheduler/Runtime errors |
| Workflow | Workflow boundary errors | Responsibility scope | Scheduler/Runtime execution errors |
| Scheduler | Scheduling/timeout/cancellation errors | Scheduling scope | Implement scheduling; Runtime State mutation |
| Runtime | Normalized execution errors | Execution scope | Exception implementation; full Lifecycle ownership |
| Provider | Provider-originated info (normalized) | Minimum | Mutate Error Model / State / Lifecycle |

---

## 40. Event Error Boundary

- MAY describe **event_error** classification at Event responsibility boundary
- Responsibility ends per Lifecycle Design
- MUST NOT modify downstream Error Information

---

## 41. Automation Error Boundary

- MAY describe **automation_error** / **authorization_error**
- Read automation-relevant Error Information only
- MUST NOT pre-write Workflow / Scheduler / Runtime errors

---

## 42. Workflow Error Boundary

- MAY describe **workflow_error**
- Read workflow-relevant Error Information only
- MUST NOT own Scheduler or Runtime execution errors

---

## 43. Scheduler Error Boundary

- MAY describe **scheduling_error** / **timeout_error** / **cancellation_error**
- MUST NOT modify Workflow intent
- MUST NOT implement scheduling logic

---

## 44. Runtime Error Boundary

- MAY **normalize** execution boundary Error Information
- MAY describe **runtime_error**
- MUST NOT define Runtime Exception implementation
- MUST NOT independently own entire Interaction Lifecycle
- **Runtime Exception ≠ Interaction Error Model**

---

## 45. Provider Error Boundary

Provider:

- MAY provide **provider-originated** error information
- MUST NOT mutate Interaction Error Model directly
- MUST NOT mutate Interaction State or Lifecycle
- Provider-specific **raw errors MUST NOT leak** across architecture boundaries
- Provider error information MUST be **normalized** before crossing Provider boundary
- Provider error information MUST remain **implementation-agnostic**
- **providerErrorRef deferred** — Minimal Contract exclusion

---

## 46. Error Consistency Rules

| Rule | 規範 |
|------|------|
| **ECN-01** | interactionId consistent with Context / State |
| **ECN-02** | lifecycleStateRef references valid SSOT Lifecycle state |
| **ECN-03** | stateRevisionRef references without mutation |
| **ECN-04** | Error MUST NOT contradict published State information |
| **ECN-05** | Error MUST NOT embed Metadata semantics |
| **ECN-06** | Classification MUST NOT substitute for lifecycleState |

---

## 47. Error Compatibility Rules

| Rule | 規範 |
|------|------|
| **CMP-01** | Required fields are **stable** |
| **CMP-02** | Required fields MUST NOT be removed or semantically redefined |
| **CMP-03** | Optional fields MAY be added **additively** |
| **CMP-04** | Cross-model references MUST remain **loose references** |
| **CMP-05** | Lifecycle / State / Context / Error / future Metadata independently governable |
| **CMP-06** | No independent compatibilityVersion in Minimal Error Contract |

---

## 48. Cross-Model Version Compatibility

| Model | Compatibility authority |
|-------|------------------------|
| Governing contract | Context **compatibilityVersion**（central） |
| Error Model | Follows governing contract — no competing field |
| State Model | stateRevision — ordering only |
| Lifecycle | SSOT semantics — unchanged |

Cross-model compatibility conflicts resolved by **governing Architecture compatibility contract**。

---

## 49. Governance Integration

| 文書 | Integration |
|------|-------------|
| [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) | Error contract changes |
| [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md) | Release verification |
| [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md) | Breaking change rules |

---

## 50. Future Entry Criteria Integration

- Level 3→4 MUST validate Error Model against Lifecycle / State / Context SSOT
- Future Metadata Model MUST NOT break Error boundaries
- Implementation MUST NOT begin until Entry Criteria pass

---

## 51. Error Model Examples

### Minimal Error Information Example

```text
interactionId:        "ix-001"
errorId:              "err-001"
errorType:            "validation_failure"
errorSourceLayer:     "Event"
errorClassification:  "validation_error"
```

### Error with Optional References Example

```text
interactionId:        "ix-001"
errorId:              "err-002"
errorType:            "scheduling_timeout"
errorSourceLayer:     "Scheduler"
errorClassification:  "timeout_error"
lifecycleStateRef:    "Running"
stateRevisionRef:     "5"
contextRef:           "ctx-ref-001"
```

### Forbidden Error Information Example

```text
# FORBIDDEN
errorClassification:  "Running"           # treating classification as lifecycleState
stackTrace:           "..."               # runtime implementation
retryRef:             "retry-policy-1"    # retry engine predefinition
recoveryRef:          "recovery-1"        # recovery engine predefinition
metadataRef:          "trace-abc"         # metadata model invasion
compatibilityVersion: "1.64.0"            # competing compatibility authority
providerErrorRef:     "aws-12345"         # provider coupling
exceptionClass:       "ProviderException" # runtime exception
```

---

## 52. Anti-Patterns

| Anti-Pattern | Why forbidden |
|--------------|---------------|
| **Redefining lifecycle failure states** | Lifecycle SSOT violation |
| **Treating errorClassification as lifecycleState** | Semantic confusion |
| **Mutating stateRevision from Error Model** | State Model violation |
| **Embedding full Context inside Error Model** | Context boundary violation |
| **Using Context as an error carrier** | Context role violation |
| **Provider-specific raw exception details in public contract** | Implementation leakage |
| **Adding stack traces** | Runtime implementation |
| **Defining retry logic** | Retry Engine premature |
| **Defining recovery logic** | Recovery Engine premature |
| **Defining logging / monitoring implementation** | Observability premature |
| **Defining database schema** | Persistence premature |
| **Defining queue or worker behavior** | Infrastructure premature |
| **Changing production code** | Design Only violation |

---

## 53. Testing Strategy

| 観点 | v1.64.0 |
|------|---------|
| Scope | Documentation / SSOT separation / Minimal Contract / boundary verification |
| Machine checks | Quality Pipeline Test 681–700 |
| Production implementation tests | **MUST NOT** add |
| Validates | Design Only, Lifecycle/State/Context separation, Classification, Ownership, Propagation, Boundaries, Provider prohibition, Compatibility, Anti-Patterns |

---

## 54. Observability Boundary

- Error Model MAY expose fields useful for **future observation**（errorId, classification, severity）
- Error Model MUST NOT define: metrics / logging / tracing / monitoring / telemetry backend
- **metadataRef excluded** — Metadata remains separate concern
- **logRef / metricRef / monitoringRef forbidden**

---

## 55. Completion Criteria

Interaction Error Model Design 文書の完成条件（v1.64.0）:

- [x] INTERACTION_ERROR_MODEL.md 存在（§1–§55）
- [x] Lifecycle / State / Context SSOT **非再定義**
- [x] Minimal Error Information Contract defined
- [x] Classification / Ownership / Read / Write / Propagation rules defined
- [x] Failure / Rejection / Abortion / Expiration / Timeout / Cancellation / Retry / Recovery boundaries defined
- [x] Provider mutation prohibited / normalized boundary defined
- [x] Production Code **変更なし** / **no implementation scope**
- [x] Quality Pipeline **700 PASS**（Test 681–700）
- [x] Architecture Governance **35** 必須文書

---

## Related Documents

| 文書 | 関係 |
|------|------|
| [INTERACTION_LIFECYCLE_DESIGN.md](./INTERACTION_LIFECYCLE_DESIGN.md) | Lifecycle SSOT |
| [INTERACTION_STATE_MODEL.md](./INTERACTION_STATE_MODEL.md) | State SSOT |
| [INTERACTION_CONTEXT_DESIGN.md](./INTERACTION_CONTEXT_DESIGN.md) | Context carrier |
| [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) | Interaction boundary |
| [NON_GOALS.md](./NON_GOALS.md) | 実装禁止 |
