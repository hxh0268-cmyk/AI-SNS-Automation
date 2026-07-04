# Versioning Policy

SemVer、Patch / Minor / Major、Version Rule を定義する Architecture Governance 基準書です。

---

## SemVer

AI-SNS-Automation は **Semantic Versioning（SemVer）** に従います。

```text
vMAJOR.MINOR.PATCH
```

| 桁 | 意味 |
|----|------|
| MAJOR | Breaking Public Contract / Layer Boundary 変更 |
| MINOR | Backward compatible Foundation / Contract 追加 |
| PATCH | Bug fix / docs / non-breaking internal refactor |

`docs/VERSION.md` が Current Version の正です。

---

## Patch

**Patch（X.Y.Z+1）** に該当する変更:

- bug fix（extract 出力・JSON shape 不変）
- ドキュメント修正（Governance 文書含む）
- Quality Pipeline テスト追加（既存 Contract 不変）
- internal refactor（Public Contract 不変）

Patch では Catalog の `publicContracts` shape を変更しません。

---

## Minor

**Minor（X.Y+1.0）** に該当する変更:

- 新 Foundation 追加
- Public Contract への additive field 追加
- Public Contract Catalog 拡張（非 breaking）
- Architecture Governance 文書追加（v1.49.0 等）

Minor では既存 extract 関数の **必須** 出力 field を削除しません。

---

## Major

**Major（X+1.0.0）** に該当する変更:

- Public Contract 必須 field 削除・改名
- extract 関数削除・置換
- schema breaking 変更
- Layer Boundary 変更
- Deprecated 完了後の Removal

Major は [DEPRECATION_POLICY.md](./DEPRECATION_POLICY.md) と [CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) に従います。

---

## Version Rules

Catalog `versionRules[]` と同等:

| Type | SemVer | Public Contract Impact |
|------|--------|------------------------|
| patch | X.Y.Z+1 | none |
| minor | X.Y+1.0 | additive-only |
| major | X+1.0.0 | breaking |

Version 判断に迷う場合は **より保守的（Major 寄り）** を選択し、ADR を [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) に記録します。

---

## Release Alignment

| Artifact | Version 参照 |
|----------|-------------|
| git tag | release version |
| docs/VERSION.md | current + history |
| public-contract-catalog.json | catalogVersion（Catalog schema 版） |
| Foundation schema | `{domain}/{major.minor}` 形式 |

Foundation schema version と repo SemVer は別管理です。混同しないこと。
