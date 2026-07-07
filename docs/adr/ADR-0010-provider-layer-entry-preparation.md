# ADR-0010: Provider Layer Entry Preparation

## Status

Accepted（v1.68.0 — Provider Entry Preparation Governance）

## Context

v1.67.0 Formal Level 4 Entry Review（Decision: Conditionally Ready）により、First Target Domain = **Provider Layer Entry Preparation** が決定された（[ADR-0009](./ADR-0009-level-4-entry-strategy.md)）。

Provider Layer Design（v1.54.0）は Design Only で Complete であるが、Production Implementation 着手前に以下を Governance として固定する必要がある:

- Provider 責務境界と非所有権（Runtime / Scheduler / OAuth / Retry / Idempotency）
- Application Public Contract 入力境界と Adapter 正規化境界
- Provider raw response leakage 防止方針
- Mock Provider default / Real Provider feature flag 方針
- Provider Entry Criteria P1–P6 の Evidence 方針

Provider Production Implementation は **まだ開始しない**。Non-Goals Release は別 Decision として残す。

## Decision

**Provider Layer Entry Preparation を正式に決定する。**

### Provider Production Implementation

| 項目 | 決定 |
|------|------|
| **Provider Entry Preparation** | **Accepted — Governance phase** |
| **Provider Production Implementation** | **Prohibited — Not Yet Authorized** |
| **Provider Level 4 Implementation Ready** | **Not declared** |
| **Non-Goals Release** | **Not Satisfied** — Reason: Pending separate Provider Non-Goals Release Decision（G-25） |

### Mock Provider / Real Provider Policy

| 項目 | 方針 |
|------|------|
| **Default** | **Mock Provider** — no external IO in default path |
| **Real Provider** | **Feature flag only** — explicit opt-in per Provider capability |
| **Evidence** | Feature flag design documented before Real Provider ADR |
| **CI / local** | Mock default unless flag enabled in controlled test environment |

### Application Public Contract Input Boundary

- Provider **MUST** accept **Application Layer Public Contract** shapes as **input authority** — not raw upstream internal objects
- Provider **MUST NOT** depend on Foundation internal modules directly
- New Provider-facing contracts require **additive** Catalog extension per [ADR-0011](./ADR-0011-public-contract-catalog-future-layer-scope.md) — **not in v1.68.0**

### Adapter Normalization Boundary

- Provider raw responses **MUST NOT** propagate to Interaction Error / Metadata / Context / State contracts
- Adapter layer **MUST** normalize Provider output to declared Provider Output Contract shape
- Rate limit / auth / retry handling **MUST** remain inside Provider/Adapter — **not** exposed via Application Public Contract fields

### Provider Raw Response Leakage Prohibition

- Forbidden in cross-layer contracts: raw Provider HTTP body, Provider SDK exceptions, OAuth tokens, credential payloads
- Normalization rules align with CL-007 mitigation（[RISK_REGISTER.md](../architecture/RISK_REGISTER.md)）
- Provider Error Contract（PROVIDER_LAYER_DESIGN §11）is the **only** authorized failure surface upward

### Provider Non-Ownership（Cross-Layer）

Provider **does not own**:

| Concern | Owner |
|---------|-------|
| Runtime execution lifecycle | Runtime Layer |
| Scheduler / trigger policy | Scheduler Layer |
| OAuth flow / token lifecycle | OAuth Layer（future） |
| Cross-layer retry coordination | Deferred — Lifecycle + dedicated ADR |
| Cross-layer idempotency | Deferred — explicit ownership ADR required |
| Interaction Lifecycle states | INTERACTION_LIFECYCLE_DESIGN |
| Interaction State / Error / Metadata semantics | Respective Cross Layer SSOT models |

Provider **owns**（within Provider boundary only）:

- Provider Input / Output Contract
- Provider Capability declaration
- Provider-local configuration（non-credential defaults）
- Provider-local error normalization **before** Adapter upward propagation

### Provider Entry Criteria P1–P6 Evidence Policy

| # | Criterion | Evidence（v1.68.0） | Status |
|---|-----------|---------------------|--------|
| P1 | Provider Layer 責務一致 | PROVIDER_LAYER_DESIGN + FUTURE_ARCHITECTURE + ADR-0010 | **Satisfied** |
| P2 | Mock default / Real feature flag | ADR-0010 §Mock Provider / Real Provider Policy | **Satisfied**（design policy） |
| P3 | Application Public Contract input + Adapter shape | ADR-0010 §Input / Adapter boundaries | **Satisfied**（design policy） |
| P4 | Provider Public Contract Catalog registration plan | ADR-0011 — **plan only, no catalog change** | **Partially Satisfied** |
| P5 | Rate limit / auth / retry in Provider/Adapter | ADR-0010 §Adapter boundary | **Satisfied**（design policy） |
| P6 | Provider ADR + Risk Register update | ADR-0010 + PR-001–PR-005 in RISK_REGISTER | **Satisfied** |

**P4 Partially Satisfied** is intentional — Catalog additive extension is planned for Contract Definition Phase, not v1.68.0.

### Non-Goals Release

Non-Goals Release for Provider scope remains a **separate Decision**:

- Requires NG1–NG6 per FUTURE_ENTRY_CRITERIA §Non Goals Release Criteria
- Dedicated Non-Goals Release ADR before Provider Production Implementation
- **G-25 remains Not Satisfied at v1.68.0** — Reason: Pending separate Provider Non-Goals Release Decision

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Immediate Provider Production Implementation | Entry Preparation incomplete; G-25 not satisfied |
| Real Provider as default | External IO risk; violates Mock-first principle |
| Provider owns retry coordination | Cross-layer deferral boundary violated |
| Register Provider contracts in Catalog now | Scope ADR requires planning phase separation（ADR-0011） |
| Bundle Non-Goals Release in ADR-0010 | User requirement: separate Decision |

## Consequences

### Positive

- Provider Entry Preparation governance evidence fixed（PROVIDER_ENTRY_PREPARATION_REVIEW.md）
- P1–P6 evidence policy traceable
- Raw response leakage and non-ownership boundaries explicit
- Production Implementation prohibition unambiguous

### Negative / Remaining Exposure

- Provider Production Implementation **still prohibited**
- G-25 Non-Goals Release **not satisfied**
- P4 Catalog registration **not executed**
- CL-007 exposure remains until implementation + normalization enforcement
- Real Provider feature flag **not implemented** — design only

## Review Trigger

- Provider Non-Goals Release ADR proposed — re-evaluate G-25
- Provider Contract Definition Phase begins — re-evaluate P4 + ADR-0011 additive strategy
- Provider Production Implementation ADR proposed — requires G-24 PASS + G-25 PASS + Compliance execution records
- Cross-layer retry / idempotency ADR affects Provider boundary — update ADR-0010 non-ownership table
