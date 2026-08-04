# Product Provider Selection Record

**Document type:** Productization governance record（Bounded Productization Entry）
**Lifecycle:** v1.87.0 Bounded Productization Entry + P2 Provider Re-evaluation Documentation
**Authority:** Planning / selection record only — **not** Real Provider authorization, External IO authorization, Production Ready declaration, endpoint approval, or Catalog registration

---

## 1. Purpose

この文書は、Bounded Text Publishing MVP における **最初の1 Provider** 選定根拠を恒久的なガバナンス記録として固定する。

この文書は **推奨（Recommended）** を記録する。実装許可・ネットワーク許可・Production Ready 宣言・endpoint 承認を行わない。

**Recommended ≠ Authorized.**

---

## 2. Current Decision Summary

| Field | Value |
| ----- | ----- |
| **Selection Outcome** | **D. CONDITIONAL RECOMMENDATION — X** |
| **Current Recommendation** | **X** with Entry Conditions |
| **Authorized Provider** | **None** |
| **Product form** | Bounded Text Publishing MVP（Branch A — pure text-only） |
| **Provider count** | **1** only |
| **Content** | Text-only |
| **Endpoint Approved** | **No** |
| **Catalog Registered (Real Provider)** | **No** |
| **Real Provider / External IO** | **Prohibited** |
| **Version** | **Not Assigned** |
| **Pending Release** | **None** |
| **Evidence date** | Research / Selection **2026-08-03**; Documentation Implementation In Progress |

### Current Provider State

| Provider | Contract Fit | Current Selection State |
| -------- | ------------ | ----------------------- |
| Instagram | **NOT FIT** | Historical Initial Recommendation / Branch A excluded |
| Threads | **CONDITIONAL FIT** | **Deferred** |
| X | **CONDITIONAL FIT** | **Recommended with Entry Conditions** |

Research records: [docs/architecture/research/](./research/README.md)
Unified matrix: [P2_PROVIDER_REEVALUATION_MATRIX.md](./research/P2_PROVIDER_REEVALUATION_MATRIX.md)

---

## 3. Historical Initial Recommendation（v1.87.0）

> Retained for traceability. **Superseded for Branch A text-only MVP** by official Contract-Fit Research (P2-R1–R4).
> Historical recommendation ≠ current recommendation.

### Historical decision (repository-fit era)

| Field | Historical value |
| ----- | ---------------- |
| Decision | **Instagram** |
| Status | Recommended for first bounded product |
| Basis | Repository-internal evidence only（no official API Contract-Fit Research） |
| Record date | v1.87.0 Productization Governance |

### Historical scoring matrix (preserved)

Original criteria C1–C14 (repository-fit era) rated Instagram Strong on repository fit / implementation effort and selected Instagram; Threads / X Deferred. Primary discriminator was existing `publishing.js` / `publishing/1.0` Instagram coupling.

### Why historical Instagram recommendation was superseded

1. P2-R1 official research: Instagram Content Publishing requires **mandatory media**
2. Branch A preserves **pure text-only** MVP — C2 / C19 **Blocking** for Instagram
3. Repository fit **must not** override official contract Blocking
4. P2-R2 / P2-R3 found Threads and X technically text-only capable
5. P2-R4 selected **X Conditional Recommendation** over Threads Deferred (commercial certainty)

Historical context is **not** retroactively rewritten; it remains the initial Productization Entry recommendation under repository-only evidence.

---

## 4. Official Contract-Fit Re-evaluation（P2-R1–R4）

| Phase | Result |
| ----- | ------ |
| P2-R1 Instagram | **NOT FIT** |
| P2-R2 Threads | **CONDITIONAL FIT** → Deferred |
| P2-R3 X | **CONDITIONAL FIT** |
| P2-R4 Selection | **D — Conditional Recommendation — X** |

Evaluation axes: unified C1–C20 (official research). See matrix artifact for full ratings/confidence.

### Why X (conditional)

1. Native pure text-only Strong (parity with Threads)
2. Critical Blocking = 0
3. Public pay-per-use pricing evidenced (Threads C17 **Unknown**)
4. Spending limits / credits controls more operator-controllable than Unknown pricing
5. Entry conditions can be explicit
6. Still **not** Authorized; endpoints **Not Approved**

### Why not Threads now

C17 Commercial/pricing **Unknown** / Low confidence — Deferred pending commercial evidence or future re-evaluation.

### Why not Instagram now

C2 / C19 **Blocking** — media mandatory vs text-only MVP.

---

## 5. X Mandatory Entry Conditions

Conditions must be accepted before any Implementation / Authorization / endpoint Planning proceeds. **None are satisfied by this documentation alone.**

### Commercial

1. Credit purchase / spend-policy acceptance（purchase **not** performed here）
2. Standard create-price acceptance as planning baseline
3. **URL-bearing Posts prohibited** in initial MVP unless separately approved
4. Confirmation read-back cost acceptance
5. Live Developer Console rate confirmation before Implementation
6. Price-change review / publish kill-stop trigger

### Security

7. Least-privilege OAuth scope freeze
8. Token lifecycle / refresh / revocation freeze
9. Credential isolation and account binding

### Reliability

10. Application request intent ID
11. Pre-publish approval record
12. Single-flight execution
13. Attempt ledger
14. No automatic blind retry
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

26. Separate endpoint allowlist Planning（Candidate Evidence ≠ Approved）
27. Separate Provider Authorization
28. Separate Catalog Registration
29. Separate P2B+ authorization
30. **Recommended ≠ Authorized** maintained until explicit Authorization

---

## 6. Explicit markers

| Marker | Value |
| ------ | ----- |
| Selection | Conditional Recommendation |
| Authorization | **No** |
| Endpoints | **Not Approved** |
| Catalog registration | **No** |
| Credentials / OAuth / API | **Prohibited** |
| Credits / billing executed | **No** |
| P2B+ | **Not Authorized** |
| Version | **Not Assigned** |
| Pending Release | **None** |
| Real Provider / External IO / Automatic SNS | **Prohibited** |

---

## 7. Re-evaluation triggers

| Trigger | Action |
| ------- | ------ |
| X public pricing / Console rate change | Bounded re-evaluation; External IO remains off |
| Credit / billing / URL surcharge / write-access change | Re-check commercial entry conditions |
| OAuth scope / auth / API deprecation / automation policy change | Re-check security/policy fit |
| Native idempotency contract added | Update C10 / mitigation |
| Threads public pricing published / Advanced Access change | May reopen Threads comparison |
| Instagram native text-only API | May reopen Instagram under Branch A |
| MVP boundary / volume change | New selection cycle if authorized |

Trigger なしの日常的な再比較は禁止する。

---

## 8. Non-goals

- Real Provider / External IO / Automatic SNS authorization
- Concrete endpoint approval
- Catalog Real Provider registration
- Credential creation
- Network / SDK / adapter implementation
- Version / tag / SemVer assignment in this record
- Treating public X prices as permanent fixed truth
- Treating Threads as free

---

## 9. Governance references

| Document | Role |
| -------- | ---- |
| [research/README.md](./research/README.md) | Research index |
| [P2_R1_INSTAGRAM_CONTRACT_FIT_RESEARCH.md](./research/P2_R1_INSTAGRAM_CONTRACT_FIT_RESEARCH.md) | Instagram NOT FIT |
| [P2_R2_THREADS_CONTRACT_FIT_RESEARCH.md](./research/P2_R2_THREADS_CONTRACT_FIT_RESEARCH.md) | Threads Deferred |
| [P2_R3_X_CONTRACT_FIT_RESEARCH.md](./research/P2_R3_X_CONTRACT_FIT_RESEARCH.md) | X CONDITIONAL FIT |
| [P2_PROVIDER_REEVALUATION_MATRIX.md](./research/P2_PROVIDER_REEVALUATION_MATRIX.md) | Outcome D matrix |
| [PRODUCT_MVP_BOUNDARY.md](./PRODUCT_MVP_BOUNDARY.md) | MVP boundary |
| [PROVIDER_ENDPOINT_ALLOWLIST.md](./PROVIDER_ENDPOINT_ALLOWLIST.md) | Allowlist model — Not Approved |
| [ADR-0024](../adr/ADR-0024-bounded-productization-entry.md) | Productization entry |
| [BASELINE_SYNCHRONIZATION.md](./BASELINE_SYNCHRONIZATION.md) | Current Baseline Record |

---

## Document Control

| Field | Value |
| ----- | ----- |
| Status | **Conditional Recommendation — X**（Recommended — **not** Authorized） |
| Historical Instagram recommendation | Retained / superseded for Branch A |
| Next related phase | Documentation Independent Review → Commit lifecycle（versionless） |
| Mutation | Requires re-evaluation under §7 + explicit governance update |
