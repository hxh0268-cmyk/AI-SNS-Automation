# P2 Provider Re-evaluation Official Source Register

**Document type:** Official source register
**Retrieval date baseline:** **2026-08-03** (Asia/Tokyo)
**Rule:** Official primary sources only; summaries only; no long verbatim dumps
**Console rates:** **Not viewed**
**Provider Authorization:** **No**
**Endpoint Approval:** **No**

---

## 1. Instagram (Meta)

| Source ID | Title | Canonical URL | Domain | Retrieval | Version / status | Findings | Confidence | Conflict | Next review |
| --------- | ----- | ------------- | ------ | --------- | ---------------- | -------- | ---------- | -------- | ----------- |
| IG-S1 | Instagram Content Publishing | https://developers.facebook.com/docs/instagram-platform/content-publishing | developers.facebook.com | 2026-08-03 | Product-level / Graph family | Media-backed publishing; caption with media | High | — | Native text API |
| IG-S2 | Graph API versions | https://developers.facebook.com/docs/graph-api/changelog/versions/ | developers.facebook.com | 2026-08-03 | v26.0 current at retrieval | Version baseline | High | — | Version expiry |
| IG-S3 | Instagram Platform overview / related publishing docs | https://developers.facebook.com/docs/instagram-platform | developers.facebook.com | 2026-08-03 | Product-level | Account/publishing context | Medium | Quota figure conflicts across pages | Doc refresh |

Limitations: Some Graph error-envelope fetches incomplete during Research. Does not change NOT FIT.

## 2. Threads (Meta)

| Source ID | Title | Canonical URL | Domain | Retrieval | Version / status | Findings | Confidence | Conflict | Next review |
| --------- | ----- | ------------- | ------ | --------- | ---------------- | -------- | ---------- | -------- | ----------- |
| TH-S1 | Threads API / posts create documentation | https://developers.facebook.com/docs/threads | developers.facebook.com | 2026-08-03 | Threads API product | `media_type=TEXT` support | High | — | API change |
| TH-S2 | Threads publishing / access docs | https://developers.facebook.com/docs/threads/overview | developers.facebook.com | 2026-08-03 | Product-level | Access / publishing overview | Medium | — | Advanced Access |
| TH-S3 | Threads posts / publish guides | https://developers.facebook.com/docs/threads/posts | developers.facebook.com | 2026-08-03 | Product-level | Create/publish sequence | High | — | Contract change |

Limitations: No public fee table found in reviewed docs → C17 Unknown. Do **not** infer free.

## 3. X

| Source ID | Title | Canonical URL | Domain | Retrieval | Version / status | Findings | Confidence | Conflict | Next review |
| --------- | ----- | ------------- | ------ | --------- | ---------------- | -------- | ---------- | -------- | ----------- |
| X-S1 | X API Introduction | https://docs.x.com/x-api/introduction | docs.x.com | 2026-08-03 | X API v2 / pay-per-use | Product overview | High | — | Product change |
| X-S2 | Manage Posts introduction | https://docs.x.com/x-api/posts/manage-tweets/introduction | docs.x.com | 2026-08-03 | v2 | Text-only Basic Post; reply/quote/media sections | High | Self-serve reply/cashtag notes | Access rules |
| X-S3 | Manage Posts quickstart | https://docs.x.com/x-api/posts/manage-tweets/quickstart | docs.x.com | 2026-08-03 | v2 | “at least text or media”; success id/text | High | — | Contract change |
| X-S4 | Create or Edit Post | https://docs.x.com/x-api/posts/create-post | docs.x.com | 2026-08-03 | v2 | Schema; scopes; Enterprise quote note; dynamic Unit Cost UI | Medium | Unit Cost dynamic vs static pricing page subtypes | Console + page refresh |
| X-S5 | Pay-per-use pricing | https://docs.x.com/x-api/getting-started/pricing | docs.x.com | 2026-08-03 | Pay-per-use | Post Create / URL / summoned / reads; spending limits; Console authority | Medium | Subtype prices; subject to change | Price/Console change |
| X-S6 | Rate limits | https://docs.x.com/x-api/fundamentals/rate-limits | docs.x.com | 2026-08-03 | v2 tables | POST /2/tweets App/User windows | High | Distinct windows — do not sum | Limit change |
| X-S7 | Counting Characters | https://docs.x.com/fundamentals/counting-characters | docs.x.com | 2026-08-03 | Product | 280 weighted; URL=23; emoji/CJK weights | High | — | Counting rules |
| X-S8 | Authentication | https://docs.x.com/resources/fundamentals/authentication | docs.x.com | 2026-08-03 | OAuth 1.0a / OAuth 2.0 PKCE | User context methods | High | — | Auth change |
| X-S9 | Developer Policy | https://developer.x.com/en/developer-terms/policy | developer.x.com | 2026-08-03 | Policy | Automation/spam/credentials/rate-limit rules | High | — | Policy change |
| X-S10 | V2 Webhooks API | https://docs.x.com/x-api/webhooks | docs.x.com | 2026-08-03 | Webhooks/Activity | Events available; **not required** for create Post MVP | Medium | — | Webhook pricing |

Limitations: Create-post Unit Cost is UI/estimator driven; Console live rates not accessed. Public prices are planning baseline only.

## 4. Shared / policy notes

| Source ID | Title | Canonical URL | Notes |
| --------- | ----- | ------------- | ----- |
| X-S11 | X Developer Agreement | https://developer.x.com/en/developer-terms/agreement | License / terms context; no Implementation authorization |

## 5. Exclusions

Not used as final evidence: blogs, Stack Overflow, Reddit, third-party pricing sites, unofficial SDKs, non-official GitHub, search snippets, cached mirrors, Mintlify preview hosts as sole authority, AI summaries.

## 6. Next review triggers

Any material change to URLs above, pricing tables, access tiers, OAuth scopes, or automation policy → bounded re-evaluation; External IO remains off.

---

## Document Control

| Field | Value |
| ----- | ----- |
| Retrieval baseline | 2026-08-03 |
| Console rates viewed | **No** |
| Credits purchased | **No** |
| Endpoint Approved | **No** |
