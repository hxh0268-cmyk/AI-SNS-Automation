# Quality Governance

Quality Pipeline と Architecture Governance の **位置づけ** を定義する基準書です。PASS 数の増加だけでは Architecture 品質を保証できないことを明文化し、Machine Check と Human / Governance Check を分離します。

> **関連:** 運用確認は [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md)、変更判断は [CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) を正とします。

---

## PASS Count Is Not Sufficient Quality Proof

**Quality Pipeline の PASS 数は、Architecture 品質の十分条件ではありません。**

- Quality Pipeline の **PASS 数は、Architecture 品質の十分条件ではありません。**
- `812 PASS` のような大きな数値は **自動検証が通過した件数** を示すだけです（v1.70.0 時点 — governance consistency tests を含む）
- テスト未カバーの設計判断・Layer 違反・Governance drift は PASS 数からは読み取れません
- release 可否は **Quality Pipeline 全 PASS + Governance Review** の両方が必要です

---

## PASS Count Meaning

**PASS 数 = 自動検証範囲（Machine Check）の通過数** です。

| 区分 | 内容 |
|------|------|
| Quality Pipeline | `scripts/test_quality_pipeline.sh` — schema / file / link / non-scope 等 |
| 対象外 | 設計の妥当性、Future Epic の承認、ビジネス判断、未テストの edge case |

テスト追加は品質向上に寄与しますが、PASS 数そのものを KPI にしてはいけません。

---

## Architecture Quality Requires Governance Review

Architecture 品質は、Quality Pipeline と **以下の Governance Review をセット** で判断します。

| # | 確認領域 | 参照文書 |
|---|----------|----------|
| 1 | Layer Rule | [LAYER_MODEL.md](./LAYER_MODEL.md) / [LAYER_INVARIANTS.md](./LAYER_INVARIANTS.md) |
| 2 | Dependency Rule | [DEPENDENCY_RULES.md](./DEPENDENCY_RULES.md) |
| 3 | Public Contract Policy | [PUBLIC_CONTRACT_POLICY.md](./PUBLIC_CONTRACT_POLICY.md) |
| 4 | Compatibility Policy | [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md) |
| 5 | Versioning Policy | [VERSIONING_POLICY.md](./VERSIONING_POLICY.md) |
| 6 | Deprecation Policy | [DEPRECATION_POLICY.md](./DEPRECATION_POLICY.md) |
| 7 | Change Governance | [CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) |
| 8 | Risk Register | [RISK_REGISTER.md](./RISK_REGISTER.md) |
| 9 | ADR | [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) |
| 10 | Architecture Compliance Checklist | [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md) |

---

## Machine Check vs Governance Check

| 種別 | 担当 | 例 |
|------|------|-----|
| **Machine Check** | Quality Pipeline | ファイル存在、schema 定数、grep non-scope、backward compat script |
| **Human / Governance Check** | Architecture Compliance Checklist + Mandatory Policy Review | Layer 境界、Contract 影響、Future 設計と Non-Goals の整合 |

Quality Pipeline が PASS でも Compliance Checklist 未完了の変更は merge 不可とします。

---

## Future Layer And Future Architecture

**Future Architecture / Future Layer** に進む場合（設計追記または v2 実装 Epic）は、**PASS 数だけでは判断しません。**

必須:

1. Quality Pipeline 全 PASS
2. [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md) の該当節（Future Architecture Addition / Provider Runtime Scheduler API Pre Addition）を **すべて** 確認
3. [NON_GOALS.md](./NON_GOALS.md) 非該当または Governance Review による明示承認
4. [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) — Design Only 境界の維持

---

## PASS Count Update Procedure

PASS 数（テスト件数）を更新する場合は、以下の **整合** を確認します。

| 成果物 | 確認内容 |
|--------|----------|
| `scripts/test_quality_pipeline.sh` | テスト追加・番号連続・`All quality pipeline tests passed` |
| [docs/VERSION.md](../VERSION.md) | Quality Pipeline Tests PASS 数 |
| [docs/CHANGELOG.md](../CHANGELOG.md) | テスト範囲と PASS 数 |
| [README.md](../../README.md) | release 関連の品質表記（該当時） |
| 本書 | Machine Check / Governance Check の分離が維持されているか |

PASS 数を増やしただけで Architecture 品質が自動的に向上したと記述してはいけません。

---

## Release Gate Summary

```text
Release 可否 =
  Quality Pipeline 全 PASS（Machine Check）
  AND Architecture Compliance Checklist 完了（Governance Check）
  AND Mandatory Policy Review（CHANGE_GOVERNANCE）
  AND VERSION / CHANGELOG 整合
```

Human Approval Gate: git commit / tag / push は自動化しません。

---

## Relationship to Architecture Maturity Model

- [ARCHITECTURE_MATURITY_MODEL.md](./ARCHITECTURE_MATURITY_MODEL.md) が **成熟度 Level** を定義する
- 本書（Quality Governance）は Level 2 Evidence の一部である
- **PASS 数は Maturity Level を直接上げない**
- Level 4（Implementation Ready）以上には Compliance Checklist + Future Entry Criteria Gate が必要
