# Layer Model

AI-SNS-Automation の **Layer 構造と依存方向** を定義する Architecture Governance 基準書です。

> **関連:** 破ってはいけない不変条件は [LAYER_INVARIANTS.md](./LAYER_INVARIANTS.md) を参照してください。本書は構造（What）と依存方向（How layers relate）、不変条件書は禁止事項（Must never break）を担当します。

---

## Responsibilities

| Layer | 責務 | 完了状態 |
|-------|------|----------|
| **Platform Layer** | Developer Automation Workflow の実行・履歴・集計・可視化 | Completed（v1.40.0） |
| **Application Layer** | SNS コンテンツ生成パイプライン（pre-publish MVP） | Completed（v1.47.0） |
| **Governance Layer** | Public Contract Catalog と Architecture Documentation | Completed（v1.48.0–v1.49.0） |
| **Future Layer** | Provider / Adapter / Runtime / Automation / Cloud | Design Only |

Platform Layer 内部の Workflow → State → Checkpoint → History → Timeline → Dashboard → Analytics チェーンは、Platform Layer 内の **一方向依存** を維持します（v1.37.1 以前の Layer Model を Platform 内部構造として継承）。

---

## Dependency Direction

```text
Future Layer
    ↓ Public Contract Only
Application Layer
    ✕ (no dependency)
Platform Layer
```

- **下位 → 上位** の依存は禁止
- **Platform → Application** の依存は禁止
- **Application → Platform Internal** の依存は禁止
- **Future → Foundation Internal** の依存は禁止
- **Foundation 間** は upstream `extract*PublicContract()` のみ許可

---

## Layer Boundary

| 境界 | ルール |
|------|--------|
| Platform ↔ Application | 完全分離。共有は Governance 文書と Catalog のみ |
| Application ↔ Future | Future は Public Contract のみ参照 |
| Governance ↔ 全 Layer | 文書化・Catalog 生成。実行時副作用なし |
| Foundation ↔ Foundation | Public Contract エッジのみ（Compatibility Matrix 準拠） |

Layer Boundary を越えた import、内部 builder 呼び出し、private field 参照は **Layer 違反** として禁止します。

---

## Prohibited Dependencies

以下の依存は **すべての Layer で禁止** です。

- 循環参照（Foundation 間・Layer 間）
- 上流 Foundation が下流 Foundation に依存すること
- `build*` / `normalize*` / internal score / internal flags への直接依存
- Timeline / History / Checkpoint / Workflow State への Analytics 派生からの直接参照（Platform 内部ルール）
- Future Provider / Runtime が Application 内部モジュールを import すること

---

## Public Contract Only

Layer 間および Foundation 間のデータ受け渡しは **Public Contract extract 関数** の出力のみを正とします。

| 区分 | 例 |
|------|-----|
| 公開 | `extractPublishingPublicContract()` の `packages[]` |
| 非公開 | `readinessScore`, `flags`, `asset`, `checklist`, internal builder |

Public Contract の追加は Minor、削除・改名は Major として [VERSIONING_POLICY.md](./VERSIONING_POLICY.md) に従います。

---

## Circular Dependency Prohibition

循環参照は Architecture Governance 上 **Critical 違反** です。

- Compatibility Matrix に cyclic edge を追加してはならない
- import graph に cycle が発生した場合、Foundation 追加を revert する
- Catalog の `compatibilityMatrix[].cyclic` は常に `false` であること

循環参照の検出は Code Review と Quality Pipeline の Non-scope / Public Contract テストで継続確認します。
