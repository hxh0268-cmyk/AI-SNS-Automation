# P2-R2 Threads Official Contract-Fit Research Record

**Document type:** Official Contract-Fit Research record
**Phase:** P2-R2
**Status:** **Complete**
**Outcome:** **CONDITIONAL FIT**
**Current Selection State:** **Deferred**
**Retrieval date baseline:** **2026-08-03** (Asia/Tokyo)
**Research source boundary:** Meta official Threads / Graph documentation only
**Provider Authorization:** **No**
**Endpoint Approval:** **No**
**Catalog Registration:** **No**

---

## 1. Purpose

Evaluate whether Threads API officially supports pure text-only create/publish for Branch A Bounded Text Publishing MVP.

## 2. Primary text-only finding

| Question | Answer |
| -------- | ------ |
| Native pure text-only | **Officially supported** (`media_type=TEXT`) |
| Media asset required for text posts | **No** |
| Feasibility class | **A** — Native pure text-only |
| C2 / C19 | **Strong** |
| Critical Blocking | **0** |

## 3. Required commercial / access findings

| Item | Finding |
| ---- | ------- |
| C17 Commercial/pricing | **Unknown** |
| Public fee table in reviewed docs | **Insufficient / absent** |
| Free assumption | **Forbidden** — do not treat as free |
| Advanced Access / third-party | **Conditional** (C5/C6 Medium) |
| Unconditional final SELECT | **Not allowed** while C17 Unknown |

## 4. Reliability findings

| Item | Finding |
| ---- | ------- |
| C10 Idempotency | **Weak** — no client idempotency key documented |
| Result confirmation | Medium — container/post IDs + status fields |
| UNKNOWN_RESULT | Application-layer quarantine required if selected |
| Webhooks required for publish | **Not required** for MVP create/publish path |

## 5. C1–C20 summary (unchanged from Research)

| ID | Rating | Notes |
| -- | ------ | ----- |
| C1 | Strong | Official public API |
| C2 | **Strong** | `media_type=TEXT` |
| C3 | Medium | Testers / Advanced Access split |
| C4 | Strong | OAuth documented |
| C5 | Medium | Advanced Access for 3P |
| C6 | Medium | Own-account path; 3P Advanced Access |
| C7 | Medium | Live/tester paths |
| C8 | Strong | Finite host/template candidates (Not Approved) |
| C9 | Medium | IDs + status |
| C10 | **Weak** | No native idempotency key |
| C11 | Strong | Publishing limit guidance |
| C12 | Medium | Partial error envelope |
| C13 | Medium | OAuth + server-side secrets |
| C14 | Weak | Instagram-fixed publishing path in repo |
| C15 | Weak–Medium | New adapter effort |
| C16 | Medium | Token refresh / quotas |
| C17 | **Unknown** | SELECT-blocking for unconditional |
| C18 | Medium | Evolving platform rules |
| C19 | **Strong** | Matches Branch A |
| C20 | Medium | Product constraints to monitor |

## 6. Candidate endpoint evidence (Not Approved)

Research recorded candidate hosts/templates (e.g. Graph Threads hosts; create/publish/status/limit/token paths).
**Explicitly Not Approved** — no allowlist mutation; Candidate Evidence ≠ Approved Allowlist.

## 7. Conclusion

**Overall: B. THREADS CONDITIONAL FIT**

Technically viable for text-only MVP; commercial Unknown + Advanced Access conditions prevent unconditional recommendation. **Deferred** after P2-R4 in favor of X Conditional Recommendation.

## 8. Source references

See [P2_PROVIDER_REEVALUATION_SOURCE_REGISTER.md](./P2_PROVIDER_REEVALUATION_SOURCE_REGISTER.md) (Threads section).

## 9. Re-evaluation triggers

- Official public pricing / billing table published
- Advanced Access / production eligibility clarification
- Native idempotency contract added
- Third-party operation policy change

External IO remains **Prohibited** until any future recommendation is separately authorized.

---

## Document Control

| Field | Value |
| ----- | ----- |
| Outcome | **CONDITIONAL FIT** |
| Selection State | **Deferred** |
| Provider Authorization | **No** |
| Endpoint Approval | **No** |
