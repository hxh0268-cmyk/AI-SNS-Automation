# Future Architecture

Provider / Adapter / Runtime / Automation / Cloud Layer と v2 Roadmap を **設計のみ** 記述する Architecture Governance 基準書です。

> **境界:** 本書は **将来設計（Design Only）** を記述します。**現時点で実装・merge してはならない対象** は [NON_GOALS.md](./NON_GOALS.md) を正としてください。Future Architecture = 構想、Non-Goals = 現フェーズの禁止リスト。

**Design Only — 実装禁止。** v1.49.0 時点ではコード・npm script・Quality Pipeline 実装を追加しません。

---

## Provider Layer

**責務:** 外部サービス（LLM / Image / Metrics）への接続を Foundation から分離する。

**設計原則:**

- Application Public Contract を入力
- Provider 出力は Adapter 経由で Foundation JSON shape に変換
- Mock Provider を default とし、Real Provider は flag 切替

**未実装:** v1.41–v1.47 は Mock / rule-based MVP。Provider Layer は v2 候補。

---

## Adapter Layer

**責務:** Provider response ↔ Public Contract shape の変換。

**設計原則:**

- 1 Adapter = 1 external service family
- auth / rate limit / retry は Adapter 内（Foundation 非公開）
- Adapter failure は Foundation JSON に error summary として記録（将来）

**未実装:** Design Only。

---

## Runtime Layer

**責務:** Foundation pipeline の実行オーケストレーション（local / CI / cloud）。

**設計原則:**

- Foundation は pure function のまま維持
- Runtime は JSON artifact 読み書きと CLI invoke のみ
- Developer Automation Workflow（Platform）とは別 Runtime

**未実装:** Design Only。

---

## Automation Layer

**責務:** pre-publish 改善結果に基づく自動アクション（将来: 投稿 draft 更新、review 依頼等）。

**設計原則:**

- Continuous Improvement Public Contract を入力
- 自動投稿・自動再投稿は Explicit Non-Goal（[NON_GOALS.md](./NON_GOALS.md)）
- Human Approval Gate 維持

**未実装:** Design Only。

---

## Cloud Layer

**責務:** Cloud 上での Runtime 配置、secret 管理、artifact 保管。

**設計原則:**

- Foundation / Public Contract は cloud-agnostic
- secret は Cloud Layer のみ
- GitHub Actions（Platform）とは Application Cloud を分離

**未実装:** Design Only。

---

## v2 Roadmap

| Phase | 内容 | 前提 |
|-------|------|------|
| v2.0-design | Provider / Adapter インターフェース定義 | v1.49 Governance 完了 |
| v2.0-mock | Mock Provider 統合 | Catalog 更新 |
| v2.x-real | Real SNS API（Adapter 経由） | OAuth / compliance review |
| v2.x-metrics | Real Metrics Provider | Analytics 拡張（pre-publish 不変） |
| v2.x-runtime | Cloud Runtime | Runtime Layer 実装 |

v2 実装開始条件は [CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) と [EXTENSION_CHECKLIST.md](./EXTENSION_CHECKLIST.md) の Future 版を策定してからとします。

---

## Design Only

本ドキュメントの Layer は **すべて Design Only** です。

- ソースコード追加禁止（v1.49.0）
- npm script 追加禁止
- Quality Pipeline 実装テスト追加禁止（Governance docs テストのみ）
- Public Contract 破壊的変更禁止

実装着手は別バージョンで Governance Review を経て承認された後に限ります。
