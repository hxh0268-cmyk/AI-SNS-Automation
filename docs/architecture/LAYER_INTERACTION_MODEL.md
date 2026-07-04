# Layer Interaction Model Design

Core Layer Design 完成後の **Layer 間 Interaction** を統治する top-level Architecture Contract です。個別 Layer の責務は **再定義しません**。Interaction / Dependency / Ownership / Communication / Boundary Crossing / Compatibility / Governance Rules のみを定義します。

> **重要（v1.60.0）:** 本書は **Design Only**。Production Code 変更なし。**Individual Core Layer responsibilities MUST NOT be redefined.** v1.53.0 Layer Interaction foundation は **Cross Layer Integration 観点で supersede** されます。**Level 4 Implementation Ready 到達を意味しません。**

---

## 1. Purpose

- 完成した Core Layer（Provider / Runtime / Scheduler / Automation / Workflow / Event）間の **Interaction Contract** を固定する
- **Contract-based cross-layer access** を MUST とし、skip-layer / reverse / circular dependency を MUST NOT とする
- [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) および各 `*_LAYER_DESIGN.md` の責務を **変更せず接続** する
- Future implementation を **explicit interaction rules** で拘束する
- Architecture を **Level 4 — Implementation Ready** へ近づける **Cross Layer Design** 基準書とする

---

## 2. Scope

| 対象 | 内容 |
|------|------|
| Interaction Principles / Rules | MUST / MUST NOT / SHOULD 規範 |
| Allowed / Forbidden Interaction Matrix | Contract ベース許可・禁止 |
| Dependency Direction / Reverse / Circular Rules | 依存方向固定 |
| Ownership Rules | Input / Output / Contract ownership |
| Boundary Crossing Rules | 隣接 Layer contract のみ |
| Layer Isolation | 非隣接 implementation detail 禁止 |
| Communication / Data / Control / Event Flow | 設計 overview |
| Per-boundary sections | Event→Automation … Runtime→Provider |
| Infrastructure boundaries | Queue / Worker / Receiver / Adapter / API / DB / Cloud |
| Version / Backward Compatibility / Extension | additive default |
| Governance / Future Entry / Anti-Patterns / Sequence / Testing / Observability | Design Only |

Application / Platform Layer の **既存 Public Contract** は変更しません。

---

## 3. Non-Goals

本書は以下を **行わない**（MUST NOT）:

- Individual Core Layer **責務の再定義**
- Provider / Runtime / Scheduler / Automation / Workflow / Event **実装**
- Queue / Worker / Receiver / Adapter / OAuth / SNS API / External API / Database / Cloud Runtime / Cache / Metrics / Background Job **実装**
- Runtime 起動 / Workflow 実行 / Scheduler 登録 / Provider 呼び出し
- Event 永続化 / Webhook 受信 / Message Broker 実装
- **Production Code** 変更
- **Level 4 Implementation Ready** 到達の宣言

---

## 4. Current Maturity Context

| 観点 | 状態 |
|------|------|
| **Current Maturity** | **Level 3.0 — Core Layer Design Complete** |
| Core Layers | Provider / Runtime / Scheduler / Automation / Workflow / Event — **Design Complete** |
| Cross Layer Design | **v1.60.0 開始** — 本書 |
| Target | **Level 4 — Implementation Ready**（**未到達**） |
| Implementation | **Prohibited** until Future Entry Criteria + ADR |

---

## 5. Architecture Position

```
Governance Layer (Catalog / Docs / Process / Boundaries)
        │
        ▼
Core Layer Design (Provider … Event) — Complete
        │
        ▼
Cross Layer Interaction Model (本書) — v1.60.0
        │
        ▼
Future Infrastructure (Queue / Worker / Receiver / Adapter …) — Design boundary only
        │
        ▼
Level 4 Implementation Ready — NOT reached
```

- **Boundary Design** ([FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md)) — 各 Layer が何を所有するか — **変更しない**
- **Layer Design** (`*_LAYER_DESIGN.md`) — 各 Layer contract — **変更しない**
- **Interaction Model（本書）** — Layer が **どう隣接 contract を越えるか** — **接続のみ**

---

## 6. Core Layer Responsibilities

本書は以下の **既存定義を参照するのみ**（再定義しない）:

| Layer | 責務（要約） | 参照 |
|-------|-------------|------|
| **Event** | trigger / input / signal **分類** | [EVENT_LAYER_DESIGN.md](./EVENT_LAYER_DESIGN.md) |
| **Automation** | automation **intent** / approval boundary | [AUTOMATION_LAYER_DESIGN.md](./AUTOMATION_LAYER_DESIGN.md) |
| **Workflow** | structure / step / dependency / transition | [WORKFLOW_LAYER_DESIGN.md](./WORKFLOW_LAYER_DESIGN.md) |
| **Scheduler** | execution timing / trigger **condition** | [SCHEDULER_LAYER_DESIGN.md](./SCHEDULER_LAYER_DESIGN.md) |
| **Runtime** | execution lifecycle / orchestration | [RUNTIME_LAYER_DESIGN.md](./RUNTIME_LAYER_DESIGN.md) |
| **Provider** | capability **abstraction** | [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md) |

---

## 7. Interaction Principles

| 原則 | 規範 |
|------|------|
| **Contract First** | すべての Interaction MUST be Public Contract 経由のみ |
| **Adjacent Boundary Only** | Layer MUST cross **only** to the next permitted contract boundary |
| **No Skip Layer** | Cross-layer shortcut MUST NOT occur unless future ADR explicitly allows |
| **No Reverse Dependency** | Lower layer MUST NOT depend on upper layer |
| **No Circular Dependency** | Bidirectional runtime dependency MUST NOT exist |
| **Explicit Ownership** | Input / Output / Contract ownership MUST be declared |
| **No Hidden Side Effects** | Side effects MUST be isolated to owning Layer |
| **No Implicit Shared State** | Cross-layer implicit shared state MUST NOT exist |
| **Observable Interaction** | Each interaction SHOULD declare observability points |
| **Backward Compatibility** | Contract changes SHOULD be additive by default |
| **Governance First** | Changes MUST follow [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) |

---

## 8. Layer Interaction Rules

| Rule ID | 規範 |
|---------|------|
| **IR-01** | Interaction MUST use named Layer Contract references |
| **IR-02** | Interaction MUST NOT pass implementation internals across boundaries |
| **IR-03** | Interaction MUST NOT bypass Automation when originating from Event |
| **IR-04** | Interaction MUST NOT reach Provider except via Runtime contract |
| **IR-05** | Scheduler MUST NOT mutate Workflow structure |
| **IR-06** | Workflow MUST NOT execute Runtime directly |
| **IR-07** | Event MUST NOT execute Runtime or Provider |
| **IR-08** | Provider MUST remain capability abstraction — MUST NOT invoke upper layers |
| **IR-09** | Future infrastructure MUST NOT be implemented in this phase |
| **IR-10** | Contradiction with Layer Design MUST be resolved via Governance Flow + ADR |

---

## 9. Allowed Interaction Matrix

| From | To | Contract | Notes |
|------|-----|----------|-------|
| **Event** | **Automation** | Automation Contract | Event classification → intent mapping |
| **Automation** | **Workflow** | Workflow Contract | Intent → structure |
| **Workflow** | **Scheduler** | Scheduler Contract | Structure → timing / trigger condition |
| **Scheduler** | **Runtime** | Runtime Contract | Trigger → lifecycle start / request |
| **Runtime** | **Provider** | Provider Contract | Lifecycle → capability invocation |
| **Any Layer** | **Governance** | Documentation reference | Governance Flow / Future Entry Criteria / Public Contract Catalog / Compliance Checklist |
| **Any Layer** | **Layer Design docs** | Documentation reference | MUST NOT imply runtime call |

**Allowed documentation-level references:**

- [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md)
- [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md)
- Public Contract Catalog
- [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md)
- Layer-specific `*_LAYER_DESIGN.md`

---

## 10. Forbidden Interaction Matrix

| From | To | Reason |
|------|-----|--------|
| **Event** | **Runtime** | Skip Automation / Workflow / Scheduler |
| **Event** | **Provider** | Skip entire execution chain |
| **Automation** | **Runtime** | Skip Workflow / Scheduler |
| **Automation** | **Provider** | Intent layer MUST NOT call capability |
| **Workflow** | **Runtime** | Skip Scheduler |
| **Workflow** | **Provider** | Structure layer MUST NOT call capability |
| **Scheduler** | **Provider** | Timing layer MUST NOT call capability |
| **Provider** | **Runtime** | Reverse dependency |
| **Provider** | **Scheduler** | Reverse dependency |
| **Provider** | **Workflow** | Reverse dependency |
| **Provider** | **Automation** | Reverse dependency |
| **Provider** | **Event** | Reverse dependency |

**Also forbidden (MUST NOT):**

- Any layer → **non-adjacent implementation detail**
- Any layer → **future infrastructure implementation** before ADR
- **Any bidirectional dependency**
- **Any circular dependency**
- **Any implicit shared state**
- **Any direct database ownership crossing layers**
- **Queue / Worker / Receiver implementation** in this phase

---

## 11. Dependency Direction Rules

Primary dependency direction MUST follow:

```
Event → Automation → Workflow → Scheduler → Runtime → Provider
```

| Rule | 規範 |
|------|------|
| **DD-01** | Upper layer MAY reference lower layer **contract** only |
| **DD-02** | Lower layer MUST NOT reference upper layer runtime state |
| **DD-03** | Dependency MUST be acyclic |
| **DD-04** | [DEPENDENCY_RULES.md](./DEPENDENCY_RULES.md) MUST remain satisfied |

---

## 12. Reverse Dependency Rules

| Rule | 規範 |
|------|------|
| **RD-01** | Provider MUST NOT depend on Runtime |
| **RD-02** | Runtime MUST NOT depend on Scheduler for capability semantics |
| **RD-03** | No lower layer MUST invoke upper layer lifecycle |
| **RD-04** | Provider reverse calls MUST NOT exist — **Provider Reverse Dependency Boundary** |

---

## 13. Circular Dependency Rules

| Rule | 規範 |
|------|------|
| **CD-01** | Circular contract references MUST NOT exist |
| **CD-02** | Circular runtime callbacks between Core Layers MUST NOT exist |
| **CD-03** | Retry loops MUST NOT create undeclared circular ownership |
| **CD-04** | Circular dependency detection SHOULD be part of future compliance checks |

---

## 14. Ownership Rules

| Ownership Type | Owner |
|----------------|-------|
| Event classification | Event Layer |
| Automation intent | Automation Layer |
| Workflow structure | Workflow Layer |
| Trigger timing / condition | Scheduler Layer |
| Execution lifecycle | Runtime Layer |
| Capability semantics | Provider Layer |
| Cross-layer orchestration metadata | Declared in Interaction Contract — not shared implicitly |

---

## 15. Input Ownership

| Layer | Owns Input |
|-------|------------|
| Event | eventSource / payloadRef / payloadShape declaration |
| Automation | intent mapping input |
| Workflow | step / dependency / transition input |
| Scheduler | schedule / trigger condition input |
| Runtime | execution context input |
| Provider | capability input contract |

Upper layer MUST NOT mutate lower layer input contract schema without governance review.

---

## 16. Output Ownership

| Layer | Owns Output |
|-------|-------------|
| Event | classified event contract output |
| Automation | automation intent decision output |
| Workflow | workflow structure output |
| Scheduler | trigger request output |
| Runtime | lifecycle / orchestration output |
| Provider | capability result output |

Output MUST cross boundaries only as **contract references**, not raw implementation objects.

---

## 17. Contract Ownership

| Contract | Owner |
|----------|-------|
| Event Contract | Event Layer |
| Automation Contract | Automation Layer |
| Workflow Contract | Workflow Layer |
| Scheduler Contract | Scheduler Layer |
| Runtime Execution Contract | Runtime Layer |
| Provider Contract | Provider Layer |
| Interaction rules（本書） | Cross Layer Governance |

Contract versioning MUST follow [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md).

---

## 18. Boundary Crossing Rules

| Rule | 規範 |
|------|------|
| **BC-01** | Boundary crossing MUST use adjacent layer contract only |
| **BC-02** | Boundary crossing MUST NOT embed foreign layer implementation |
| **BC-03** | Boundary crossing MUST declare correlation / causation where applicable |
| **BC-04** | Boundary crossing MUST NOT persist foreign layer state |
| **BC-05** | Skip-layer calls MUST NOT occur — **Cross-layer shortcut forbidden** |

---

## 19. Layer Isolation Rules

| Rule | 規範 |
|------|------|
| **LI-01** | Layers MUST NOT share mutable runtime state |
| **LI-02** | Layers MUST NOT expose internal caches to other layers |
| **LI-03** | Layers MUST NOT read foreign layer private configuration |
| **LI-04** | Test doubles MUST respect same isolation boundaries |

---

## 20. Communication Principles

| 観点 | 規範 |
|------|------|
| **Command vs Query** | **Command** changes state in owning layer; **Query** MUST NOT hide side effects |
| **Sync vs Async** | Async handoff to Queue / Worker is **future** — v1.60.0 **実装しない** |
| **Error Propagation** | Errors MUST propagate via contract — MUST NOT be swallowed |
| **Retry Responsibility** | Retry owner MUST be declared per interaction — **Hidden retry forbidden** |
| **Timeout Ownership** | Timeout owner MUST be declared per interaction |
| **Public Contract** | All messages MUST be Public Contract 経由のみ |

---

## 21. Data Flow Overview

```
[Event payloadRef]
      │
      ▼
[Automation intent mapping] ── contract ref ──►
      │
      ▼
[Workflow structure] ── contract ref ──►
      │
      ▼
[Scheduler trigger condition] ── contract ref ──►
      │
      ▼
[Runtime execution context] ── contract ref ──►
      │
      ▼
[Provider capability input/output]
```

Data MUST flow **down** the chain via contract references. Data MUST NOT skip layers.

---

## 22. Control Flow Overview

```
Event signal classified
  → Automation evaluates intent
  → Workflow resolves structure
  → Scheduler determines when to trigger
  → Runtime owns lifecycle
  → Provider executes capability (via Runtime only)
```

Control MUST NOT bypass Scheduler to reach Runtime from Workflow.

Control MUST NOT bypass Runtime to reach Provider from any upper layer.

---

## 23. Event Flow Overview

Event flow MUST begin at Event Layer classification and MUST NOT terminate at Provider without traversing intermediate contracts.

| Stage | Responsibility |
|-------|----------------|
| Ingress (future) | Receiver — **not Event Layer** |
| Classification | Event Layer |
| Intent mapping | Automation Layer |
| Structure binding | Workflow Layer |
| Trigger scheduling | Scheduler Layer |
| Execution | Runtime Layer |
| Capability | Provider Layer |

---

## 24. Event to Automation Boundary

| 観点 | 規範 |
|------|------|
| Event role | Event **classifies** trigger / input / signal |
| Event MUST NOT | Execute automation |
| Automation role | Automation **decides** whether event maps to automation intent |
| Contract | Event Contract → Automation Contract reference |
| Forbidden | Event → Runtime / Provider |

---

## 25. Automation to Workflow Boundary

| 観点 | 規範 |
|------|------|
| Automation role | Automation **defines intent** |
| Workflow role | Workflow **defines structure** |
| Automation MUST NOT | Define step execution internals |
| Workflow MUST NOT | Own business trigger classification |
| Contract | Automation Contract → Workflow Contract |

---

## 26. Workflow to Scheduler Boundary

| 観点 | 規範 |
|------|------|
| Workflow role | Defines steps / dependencies / transitions |
| Scheduler role | Defines **when** execution is triggered |
| Workflow MUST NOT | Execute runtime |
| Scheduler MUST NOT | Mutate workflow structure |
| Contract | Workflow Contract → Scheduler Contract |

---

## 27. Scheduler to Runtime Boundary

| 観点 | 規範 |
|------|------|
| Scheduler role | Starts or **requests** execution through Runtime contract |
| Scheduler MUST NOT | Execute provider capability directly |
| Runtime role | **Owns lifecycle** |
| Contract | Scheduler Contract → Runtime Execution Contract |
| Forbidden | Scheduler → Provider |

---

## 28. Runtime to Provider Boundary

| 観点 | 規範 |
|------|------|
| Runtime role | Coordinates execution lifecycle |
| Provider role | Exposes capability abstraction |
| Runtime MAY | Call Provider contract |
| Provider MUST NOT | Know Runtime internals |
| Contract | Runtime Execution Contract → Provider Contract |

---

## 29. Provider Reverse Dependency Boundary

| 規範 | 内容 |
|------|------|
| Provider MUST NOT | Call Runtime / Scheduler / Workflow / Automation / Event |
| Provider MUST NOT | Initiate upper-layer lifecycle |
| Provider MUST | Remain capability abstraction only |
| Runtime MAY | Depend on Provider contracts |
| Violation | **Forbidden reverse dependency example** — see §39 |

---

## 30. Queue / Worker / Receiver Boundary

| Component | v1.60.0 Status |
|-----------|----------------|
| Queue | **future infrastructure** — MUST NOT implement |
| Worker | **future infrastructure** — MUST NOT implement |
| Event Receiver | **future infrastructure** — MUST NOT implement |
| Webhook Receiver | **future infrastructure** — MUST NOT implement |
| Message Broker | **future infrastructure** — MUST NOT implement |

**Queue / Worker / Receiver Boundary:** Core Layers MUST NOT enqueue, start workers, or receive webhooks in this phase. Async handoff references MAY appear in contracts as **future implementation concern** only.

---

## 31. Adapter / API / Database / Cloud Runtime Boundary

| Component | Boundary |
|-----------|----------|
| Adapter | Below Provider — MUST NOT be invoked by upper Core Layers directly |
| OAuth / SNS API / External API | Below Adapter/Provider — MUST NOT be called from Event / Automation / Workflow / Scheduler |
| Database | MUST NOT be owned cross-layer — persistence is future infrastructure |
| Cloud Runtime | MUST NOT be implemented in this phase |
| Cache / Real Metrics | Design reference only |

Any layer → future infrastructure implementation **before ADR** is **MUST NOT**.

---

## 32. Dependency Matrix

|  | Event | Automation | Workflow | Scheduler | Runtime | Provider |
|--|:---:|:---:|:---:|:---:|:---:|:---:|
| **Event** | — | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Automation** | ❌ | — | ✅ | ❌ | ❌ | ❌ |
| **Workflow** | ❌ | ❌ | — | ✅ | ❌ | ❌ |
| **Scheduler** | ❌ | ❌ | ❌ | — | ✅ | ❌ |
| **Runtime** | ❌ | ❌ | ❌ | ❌ | — | ✅ |
| **Provider** | ❌ | ❌ | ❌ | ❌ | ❌ | — |

✅ = adjacent contract allowed | ❌ = MUST NOT (including reverse / skip)

---

## 33. Version Compatibility Rules

| Rule | 規範 |
|------|------|
| **VC-01** | Interaction contract changes SHOULD be additive |
| **VC-02** | Breaking interaction changes MUST follow [CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) |
| **VC-03** | Layer contract version MUST be declared in cross-layer references |
| **VC-04** | Compatibility policy MUST align with [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md) |

---

## 34. Backward Compatibility

- v1.60.0 Cross Layer Design MUST NOT break Application / Platform Public Contracts
- v1.53.0 Layer Interaction foundation concepts remain valid where not superseded
- Additive interaction rules MUST NOT remove prior governance guarantees
- Layer Design documents MUST remain authoritative for individual layer scope

---

## 35. Extension Rules

| Extension | Requirement |
|-----------|-------------|
| New Core Layer interaction | ADR + Governance Flow + matrix update |
| Skip-layer exception | Explicit ADR ONLY |
| Infrastructure layer | Future Entry Criteria gate |
| New contract field | Additive default + documentation |

---

## 36. Governance Integration

| 文書 | Integration |
|------|-------------|
| [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) | Interaction changes MUST follow governance process |
| [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md) | Release / change verification |
| [CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) | Mandatory policy review |
| [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) | ADR for exceptions |

---

## 37. Future Entry Criteria Integration

- Level 3→4 transition MUST satisfy [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md)
- Implementation MUST NOT begin until Entry Criteria + Compliance Checklist pass
- Interaction Model MUST be validated against all Core Layer Design documents before implementation

---

## 38. Anti-Patterns

| Anti-Pattern | Why forbidden |
|--------------|---------------|
| **Layer skipping** | Violates adjacent boundary model |
| **Cross-layer shortcut** | Bypasses ownership and governance |
| **Hidden retry** | Obscures retry responsibility |
| **Provider direct call from upper layer** | Violates Runtime boundary |
| **Reverse dependency** | Breaks acyclic model |
| **Implicit shared state** | Breaks isolation |
| **Event → Runtime direct trigger** | Skips intent and structure |
| **Scheduler → Provider call** | Skips Runtime lifecycle |
| **Infrastructure implemented early** | Violates Non-Goals |

---

## 39. Sequence Examples

### 1. Event-driven automation flow

```
External signal (future ingress)
  → Event: classify as Webhook Event (contract only)
  → Automation: map to automation intent
  → Workflow: bind workflow structure
  → Scheduler: schedule trigger condition
  → Runtime: start lifecycle
  → Provider: capability via Runtime contract
```

### 2. Scheduled workflow flow

```
Scheduled Event (contract)
  → Automation: scheduled automation intent
  → Workflow: workflow structure
  → Scheduler: time-based trigger
  → Runtime: execution request
  → Provider: capability execution
```

### 3. Manual approval flow

```
Manual Event (contract)
  → Automation: intent + approval boundary
  → Workflow: approval point in structure
  → (approval gate — future)
  → Scheduler: post-approval trigger
  → Runtime → Provider
```

### 4. Provider capability execution flow

```
Runtime: lifecycle START
  → Runtime: resolve Provider Contract ref
  → Provider: capability invocation (abstraction)
  → Provider: capability result
  → Runtime: lifecycle COMPLETE
```

### 5. Forbidden direct provider call example

```
Workflow ──X──► Provider   ← MUST NOT (skip Scheduler + Runtime)

Automation ──X──► Provider   ← MUST NOT

Event ──X──► Provider   ← MUST NOT
```

### 6. Forbidden reverse dependency example

```
Provider ──X──► Runtime   ← MUST NOT (reverse dependency)

Provider ──X──► Event   ← MUST NOT
```

---

## 40. Testing Strategy

| 観点 | v1.60.0 |
|------|---------|
| Scope | Documentation / matrix / boundary verification |
| Machine checks | Quality Pipeline Test 601–620 |
| Implementation tests | **MUST NOT** add in this phase |
| Compliance | Architecture Compliance Checklist on change |
| Matrix validation | Allowed / Forbidden matrix MUST be grep-verifiable |

---

## 41. Observability

| Point | Owner |
|-------|-------|
| Event classification | Event Layer contract metadata |
| Intent decision | Automation Layer |
| Structure resolution | Workflow Layer |
| Trigger firing | Scheduler Layer |
| Lifecycle transitions | Runtime Layer |
| Capability invocation | Provider Layer via Runtime |

Cross-layer correlationId SHOULD propagate via contract references. Real Metrics implementation is **future**.

---

## 42. Completion Criteria

Layer Interaction Model Design 文書の完成条件（v1.60.0）:

- [x] LAYER_INTERACTION_MODEL.md 存在（§1–§42）
- [x] Core Layer 責務 **非再定義**
- [x] Allowed / Forbidden Interaction Matrix 定義
- [x] Event → Automation → Workflow → Scheduler → Runtime → Provider chain 固定
- [x] Queue / Worker / Receiver / Adapter / API / Database / Cloud Runtime 境界明確
- [x] Production Code **変更なし**
- [x] Level 4 Implementation Ready **未到達**
- [x] Quality Pipeline **620 PASS**（Test 601–620）
- [x] Architecture Governance **31** 必須文書（Cross Layer Design 完成）

---

## Related Documents

| 文書 | 関係 |
|------|------|
| [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) | Boundary source — **変更しない** |
| [EVENT_LAYER_DESIGN.md](./EVENT_LAYER_DESIGN.md) | Event classification |
| [AUTOMATION_LAYER_DESIGN.md](./AUTOMATION_LAYER_DESIGN.md) | Automation intent |
| [WORKFLOW_LAYER_DESIGN.md](./WORKFLOW_LAYER_DESIGN.md) | Workflow structure |
| [SCHEDULER_LAYER_DESIGN.md](./SCHEDULER_LAYER_DESIGN.md) | Scheduler trigger |
| [RUNTIME_LAYER_DESIGN.md](./RUNTIME_LAYER_DESIGN.md) | Runtime lifecycle |
| [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md) | Provider capability |
| [NON_GOALS.md](./NON_GOALS.md) | 実装禁止 |
| [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) | Level 3→4 gate |
