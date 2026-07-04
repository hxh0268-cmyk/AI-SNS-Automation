# Dependency Rules

Foundation 間依存、Layer Rule、Compatibility Matrix の考え方を定義する Architecture Governance 基準書です。

---

## Foundation Dependencies

Application Layer Foundation 間の **唯一許可される依存** は upstream Public Contract です。

| Downstream | Upstream Public Contract |
|------------|--------------------------|
| Content Generation | `extractAIIdeaPublicContract` |
| Image Generation | `extractContentGenerationPublicContract` |
| Publishing | `extractImageGenerationPublicContract` |
| Analytics | `extractPublishingPublicContract` |
| Continuous Improvement | `extractAnalyticsPublicContract` |

Idea Generation と AI Idea Generation は独立 root です。相互依存はありません。

---

## Dependency Rule

| ID | Rule | Enforcement |
|----|------|-------------|
| public-contract-only | Foundation 依存は upstream `extract*PublicContract()` のみ | required |
| no-internal-import | upstream internal builder / normalizer / private field 禁止 | required |
| no-circular-dependency | 循環依存禁止 | required |
| no-upstream-reverse-dependency | 上流が下流に依存することを禁止 | required |
| matrix-update-required | 依存追加時は Compatibility Matrix を更新 | required |
| catalog-first-reference | 新 Provider / Adapter は Catalog に Contract ID を宣言 | recommended |

Machine Readable な定義は Public Contract Catalog（`dependencyRules`）を正とします。

---

## Layer Rule

| ID | Rule | Scope |
|----|------|-------|
| platform-independent-from-application | Platform は Application に依存しない | platform |
| application-independent-from-platform-internals | Application は Platform Internal に依存しない | application |
| application-independent-from-future-runtime | Application は Future Runtime に依存しない | application |
| future-runtime-public-contract-only | Future は Public Contract のみ参照 | future |
| no-internal-function-dependency | 内部関数依存禁止 | all |
| no-circular-reference | 循環参照禁止 | all |

詳細は [LAYER_MODEL.md](./LAYER_MODEL.md) と [LAYER_INVARIANTS.md](./LAYER_INVARIANTS.md) を参照してください。

---

## Compatibility Matrix

Compatibility Matrix は Application Layer Foundation 間の **Public Contract 依存エッジ** の一覧です。

### 考え方

- **行:** downstream Foundation（依存する側）
- **列:** upstream Public Contract（依存される公開面）
- **dependencyType:** 常に `public-contract`
- **cyclic:** 常に `false`

### 更新タイミング

- 新 Foundation 追加時（必須）
- upstream Public Contract 変更時（Minor 以上）
- Foundation 削除候補登録時（Deprecation 連動）

### 生成方法

```bash
npm run public-contract:catalog
```

出力 JSON の `compatibilityMatrix` を Compatibility 判断の Source として使用します。Markdown View は人間レビュー用です。

### 判断フロー

1. 新 Foundation の upstream を 1 つ特定（または root）
2. Matrix に edge を追加
3. Quality Pipeline に Public Contract only テストを追加
4. [EXTENSION_CHECKLIST.md](./EXTENSION_CHECKLIST.md) を完了
5. [CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) に従い Version を決定
