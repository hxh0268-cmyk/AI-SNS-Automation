# Provider Endpoint Allowlist Model

**Document type:** P2A Provider Endpoint Allowlist Schema
**Lifecycle:** P2A — Boundary Specifications **Complete** / IR **A.GO**; lifecycle closure **In Progress**（versionless; **Not Assigned**）
**Status:** **Model Defined / Concrete Endpoints Pending P2-R1**
**Authority:** [ADR-0024](../adr/ADR-0024-bounded-productization-entry.md)
**Related:** [EXTERNAL_IO_BOUNDARY.md](./EXTERNAL_IO_BOUNDARY.md)

---

## 1. Purpose

Define the allowlist **schema**, decision procedure, and rejection behavior for future single-Provider External IO.

**Do not invent concrete Meta / Instagram hosts or API paths in this document.**

## 2. Status

| Field | Value |
| ----- | ----- |
| Model | **Defined**（this document） |
| Concrete official hosts | **TBD — Pending P2-R1** |
| Concrete endpoint templates | **TBD — Pending P2-R1** |
| Implementation / network | **Not authorized** |
| Real Provider | **Prohibited** |
| External IO | **Prohibited** |

## 3. Provider Contract-Fit Research dependency

```text
P2-R1 — Official Instagram Contract-Fit Research
```

| Item | Value |
| ---- | ----- |
| Sources | Official Meta primary documentation only |
| Method | Read-only research; no repository network calls to Provider APIs |
| Output | Evidence tables for hosts, methods, endpoint templates, auth model, rate-limit notes |
| Implementation | **Not authorized** by research alone |
| Recommendation | Instagram remains Recommended ≠ Authorized |

Until P2-R1 completes, concrete `official hosts` and `endpoint templates` fields remain empty / TBD markers only.

## 4. Allowlist record schema

```text
ProviderAllowlist
- providerId                 # e.g. future "instagram" lock — one Provider
- environment                # local | ci | test | production（or equivalent）
- enabled                    # boolean; default false
- scheme                     # https only（recommendation）
- officialHosts[]            # exact hostnames — TBD until P2-R1
- allowedPorts[]             # e.g. 443
- methods[]                  # per-template HTTP methods
- endpointTemplates[]        # narrow templates — TBD until P2-R1
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
11. Concrete hosts/endpoints remain TBD until P2-R1
12. Allowlist changes are audited（no secret values）

## 6. Endpoint template rules

- Templates are exact or narrowly parameterized（e.g. `{media_id}` with charset constraints）
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
- P2A may only define the model
- Filling concrete hosts requires P2-R1 evidence + subsequent docs update authorization
- No runtime enablement in P2A

## 9. Explicit non-goals

- Listing guessed `graph.*` hosts
- Implementing HTTP clients
- Registering Real Provider in Catalog
- Authorizing External IO

## 10. Relationship to other phases

| Phase | Role |
| ----- | ---- |
| P2A（this） | Schema + pending status |
| P2-R1 | Official evidence for hosts/templates |
| P2D | Gateway abstraction consumes allowlist（still no network） |
| Later auth | Enablement under kill-switch hierarchy |

---

## Document Control

| Field | Value |
| ----- | ----- |
| Status | **Model Defined / Concrete Endpoints Pending P2-R1** |
| Version | **Not Assigned** |
| Implementation | **Not authorized** |
