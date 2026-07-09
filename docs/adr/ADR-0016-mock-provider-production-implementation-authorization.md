# ADR-0016: Mock Provider Production Implementation Authorization Decision

## Status

Accepted（v1.73.0 — Mock Provider Production Implementation Authorization Governance）

## Context

[ADR-0013](./ADR-0013-provider-non-goals-release-decision.md)（v1.70.0）により Mock Provider broad Non-Goal **partial release** のみが G-25 gate として記録された。[ADR-0014](./ADR-0014-provider-level-4-implementation-ready-decision.md)（v1.71.0）により Provider domain **Level 4 Implementation Ready Declared**（domain-specific）。[ADR-0015](./ADR-0015-provider-public-contract-catalog-extension-release.md)（v1.72.0）により `providerContracts[]` abstract authority registration が完了した。

`PROVIDER_ENTRY_PREPARATION_REVIEW.md` は `Provider Production Implementation Authorized = G-24 + G-25 + Provider Production Implementation ADR` を定義するが、Provider Production Implementation ADR は v1.72.0 まで **未作成** だった。Mock Provider Production Implementation は全 governance 表面で **Not Started** のまま維持されていた。

v1.73.0 は **Governance / Review / Evidence Release のみ**。Mock Provider / Real Provider / Adapter / Runtime / Scheduler **production implementation**、Catalog generator 変更、concrete `providerContracts[]` Mock registration は **禁止**。

## Decision

### Release Type

| Item | Decision |
|------|----------|
| **Release scope** | **Governance only** — Mock Provider Production Implementation Authorization + evidence |
| **Production code** | **No change** |
| **Catalog generator / reports** | **No change** |
| **`providerContracts[]` concrete Mock registration** | **Not executed** |
| **Mock Provider Production Implementation** | **Authorized** — future separate Implementation Release only |
| **Mock Provider Production Implementation execution** | **Not Started** |
| **Provider Production Ready** | **Not Declared** |
| **Repository-wide Level 4 Implementation Ready** | **Not Declared** |

### Decision Scope

| State | v1.73.0 |
|-------|---------|
| Provider Level 4 Implementation Ready | **Declared**（domain-specific — maintained） |
| Provider Public Contract Catalog Extension | **Complete**（maintained） |
| Mock Provider Production Implementation **Authorized** | **Yes** — this ADR |
| Mock Provider Production Implementation **Started** | **No** |
| Mock Provider Production Implementation **Complete** | **No** |
| Provider Production Ready | **Not Declared** |
| Repository-wide Level 4 Implementation Ready | **Not Declared** |

**Critical distinction:**

```text
Authorized ≠ Started ≠ Implemented ≠ Production Ready
```

### Authorization Preconditions（satisfied at v1.73.0）

| Prerequisite | Evidence |
|--------------|----------|
| G-24 Provider Entry Criteria | **Satisfied** — FUTURE_ENTRY_CRITERIA |
| G-25 Non-Goals Release | **Satisfied** — ADR-0013 |
| G-26 Catalog scope | **Satisfied** — ADR-0011 |
| Provider domain L4 Ready | **Declared** — ADR-0014 |
| Catalog Extension Release | **Complete** — ADR-0015 |
| Human Review | **Required** — completed as part of this Governance Release |

### Authorization Evidence

| Artifact | Role |
|----------|------|
| [MOCK_PROVIDER_PRODUCTION_IMPLEMENTATION_AUTHORIZATION_REVIEW.md](../architecture/MOCK_PROVIDER_PRODUCTION_IMPLEMENTATION_AUTHORIZATION_REVIEW.md) | Formal evaluation + Final Decision |
| ADR-0013 / 0014 / 0015 chain | Prerequisite evidence |
| [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md) | Contract Authority — **unchanged SSOT** |
| Quality Pipeline | Machine check evidence |

## Mock Provider Definition

**Mock Provider** is:

```text
a concrete Provider Layer production code implementation
of the authoritative Provider abstract contract
for deterministic, non-external-IO execution
within explicitly authorized capabilities and boundaries
```

Mock Provider is **not**:

- a Real Provider
- an External API Provider
- an Adapter implementation
- a Runtime implementation
- a Scheduler implementation
- a Retry Engine
- a Recovery Engine
- an Idempotency Engine
- a duplicate interaction handler
- a credential integration
- a secret management mechanism
- an automatic SNS publishing mechanism

Mock Provider is **distinct from** Application Layer mock functions（`generateMockAIIdeas`, `generateMockContentDrafts` 等）— those remain Application Layer concerns.

## Production Code Classification

Future Mock Provider implementation is:

| Classification | Decision |
|----------------|----------|
| **Layer** | Provider Layer **production code** |
| **Determinism** | **Required** |
| **External IO** | **Prohibited** |
| **Credentials** | **Prohibited** |
| **Contract binding** | Bounded by [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md) §8–§14 |
| **Real Provider equivalence** | **Explicitly not equivalent** |

## Relationship to Provider Abstract Contract

- Contract Authority remains [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md) — **no duplicate SSOT**
- Mock Provider implements authoritative sections **by reference** — Input §9, Output §10, Error §11, Capability §12, Configuration §13, Credential §14
- Catalog abstract authority entry `provider-abstract-contract-authority` remains the JSON traceability anchor（ADR-0015）

## Minimum Implementation Responsibility

Future Mock Provider implementation **must** provide（authorization requirements — **not implemented in v1.73.0**）:

| Responsibility | Requirement |
|----------------|-------------|
| Provider identity | Explicit bounded identity |
| Declared capability | Explicit per §12 — initial scope only |
| Input contract validation | Per §9 + Malformed Input Boundary below |
| Normalized output | Per §10 |
| Structured Provider error handling | Per §11 at public boundary |
| Non-secret configuration handling | Per §13 |
| Credential requirement declaration | `false` for Mock |
| Side effect declaration | query-only for initial authorized scope |
| Timeout policy declaration | Declaration only — see Timeout Boundary |
| Retry policy declaration | Declaration only — see Retry Boundary |
| Deterministic behavior | Per Deterministic Behavior Requirements |

## Input Contract Boundary

Authority: [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md) §9.

| Case | Future Mock Provider Policy |
|------|----------------------------|
| Missing required field | `validation_error` |
| Invalid field type | `validation_error` |
| Unsupported capability | `unsupported_capability` |
| Unknown top-level fields | `validation_error` — **strict deterministic rejection** |
| Unknown fields in Provider private envelope | `validation_error` |
| Forbidden credential / secret fields | `validation_error` |
| Forbidden runtime-owned orchestration fields | `validation_error` |

## Output Contract Boundary

Authority: [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md) §10.

Future Mock Provider output **must** be:

- normalized JSON
- deterministic
- free of raw external API response
- free of credentials / secrets / SDK-specific fields
- free of retry / recovery / idempotency / duplicate interaction state

**Must include:** provider identity, capability identity, normalized execution result payload per contract.

## Error Contract Boundary

Authority: [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md) §11.

| Rule | Decision |
|------|----------|
| Public boundary | **Structured Provider error contract required** |
| Internal exceptions | **Allowed** if normalized before public boundary |
| Raw exception leakage | **Prohibited** |
| Raw SDK / external API errors | **Prohibited** |
| Stack traces in public contract | **Prohibited** |
| Credentials / secrets in errors | **Prohibited** |

## Capability Declaration

**Initial authorized capability scope only:**

| Capability | Kind | Status |
|------------|------|--------|
| `text_generation` | query | **Authorized** for future initial implementation |

**Not authorized:** SNS, OpenAI, Gemini, Nano Banana, External API, image_generation, sns_publish, storage_write, notification_send, or any Real Provider capability.

## Configuration Boundary

Future Mock Provider configuration:

- explicit
- non-secret
- deterministic
- validated
- bounded

**Prohibited:** environment-dependent secret configuration, external service endpoints, credential fields.

## Credential Boundary

| Rule | Decision |
|------|----------|
| Credentials required | **No** |
| Read credentials / secrets | **Prohibited** |
| Environment-based authentication | **Prohibited** |
| Credential-bearing input | **Rejected** — `validation_error` |

## Side Effect Boundary

Initial authorized Mock Provider side effects:

| Effect | Decision |
|--------|----------|
| In-memory only | **Allowed** |
| Filesystem writes | **Prohibited** |
| Network | **Prohibited** |
| External services | **Prohibited** |
| Database / Queue | **Prohibited** |
| Publishing | **Prohibited** |

Initial scope: **query capability only** — no command side effects.

## External IO Boundary

| Provider Type | Status |
|---------------|--------|
| Real Provider | **Prohibited** |
| External API | **Prohibited** |
| SNS / OpenAI / Gemini / Nano Banana | **Prohibited** |
| Network access in Mock Provider | **Prohibited** |

## Runtime Boundary

Mock Provider **≠** Runtime. Future implementation **must not** introduce Runtime orchestration, execution environment selection, or cross-layer execution coordination.

Initial Mock Provider: **direct module API only** — no Runtime Layer implementation.

## Scheduler Boundary

Mock Provider **≠** Scheduler. No scheduling, cron, or timed execution.

## Adapter Boundary

Mock Provider **≠** Adapter. Initial implementation **does not require** an Adapter — no external API translation.

## Retry Boundary

| Item | Decision |
|------|----------|
| Retry policy declaration | **Allowed** — declaration only per contract |
| Retry execution engine | **Not authorized** |
| Cross-layer retry coordination | **Not authorized** — CL-004 deferred |
| `src/lib/retry.js` | **Not** Provider Layer authority — do not reuse as Provider retry semantics |

## Timeout Boundary

| Item | Decision |
|------|----------|
| Timeout policy declaration | **Required** if contract requires — declaration only |
| Timeout execution engine | **Not authorized** |
| Deterministic `provider_timeout` error representation | **Allowed** — structured failure only, explicitly bounded |
| Runtime-level timeout orchestration | **Not authorized** |

## Recovery Boundary

Recovery Engine = **Not Authorized**. Structured Provider failure representation only — no recovery orchestration.

## Idempotency Boundary

Cross-layer idempotency = **Deferred**（CL-005）. Idempotency engine = **Not Authorized**.

## Duplicate Interaction Boundary

Duplicate interaction handling = **Deferred**（CL-006）. Deduplication engine = **Not Authorized**.

## Deterministic Behavior Requirements

Future Mock Provider **must**:

| Requirement | Policy |
|-------------|--------|
| Same valid input + same explicit configuration | Same normalized output |
| Output ordering | Stable |
| Random IDs | **Prohibited** unless explicitly supplied as input |
| Current-time dependency | **Prohibited** |
| Network / environment / machine / secret dependency | **Prohibited** |

## Failure Injection Boundary

| Item | Decision |
|------|----------|
| Advanced failure injection framework | **Not required** for initial implementation |
| `validation_error` | **Required** deterministic path |
| `unsupported_capability` | **Required** deterministic path |
| `provider_timeout` simulation | **Optional** — only if explicitly bounded and deterministic |
| Retry / recovery failure orchestration | **Not authorized** |

## Malformed Input Boundary

All malformed input cases listed in Input Contract Boundary **must** have explicit deterministic policy — no raw exception at public boundary.

## Provider Catalog Registration Decision

**Decision B:** Concrete Mock Provider `providerContracts[]` registration requires a **separate future Catalog Governance decision/release**.

| Item | v1.73.0 |
|------|---------|
| Abstract authority registration | **Maintained** — ADR-0015 |
| Concrete Mock registration in initial Implementation Release | **Not authorized** |
| Validator / `registrationKind` changes | **Deferred** to future Catalog Governance Release |
| Catalog schema / version | **Unchanged** |

**Rationale:** v1.72.0 intentionally registered abstract authority only; current validator rejects `mock-*` providerIds and enforces `abstract-contract-authority` only.

## Catalog Schema / Version Decision

| Item | Decision |
|------|----------|
| schema | `public-contract-catalog/1.0` — **unchanged** |
| catalogVersion | `1.0` — **unchanged** |
| `public_contract_catalog.js` | **No change in v1.73.0** |

## Machine-Readable Output Boundary

| Artifact | Decision |
|----------|----------|
| Mock Provider contract output JSON | **Required** |
| Separate execution report | **Not required** initially |
| Markdown report | **Not required** initially |
| CLI summary | **Not required** initially |

JSON = Source / Markdown = View principle preserved where applicable.

## CLI Decision

Initial Mock Provider CLI = **Not Required**. Direct module API + Quality Pipeline imports preferred.

## Fixture Decision

| Item | Decision |
|------|----------|
| Dedicated Provider fixture subsystem | **Not required** |
| Deterministic inline fixtures | **Allowed** |
| Temporary generated fixtures | **Allowed** per repository convention |
| Fixture infrastructure expansion | **Deferred** |

## Quality Pipeline Requirements

Future Implementation Release must add machine checks for: module presence, contract validation, deterministic behavior, boundary prohibitions, no external IO, no credentials, no retry/recovery engines.

v1.73.0 adds governance evidence tests（Test 863–892）.

## Risk Decision

| ID | v1.73.0 Effect |
|----|----------------|
| PR-004 | **Low** — maintained |
| PR-005 | **Medium** — reframed: Authorized vs Started distinction explicit |
| PR-006 | **Added** — Mock Provider semantic drift / Application mock conflation |
| CL-004 / CL-005 / CL-006 | **Unchanged — deferred** |
| CL-013 | **Mitigated** — maintained |

## Compliance Decision

MOCK_PROVIDER_PRODUCTION_IMPLEMENTATION_AUTHORIZATION_REVIEW compliance section added to ARCHITECTURE_COMPLIANCE_CHECKLIST.

## Compatibility Decision

| Surface | Impact |
|---------|--------|
| Application `publicContracts[]` | **Unchanged** |
| `compatibilityMatrix` | **Unchanged** |
| `providerContracts[]` abstract authority | **Unchanged** |
| PROVIDER_LAYER_DESIGN contract semantics | **Unchanged** — clarifying note only for catalog example |

## Human Review Requirement

**Required** — completed as part of v1.73.0 Governance Release per ADR-0014 rollback guard.

## Authorized Scope

- ADR-0016 acceptance
- MOCK_PROVIDER_PRODUCTION_IMPLEMENTATION_AUTHORIZATION_REVIEW evidence
- Governance documentation updates（NON_GOALS, FUTURE_ENTRY_CRITERIA, COMPLIANCE, MATURITY, RISK, VERSION, CHANGELOG, README）
- Quality Pipeline governance tests
- PROVIDER_LAYER_DESIGN §8 catalog example clarification（wording only）

## Explicitly Unauthorized Scope

- Mock Provider production module implementation
- Concrete Mock `providerContracts[]` registration
- Catalog generator / validation changes
- Real Provider / external IO
- Runtime / Scheduler / Adapter implementation
- Retry Engine / Recovery Engine / Idempotency Engine / deduplication
- Application Layer mock function changes
- Repository-wide L4 Ready declaration

## Implementation Start Rule

Mock Provider Production Implementation **may begin** only in a **future separate Implementation Release** after:

1. ADR-0016 merged
2. MOCK_PROVIDER_PRODUCTION_IMPLEMENTATION_AUTHORIZATION_REVIEW Final Decision accepted
3. Human Review recorded
4. Quality Pipeline PASS for v1.73.0 governance evidence

**Started** status requires explicit Implementation Release documentation — not this Governance Release.

## Rollback / Rejection Conditions

| Condition | Action |
|-----------|--------|
| ADR-0016 rejected before merge | Mock Production Authorization **Not Granted**; revert governance docs |
| Mock impl started without ADR-0016 | **Reject** — prerequisite violation |
| Mock impl conflated with Real Provider | **Reject** — PR-002 Critical |
| Repository-wide L4 declared from Mock authorization | **Reject** — ADR-0009 violation |
| Concrete catalog registration without Catalog Governance Release | **Reject** — Decision B violation |
| Cross-layer retry/recovery/idempotency in Mock impl | **Reject** — CL-004/005/006 violation |

## Consequences

### Positive

- Explicit authorization layer between L4 Ready + Catalog Extension and future implementation
- Mock Provider semantics defined — Major Gap closed
- PR-005 protected — Authorized ≠ Started ≠ Complete
- Timeout ownership ambiguity resolved at governance level
- Catalog registration policy explicit — Decision B

### Negative / Trade-offs

- Concrete catalog registration deferred — additional future governance step
- PR-005 remains Medium until Implementation Release completes
- CL-004 / CL-005 / CL-006 exposure unchanged

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Bundle Mock impl in v1.73.0 | Violates governance-only scope |
| Authorize concrete catalog registration now | v1.72.0 validator / registrationKind not ready; risks accidental catalog expansion |
| Defer authorization until implementation | ADR-0014/0015 Review Triggers require explicit authorization governance |
| Authorize all Provider capabilities | Violates minimal initial scope; expands risk surface |

## Review Triggers

- Mock Provider Production Implementation Release proposed（code）
- Concrete `providerContracts[]` Mock registration proposed
- Real Provider / external IO proposed
- Catalog schema breaking change proposed

## Final Decision

| Item | Decision |
|------|----------|
| **Mock Provider Production Implementation** | **Authorized** — future separate Implementation Release |
| **Mock Provider Production Implementation** | **Not Started** |
| **Provider Production Ready** | **Not Declared** |
| **Repository-wide Level 4 Implementation Ready** | **Not Declared** |
| **Real Provider / External IO** | **Prohibited** |
| **Concrete catalog Mock registration** | **Deferred** — separate future Catalog Governance Release |

## Related Documents

- [ADR-0013](./ADR-0013-provider-non-goals-release-decision.md)
- [ADR-0014](./ADR-0014-provider-level-4-implementation-ready-decision.md)
- [ADR-0015](./ADR-0015-provider-public-contract-catalog-extension-release.md)
- [MOCK_PROVIDER_PRODUCTION_IMPLEMENTATION_AUTHORIZATION_REVIEW.md](../architecture/MOCK_PROVIDER_PRODUCTION_IMPLEMENTATION_AUTHORIZATION_REVIEW.md)
- [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md)
- [FUTURE_ENTRY_CRITERIA.md](../architecture/FUTURE_ENTRY_CRITERIA.md)
- [NON_GOALS.md](../architecture/NON_GOALS.md)
- [RISK_REGISTER.md](../architecture/RISK_REGISTER.md)
- [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](../architecture/ARCHITECTURE_COMPLIANCE_CHECKLIST.md)
