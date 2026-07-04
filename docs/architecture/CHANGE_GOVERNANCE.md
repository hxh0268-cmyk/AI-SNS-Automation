# Change Governance

変更時の判断基準、Foundation / Layer / Contract / Version 変更条件を定義する Architecture Governance 基準書です。

---

## Change Criteria

すべての変更は以下の順で判断します。

1. **Non-Goal 確認** — [NON_GOALS.md](./NON_GOALS.md) に該当しないか
2. **Layer Invariant 確認** — [LAYER_INVARIANTS.md](./LAYER_INVARIANTS.md) 違反がないか
3. **Public Contract 影響** — Patch / Minor / Major（[VERSIONING_POLICY.md](./VERSIONING_POLICY.md)）
4. **Compatibility 影響** — Matrix 更新要否（[COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md)）
5. **Test 追加** — Quality Pipeline 更新
6. **Documentation 更新** — CHANGELOG / VERSION / Governance docs

Human Approval Gate: git commit / tag / push は自動化しません（Developer Automation 原則）。

---

## Mandatory Policy Review

**すべての変更判断**（Patch / Minor / Major、Foundation 追加、Contract 変更、Governance 更新を含む）では、merge 前に **必ず** 以下を確認します。

| # | 確認対象 | 参照文書 |
|---|----------|----------|
| 1 | Layer Rule | [LAYER_MODEL.md](./LAYER_MODEL.md) + [LAYER_INVARIANTS.md](./LAYER_INVARIANTS.md) + [DEPENDENCY_RULES.md](./DEPENDENCY_RULES.md) |
| 2 | Dependency Rule | [DEPENDENCY_RULES.md](./DEPENDENCY_RULES.md) |
| 3 | Public Contract Policy | [PUBLIC_CONTRACT_POLICY.md](./PUBLIC_CONTRACT_POLICY.md) |
| 4 | Compatibility Policy | [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md) |
| 5 | Versioning Policy | [VERSIONING_POLICY.md](./VERSIONING_POLICY.md) |
| 6 | Deprecation Policy | [DEPRECATION_POLICY.md](./DEPRECATION_POLICY.md) |
| 7 | Risk Register | [RISK_REGISTER.md](./RISK_REGISTER.md) |

変更が Public Contract / Compatibility / Foundation 依存に触れる場合は、**Public Contract Catalog**（[CATALOG_USAGE.md](./CATALOG_USAGE.md)）を変更判断の **最初の入口** として参照し、`compatibilityMatrix` と `publicContracts[]` の整合を確認してから上表 1–7 を完了します。

---

## Foundation Addition Criteria

新 Application Layer Foundation を追加する条件（**v1.47.0 完了後は原則禁止**。Future Layer 向けに将来適用）:

| # | 条件 |
|---|------|
| 1 | upstream Public Contract が Active |
| 2 | 単一 upstream のみ（root 除く） |
| 3 | `extract*PublicContract()` を定義 |
| 4 | JSON / Markdown / CLI Summary パターン遵守 |
| 5 | Compatibility Matrix edge 追加 |
| 6 | Public Contract only テスト追加 |
| 7 | [EXTENSION_CHECKLIST.md](./EXTENSION_CHECKLIST.md) 完了 |
| 8 | Catalog 再生成 |
| 9 | Minor version bump |

Platform Layer への新 Foundation 追加は **禁止**（Completed v1.40.0）。

---

## Layer Change Criteria

Layer Boundary 変更は **Major** 変更として扱います。

| 変更 | 許可 |
|------|------|
| Platform ↔ Application 依存追加 | 禁止 |
| Future Layer 実装開始 | 別 Epic。Governance review 必須 |
| Governance Layer 文書追加 | Minor（v1.49.0 型） |
| Layer 統合 / 分割 | Major + ADR 必須 |

---

## Contract Change Criteria

| 変更 | Version | Deprecation | Tests |
|------|---------|-------------|-------|
| optional field 追加 | Minor | 不要 | 追加 |
| 必須 field 追加 | Minor | Warning 検討 | 追加 |
| field 削除 | Major | 必須 | 更新 |
| extract 改名 | Major | 必須 | 更新 |

Contract 変更は Catalog `publicContracts[]` と同期必須。

---

## Version Change Criteria

| 成果物 | 更新タイミング |
|--------|---------------|
| docs/VERSION.md | 毎 release |
| docs/CHANGELOG.md | 毎 release |
| Test 98（current version） | 毎 release |
| git tag | Human approval 後 |
| catalogVersion | Catalog schema 変更時のみ |

Version 変更は Quality Pipeline 全 PASS を gate とします。

---

## Governance Review Checklist

- [ ] **Mandatory Policy Review**（Layer / Dependency / Public Contract / Compatibility / Versioning / Deprecation / Risk Register）
- [ ] Public Contract Catalog 整合（該当時 — 変更判断の入口）
- [ ] NON_GOALS 非該当
- [ ] Layer Invariants 遵守
- [ ] Public Contract 影響評価
- [ ] Compatibility Matrix 整合
- [ ] Deprecation 段階（該当時）
- [ ] Quality Pipeline PASS
- [ ] Architecture docs 更新
