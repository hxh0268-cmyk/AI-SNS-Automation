# Catalog Usage

Public Contract Catalog の使い方、JSON / Markdown / CLI、利用ルールを定義する Architecture Governance 基準書です。

---

## Public Contract Catalog

Public Contract Catalog（v1.48.0）は Application Layer Foundation 群の **Machine Readable な Governance Source** です。

| 項目 | 値 |
|------|-----|
| schema | `public-contract-catalog/1.0` |
| generator | `src/lib/public_contract_catalog.js` |
| CLI | `npm run public-contract:catalog` |

Catalog は Foundation 実装を置き換えません。Contract 一覧・Dependency Rule・Compatibility Matrix の **正** です。

---

## JSON Source

**正（Source of Truth）:**

```
reports/public-contract-catalog/latest/public-contract-catalog.json
```

含まれる主要セクション:

- `foundations` — Platform + Application Foundation 一覧
- `publicContracts` — extract 関数と公開フィールド
- `dependencyRules` / `layerRules` / `versionRules` / `deprecationRules`
- `compatibilityMatrix` — Application Layer 依存エッジ
- `extensionWarnings` / `compatibilityNotes`

JSON を手動編集してはなりません。`buildPublicContractCatalog()` の出力を正とします。

---

## Markdown View

**人間レビュー用 View:**

```
reports/public-contract-catalog/latest/public-contract-catalog.md
```

Markdown は JSON から生成される View です。Markdown のみを更新して JSON と乖離させてはなりません。

---

## CLI Summary

```bash
npm run public-contract:catalog
```

CLI 出力例:

```text
Public Contract Catalog Summary
Catalog Version: 1.0
Application Foundations: 7
Public Contracts: 7
...
```

CLI Summary は JSON の要約表示です。判断は JSON Source を参照してください。

---

## Usage Rules

| ルール | 説明 |
|--------|------|
| **Catalog First** | 新 Foundation 追加前に Catalog 更新計画を立てる |
| **JSON First** | 互換性判断は JSON の `compatibilityMatrix` を正とする |
| **No Runtime Side Effect** | Catalog 生成は docs 更新とテスト追加のみ。外部 API 非接続 |
| **Sync with Governance Docs** | Architecture Governance 文書と Catalog のルールは一致させる |
| **No Breaking Catalog Change** | v1.48.0 以降、Catalog schema の破壊的変更は Major |

Foundation 追加・Contract 変更時は Catalog 再生成後、[EXTENSION_CHECKLIST.md](./EXTENSION_CHECKLIST.md) を完了してください。
