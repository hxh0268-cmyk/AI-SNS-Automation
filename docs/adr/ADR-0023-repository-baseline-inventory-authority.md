# ADR-0023: Repository Baseline Inventory Authority Decision

## Status

Accepted（v1.86.0 — Repository Baseline Inventory Authority Governance）

## Supersedes

None.

This ADR introduces Repository Baseline Inventory Authority.

It does not supersede any previous ADR.

## Scope

This ADR governs:

- Repository Baseline Inventory Authority
- Current Baseline Record Authority
- Synchronization Matrix Authority

It does not govern:

- Release execution
- Provider implementation
- Catalog registration
- Production Readiness

## Context

[v1.85.0](../VERSION.md)（commit `0301d1a571997e3236952b3fbb2c593718e1f164`）により Provider Production Readiness SSOT terminology alignment が完了した。Git `main` / tag `v1.85.0` / `origin/main` は同期済みである。

At the time of the authority-conflict audit（before ADR Acceptance）, [VERSIONING_POLICY.md](../architecture/VERSIONING_POLICY.md) still declared that **`docs/VERSION.md` が Current Version の正** である。これにより Current Version **value** の権威が `docs/VERSION.md` に帰属していると読まれていた。

At the proposal stage, the parallel Phase 1 artifact [BASELINE_SYNCHRONIZATION.md](../architecture/BASELINE_SYNCHRONIZATION.md) defined Repository Baseline Inventory **Inventory Authority** but had **not yet instantiated** the **Current Baseline Record**（各 inventory field の認可済み現在値）; the Synchronization Matrix was also **not yet established**.

Phase 2-A Inventory Audit（before ADR Acceptance）confirmed the following.

- Git / tag 上の正式 baseline は **v1.85.0** @ `0301d1a…`
- 複数の derived documents（`docs/VERSION.md` current header、README current release section、Quality Pipeline current-version assertions 等）はなお **v1.84.0** を Current Version として表示・固定していた
- `Next Phase Candidate: v1.85.0` が残存するなど、derived identity と Git identity が drift していた

Phase 2-B Authority Conflict Decision / ADR Planning concluded **PASS WITH CORRECTIONS** and prohibited proceeding to repository-wide baseline synchronization until the authority conflict was resolved by ADR.

```text
VERSIONING_POLICY: VERSION.md = Current Version value authority
        ≠
BASELINE_SYNCHRONIZATION: Inventory Authority（Record deferred）
        ≠
Git tag v1.85.0 @ 0301d1a（actual release identity）
        ≠
Derived documents still displaying v1.84.0 as current
```

Before ADR Acceptance, repository-wide Baseline Synchronization was **prohibited** until this authority conflict was decided and SSOT（Current Baseline Record + Synchronization Matrix）was established.

At the proposal stage, this document was scoped as a **Governance / Authority Decision** only. Existing-file edits, Record population, Matrix instantiation, derived synchronization, Quality correction, and commit / tag / push were **outside the proposal-stage ADR text itself** and were reserved for subsequent authorized migration phases after Acceptance.

## Decision

### Decision Summary

**DECISION — Establish Repository Baseline Inventory Authority Hierarchy**

[BASELINE_SYNCHRONIZATION.md](../architecture/BASELINE_SYNCHRONIZATION.md) を、次の三者の **sole architectural authority** とする。

1. Repository Baseline Inventory Model
2. Current Baseline Record
3. Synchronization Matrix

三者は同一文書へ **co-locate** してよい。ただし概念上・構造上は常に区別する。

```text
Repository Baseline Inventory Model
≠ Current Baseline Record
≠ Synchronization Matrix
```

### Authority Hierarchy

```text
ADR-0023（this decision）
        │
        ▼
BASELINE_SYNCHRONIZATION.md
  ├── Repository Baseline Inventory Model（definitions / field meanings / rules）
  ├── Current Baseline Record（authorized current values）
  └── Synchronization Matrix（sync obligations / targets）
        │
        ▼
Required Derived Targets（display / consume Record values）
        │
        ▼
Quality Enforcement（after ADR + SSOT approval only）
```

Supporting authorities that are **not** Current Baseline value authorities:

| Artifact | Role in hierarchy |
|----------|-------------------|
| [VERSIONING_POLICY.md](../architecture/VERSIONING_POLICY.md) | Versioning **rules** authority only |
| Git repository state | Validation **evidence** for Record fields only |
| Quality Pipeline | Enforcement of approved hierarchy only（post-approval） |

### Authority Assignments

| Artifact | Authority role |
|----------|----------------|
| [BASELINE_SYNCHRONIZATION.md](../architecture/BASELINE_SYNCHRONIZATION.md) | Sole authority for Inventory Model, Current Baseline Record, and Synchronization Matrix |
| [docs/VERSION.md](../VERSION.md) | Required human-readable document for Current Version **display**, Current Release **summary**, and Release **History**. Current values are **derived** from the approved Current Baseline Record. **Not** an independent Current Baseline authority |
| [VERSIONING_POLICY.md](../architecture/VERSIONING_POLICY.md) | Authority for Semantic Versioning rules, Patch / Minor / Major bump rules, and version transition rules. **Not** authority for the current version **value** |
| Git repository state（HEAD / branch / tag / remote refs / divergence） | Authoritative **validation evidence** for the Current Baseline Record. **Not** a replacement for the Current Baseline Record |
| `scripts/test_quality_pipeline.sh` and quality checks | Enforce the approved authority hierarchy **only after** ADR and SSOT approval. Quality **must not** create, replace, or override authority |

### Required Derived Targets

Under this decision, documents that display or restate current-baseline values are **Required Derived Targets** when their responsibilities include current-identity presentation.

At minimum, [docs/VERSION.md](../VERSION.md) is a Required Derived Target for:

- Current Version display
- Current Release summary

Release History in `docs/VERSION.md` remains a **historical record surface**. It is not the Current Baseline Record.

Additional derived targets（architecture overviews, review baseline tables, quality assertions, and related governance status surfaces）are identified by the Synchronization Matrix after SSOT establishment. They must not independently redefine Record field meanings or values.

```text
Current Baseline Record
        ↓
Required Derived Targets
```

Reverse synchronization is prohibited.

### Deferred Reconciliations（SSOT establishment phase）

[GOVERNANCE_FLOW.md](../architecture/GOVERNANCE_FLOW.md) および `docs/VERSION.md` を sole Current Version **value** authority と implied する他文書は、ADR Acceptance 後の **SSOT establishment phase** で権威階層へ reconcile する。**ADR Acceptance itself did not modify those files**; subsequent authorized migration phases performed the reconciliations.

### What ADR Acceptance Did Not Authorize

| Item | Status under ADR Acceptance |
|------|-----------------------------|
| Declare **v1.86.0** completed / released | **No** |
| Declare Bounded Production Ready or Global Provider Production Ready | **No** |
| Declare repository-wide Level 4 Implementation Ready | **No** |
| Authorize Real Provider | **No** |
| Authorize External IO | **No** |
| Authorize automatic SNS publishing | **No** |
| Populate Current Baseline Record values | **No**（by ADR Acceptance alone — executed in subsequent Migration steps） |
| Create Synchronization Matrix | **No**（by ADR Acceptance alone — executed in subsequent Migration steps） |
| Modify v1.84.0 historical / derived references | **No** |
| Modify existing repository files | **No**（by ADR Acceptance itself — subsequent authorized migrations applied changes） |
| Authorize repository-wide baseline synchronization | **No**（at Acceptance — executed in Migration step 10 after prerequisites） |
| Authorize commit / tag / push | **No**（at Acceptance — Migration steps 13–15 remain separately authorized） |
| Govern release execution / Provider implementation / Catalog registration / Production Readiness | **No** — see Scope |

## Authority Boundaries

The following boundaries are mandatory and must not be collapsed.

```text
Repository Baseline Inventory Authority
≠ Versioning Rules Authority

Repository Baseline Inventory Model
≠ Current Baseline Record

Current Baseline Record
≠ Synchronization Matrix

Current Baseline Record
≠ Release History

Current Baseline Record
≠ Git Repository Evidence

Derived Document
≠ Current Baseline Authority

Quality Enforcement
≠ Authority

Baseline Authority
≠ Release Authority

Baseline Authority
≠ Implementation Authority

Baseline Authority
≠ Catalog Registration Authority

Baseline Authority
≠ Production Readiness Authority
```

Additional preserved distinctions:

```text
Baseline Authority
≠ Provider Expansion / Implementation / Catalog Registration authorization

Assessment Decision READY
≠ Bounded Production Ready Declaration
≠ Global Provider Production Ready
```

## Dependency Chain

Repository Baseline work shall follow this dependency order. No later step may omit an earlier dependency.

```text
Authority Decision（this ADR）
        ↓
ADR Acceptance（v1.86.0）
        ↓
SSOT（Current Baseline Record instantiation）
        ↓
Synchronization Matrix
        ↓
Repository-wide Baseline Synchronization
        ↓
Review
        ↓
Quality Enforcement
        ↓
Independent Review
        ↓
Commit
        ↓
Tag
        ↓
Push
```

The numbered Migration Sequence below is the operative checklist for this chain.

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Keep `docs/VERSION.md` as Current Version value SSOT; Baseline file = model only | Leaves Phase 2-A dual-authority conflict; Current Baseline Record remains orphaned |
| Use Git tags / HEAD as the Current Baseline Record | Violates Record ≠ Git Evidence; command output and hosting UI become de facto authority |
| Create a separate `CURRENT_BASELINE.md` as Record SSOT | Extra authority surface without necessity if co-located sections remain distinct |
| Let Quality Pipeline define or freeze Current Version | Quality Enforcement ≠ Authority |
| Amend VERSIONING_POLICY only, without ADR | Policy edit without ADR does not establish governed authority transition |
| Amend ADR-0018 or prior ADRs to carry baseline authority | Out of scope; those ADRs govern readiness / provider decisions, not repository baseline inventory |
| Proceed immediately to repository-wide v1.84.0 → v1.85.0 synchronization | Forbidden until authority conflict is resolved and Record / Matrix exist |

## Consequences

### Positive

- Single architectural authority for Inventory Model, Current Baseline Record, and Synchronization Matrix
- Ends VERSIONING_POLICY ↔ VERSION.md circular claim over Current Version **value**
- Enables ordered SSOT establishment and Synchronization Matrix before repository-wide sync
- Preserves VERSION.md as human-readable display / summary / history without making it baseline authority
- Keeps Git as validation evidence without replacing the Record
- Prevents Quality from inventing authority

### Negative / Accepted

- Requires later SSOT edits to VERSIONING_POLICY, VERSION.md（derived-target declaration）, GOVERNANCE_FLOW, and ARCHITECTURE_DECISIONS registry
- Temporary dual wording may persist until SSOT establishment and Independent Review
- Co-location risk: readers may conflate Model / Record / Matrix unless structural sections remain explicit
- Quality current-version locks（e.g. v1.84.0 assertions）remain until post-approval Quality phase

### Risk Mitigation

- Require distinct document sections for Model, Record, and Matrix inside BASELINE_SYNCHRONIZATION.md
- Forbid reverse synchronization（derived text must not become Record values）
- Forbid Quality updates that invent authority before ADR Acceptance + SSOT approval

## Migration Sequence

Normative dependency order（operative checklist for the Dependency Chain）:

1. ADR-0023 Authority Decision（this document）
2. ADR Independent Review
3. ADR Acceptance for **v1.86.0**
4. Inventory Authority / SSOT update（instantiate Current Baseline Record structure in BASELINE_SYNCHRONIZATION.md without collapsing Model ≠ Record ≠ Matrix）
5. VERSIONING_POLICY authority correction（rules only; remove Current Version value SSOT claim）
6. docs/VERSION.md derived-target declaration（display / summary / history; values derive from Record）
7. GOVERNANCE_FLOW authority correction
8. ARCHITECTURE_DECISIONS registry update
9. Synchronization Matrix instantiation
10. Repository-wide Baseline Synchronization
11. Quality Enforcement（enforce approved hierarchy only）
12. Independent Review
13. Commit
14. Tag
15. Push

A later step shall never justify omission of an earlier dependency.

## Current Progress

**v1.86.12** is **Released** at commit `881081a1c037093ad275ac0d3c8a1362cc9e017d`
（tag `v1.86.12`; remote synchronized）. Parent release **v1.86.11** remains
**Released** at `fb1f6dd85a5efe967bedc0151c686d4967627ade`. Corrective workstream
**v1.86.13**（v1.86.12 released-state reconciliation）is in **Implementation**;
Release remains **Not Declared**. Post-Push Review for `v1.86.12` is **Complete**.

| Migration Step / Phase | Status |
| ---------------------- | ------ |
| 1 — ADR-0023 Authority Decision | **Complete** |
| 2 — ADR Independent Review | **Complete** |
| 3 — ADR Acceptance（v1.86.0 Planning → Released） | **Complete** |
| 4 — Inventory Authority / SSOT update | **Complete** |
| 5 — VERSIONING_POLICY authority correction | **Complete** |
| 6 — docs/VERSION.md derived-target declaration | **Complete** |
| 7 — GOVERNANCE_FLOW authority correction | **Complete** |
| 8 — ARCHITECTURE_DECISIONS registry update | **Complete** |
| 9 — Synchronization Matrix instantiation（SM-001–SM-025） | **Complete** |
| 10 — Repository-wide Baseline Synchronization | **Complete**（under released `v1.86.12`） |
| 11 — Quality Enforcement Correction（Tests 988 / 1026 / 1034 remediated; **1232 PASS**） | **Complete** |
| 12 — Independent Review | **Complete** — Decision **A. GO** |
| 13 — Commit（v1.86.0） | **Complete** — `57b3182ea2fb51f4f3441f9c1013543276cb757f` |
| 14 — Tag（v1.86.0） | **Complete** — tag `v1.86.0` |
| 15 — Push（v1.86.0） | **Complete** — `origin/main` + tag synchronized |

| Recorded outcome（v1.86.0） | Status |
| -------------------------- | ------ |
| ADR Acceptance | **Complete** |
| Current Baseline Record population | **Complete**（Recorded Current Version `v1.86.0` — now historical） |
| Synchronization Matrix | **Complete** |
| Repository-wide Baseline Synchronization | **Complete** |
| Quality Enforcement Correction | **Complete** |
| Independent Review | **Complete** — **A. GO** |
| Commit / Tag / Push | **Complete** |
| **v1.86.0** Release | **Released** — commit `57b3182…` / tag `v1.86.0` / remote synchronized |

| Corrective workstream（v1.86.1） | Status |
| ------------------------------- | ------ |
| Purpose | Repository Baseline Identity Reconciliation |
| Independent Review | **Complete** — Decision **A. GO** |
| Status | **Released / Completed** |
| Release | **Released** — commit `a47e892…` / tag `v1.86.1` / remote synchronized |
| Commit / Tag / Push | **Complete** |
| Post-Push Review | **Complete** |
| Image Review Entry / Formal Assessment / Production Ready | **Unchanged**（NO / NO / Not Declared） |

| Corrective workstream（v1.86.2） | Status |
| ------------------------------- | ------ |
| Purpose | v1.86.1 released-state reconciliation |
| Status | **Released / Completed** |
| Release | **Released** — commit `46b77f8…` / tag `v1.86.2` / remote synchronized |
| Commit / Tag / Push | **Complete** |
| Post-Push Review | **Complete** |
| Image Review Entry / Formal Assessment / Production Ready | **Unchanged**（NO / NO / Not Declared） |

| Corrective workstream（v1.86.3） | Status |
| ------------------------------- | ------ |
| Purpose | v1.86.2 released-state reconciliation |
| Status | **Released / Completed** |
| Release | **Released** — commit `695a9e2…` / tag `v1.86.3` / remote synchronized |
| Commit / Tag / Push | **Complete** |
| Post-Push Review | **Complete** |
| Image Review Entry / Formal Assessment / Production Ready | **Unchanged**（NO / NO / Not Declared） |

| Corrective workstream（v1.86.4） | Status |
| ------------------------------- | ------ |
| Purpose | v1.86.3 released-state reconciliation |
| Status | **Released / Completed** |
| Release | **Released** — commit `d5907a2…` / tag `v1.86.4` / remote synchronized |
| Commit / Tag / Push | **Complete** |
| Post-Push Review | **Complete** |
| Image Review Entry / Formal Assessment / Production Ready | **Unchanged**（NO / NO / Not Declared） |

| Corrective workstream（v1.86.5） | Status |
| ------------------------------- | ------ |
| Purpose | v1.86.4 released-state reconciliation |
| Status | **Released / Completed** |
| Release | **Released** — commit `4a53c610…` / tag `v1.86.5` / remote synchronized |
| Commit / Tag / Push | **Complete** |
| Post-Push Review | **Complete** |
| Image Review Entry / Formal Assessment / Production Ready | **Unchanged**（NO / NO / Not Declared） |

| Corrective workstream（v1.86.6） | Status |
| ------------------------------- | ------ |
| Purpose | v1.86.5 released-state reconciliation |
| Status | **Released / Completed** |
| Release | **Released** — commit `bb26dff…` / tag `v1.86.6` / remote synchronized |
| Commit / Tag / Push | **Complete** |
| Post-Push Review | **Complete** |
| Image Review Entry / Formal Assessment / Production Ready | **Unchanged**（NO / NO / Not Declared） |

| Corrective workstream（v1.86.7） | Status |
| ------------------------------- | ------ |
| Purpose | v1.86.6 released-state reconciliation |
| Status | **Released / Completed** |
| Release | **Released** — commit `511ceed…` / tag `v1.86.7` / remote synchronized |
| Commit / Tag / Push | **Complete** |
| Post-Push Review | **Complete** |
| Image Review Entry / Formal Assessment / Production Ready | **Unchanged**（NO / NO / Not Declared） |

| Corrective workstream（v1.86.8） | Status |
| ------------------------------- | ------ |
| Purpose | v1.86.7 released-state reconciliation |
| Status | **Released / Completed** |
| Release | **Released** — commit `5a019898…` / tag `v1.86.8` / remote synchronized |
| Commit / Tag / Push | **Complete** |
| Post-Push Review | **Complete** |
| Image Review Entry / Formal Assessment / Production Ready | **Unchanged**（NO / NO / Not Declared） |

| Corrective workstream（v1.86.9） | Status |
| ------------------------------- | ------ |
| Purpose | v1.86.8 released-state reconciliation |
| Status | **Released / Completed** |
| Release | **Released** — commit `21ec585…` / tag `v1.86.9` / remote synchronized |
| Commit / Tag / Push | **Complete** |
| Post-Push Review | **Complete** |
| Image Review Entry / Formal Assessment / Production Ready | **Unchanged**（NO / NO / Not Declared） |

| Corrective workstream（v1.86.10） | Status |
| ------------------------------- | ------ |
| Purpose | v1.86.9 released-state reconciliation |
| Status | **Released / Completed** |
| Release | **Released** — commit `1d99eb7…` / tag `v1.86.10` / remote synchronized |
| Commit / Tag / Push | **Complete** |
| Post-Push Review | **Complete** |
| Image Review Entry / Formal Assessment / Production Ready | **Unchanged**（NO / NO / Not Declared） |

| Corrective workstream（v1.86.11） | Status |
| ------------------------------- | ------ |
| Purpose | v1.86.10 released-state reconciliation |
| Status | **Released / Completed** |
| Release | **Released** — commit `fb1f6dd…` / tag `v1.86.11` / remote synchronized |
| Commit / Tag / Push | **Complete** |
| Post-Push Review | **Complete** |
| Image Review Entry / Formal Assessment / Production Ready | **Unchanged**（NO / NO / Not Declared） |

| Corrective workstream（v1.86.12） | Status |
| ------------------------------- | ------ |
| Purpose | v1.86.11 released-state reconciliation |
| Status | **Released / Completed** |
| Release | **Released** — commit `881081a…` / tag `v1.86.12` / remote synchronized |
| Commit / Tag / Push | **Complete** |
| Post-Push Review | **Complete** |
| Image Review Entry / Formal Assessment / Production Ready | **Unchanged**（NO / NO / Not Declared） |

| Corrective workstream（v1.86.13） | Status |
| ------------------------------- | ------ |
| Purpose | v1.86.12 released-state reconciliation |
| Status | **Implementation** / **Not Declared** |
| Release | **Not Declared** |
| Commit / Tag / Push | **Pending** |
| Image Review Entry / Formal Assessment / Production Ready | **Unchanged**（NO / NO / Not Declared） |
| v1.87.0 Production Readiness Assessment | **Not started** |

## Non-Goals

This ADR does not:

- redefine or rewrite historical releases;
- modify completed ADR decisions（ADR-0007–ADR-0022 evidence）;
- replace or alter review evidence artifacts;
- modify or regenerate generated reports / developer-handoff outputs;
- authorize Provider implementation changes;
- authorize Public Contract Catalog implementation changes;
- authorize Real Provider;
- authorize External IO;
- authorize automatic SNS publishing;
- change CL-004 / CL-005 / CL-006 deferred state;
- declare Bounded Production Ready or Global Provider Production Ready;
- declare repository-wide Level 4 Implementation Ready;
- declare v1.86.0 complete;
- populate Current Baseline Record field values as part of ADR Acceptance itself;
- create the Synchronization Matrix as part of ADR Acceptance itself;
- perform repository-wide derived synchronization as part of ADR Acceptance itself;
- govern release execution（see Scope）;
- modify BASELINE_SYNCHRONIZATION.md, VERSION.md, VERSIONING_POLICY.md, GOVERNANCE_FLOW.md, ARCHITECTURE_DECISIONS.md, or other repository files as part of ADR Acceptance itself;
- commit, tag, or push as part of ADR Acceptance itself.

## Acceptance Record

Before ADR-0023 was accepted, Independent Review confirmed the following criteria were satisfied:

1. Sole authority assignment to BASELINE_SYNCHRONIZATION.md for Inventory Model, Current Baseline Record, and Synchronization Matrix was explicit.
2. Model ≠ Record ≠ Matrix remained conceptually and structurally distinct.
3. This ADR assigned `docs/VERSION.md` as a Required Derived Target for current values; Release History remained distinct from the Record.（File edit of VERSION.md was Migration step 6 — **after** Acceptance.）
4. This ADR assigned VERSIONING_POLICY as Versioning Rules Authority only.（File correction was Migration step 5 — **after** Acceptance.）
5. Git was validation evidence only; not a Record substitute.
6. Quality Enforcement ≠ Authority was explicit; quality updates were deferred until after ADR and SSOT approval.
7. GOVERNANCE_FLOW and related implied VERSION value-authority claims were scheduled for SSOT reconciliation（Migration steps 4–8）and were not retained as competing authority in this decision.
8. Scope, Authority Boundaries, Dependency Chain, Migration Sequence, and Non-Goals were mutually consistent.
9. Non-Goals were preserved.
10. No repository-wide baseline synchronization had been executed solely on the basis of the pre-Acceptance proposal text.

Subsequent migration steps（SSOT establishment, derived-target file edits, Synchronization Matrix instantiation, repository-wide synchronization, Quality Enforcement, and Independent Review）were executed under the authorized Migration Sequence after Acceptance.

## Review Trigger

Revisit this ADR when any of the following occur:

- Proposal to restore `docs/VERSION.md` as Current Version **value** authority
- Proposal to treat Git refs or hosting UI as Current Baseline Record
- Proposal to split Inventory Model / Record / Matrix into multiple competing authority documents without a superseding ADR
- Proposal for Quality Pipeline to define current baseline values
- Repository Baseline Inventory field set materially expands
- Conflict between Current Baseline Record and Git validation evidence cannot be reconciled under existing rules
- Supersession by a later ADR that reassigns baseline authority

## Related Documents

- [BASELINE_SYNCHRONIZATION.md](../architecture/BASELINE_SYNCHRONIZATION.md)
- [VERSIONING_POLICY.md](../architecture/VERSIONING_POLICY.md)
- [docs/VERSION.md](../VERSION.md)
- [GOVERNANCE_FLOW.md](../architecture/GOVERNANCE_FLOW.md)
- [ARCHITECTURE_DECISIONS.md](../architecture/ARCHITECTURE_DECISIONS.md)
