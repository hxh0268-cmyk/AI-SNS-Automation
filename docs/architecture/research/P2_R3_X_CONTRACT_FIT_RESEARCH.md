# P2-R3 X Official Contract-Fit Research Record

**Document type:** Official Contract-Fit Research record
**Phase:** P2-R3
**Status:** **Complete**
**Outcome:** **CONDITIONAL FIT**
**Technical Fit:** **Strong**
**Commercial Fit:** **Conditional**
**Retrieval date baseline:** **2026-08-03** (Asia/Tokyo)
**Research source boundary:** X official documentation only (`docs.x.com`, `developer.x.com`)
**Provider Authorization:** **No**
**Endpoint Approval:** **No**
**Catalog Registration:** **No**

---

## 1. Purpose

Evaluate whether X API officially supports pure text-only Post creation for Branch A Bounded Text Publishing MVP, separating **Technical Contract Fit** from **Commercial / Access Fit**.

## 2. Primary text-only finding

| Question | Answer |
| -------- | ------ |
| Create root Post via current v2 manage Posts | **Yes** — `POST /2/tweets` (candidate path; Not Approved) |
| Text-only body sufficient | **Yes** — official examples use `{"text":"..."}` |
| Media required | **Optional** — “at least text or media” |
| Feasibility class | **A** — Native pure text-only officially supported |
| C2 / C19 | **Strong** |
| Critical Blocking | **0** |

## 3. API / version

| Item | Finding |
| ---- | ------- |
| Recommended product family | X API **v2** Manage Posts |
| Create-post endpoint family | v2 Posts create/edit |
| Host (candidate evidence) | `api.x.com` (Not Approved) |
| v1.1 | Not used as create-post authority for this Research |
| Media upload | Separate path; not required for text-only |

## 4. Authentication / scopes

| Item | Finding |
| ---- | ------- |
| User context required for create | **Yes** |
| OAuth 2.0 PKCE | Supported (user context) |
| OAuth 1.0a user context | Supported |
| App-only | Insufficient for create Post |
| Research baseline scopes | `tweet.read`, `tweet.write`, `users.read` |
| App / Project | Approved developer account + Project/App required |

## 5. Commercial / pricing findings (planning baseline)

| Item | Finding |
| ---- | ------- |
| Model | Pay-per-use credits (no subscription framing on pricing page) |
| Credits | Purchase upfront in Developer Console (**not performed**) |
| Spending limits | Documented |
| Post: Create (standard) | Public unit cost evidenced on pricing page at retrieval |
| Post: Create (with URL) | Higher surcharge evidenced |
| Post: Create (summoned) | Distinct lower unit cost evidenced |
| Posts: Read | Per-resource cost evidenced (affects confirmation strategy) |
| Cap | Self-serve Post reads monthly cap evidenced; Enterprise for higher volume |
| Authority | Public pricing + Developer Console current rates; prices subject to change |
| Console rates | **Not viewed** in Research (login prohibited) |
| C17 | **Medium / Conditional** |

### Pricing conflict handling

Planning noted potential `$0.015` vs `$0.010` create-cost conflict. Public pricing page distinguishes **standard / URL / summoned** operations. Create-post page Unit Cost is dynamically loaded (not a static conflicting hard-code in HTML). Research did **not** average prices or pick cheaper/safer arbitrarily. Public figures are **retrieval-date planning baseline**, not permanent truth. Future Implementation requires **live Console confirmation**.

**No credit purchase. No billing operation.**

## 6. Reliability / ops findings

| Item | Finding |
| ---- | ------- |
| Success response | Includes Post `id` and `text` in official quickstart |
| C10 Idempotency | **Weak** — no native idempotency key documented |
| Rate limits (create) | Per App 10,000/24hrs; Per User 100/15min (official rate-limit tables) |
| Webhooks required for publish | **No** |
| Testing | Live / own-account; live-cost / live-visible; spending limits available |
| Self-serve constraints | e.g. cashtag limit; reply summoning rules documented |
| Quote via `quote_tweet_id` | Enterprise note on create-post page (self-serve restriction) |

## 7. C1–C20 summary (normalized; fixed cells unchanged)

| ID | Rating | Notes |
| -- | ------ | ----- |
| C1 | Strong | Official public API |
| C2 | **Strong** | Text-only create |
| C3 | Medium | Dev account + Project/App |
| C4 | Strong | OAuth 2.0 PKCE / OAuth 1.0a |
| C5 | Medium | Scopes; some features Enterprise |
| C6 | Medium | Credits conditional production write |
| C7 | Weak | Live-cost testing; no dedicated sandbox confirmed |
| C8 | Strong | Finite candidate endpoint (Not Approved) |
| C9 | Medium | id/text return; lookup may cost |
| C10 | **Weak** | No native idempotency key |
| C11 | Strong | Documented create limits |
| C12 | Medium | Problem Details style errors |
| C13 | Medium | User-context secrets; policy constraints |
| C14 | Weak | Repo Instagram-oriented path |
| C15 | Weak–Medium | New adapter |
| C16 | Medium | Credits / rate monitoring |
| C17 | **Medium / Conditional** | Public rates; Console live authority |
| C18 | Medium | Policy + price changeability |
| C19 | **Strong** | Branch A text-only |
| C20 | Medium | URL cost policy needed for MVP |

## 8. Candidate endpoint evidence (Not Approved)

Official candidate: `POST https://api.x.com/2/tweets` and related delete/lookup surfaces.
**Explicitly Not Approved.**

## 9. Conclusion

**Overall: B. X CONDITIONAL FIT**

Technical text-only Strong; commercial Conditional (credits, URL surcharge, changeable Console rates, C10 Weak). Selected later as **Recommended with Entry Conditions** (P2-R4 outcome D) — still **not Authorized**.

## 10. Source references

See [P2_PROVIDER_REEVALUATION_SOURCE_REGISTER.md](./P2_PROVIDER_REEVALUATION_SOURCE_REGISTER.md) (X section). Key surfaces: X API introduction, Manage Posts, Create Post, Quickstart, Pricing, Rate Limits, Counting Characters, Authentication, Developer Policy.

## 11. Re-evaluation triggers

- Public or Console rate changes
- Credit / billing condition changes
- URL surcharge changes
- OAuth scope / auth model changes
- Idempotency contract added
- Automation policy changes
- Write-access eligibility changes

External IO remains **Prohibited** until separate Authorization.

---

## Document Control

| Field | Value |
| ----- | ----- |
| Outcome | **CONDITIONAL FIT** |
| Technical / Commercial | Strong / Conditional |
| Provider Authorization | **No** |
| Endpoint Approval | **No** |
| Credits / billing executed | **No** |
