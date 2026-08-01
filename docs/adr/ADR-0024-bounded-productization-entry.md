# ADR-0024: Bounded Productization Entry Decision

## Status

Accepted（v1.87.0 — Bounded Productization Entry — governance / documentation release candidate）

## Supersedes

None.

This ADR introduces **Bounded Productization Entry** as a capability-based lifecycle after continuous `v1.86.x` Repository Released-State Reconciliation termination.

It does **not** supersede [ADR-0023](./ADR-0023-repository-baseline-inventory-authority.md). ADR-0023 remains the sole authority for Repository Baseline Inventory / Current Baseline Record / Synchronization Matrix.

## Purpose

Establish formal governance for the transition from identity-only Released-State Reconciliation cycles to the first **user-usable bounded product** path:

```text
Bounded Text Publishing MVP
```

This ADR defines entry authority, roadmap framing, non-goals, constraints, migration boundary handling, rollback, and exit criteria. It does **not** authorize Real Provider implementation, External IO, credentials, network calls, automatic SNS publishing, or Production Ready declarations.

## Background

- [v1.86.21](../VERSION.md) is **Released** at commit `4c1c21259493d3bcb7a1de79bf6c99c09fc0ffd1`（tag `v1.86.21`; subject `docs(governance): reconcile v1.86.20 released baseline`）.
- Post-Push Release State Review for `v1.86.21` returned **A. GO** and **terminated** continuous `v1.86.x` Reconciliation.
- `v1.86.22` normal reconciliation is **not authorized**.
- Planning for `v1.87.0 Bounded Productization Entry` returned **A. GO** and recommended capability-based milestones P0–P10.
- Provider Selection Record recommends **Instagram** as the first Provider（Recommended ≠ Authorized）— see [PRODUCT_PROVIDER_SELECTION.md](../architecture/PRODUCT_PROVIDER_SELECTION.md).

Further identical identity-only cycles add no product capability. The next objective is a bounded, human-approved, text-only publishing product with mandatory safety controls.

## Scope

### In scope（authorized by this ADR）

- Formal Productization Entry designation for `v1.87.0`
- Capability-based roadmap framing（P1–P10）
- MVP boundary authority pointer（[PRODUCT_MVP_BOUNDARY.md](../architecture/PRODUCT_MVP_BOUNDARY.md)）
- ADR-0023 Record migration of Current → published `v1.86.21` and Pending → `v1.87.0` Productization Entry
- Documentation / governance artifacts required for Entry
- Explicit non-goals and governance constraints

### Out of scope（not authorized）

- Provider Adapter / Real Provider implementation
- External IO / network execution / SNS posting
- Credential creation or secret storage
- Catalog schema / `providerContracts[]` changes
- Quality Test **additions**（identity lock updates for Record sync remain allowed under ADR-0023）
- Automatic SNS Publishing
- Bounded / Global Production Ready declaration
- Repository-wide Level 4 declaration
- Image / video publishing scope
- Multi-Provider scope
- `v1.86.22` reconciliation restart

## Capability-based roadmap

| ID | Milestone | Entry status under this ADR |
| -- | --------- | --------------------------- |
| P0 | Productization Entry Planning | **Complete** |
| P1 | Productization Governance and MVP Boundary | **Authorized**（this release candidate） |
| P2 | Security / Credential / External IO Boundary（specs） | Not started — separate authorization |
| P3 | Human Approval Workflow Foundation | Not started |
| P4 | Real Provider Adapter（default-disabled） | Not started — **prohibited** until separately authorized |
| P5 | Dry-Run and Idempotency | Not started |
| P6 | Controlled Publication Execution | Not started |
| P7 | Failure / Retry / Kill Switch / Audit | Not started |
| P8 | Bounded Validation with Test Account | Not started |
| P9 | First Product Release Preparation | Not started |
| P10 | First Product Release and Post-Release Review | Not started |

First user-usable product versioning candidate remains **`v1.88.0`（MINOR）** unless a future Major is required by VERSIONING_POLICY breaking rules. `v2.0.0` is **not** selected by this ADR.

## Explicit non-goals

- Multiple SNS Providers
- Image / video posting
- Automatic approval / automatic publishing
- Comment / DM automation
- Follower / engagement scraping
- Multi-tenant SaaS / complex RBAC / HA cluster
- Global Production Ready / repository-wide Level 4
- Image Review Entry / Image Formal Assessment advancement
- CL-004 / CL-005 / CL-006 completion
- Restart of continuous `v1.86.x` Released-State Reconciliation

## Governance constraints

```text
Recommended Provider ≠ Authorized Real Provider
Authorized governance ≠ Implemented adapter
Dry-run ≠ Published
Human approval required ≠ Automatic publishing
External IO default-disabled ≠ External IO authorized
Production Ready ≠ Assessment READY（Mock lineage）
```

Mandatory safety capabilities for the first product（design/planning authority; implementation later）:

- Human approval
- Dry-run
- Idempotency / duplicate prevention
- Audit log
- Retry ceiling
- Kill switch
- Credential protection / redaction

Real Provider and External IO remain **Prohibited** until a later, separate authorization explicitly grants them. Default posture is **disabled**.

## Relationship to ADR-0023

| Concern | Authority |
| ------- | --------- |
| Inventory / Record / Matrix | **ADR-0023** + [BASELINE_SYNCHRONIZATION.md](../architecture/BASELINE_SYNCHRONIZATION.md) |
| Productization Entry / MVP boundary / capability roadmap | **This ADR（ADR-0024）** |
| Provider recommendation | [PRODUCT_PROVIDER_SELECTION.md](../architecture/PRODUCT_PROVIDER_SELECTION.md) |
| MVP include/exclude / success criteria | [PRODUCT_MVP_BOUNDARY.md](../architecture/PRODUCT_MVP_BOUNDARY.md) |

```text
ADR-0023 Record authority
        ≠
ADR-0024 Productization Entry authority
```

**Reverse Synchronization remains Prohibited** under ADR-0023. Derived Targets and Quality identity locks synchronize **Record → Derived → Quality** only.

## Migration boundary

At Productization Entry:

| Field | Value |
| ----- | ----- |
| Git published baseline | `v1.86.21` @ `4c1c21259493d3bcb7a1de79bf6c99c09fc0ffd1` |
| Record Current（after this Entry population） | `v1.86.21` |
| Record Pending | `v1.87.0` Bounded Productization Entry — **Implementation** / **Not Declared** |
| Continuous `v1.86.x` Reconciliation | **Terminated** |
| `v1.86.22` | **Not authorized** |

Post-push one-cycle lag from `v1.86.21` publication is closed by this Entry’s Record population（Current → `v1.86.21`）. Pending moves to Productization capability work — **not** another identity-only reconciliation.

## Rollback policy

If Entry documentation or Record population is found incorrect before `v1.87.0` Commit / Tag / Push:

1. Do **not** force-push or rewrite published `v1.86.21`
2. Do **not** reverse-sync Derived → Record
3. Stop further Productization Implementation phases
4. Correct via bounded documentation revision under the same Entry designation
5. Keep Real Provider / External IO / automatic publishing **Prohibited**

If a later milestone must abort after partial enablement（future phases）: engage kill switch / disable flags; do not declare Production Ready; quarantine unknown publication results.

## Exit criteria

This ADR’s Entry governance is **complete** when:

1. Productization Entry ADR Accepted（this document）
2. MVP Boundary document published
3. Provider Selection Record published（Instagram Recommended）
4. Current Baseline Record populated to Git-published `v1.86.21`
5. Pending set to `v1.87.0` Productization Entry（Not Declared）
6. Required Derived Targets synchronized Record → Derived
7. Quality identity locks assert Record `v1.86.21`（no Test 1233）
8. Real Provider / External IO / automatic publishing remain Prohibited
9. Catalog counts unchanged unless separately authorized
10. No Adapter / network / credential mutations in this Entry slice

## Decision summary

| Item | Decision |
| ---- | -------- |
| **Release designation** | Bounded Productization Entry |
| **Lifecycle** | `v1.87.0` capability-based Productization |
| **Continuous v1.86.x Reconciliation** | **Terminated** |
| **v1.86.22** | **Not authorized** |
| **First product** | Bounded Text Publishing MVP |
| **Provider recommendation** | Instagram（Recommended — not Authorized） |
| **Real Provider / External IO** | **Still Prohibited** |
| **Automatic SNS Publishing** | **Still Prohibited** |
| **Production Ready** | **Not Declared** |
| **Repository-wide Level 4** | **Not Declared** |

## References

- [ADR-0023](./ADR-0023-repository-baseline-inventory-authority.md)
- [BASELINE_SYNCHRONIZATION.md](../architecture/BASELINE_SYNCHRONIZATION.md)
- [PRODUCT_MVP_BOUNDARY.md](../architecture/PRODUCT_MVP_BOUNDARY.md)
- [PRODUCT_PROVIDER_SELECTION.md](../architecture/PRODUCT_PROVIDER_SELECTION.md)
- [PROVIDER_PRODUCTION_READINESS_REVIEW.md](../architecture/PROVIDER_PRODUCTION_READINESS_REVIEW.md)
- [VERSIONING_POLICY.md](../architecture/VERSIONING_POLICY.md)
- [NON_GOALS.md](../architecture/NON_GOALS.md)
