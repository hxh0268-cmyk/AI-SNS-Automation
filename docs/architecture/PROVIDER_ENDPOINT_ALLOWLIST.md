# Provider Endpoint Allowlist Model

**Document type:** P2A Provider Endpoint Allowlist Schema
**Lifecycle:** P2A Boundary Specifications **Complete**; P2-R1–R4 Research **Complete**; Documentation Implementation **In Progress**（versionless; **Not Assigned**）
**Status:** **Model Defined / Research Complete / Concrete Endpoint Selection and Approval Pending Separate Planning**
**Authority:** [ADR-0024](../adr/ADR-0024-bounded-productization-entry.md)
**Related:** [EXTERNAL_IO_BOUNDARY.md](./EXTERNAL_IO_BOUNDARY.md) · [PRODUCT_PROVIDER_SELECTION.md](./PRODUCT_PROVIDER_SELECTION.md) · [research/README.md](./research/README.md)

---

## 1. Purpose

Define the allowlist **schema**, decision procedure, and rejection behavior for future single-Provider External IO.

**Do not invent or approve concrete Provider hosts or API paths in this document.**
**Candidate Evidence ≠ Approved Allowlist.**

## 2. Status

| Field | Value |
| ----- | ----- |
| Model | **Defined**（this document） |
| Provider research R1–R4 | **Complete** |
| Conditional Recommendation | **X** with Entry Conditions |
| Endpoint candidates | **Research Evidence only** |
| Concrete official hosts | **Empty / unapproved** |
| Concrete endpoint templates | **Empty / unapproved** |
| Concrete Endpoint Approval | **Not Started / Not Authorized** |
| Implementation / network | **Not authorized** |
| Provider Authorization | **No** |
| Real Provider | **Prohibited** |
| External IO | **Prohibited** |

## 3. Research dependency（completed）

```text
P2-R1 Instagram — NOT FIT（Branch A）
P2-R2 Threads — CONDITIONAL FIT / Deferred
P2-R3 X — CONDITIONAL FIT
P2-R4 Selection — D. CONDITIONAL RECOMMENDATION — X
```

| Item | Value |
| ---- | ----- |
| Sources | Official Meta / X primary documentation only（see research source register） |
| Method | Read-only research; no Provider API execution during Research |
| Output | Candidate evidence for hosts/templates — **not approval** |
| Implementation | **Not authorized** by research or conditional recommendation alone |
| Recommendation | X Recommended with Entry Conditions ≠ Authorized |

Research completion does **not** fill `officialHosts[]` or `endpointTemplates[]`.
Next: **separate endpoint contract / allowlist Planning** only after entry-condition acceptance and separate authorization.

## 4. Allowlist record schema

```text
ProviderAllowlist
- providerId                 # future single Provider lock — empty until approved
- environment                # local | ci | test | production（or equivalent）
- enabled                    # boolean; default false
- scheme                     # https only（recommendation）
- officialHosts[]            # exact hostnames — EMPTY / unapproved
- allowedPorts[]             # e.g. 443
- methods[]                  # per-template HTTP methods
- endpointTemplates[]        # narrow templates — EMPTY / unapproved
- pathParameters[]           # constrained placeholders only
- queryParameters[]          # allowlisted names only; no arbitrary passthrough
- credentialReferenceTypes[] # which CredentialReference kinds may be used
- accountRestrictions        # binding rules
- requestSchema              # schema ID / version
- responseSchema             # schema ID / version
- timeoutPolicy              # connect / request
- retryPolicy                # retryable classes + ceiling
- redirectPolicy             # disabled | revalidate-each-hop
- auditPolicy                # which fields may be recorded
- changeControl              # who may mutate allowlist; audit required
```

## 5. Mandatory principles

1. **Deny by default**
2. **One Provider lock** for MVP
3. No arbitrary path passthrough
4. No arbitrary query passthrough
5. Production / test endpoint separation
6. Unknown Provider rejected
7. Unknown host rejected
8. Unknown endpoint rejected
9. Unknown method rejected
10. Redirects disabled or re-validated against allowlist
11. Concrete hosts/endpoints remain **unapproved** until separate Planning + Authorization
12. Allowlist changes are audited（no secret values）
13. Research Candidate Evidence is **not** an Approved Allowlist

## 6. Endpoint template rules

- Templates are exact or narrowly parameterized（e.g. `{id}` with charset constraints）
- Wildcards that accept arbitrary paths are **forbidden**
- Query strings: only named allowlisted parameters
- Bodies: schema-validated; size-limited

## 7. Rejection behavior

| Condition | Error category |
| --------- | -------------- |
| Unknown Provider | `POLICY_BLOCKED` / Provider disabled |
| Host not on list | `HOST_NOT_ALLOWED` |
| Endpoint not on list | `ENDPOINT_NOT_ALLOWED` |
| Method not on list | `METHOD_NOT_ALLOWED` |
| Allowlist disabled / enable OFF | `PROVIDER_DISABLED` / `KILL_SWITCH_ACTIVE` |
| Redirect to non-allowlisted host | `HOST_NOT_ALLOWED` / `POLICY_BLOCKED` |

## 8. Change control

- Mutating allowlist content requires governed documentation / Implementation authorization
- P2A defined the model; R1–R4 produced candidate evidence only
- Filling concrete hosts requires **separate endpoint allowlist Planning** after entry-condition acceptance
- No runtime enablement from Documentation Implementation

## 9. Explicit non-goals

- Listing guessed hosts as approved
- Implementing HTTP clients
- Registering Real Provider in Catalog
- Authorizing External IO
- Treating Conditional Recommendation as endpoint approval

## 10. Relationship to other phases

| Phase | Role |
| ----- | ---- |
| P2A（this model） | Schema |
| P2-R1–R4 | Official candidate evidence — **Complete** |
| Entry-condition acceptance | Prerequisite for endpoint Planning |
| Separate endpoint Planning | Select/approve concrete hosts/templates |
| P2D / later | Gateway consumes allowlist（still no network until authorized） |

---

## Document Control

| Field | Value |
| ----- | ----- |
| Status | **Research Complete / Concrete Endpoint Selection and Approval Pending Separate Planning** |
| Version | **Not Assigned** |
| Implementation | **Not authorized** |
| Endpoints Approved | **No** |
