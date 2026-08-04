# P2-R1 Instagram Official Contract-Fit Research Record

**Document type:** Official Contract-Fit Research record
**Phase:** P2-R1
**Status:** **Complete**
**Outcome:** **NOT FIT**
**Retrieval date baseline:** **2026-08-03** (Asia/Tokyo)
**Research source boundary:** Meta official primary documentation only (`developers.facebook.com`)
**Provider Authorization:** **No**
**Endpoint Approval:** **No**
**Catalog Registration:** **No**

---

## 1. Purpose

Record whether Instagram Content Publishing officially supports **pure text-only** publication for Bounded Text Publishing MVP (Branch A).

## 2. Primary text-only finding

| Question | Answer |
| -------- | ------ |
| Native pure text-only publication | **Unsupported** |
| Caption-only without media | **Not supported** |
| Media requirement | **Mandatory** (`image_url` / `video_url` or media-backed container) |
| Feasibility class | **B** — caption accepted only with mandatory media |
| Official Notes / text-only publishing API for MVP | **No supporting official evidence** in researched sources |

## 3. Critical criteria (C1–C20 mapping)

Instagram Research used F1–F16; mapped to Branch A C-criteria:

| Criterion | Rating | Confidence | Impact |
| --------- | ------ | ---------- | ------ |
| C2 Native pure text-only | **Blocking** | High | Disqualifies Branch A |
| C19 MVP scope compatibility | **Blocking** | High | Text-only MVP vs mandatory media |
| C14 Historical repository fit | Strong (historical) | High | **Does not override** C2/C19 |

**Critical Blocking count ≥ 1 → Branch A selection eligibility = false.**

## 4. Supporting summary

### Account / auth / permission

Professional Business/Creator account path documented. OAuth + long-lived token refresh model documented at product level. Multi-tenant Advanced Access may apply. Not decisive given C2/C19 Blocking.

### Publishing flow

Container create → publish sequence for image / video / reels / carousel. Media asset required for container creation.

### Result / idempotency

Status polling available for containers. No client idempotency key documented (Weak; non-decisive due to Blocking).

### Rate / error

Publishing-limit endpoints exist; researched docs showed quota figure conflict (Major non-Blocking). Error envelopes partially evidenced.

### App Review / testing

Live professional account testing; no Meta mock substitute for Content Publishing confirmed in research.

### Version / deprecation

Graph API current researched baseline **v26.0** (retrieval 2026-08-03). Text-only non-support is product-level, not a version quirk.

## 5. Explicit non-workarounds

Forbidden as FIT rescue:

- blank / transparent image workarounds
- browser automation
- private / undocumented APIs
- silent media-backed MVP change without Boundary Change Planning

## 6. Branch impact

| Branch | Status |
| ------ | ------ |
| Branch A — Preserve Text-Only MVP | Instagram **excluded** |
| Branch B — Media-backed MVP | Separate Planning only; not authorized here |

## 7. Official conflicts

Publish quota figures conflicted across official pages (50 vs 100 class). Recorded as Major documentation gap; does not change NOT FIT.

## 8. Conclusion

**Overall: C. NOT FIT** for Bounded Text Publishing MVP.

Instagram remains **Historical Initial Recommendation** in the Provider Selection Record for traceability, and **Current Branch A Contract Fit = NOT FIT**.

## 9. Source references

See [P2_PROVIDER_REEVALUATION_SOURCE_REGISTER.md](./P2_PROVIDER_REEVALUATION_SOURCE_REGISTER.md) (Instagram section). Representative official surfaces: Instagram Platform Content Publishing, Graph API versions changelog.

## 10. Re-evaluation triggers

- Official native text-only / Notes publishing API for Instagram Content Publishing
- Explicit Meta documentation removing media requirement for create/publish
- MVP boundary change to media-backed (Branch B Planning)

Until re-evaluation completes, External IO remains **Prohibited**.

---

## Document Control

| Field | Value |
| ----- | ----- |
| Outcome | **NOT FIT** |
| Provider Authorization | **No** |
| Endpoint Approval | **No** |
| Real Provider / External IO | **Prohibited** |
