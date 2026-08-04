# Bounded Text Publishing MVP Boundary

**Document type:** Productization MVP boundary（governance）
**Lifecycle:** v1.87.0 Bounded Productization Entry
**Authority:** [ADR-0024](../adr/ADR-0024-bounded-productization-entry.md)
**Provider recommendation:** [PRODUCT_PROVIDER_SELECTION.md](./PRODUCT_PROVIDER_SELECTION.md)（**X** — Recommended with Entry Conditions ≠ Authorized; Instagram = Historical / **NOT FIT**; Threads = Deferred）

---

## 1. Product purpose

AI がテキスト投稿案を作成し、**人間が明示的に承認した投稿だけ**を、**1 つの正式 SNS Provider**へ安全に公開できる限定製品を定義する。

製品仮称:

```text
Bounded Text Publishing MVP
```

この文書は境界と成功条件を固定する。Real Provider / External IO / 投稿実行を許可しない。

---

## 2. Included capabilities

初回 MVP に含める（設計必須 / 実装は後続マイルストーン）:

| Capability | Requirement |
| ---------- | ----------- |
| Single Provider | **1 Provider only**（recommended: **X** with Entry Conditions; **not** Authorized） |
| Content | **Text-only**（URL-bearing Posts **prohibited** in initial MVP unless separately approved） |
| Human approval | Required before any real publish eligibility |
| Draft → review → approve flow | Explicit states; no Draft→Published |
| Dry-run | Required; no outbound network; no Published state |
| Idempotency | Required; one logical publication ID |
| Duplicate prevention | Required |
| Audit log | Required for approval and publish lifecycle events |
| Retry ceiling | Required; no infinite retry |
| Kill switch | Required; checked before network execution |
| Credential protection | Required; no secrets in git/logs/reports |
| Failure visibility | Publish Failed / Quarantined visible to operators |
| Default-disabled Real Provider | Required |
| Default-disabled External IO | Required |
| Explicit enablement | Required before any live network path |

---

## 3. Excluded capabilities

初回 MVP から除外:

- Multiple SNS Providers
- Image posting / video posting
- Automatic approval
- Automatic SNS publishing
- Comment replies / DM automation
- Follower collection / engagement analytics / trend scraping
- Multi-tenant SaaS / complex RBAC / HA cluster
- Global Provider Production Ready declaration
- Repository-wide Level 4 declaration
- Image Review Entry / Image Formal Assessment advancement
- CL-004 / CL-005 / CL-006 completion as a prerequisite for this MVP boundary definition
- Browser automation / arbitrary HTTP
- Credential discovery

---

## 4. Human approval requirement

```text
Draft
≠ Review Required
≠ Approved
≠ Publish Eligible
≠ Publishing
≠ Published
```

Rules:

- Draft から Published へ直接遷移できない
- Approved なしで Publish Eligible になれない
- approval actor / timestamp / content hash を記録する
- approval 後に本文が変更されたら approval を失効する
- Automatic approval は禁止

詳細状態機械は後続仕様で固定する。本境界は **必須であること** を確立する。

---

## 5. Dry-run requirement

Dry-run は必須機能である。

| Behavior | Required |
| -------- | -------- |
| Same input / approval validation | Yes |
| Same payload construction | Yes |
| Outbound network | **No** |
| Provider-side post creation | **No** |
| Published state | **No** |
| Audit event | Yes（marked `DRY_RUN`） |

Dry-run と real execution は過度に分岐させない（共有パイプライン）。

---

## 6. Idempotency

必須:

- internal publication ID
- content hash
- approval version
- Provider + account identity
- idempotency key
- attempt number / correlation ID
- Provider post ID when known

不変条件:

- 同じ publication ID は 1 つの logical publication
- timeout 後の unknown result を即再投稿しない
- Provider post ID 取得済みなら再作成しない
- Published から再実行しない

---

## 7. Audit

最低限記録するイベント種別（例）:

- draft created / modified
- review requested
- approved / rejected / approval invalidated
- publish requested / dry-run executed
- network execution started（when authorized later）
- provider accepted / rejected
- publish succeeded / failed
- retry scheduled / executed
- quarantined / cancelled
- kill switch enabled / disabled
- credential configuration changed（no secret values）

各イベントは secret material を含んではならない。

---

## 8. Kill switch

階層（最低限）:

- global publishing disabled
- Provider disabled
- account disabled
- workflow / publication cancelled

性質:

- default-safe
- checked immediately before network execution
- audited enable / disable
- disable に credential 不要
- dry-run は real publishing disabled 中も利用可としうる

---

## 9. Provider boundary

| Item | Value |
| ---- | ----- |
| Count | **1** |
| Recommended Provider | **X** with Entry Conditions |
| Status | **Conditional Recommendation** — **Not Authorized** for Real Provider |
| Instagram | Historical Initial Recommendation / Current Branch A **NOT FIT** |
| Threads | **Deferred** / CONDITIONAL FIT |
| URL-bearing Posts | **Prohibited** in initial MVP unless separately approved |
| Catalog Real / SNS provider registration | **Not authorized** by this boundary |
| Endpoints Approved | **No** |

See [PRODUCT_PROVIDER_SELECTION.md](./PRODUCT_PROVIDER_SELECTION.md). Recommendation does **not** authorize Implementation, External IO, credentials, or endpoint approval.

---

## 10. External IO boundary

| Item | Value |
| ---- | ----- |
| Current posture | **Prohibited** |
| Default | **Disabled** |
| Future allow（separate authorization only） | Selected Provider official endpoints; auth; text post; result retrieve; minimal rate-limit/health metadata |
| Remain prohibited | Arbitrary HTTP; unregistered hosts; multi-Provider; media upload; scrape; auto-publish; silent unaudited retry |

---

## 11. Success criteria

MVP は次をすべて満たしたとき「初回製品として成功」とみなす（実装・認可は後続マイルストーン）:

1. Human-approved text publication path exists for **one** Provider
2. Dry-run proven with **no** network side effects
3. Idempotency and duplicate prevention proven
4. Audit covers approval and publish lifecycle
5. Retry ceiling and kill switch proven
6. Secrets never appear in git / logs / reports / audit payloads
7. Automatic publishing remains impossible by design
8. Image / video / multi-Provider remain excluded
9. Real Provider remains default-disabled until explicit enablement
10. Operator can observe Failed / Quarantined / kill-switch state
11. Rollback / disable procedure documented
12. No false Production Ready / Level 4 / global readiness declaration

---

## 12. Governance notes

- This boundary does **not** authorize implementation of Real Provider or External IO
- This boundary does **not** change Catalog or add Quality tests by itself
- Record / Derived / Quality identity follow [ADR-0023](../adr/ADR-0023-repository-baseline-inventory-authority.md)（Record → Derived only）
- Productization Entry authority: [ADR-0024](../adr/ADR-0024-bounded-productization-entry.md)

---

## Document Control

| Field | Value |
| ----- | ----- |
| Status | **Accepted as MVP boundary** for v1.87.0 Entry |
| First product version candidate | `v1.88.0`（MINOR）unless Major required later |
| Mutation | Requires ADR-0024-aligned governance update |
