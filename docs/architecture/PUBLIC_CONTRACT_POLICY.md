# Public Contract Policy

Public Contract の公開対象、内部対象、Backward Compatibility、ライフサイクルを定義する Architecture Governance 基準書です。

---

## Public Surface

Public Contract に **含める** もの:

| 区分 | 内容 |
|------|------|
| metadata | `schema`, `generatedAt` |
| summary | 後続 Layer が判断に必要な集計値のみ |
| collections | 後続 Layer が消費する ID / title / rank / recommendation 等 |
| extract function | `extract*PublicContract()` — 唯一の公開 API |

Public Contract は **additive-friendly** 設計とし、optional field の追加は Minor 変更として許容します。

---

## Internal Surface

Public Contract に **含めない** もの:

| 区分 | 例 |
|------|-----|
| 内部スコア | readinessScore, qualityScore, checklistScore, priorityScore |
| 内部フラグ | flags（Analytics / CI 内部） |
| 内部アセット | asset, checklist, imagePrompt |
| Builder 出力 | normalize 前の raw shape |
| Provider 実装詳細 | mock provider config, API response |

内部 surface への依存は Quality Pipeline の Public Contract only テストで reject します。

---

## Backward Compatibility

| 変更種別 | Public Contract 影響 | Version |
|----------|---------------------|---------|
| 内部 refactor（extract 出力不変） | none | Patch |
| summary への optional field 追加 | additive | Minor |
| collection item への optional field 追加 | additive | Minor |
| 必須 field 削除 / 改名 | breaking | Major |
| extract 関数削除 / 改名 | breaking | Major |
| schema 置換 | breaking | Major |

Backward Compatibility 破壊は [DEPRECATION_POLICY.md](./DEPRECATION_POLICY.md) の段階を経ずに行ってはなりません。

---

## Contract Lifecycle

```text
Draft → Active → Deprecated → Warning → Removal Candidate → Removed
```

| 段階 | 説明 |
|------|------|
| **Draft** | 新 Foundation 開発中。Quality Pipeline 未 PASS |
| **Active** | Catalog 登録済み。後続 Layer が参照可能 |
| **Deprecated** | 代替 Contract あり。後方互換維持 |
| **Warning** | Validator / CLI / docs で警告 |
| **Removal Candidate** | 次 Major で削除予定 |
| **Removed** | Major bump 後に削除 |

Contract Lifecycle の遷移は [CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) と [DEPRECATION_POLICY.md](./DEPRECATION_POLICY.md) に従います。

---

## Catalog 連携

Public Contract の Active 定義は `reports/public-contract-catalog/latest/public-contract-catalog.json` の `publicContracts[]` を正とします。文書と Catalog の不一致は **Governance 違反** として修正します。
