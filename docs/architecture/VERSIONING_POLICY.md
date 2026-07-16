# Versioning Policy

SemVer、Patch / Minor / Major、Version Rule を定義する Architecture Governance 基準書です。

本書は **Rule Document** である。Current Version **value** の権威ではない。

---

## Authority Boundary

本書の権威範囲は次に限定する。

```text
VERSIONING_POLICY.md
        ↓
Versioning Rules only
```

| Item | Status under this document |
|------|----------------------------|
| Semantic Versioning structure | **Rules authority** |
| Patch / Minor / Major increment criteria | **Rules authority** |
| Version transition / formatting rules | **Rules authority** |
| Compatibility and deprecation alignment expectations | **Rules authority**（詳細は関連 Policy） |
| Authoritative Current Version **value** | **Not this document** |
| Authoritative Current Baseline Record | **Not this document** |

Current Version **value** の sole operational authority は **Current Baseline Record** である。階層は [ADR-0023](../adr/ADR-0023-repository-baseline-inventory-authority.md) および [BASELINE_SYNCHRONIZATION.md](./BASELINE_SYNCHRONIZATION.md) に従う。

```text
Repository Baseline Inventory Authority
        ↓
Current Baseline Record
        ↓
Synchronization Matrix
        ↓
Required Derived Targets
```

Supporting roles:

| Artifact | Role |
|----------|------|
| [BASELINE_SYNCHRONIZATION.md](./BASELINE_SYNCHRONIZATION.md) | Inventory Model / Current Baseline Record / Synchronization Matrix SSOT |
| This document（VERSIONING_POLICY.md） | Versioning **rules** only |
| [docs/VERSION.md](../VERSION.md) | Required Derived Target — Current Version **display**, Current Release **summary**, Release **History**（unless reclassified by the Inventory） |
| Git repository state | Validation **evidence** for Record fields — not a Record substitute |
| Quality Pipeline | **Enforcement** of approved hierarchy — not authority |

```text
Rule Document
≠ Current Baseline Record

Versioning Rules Authority
≠ Current Version value authority

docs/VERSION.md（Derived Target）
≠ Current Baseline Authority

Reverse Synchronization
= Prohibited
```

Derived targets must synchronize **from** the Current Baseline Record.
Derived targets must **not** update, infer, or override the Current Baseline Record.

A version **value** transition requires an explicitly authorized Current Baseline Record population or release phase.
Editing this Rule Document does **not** populate the Current Baseline Record and does **not** declare `v1.86.0`.

Preserve the Record-layer distinction:

```text
Schema Definition
≠ Current Recorded Values
≠ Pending Release Values
≠ Derived Evidence
```

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

SemVer 表記規則はルールである。どの文字列が **現在の** Current Version であるかは Current Baseline Record が記録する。

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

Version **value** の変更可否・適用タイミングは、上記ルールに加え、認可済み Current Baseline Record population / release phase に従う。

---

## Release Alignment

| Artifact | Role under Baseline Inventory |
|----------|------------------------------|
| git tag | Release identity **evidence**（validates Record candidates; does not replace the Record） |
| docs/VERSION.md | Derived Target — current **display** + Release **History**（not Current Version value authority） |
| public-contract-catalog.json | catalogVersion（Catalog schema 版） |
| Foundation schema | `{domain}/{major.minor}` 形式 |

Foundation schema version と repo SemVer は別管理です。混同しないこと。

`docs/VERSION.md` の Release History は historical record surface であり、Current Baseline Record を上書きしてはならない。

---

## Non-Goals（this document）

本書は次を行わない。

- Current Baseline Record への値投入
- `v1.86.0` Release Declaration
- Migration 6（VERSION.md derived-target finalization）の代替実行
- Repository-wide Baseline Synchronization
- Production Ready / Real Provider / External IO / automatic SNS publishing の認可
