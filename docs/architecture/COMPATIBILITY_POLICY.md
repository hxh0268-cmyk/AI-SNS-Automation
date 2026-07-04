# Compatibility Policy

Compatibility Matrix、互換性判断、変更時ルール、Major / Minor 判定を定義する Architecture Governance 基準書です。

---

## Compatibility Matrix

Compatibility Matrix は `public-contract-catalog.json` の `compatibilityMatrix[]` です。

各エントリ:

| Field | 意味 |
|-------|------|
| downstreamFoundationId | 依存する Foundation |
| upstreamPublicContract | 参照する extract 関数 |
| dependencyType | `public-contract` 固定 |
| cyclic | `false` 固定 |

Matrix は Application Layer の DAG を表します。Platform Layer 依存は Matrix 外（Layer Rule で分離）です。

---

## Compatibility Decision

互換性 **あり（Compatible）** と判断する条件:

- downstream が upstream Public Contract の Active field のみを使用
- upstream Minor 変更が additive only
- extract 関数 signature / 関数名が不変
- Quality Pipeline の Public Contract tests が PASS

互換性 **なし（Breaking）** と判断する条件:

- 必須 field 削除・改名・型変更
- extract 関数削除・出力 shape 変更
- cyclic dependency 発生
- downstream が internal surface に依存

---

## Change Rules

| 変更 | Matrix 更新 | Version | Deprecation |
|------|--------------|---------|-------------|
| 新 Foundation 追加 | edge 追加 | Minor | 不要 |
| upstream optional field 追加 | 不要 | Minor | 不要 |
| upstream 必須 field 追加 | 要 review | Minor | Warning 検討 |
| upstream field 削除 | edge 見直し | Major | 必須 |
| Foundation 削除 | edge 削除 | Major | 必須 |

---

## Major Change Criteria

以下のいずれかに該当する場合 **Major** 変更:

- Public Contract から field / function を削除
- 必須 field の semantic 変更（例: recommendation enum 変更）
- schema 文字列の非 additive 置換
- Compatibility Matrix の breaking edge 変更
- Layer Boundary 変更

Major 変更前に [DEPRECATION_POLICY.md](./DEPRECATION_POLICY.md) の全段階を完了すること。

---

## Minor Change Criteria

以下に該当し、Major 条件に該当しない場合 **Minor** 変更:

- Public Contract への optional field / summary count 追加
- 新 Foundation 追加（新 extract 関数）
- Catalog / Governance docs 追加
- 内部 refactor（extract 出力不変）

Minor 変更でも Quality Pipeline テスト追加は必須です。
