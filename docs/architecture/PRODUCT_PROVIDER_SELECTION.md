# Product Provider Selection Record

**Document type:** Productization governance record（Bounded Productization Entry）  
**Lifecycle:** v1.87.0 Bounded Productization Entry  
**Authority:** Planning / selection record only — **not** Real Provider authorization, External IO authorization, Production Ready declaration, or Catalog registration  

---

## 1. Purpose

この文書は、Bounded Text Publishing MVP における **最初の1 Provider** 選定根拠を、Planning Final Report から独立した恒久的なガバナンス記録として固定する。

目的:

- Provider 選定根拠を単独で追跡可能にする
- 将来の再評価・比較を容易にする
- Final Report への依存をなくす
- Productization Governance を強化する

この文書は **推奨（Recommended）** を記録する。実装許可・ネットワーク許可・Production Ready 宣言を行わない。

---

## 2. Scope

### In scope

- First bounded product の **単一 Provider** 候補比較
- Repository 内 evidence に基づく適合性評価
- Deferred Provider の明示
- Re-evaluation trigger の定義

### Out of scope

- Real Provider 実装 / Adapter 実装
- External IO / 実 API 呼び出し
- Credential 追加・保存
- Catalog `providerContracts[]` 変更
- Quality Test 追加
- 複数 Provider 同時運用設計
- Image / video 投稿 Provider 選定
- Automatic SNS Publishing 認可

評価は **repository-internal evidence** に限定する。外部 API 調査・ネットワーク通信は行わない。

---

## 3. Decision Summary

| Field | Value |
| ----- | ----- |
| **Decision** | **Instagram** |
| **Status** | **Recommended for first bounded product** |
| **Product form** | Bounded Text Publishing MVP |
| **Provider count** | **1** only |
| **Content** | Text-only |
| **Authorization state** | **Not Authorized** for Real Provider / External IO |
| **Record date** | v1.87.0 Productization Governance（Provider Selection Record） |

**Instagram** は最初の bounded product の推奨 Provider である。  
この Decision は **実装開始・ネットワーク許可・Production Ready を意味しない**。

---

## 4. Evaluation Criteria

統一評価軸:

| # | Criterion |
| - | --------- |
| C1 | Official API availability（repository / design evidence） |
| C2 | Text posting support |
| C3 | Developer onboarding |
| C4 | Authentication complexity |
| C5 | API review requirements |
| C6 | Rate limit clarity |
| C7 | Sandbox / Test support |
| C8 | Posting identity（post ID / response identity） |
| C9 | Idempotency feasibility |
| C10 | Error semantics |
| C11 | Credential management |
| C12 | Existing repository fit |
| C13 | Implementation effort |
| C14 | Operational risk |

**Scoring scale（統一）:**

| Score | Meaning |
| ----- | ------- |
| **Strong** | Repository evidence が明確、または MVP 適合性が高い |
| **Medium** | 部分的 evidence / 追加確認が必要 |
| **Weak** | Repository evidence が薄い、または MVP 初回に不適合 |

---

## 5. Scoring Matrix

対象: **Instagram** / **Threads** / **X**

| Criterion | Instagram | Threads | X |
| --------- | --------- | ------- | - |
| C1 Official API availability | Strong | Medium | Medium |
| C2 Text posting support | Strong | Medium | Medium |
| C3 Developer onboarding | Medium | Weak | Weak |
| C4 Authentication complexity | Medium | Medium | Medium |
| C5 API review requirements | Medium | Weak | Weak |
| C6 Rate limit clarity | Medium | Weak | Weak |
| C7 Sandbox / Test support | Medium | Weak | Weak |
| C8 Posting identity | Strong | Medium | Medium |
| C9 Idempotency feasibility | Strong | Medium | Medium |
| C10 Error semantics | Medium | Weak | Weak |
| C11 Credential management | Medium | Medium | Medium |
| C12 Existing repository fit | **Strong** | Weak | Weak |
| C13 Implementation effort | Strong | Weak | Weak |
| C14 Operational risk | Medium | Medium | Medium |

### Aggregate

| Provider | Strong | Medium | Weak | Verdict |
| -------- | ------ | ------ | ---- | ------- |
| **Instagram** | 6 | 8 | 0 | **Selected（Recommended）** |
| Threads | 0 | 7 | 7 | Deferred |
| X | 0 | 7 | 7 | Deferred |

**Primary discriminator:** C12 Existing repository fit / C13 Implementation effort — Instagram のみが Application Publishing Foundation と直接整合する。

---

## 6. Selection Rationale

### Why Instagram

1. **Repository fit（決定的）**  
   - `src/lib/publishing.js` は `PUBLISHING_PLATFORM = "instagram"` を固定  
   - `publishing/1.0` Public Contract は platform `instagram` を要求  
   - `src/export_instagram_package.js` / `npm run export-instagram` が手動パッケージ経路として存在  

2. **既存 Publishing 構造**  
   - Application Foundation 連鎖が **publishing（Instagram draft packages）** で閉じている  
   - MVP の「1 Provider / text-first」境界を、既存 draft 経路の延長として定義しやすい  

3. **MVP 適合性**  
   - 初回製品は **text-only / human approval / dry-run / idempotency** を必須とする  
   - Instagram を単一対象に固定することで、allowlist・credential・audit・kill switch の境界を狭く保てる  

4. **比較結果**  
   - Threads / X は `.env.example` 上の token/key プレースホルダはあるが、Foundation / contract / export 経路の固定結合がない  

### What this Decision does **not** do

- Instagram Real Provider を許可しない  
- Instagram External IO を許可しない  
- Catalog に `sns-provider` / Real Provider を登録しない  
- Automatic SNS Publishing を許可しない  
- Bounded / Global Production Ready を宣言しない  

---

## 7. Deferred Providers

| Provider | Status | Reason |
| -------- | ------ | ------ |
| **Threads** | Deferred | Repository Foundation / Publishing Contract 未結合; env placeholder のみ |
| **X** | Deferred | Repository Foundation / Publishing Contract 未結合; env placeholder のみ |
| **Other SNS Providers** | Deferred | MVP Non-Goal（multiple Providers） |
| **Image / video first Provider** | Deferred | MVP Non-Goal（text-only）; Image Review Entry **Not Authorized** |

Deferred Provider の再評価は §8 の trigger でのみ行う。継続的な複数 Provider 比較は行わない。

---

## 8. Re-evaluation Trigger

次のいずれかが発生した場合に限り、本 Record を再評価する:

| Trigger | Action |
| ------- | ------ |
| Selected Provider API / terms の重大変更 | Re-score C1–C11; Decision 再確認 |
| Repository Capability 変更（Publishing Foundation の platform 固定解除等） | Re-score C12–C13 |
| Bounded Text Publishing MVP 完了 | Post-MVP multi-Provider 計画を別 Record / ADR で開始可能 |
| 複数 Provider 対応の正式開始（Non-Goals / ADR 認可後） | New selection cycle; 本 Record は historical |
| Instagram が MVP 必須条件を満たせないと判明 | Fallback 比較を **bounded research subphase** として再開 |

Trigger なしの日常的な再比較は **禁止**（scope creep 防止）。

---

## 9. Non-goals

この文書 / この Decision は次を行わない:

- 複数 Provider 比較の継続運用
- Real Provider authorization
- External IO authorization
- Automatic SNS Publishing authorization
- Production Ready / Bounded Production Ready 宣言
- Repository-wide Level 4 宣言
- Catalog 変更
- Quality Test 追加
- Credential 実体の作成・保存
- Network call / SDK 追加
- Provider Adapter 実装

---

## 10. Governance References

| Document | Role |
| -------- | ---- |
| [ADR-0023](../adr/ADR-0023-repository-baseline-inventory-authority.md) | Baseline Inventory / Record authority; reverse sync **Prohibited** |
| [VERSIONING_POLICY.md](./VERSIONING_POLICY.md) | SemVer rules; does **not** authorize Real Provider / External IO / automatic publishing |
| [BASELINE_SYNCHRONIZATION.md](./BASELINE_SYNCHRONIZATION.md) | Current Baseline Record / Synchronization Matrix SSOT |
| [PROVIDER_PRODUCTION_READINESS_REVIEW.md](./PROVIDER_PRODUCTION_READINESS_REVIEW.md) | Readiness review model; Real Provider / External IO / automatic SNS **Prohibited**; Production Ready **Not Declared** |
| [PROVIDER_LAYER_DESIGN.md](./PROVIDER_LAYER_DESIGN.md) | Provider capability design（includes future `sns_publish` — Design Only） |
| [NON_GOALS.md](./NON_GOALS.md) | Current implementation prohibitions（Real SNS API / External IO） |
| [PROVIDER_EXPANSION_ENTRY_REVIEW.md](./PROVIDER_EXPANSION_ENTRY_REVIEW.md) | Expansion taxonomy / entry criteria |

---

## Document Control

| Field | Value |
| ----- | ----- |
| Status | **Accepted as selection record**（Recommended — not Authorized） |
| Supersedes | Planning Final Report §Provider Selection Assessment（narrative only） |
| Next related phase | Productization Governance remainder / Security·IO boundary / Approval workflow（separate authorizations） |
| Mutation of this Decision | Requires re-evaluation under §8 + explicit governance update |
