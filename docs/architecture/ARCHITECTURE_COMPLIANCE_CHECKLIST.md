# Architecture Compliance Checklist

Architecture Governance **適合確認チェックリスト** です。将来の変更時に「読むだけ」で終わらせず、merge / release 前に **実際に確認する運用項目** を固定します。

> **関連:** 変更判断の公式フローは [CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) の **Mandatory Policy Review** を正とします。Foundation 追加の技術詳細は [EXTENSION_CHECKLIST.md](./EXTENSION_CHECKLIST.md) を併用してください。Quality Pipeline PASS 数だけでは品質十分とみなさない — [QUALITY_GOVERNANCE.md](./QUALITY_GOVERNANCE.md) を参照。

---

## Universal Compliance Items

すべての Architecture 関連変更で確認する **共通必須項目**:

- [ ] **Layer Rule 確認** — [LAYER_MODEL.md](./LAYER_MODEL.md) / [LAYER_INVARIANTS.md](./LAYER_INVARIANTS.md) / [DEPENDENCY_RULES.md](./DEPENDENCY_RULES.md)
- [ ] **Dependency Rule 確認** — upstream Public Contract のみ、循環依存なし
- [ ] **Public Contract Policy 確認** — [PUBLIC_CONTRACT_POLICY.md](./PUBLIC_CONTRACT_POLICY.md)
- [ ] **Internal API 漏出なし** — `build*` / `normalize*` / internal score / flags を Public Contract 外に露出していない
- [ ] **Compatibility Policy 確認** — [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md)
- [ ] **Catalog 更新要否確認** — [CATALOG_USAGE.md](./CATALOG_USAGE.md) / `npm run public-contract:catalog`
- [ ] **Versioning Policy 確認** — Patch / Minor / Major 判定（[VERSIONING_POLICY.md](./VERSIONING_POLICY.md)）
- [ ] **Deprecation Policy 確認** — 4 段階を踏んでいるか（[DEPRECATION_POLICY.md](./DEPRECATION_POLICY.md)）
- [ ] **CHANGE_GOVERNANCE 確認** — Mandatory Policy Review 完了
- [ ] **RISK_REGISTER 更新要否確認** — [RISK_REGISTER.md](./RISK_REGISTER.md)
- [ ] **ARCHITECTURE_DECISIONS 更新要否確認** — significant decision 時は ADR 追加
- [ ] **README 更新要否確認** — ルート [README.md](../../README.md) と [docs/architecture/README.md](./README.md)
- [ ] **CHANGELOG 更新要否確認** — [docs/CHANGELOG.md](../CHANGELOG.md)
- [ ] **VERSION 更新要否確認** — [docs/VERSION.md](../VERSION.md) / Test 98
- [ ] **Quality Pipeline 追加・維持確認** — 既存 PASS 維持 + 新規テスト追加（[QUALITY_GOVERNANCE.md](./QUALITY_GOVERNANCE.md): PASS 数は十分条件ではない）
- [ ] **Provider / Runtime / Scheduler / SNS API 等の実装禁止確認** — [NON_GOALS.md](./NON_GOALS.md) 非該当

---

## Foundation Addition

Application Layer Foundation 追加時（Future Epic 向け — v1.47.0 完了後は原則クローズ）:

- [ ] Universal Compliance Items すべて
- [ ] upstream Public Contract が Active
- [ ] 単一 upstream のみ（root 除く）
- [ ] `extract*PublicContract()` 定義
- [ ] JSON = Source / Markdown = View / CLI = Summary
- [ ] Compatibility Matrix edge 追加
- [ ] Public Contract only Quality Pipeline テスト追加
- [ ] [EXTENSION_CHECKLIST.md](./EXTENSION_CHECKLIST.md) 完了
- [ ] Platform Layer 新 Foundation ではない（v1.40.0 Completed）

---

## Public Contract Change

Public Contract field / extract 関数 / schema 変更時:

- [ ] Universal Compliance Items すべて
- [ ] Public Contract Catalog を **変更判断の最初の入口** として参照
- [ ] additive-only（Minor）か breaking（Major）か判定
- [ ] breaking 変更時: Deprecation 4 段階計画
- [ ] downstream Foundation の Public Contract only テストが PASS
- [ ] `publicContracts[]` と Governance 文書の整合

---

## Future Architecture Addition

[FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) への設計追記時:

- [ ] Universal Compliance Items（実装禁止確認を重点）
- [ ] **Design Only** — コード・npm script・runtime 実装を追加していない
- [ ] [NON_GOALS.md](./NON_GOALS.md) と矛盾しない
- [ ] Provider / Runtime / Scheduler / API **実装ファイル** を追加していない
- [ ] ADR または ARCHITECTURE_DECISIONS 更新要否を判断

---

## Provider Runtime Scheduler API Pre Addition

Provider / Adapter / Runtime / Scheduler / External SNS API 実装 **着手前**（v2 Epic 想定）:

- [ ] Universal Compliance Items すべて
- [ ] [EXTENSION_GUIDE.md](./EXTENSION_GUIDE.md) の該当節をレビュー
- [ ] [NON_GOALS.md](./NON_GOALS.md) — 現フェーズでは **実装禁止** でないことを Governance Review で明示承認
- [ ] [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) に設計記述あり
- [ ] ADR 追加（ARCHITECTURE_DECISIONS / docs/adr/）
- [ ] Public Contract 破壊的変更なし（または Major + Deprecation 完了）
- [ ] RISK_REGISTER に新規リスク登録
- [ ] OAuth / token / external API / persistent store / queue / worker **Foundation 内部** への組み込みなし

---

## Release Pre Check

release 候補（commit / tag 前の Human Review 用）:

- [ ] Universal Compliance Items すべて
- [ ] Quality Pipeline **全件 PASS**（Machine Check — 十分条件ではない）
- [ ] [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md) 該当節完了（Governance Check）
- [ ] [QUALITY_GOVERNANCE.md](./QUALITY_GOVERNANCE.md) Release Gate Summary 整合
- [ ] [ARCHITECTURE_MATURITY_MODEL.md](./ARCHITECTURE_MATURITY_MODEL.md) — 変更が Maturity Level 宣言に該当しないこと（または ADR 記録済み）
- [ ] docs/VERSION.md current version 整合（Test 98）
- [ ] docs/CHANGELOG.md エントリあり
- [ ] backward compatibility テスト PASS（直前 Minor の N-1 レイヤー）
- [ ] Public Contract Catalog 再生成（Contract 変更を含む場合）
- [ ] git commit / tag / push は Human Approval（自動化しない）

---

## Backward Compatibility Check

- [ ] 既存 extract 関数の必須出力 field を削除していない
- [ ] 既存 schema 文字列を breaking 置換していない
- [ ] Compatibility Matrix の cyclic=false 維持
- [ ] v(N-1) npm script 出力が validator を PASS
- [ ] Deprecation 段階をスキップした removal がない

---

## Risk Check

- [ ] [RISK_REGISTER.md](./RISK_REGISTER.md) — 該当リスク ID の Mitigation 実施
- [ ] Layer Boundary / Compatibility / Dependency リスク再評価
- [ ] Future Layer premature 実装リスク（AR-003）非該当
- [ ] Catalog と Governance docs の drift リスク（AR-002）確認

---

## ADR Check

- [ ] significant architectural decision がある場合 ADR 追加
- [ ] [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) summary 更新
- [ ] v1.49.0 Primary Decisions（005/006/007）に反しない
- [ ] Review Trigger を記録

---

## Usage Notes

| タイミング | 使用する節 |
|-----------|-----------|
| 通常 PR | Universal Compliance Items |
| Foundation 追加 Epic | Foundation Addition + Universal |
| Contract 変更 | Public Contract Change + Backward Compatibility |
| Future 設計 PR | Future Architecture Addition |
| v2 実装 Epic 開始前 | Provider Runtime Scheduler API Pre Addition |
| release 前 | Release Pre Check + 該当節すべて |

本チェックリストは Governance **運用面** の確認です。Machine Readable な Contract 一覧は Public Contract Catalog JSON を正とします。
