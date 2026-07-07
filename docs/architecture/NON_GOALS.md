# Non Goals

v1.49.0 時点での **明示的非目標（Non-Goals）** — **現時点の実装禁止対象** です。

> **Current Phase（v1.70.0）:** Provider Non-Goals Release Decision Governance Complete — **Provider Production Implementation Not Started**。以下の **禁止領域は引き続き実装禁止** です。Mock Provider の broad Non-Goal **部分解除** は将来 Provider Level 4 gate のみ — **本 Release では実装着手を許可しない**。

> **境界:** 将来どう実装するかの **設計構想** は [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) を参照してください。Non-Goals = 今すぐ作ってはいけないもの、Future Architecture = 将来 Epic で検討する構想。

> **Evidence:** [ADR-0013](../adr/ADR-0013-provider-non-goals-release-decision.md) + [PROVIDER_NON_GOALS_RELEASE_REVIEW.md](./PROVIDER_NON_GOALS_RELEASE_REVIEW.md)

---

## Provider

v1.70.0（[ADR-0013](../adr/ADR-0013-provider-non-goals-release-decision.md)）により、Provider 節は **Mock Provider** と **Real Provider** を区別する。

### Mock Provider

- Broad Non-Goal から **部分的に解除** — **Provider Level 4 Implementation Ready Decision 前** の将来 gate のみ
- **Mock Provider Production Implementation Not Started** — 別途 **Provider Level 4 Implementation Ready Decision** が必要
- Mock default 方針は ADR-0010 を維持
- **本 Release（v1.70.0）では実装着手を許可しない**

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
