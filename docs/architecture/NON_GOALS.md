# Non Goals

v1.49.0 時点での **明示的非目標（Non-Goals）** — **現時点の実装禁止対象** です。

> **Current Phase（v1.86.5 released / v1.86.6 Implementation）:** v1.86.4 released-state reconciliation **Released**（`v1.86.5` @ `4a53c610…`）— Repository Baseline Identity Reconciliation lineage preserved（`v1.86.1`）— Repository Baseline Inventory Authority lineage preserved（`v1.86.0`）— corrective **v1.86.6** v1.86.5 released-state reconciliation — **Implementation** / **Not Declared**（Commit / Tag / Push **Pending**）— `image-generation-mock-provider` Catalog Registration **Registered**（v1.84.0 lineage）— Catalog Registered **YES** — bounded text Mock Formal Decision **READY** preserved — Image Review Entry **NO** — Image Formally Assessed **NO** — Production Ready **Not Declared**（global）。Real Provider / external IO は **禁止維持**。**v1.87.0** Production Readiness Assessment **not started**。

> **境界:** 将来どう実装するかの **設計構想** は [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) を参照してください。Non-Goals = 今すぐ作ってはいけないもの、Future Architecture = 将来 Epic で検討する構想。

> **Evidence:** [ADR-0013](../adr/ADR-0013-provider-non-goals-release-decision.md) + [PROVIDER_NON_GOALS_RELEASE_REVIEW.md](./PROVIDER_NON_GOALS_RELEASE_REVIEW.md)

---

## Provider

v1.70.0（[ADR-0013](../adr/ADR-0013-provider-non-goals-release-decision.md)）により、Provider 節は **Mock Provider** と **Real Provider** を区別する。

### Mock Provider

- Broad Non-Goal から **部分的に解除** — ADR-0013（v1.70.0）G-25 gate のみ
- **Provider Level 4 Implementation Ready** — **Declared**（domain-specific — v1.71.0 ADR-0014）
- **Provider Public Contract Catalog Extension** — **Complete**（v1.72.0 ADR-0015）
- **Mock Provider Production Implementation Authorized** — v1.73.0 [ADR-0016](../adr/ADR-0016-mock-provider-production-implementation-authorization.md)
- **Mock Provider Production Implementation Implemented** — v1.74.0 `src/lib/mock_provider.js`（`text_generation` query only）
- **Mock Provider Catalog Registration Governance Complete** — v1.75.0 [ADR-0017](../adr/ADR-0017-mock-provider-catalog-registration-governance.md)
- **Mock Provider Catalog Registration Registered** — v1.76.0 ADR-0017 G5 implementation; `text-generation-mock-provider` in catalog
- **Provider Production Readiness Assessment Complete** — v1.78.0 Formal Decision **READY**（bounded canonical Mock Provider scope）
- **Provider Expansion Entry Governance Established** — v1.79.0 ADR-0019
- **image-generation-mock-provider Implementation Implemented** — v1.82.0 `src/lib/image_generation_mock_provider.js`
- **image-generation-mock-provider Catalog Registration Governance Complete** — v1.83.0 [ADR-0022](../adr/ADR-0022-image-generation-mock-provider-catalog-registration-governance.md)
- **image-generation-mock-provider Catalog Registration Registered** — v1.84.0 ADR-0022 G12 implementation; `image-generation-mock-provider` in catalog
- Mock default 方針は ADR-0010 を維持
- Application Layer mock functions（`generateMockAIIdeas` 等）は **Provider Layer Mock Provider ではない**

### Real Provider

- **Real Provider external IO**（外部 LLM / Image / Metrics Provider の **実接続**）は **Non-Goal のまま禁止**
- Feature flag による Real Provider も **禁止**
- OAuth / SNS API / External API 経由の接続は引き続き禁止

---

## OAuth

認証トークン交換、OAuth flow、access token 管理は Non-Goal。Future Adapter Layer で設計のみ。

---

## Scheduler

timed execution、cron、定期投稿スケジュールは Non-Goal。

---

## Queue

メッセージ queue、job queue、非同期 dispatch queue は Non-Goal。

---

## Worker

background worker、long-running worker process は Non-Goal。

---

## Cache

distributed cache、response cache layer（Governance 外の新規 cache foundation）は Non-Goal。

---

## Database

persistent store、RDBMS、document store による Foundation state 保存は Non-Goal。JSON file artifact のみ。

---

## Metrics Collection

Real SNS metrics（impressions / engagement / follower growth 等）の収集は Non-Goal。pre-publish Analytics / CI MVP のみ Completed。

---

## External API

Instagram / X / Facebook / Threads 等の External API 直接接続は Non-Goal。

---

## SNS API

SNS API upload / publish / delete の実装は Non-Goal。

---

## Runtime

Application Layer 向け Cloud Runtime / execution engine の実装は Non-Goal。Design Only（[FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md)）。

---

## Cloud

Application 向け Cloud デプロイ基盤、secret store、cloud-native orchestration の実装は Non-Goal。

---

## Governance Exception

Non-Goal 項目の **設計文書化**（FUTURE_ARCHITECTURE / EXTENSION_GUIDE）は許可されます。**コード実装** は許可されません。

Non-Goal 違反の PR は merge 不可とします。Quality Pipeline Non-scope テストで継続検証します。
