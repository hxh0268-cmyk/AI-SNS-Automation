# Layer Invariants

Architecture Governance 上 **常に真でなければならない不変条件** です。いずれかに違反する変更は merge 不可とします。

> **関連:** Layer 構造と依存方向は [LAYER_MODEL.md](./LAYER_MODEL.md) を参照してください。本書は不変条件（Must never break）、構造書は Layer 配置と依存グラフ（What / How）を担当します。

---

## Platform Application Separation

- Platform Layer は Application Layer の Foundation / module / output に依存しない
- Application Layer は Platform Layer の Workflow / Timeline / History / Dashboard Internal に依存しない
- 両 Layer は `docs/architecture/` と Public Contract Catalog 経由でのみ関連付けられる

**根拠:** Platform（開発者自動化）と Application（SNS コンテンツ）の関心分離。混在は将来 Provider 追加時の Compatibility 崩壊リスクを招く。

---

## Internal API Prohibition

- 下流は上流の `extract*PublicContract()` 以外の export を import してはならない
- 上流の `build*`, `normalize*`, `validate*`, `write*Artifacts`, pipeline 関数を下流から呼び出してはならない
- 上流 JSON の未公開フィールド（scores / flags / asset 等）を下流が読んではならない

**根拠:** Public Contract First。内部実装変更が下流に波及しないようにする。

---

## Cross Layer Prohibition

- Platform Layer module から Application Layer module への import 禁止
- Application Layer module から Platform Layer internal への import 禁止
- Future Layer 実装（将来）から Foundation internal への import 禁止
- Governance 文書は実行コードを import しない（Catalog generator は静的定義のみ）

**根拠:** Layer Boundary の物理的保証。

---

## Public Contract Only

- Foundation 入力は単一 upstream Public Contract（または root の場合は null contract）
- Foundation 出力は JSON Source + Markdown View + CLI Summary
- 後続 Layer は `extract*PublicContract()` のみ参照可能

**根拠:** v1.41.0–v1.47.0 で確立した Application Layer パターンの恒久化。

---

## Circular Dependency Prohibition

- Foundation dependency graph は DAG（有向非巡回グラフ）であること
- Compatibility Matrix に back-edge を登録しない
- Layer 間の相互参照を import または runtime coupling で作らない

**根拠:** 循環依存は Version / Deprecation / Compatibility 判断を不可能にする。

---

## Invariant Verification

| 手段 | 頻度 |
|------|------|
| Quality Pipeline Public Contract tests | 毎 commit |
| Public Contract Catalog 整合 | 新 Foundation 追加時 |
| Architecture Governance Review | Minor 以上の変更時 |
| EXTENSION_CHECKLIST.md | Foundation 追加 PR 必須 |
