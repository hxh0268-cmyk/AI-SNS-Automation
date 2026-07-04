# Extension Guide

Foundation / Provider / Runtime / Scheduler / API 追加条件を定義する Architecture Governance 基準書です。

---

## Foundation Addition

Application Layer Foundation 追加（将来 Epic 向け）:

1. upstream Public Contract を唯一の入力とする
2. `src/lib/{name}.js` に pure builder + extract + validator を実装
3. `scripts/run_{name}.js` CLI を追加
4. `output/{name}/` または `reports/{name}/latest/` に JSON + Markdown 出力
5. npm script 追加
6. Quality Pipeline テスト追加
7. Catalog + Governance docs 更新

Platform Layer Foundation 追加は **禁止**（v1.40.0 Completed）。

---

## Provider Addition

**現時点: 実装禁止（Design Only）**

将来 Provider Layer 追加時の条件:

- Application Public Contract のみを入力
- Provider 固有 response shape は Adapter 内に閉じ込める
- Catalog に Provider ID と compatible Contract を登録
- Mock Provider から開始（Real API 前に Contract 安定化）
- [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) 参照

---

## Runtime Addition

**現時点: 実装禁止（Design Only）**

将来 Runtime Layer 追加時の条件:

- Foundation JSON Source を読み取り、副作用は Runtime 境界内のみ
- Foundation builder に runtime coupling を入れない
- Public Contract 変更なしで Runtime 差し替え可能であること
- Cloud / Worker 配置は Runtime sub-layer として設計

---

## Scheduler Addition

**現時点: 実装禁止（Design Only）**

将来 Scheduler 追加時の条件:

- Application Layer は Scheduler に依存しない
- Scheduler は Public Contract 出力を入力として timed trigger のみ担当
- cron / queue / worker は Scheduler sub-layer（NON_GOALS 参照）

---

## API Addition

**現時点: 実装禁止（Design Only）**

将来 External SNS API 追加時の条件:

- Adapter Layer 経由のみ。Foundation から直接 API call 禁止
- auth token exchange は Adapter 内。Foundation / Public Contract 非公開
- Real Metrics は Analytics Provider として分離（Application pre-publish Analytics 不変）

---

## Current Non Implementation

v1.49.0 時点で **実装してはならない** もの:

| 項目 | 状態 |
|------|------|
| Provider | Design Only |
| Adapter（Real） | Design Only |
| Runtime | Design Only |
| Scheduler | Design Only |
| SNS API 接続 | Design Only |
| OAuth / token exchange | Design Only |
| Database / persistent store | Design Only |
| Queue / Worker | Design Only |
| Cloud Runtime | Design Only |
| Real Metrics Collection | Design Only |
| Real Automation（自動投稿等） | Design Only |

設計記述は [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) に限定します。
