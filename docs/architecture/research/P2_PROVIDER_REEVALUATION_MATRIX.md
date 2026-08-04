# P2 Provider Re-evaluation Matrix

**Document type:** Unified comparison / selection matrix
**Phase:** P2-R4 Selection Execution (durable record)
**Status:** **Complete**
**Selection Outcome:** **D. CONDITIONAL RECOMMENDATION — X**
**Evidence date baseline:** **2026-08-03**
**Provider Authorization:** **No**
**Endpoint Approval:** **No**
**Recommended ≠ Authorized:** **Yes**

---

## 1. Fixed states

| Provider | Contract Fit | Selection State |
| -------- | ------------ | --------------- |
| Instagram | **NOT FIT** | Historical Initial Recommendation / Branch A excluded |
| Threads | **CONDITIONAL FIT** | **Deferred** |
| X | **CONDITIONAL FIT** | **Recommended with Entry Conditions** |

## 2. C1–C20 matrix (ratings unchanged from Research)

Confidence: H=High, M=Medium, L=Low. Versions: IG Graph v26.0 product publishing; Threads API; X API v2.

| ID | Criterion | Instagram | Threads | X | Selection impact |
| -- | --------- | --------- | ------- | - | ---------------- |
| C1 | Official public API | Strong/H | Strong/H | Strong/H | Tie |
| C2 | Native pure text-only | **Blocking**/H | **Strong**/H | **Strong**/H | IG DQ |
| C3 | Account eligibility | Strong/H | Medium/M | Medium/M | TH≈X |
| C4 | Authentication clarity | Medium/M | Strong/H | Strong/H | TH≈X |
| C5 | Permission/review | Medium/M | Medium/M (Adv. Access) | Medium/M | Conditional |
| C6 | Production access | Ineligible via C2/C19 | Medium/M | Medium/M (credits) | Both conditional |
| C7 | Official testing | Weak–Med/M | Medium/M | Weak/H (live-cost) | Live-visible both |
| C8 | Endpoint allowlist bound | Medium/M | Strong/H | Strong/H | Candidates Not Approved |
| C9 | Result confirmation | Medium/M | Medium/M | Medium/M | X may incur read cost |
| C10 | Idempotency | Weak/H | **Weak**/H | **Weak**/H | Mandatory mitigation |
| C11 | Rate-limit manageability | Med/Unknown | Strong/H | Strong/H | TH≈X |
| C12 | Error-contract clarity | Med/Unknown | Medium/M | Medium/M | TH≈X |
| C13 | Credential/security | Medium/M | Medium/M | Medium/M | Not Strong |
| C14 | Repository architecture | Strong hist./H | Weak/H | Weak/H | Hist. IG **ignored** |
| C15 | Implementation effort | N/A (DQ) | Weak–Med | Weak–Med | Secondary |
| C16 | Operational burden | Med–Weak | Medium/M | Medium/M | X cost ops explicit |
| C17 | Commercial/pricing | N/A (DQ) | **Unknown**/L | **Medium/Cond**/M | **Decisive** |
| C18 | Platform-policy stability | Medium | Medium/M | Medium/M | Monitor |
| C19 | MVP scope compatibility | **Blocking**/H | **Strong**/H | **Strong**/H | IG DQ |
| C20 | User-usable product fit | Weak | Medium/M | Medium/M | URL policy for X |

## 3. Rule model

### Weight classes

- **Critical:** C2, C6, C13, C19
- **High:** C4, C5, C8, C9, C10, C17
- **Medium:** remaining

### Rules applied

1. Critical Blocking ≥ 1 → ineligible (Instagram)
2. C17 Unknown → no unconditional recommendation (Threads)
3. C17 Conditional → unconditional blocked; Conditional Recommendation allowed (X)
4. C10 Weak → application-layer mitigation mandatory if recommended
5. Strong counts cannot override Blocking/Unknown
6. Repository fit cannot override commercial/security risk
7. Selection is optional (NO SELECT allowed)
8. Rule-first; optional numeric score secondary only

### Optional secondary score (explanatory)

Approx. weighted scores (Blocking DQ excludes Instagram): Threads ~114; X ~118 (driven mainly by C17 0 vs 3). Score does **not** override rules.

## 4. Comparison summary

| Axis | Result |
| ---- | ------ |
| Technical | Near-tie; both text-only Strong |
| Commercial | **X superior** — known variable pricing vs Threads Unknown |
| Security | Tie Medium; no Critical Blocking |
| Idempotency | Both Weak — shared mitigation |
| Testing | Both live-visible; X spend controls clearer |
| Repository | Both need adapter; IG historical fit unused |
| Tie-break | Confidence → production certainty → **commercial certainty (X)** |

## 5. Final outcome

**D. CONDITIONAL RECOMMENDATION — X**

Rationale:

- Instagram Critical Blocking on C2/C19
- Threads/X technical near-tie
- Threads C17 Unknown / Low confidence
- X C17 Medium-Conditional / Medium confidence
- Known variable commercial conditions more controllable than Unknown
- Both C10 Weak
- X entry conditions can be explicitly bounded
- No unconditional eligibility for Threads or X

## 6. Mandatory X entry conditions

### Commercial

1. Credit / spend-policy acceptance (purchase not executed here)
2. Standard create-price acceptance as planning baseline
3. **URL-bearing Posts prohibited** in initial MVP unless separately approved
4. Read-back / confirmation cost acceptance
5. Live Console rate confirmation before Implementation
6. Price-change review / kill-stop trigger

### Security

7. Least-privilege OAuth scope freeze
8. Token lifecycle / refresh / revocation freeze
9. Credential isolation and account binding

### Reliability

10. Request intent ID
11. Approval record
12. Single-flight execution
13. Attempt ledger
14. No blind retry
15. Lookup-before-retry
16. UNKNOWN_RESULT quarantine
17. Operator resolution
18. Duplicate-content check
19. Kill switch
20. Immutable audit trail

### Testing

21. Live-cost boundary
22. Live-visible boundary
23. Cleanup / deletion policy
24. Spending cap
25. Test-account policy

### Governance

26. Separate endpoint allowlist Planning
27. Separate Provider Authorization
28. Separate Catalog Registration
29. Separate P2B+ authorization
30. Recommended ≠ Authorized

## 7. Deferred / rejected

| Provider | Reason |
| -------- | ------ |
| Instagram | NOT FIT — media mandatory |
| Threads | Deferred — C17 Unknown |
| Unconditional X/Threads | Forbidden by C17 Conditional/Unknown |

## 8. Re-evaluation triggers

X public/Console pricing · URL surcharge · credits/billing · write access · OAuth scopes · API deprecation · automation policy · third-party limits · idempotency contract · Threads public pricing · Threads Advanced Access · Instagram native text API · MVP boundary · volume change

On trigger: bounded re-evaluation required; External IO remains off.

---

## Document Control

| Field | Value |
| ----- | ----- |
| Outcome | **D** |
| Authorized Provider | **None** |
| Endpoints | **Not Approved** |
| Real Provider / External IO | **Prohibited** |
| Version | **Not Assigned** |
