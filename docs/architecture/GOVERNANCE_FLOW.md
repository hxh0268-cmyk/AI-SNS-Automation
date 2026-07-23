# Governance Flow

Architecture Governance を **静的文書群** から **運用可能な Governance Process** へ接続する公式フロー定義です。変更・設計・レビュー・release の **実行順序** と **必須ゲート** を明文化し、[FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) の Entry Criteria を **運用手順** に変換します。

> **重要（v1.51.0）:** 本書は **Governance Process の設計** です。**Implementation Ready（Level 4）ではありません。** Production Code / Provider / Runtime / Scheduler / OAuth / SNS API / Database / Queue / Worker / Cloud Runtime / Real Metrics / Real Automation の **実装を許可しません。**

---

## Authority Boundary

本書は **Governance Process / Transition Rule Document** である。

Current Version **value** の権威ではない。Current Baseline Record の権威でもない。

```text
Repository Baseline Inventory Authority
        ↓
Current Baseline Record
        ↓
Authorized Governance Transitions（本書が定義する実行順序・ゲート）
        ↓
Synchronization Matrix
        ↓
Required Derived Targets
        ↓
Validation / Evidence（Quality Pipeline / Git / reports）
```

権威関係は [ADR-0023](../adr/ADR-0023-repository-baseline-inventory-authority.md) および [BASELINE_SYNCHRONIZATION.md](./BASELINE_SYNCHRONIZATION.md) に従う。

| Role | Status under this document |
|------|----------------------------|
| Governance Process / Transition Rule Document | **Yes** — lifecycle, gates, review order, release sequencing |
| Current Version **value** authority | **No** — sole operational authority is the **Current Baseline Record** |
| Current Baseline Record | **Not this document** |
| Repository Baseline Inventory Authority | **Not this document** — see [BASELINE_SYNCHRONIZATION.md](./BASELINE_SYNCHRONIZATION.md) |
| Versioning rules authority | **No** — see [VERSIONING_POLICY.md](./VERSIONING_POLICY.md) |
| Required Derived Target for current-baseline values | **No** — [docs/VERSION.md](../VERSION.md) and other derived surfaces remain subordinate to the Record |

```text
Schema Definition / Inventory Model
≠ Current Recorded Values（Current Baseline Record）
≠ Pending / Planning Release Values
≠ Derived Evidence（VERSION display, docs, reports）
≠ Git Evidence（commit / tag / remote refs）
≠ Quality Enforcement
```

Mandatory rules:

1. Current Baseline Record values may change only during an **explicitly authorized** population or release phase.
2. Planning or candidate values are **not** recorded baseline values. Planning Release ≠ Current Release.
3. Editing this Governance Flow document does **not** populate or update the Current Baseline Record.
4. Editing [docs/VERSION.md](../VERSION.md) or other derived documents does **not** populate the Current Baseline Record and does **not** declare a release.
5. Required Derived Targets synchronize **from** the Current Baseline Record only after the appropriate authorization boundary（Synchronization Matrix / authorized sync phase）.
6. Derived targets, Git state, tests, reports, and release history **must not** reverse-sync or override the Current Baseline Record.
7. Quality Pipeline is **enforcement and verification**, not authority. PASS count alone does not authorize Record population or release declaration.
8. Git commits and tags are **evidence and release identity surfaces**, not substitutes for the Current Baseline Record.
9. Migration 7（GOVERNANCE_FLOW Authority Correction）does **not** populate the Current Baseline Record by itself and does **not** execute repository-wide synchronization. Historical note: Migration 7 did not declare `v1.86.0`; `v1.86.0`, `v1.86.1`, `v1.86.2`, `v1.86.3`, `v1.86.4`, `v1.86.5`, `v1.86.6`, `v1.86.7`, `v1.86.8`, `v1.86.9`, and `v1.86.10`, and `v1.86.11` are now **Released**. Pending corrective release is `v1.86.12`（Not Declared）.

```text
Current Baseline Record
        ↓
Required Derived Targets

Reverse synchronization: Prohibited
```

---

## Purpose

- Architecture を **どの順番・どの基準・どのレビュー** で進めるかを定義する
- [CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) の判断基準を **実行フロー** に落とす
- Machine Check（Quality Pipeline）と Governance Check（Compliance Checklist）の **役割分担** をプロセス上固定する
- [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) を **レビュー順序** に変換する
- **Current Maturity Level 3.7** — Architecture Governance Stabilized / Level 4 Entry Review Ready（[ARCHITECTURE_MATURITY_MODEL.md](./ARCHITECTURE_MATURITY_MODEL.md)）
- Level 4 Implementation Ready 到達を **宣言しない**

---

## Scope

- Governance Lifecycle（Change Request → Post Release Review）
- Architecture / Design / ADR / Risk / Compatibility / Public Contract / Compliance 各 Review Flow
- Documentation Update / Architecture Change / Future Layer Approval / Release Governance Flow
- [QUALITY_GOVERNANCE.md](./QUALITY_GOVERNANCE.md) および [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) との統合

本書は **Governance Layer** の Process 定義であり、Platform Layer / Application Layer の Public Contract 実装を変更しません。

---

## Non Goals

- 本書は **実装ロードマップ** ではない
- Provider / Adapter / Runtime / Scheduler / OAuth / SNS API / External API / Database / Queue / Worker / Cloud Runtime / Cache / Real Metrics / Real Automation / Background Job / Message Broker を **実装可能にしない**
- **Production Ready** / **Operational Excellence** を宣言するものではない
- Quality Pipeline **PASS 数だけで** Governance Process 完了とみなさない
- **Level 4 Implementation Ready** 到達を意味しない
- git commit / tag / push の **自動化** を定義しない（Human Approval Gate 維持）
- Current Version **value** / Current Baseline Record を **決定・記録しない**（Authority Boundary 参照）
- Migration 7 による本書更新は **それ自体では release 宣言ではない**（historical: did not declare `v1.86.0`; `v1.86.0`, `v1.86.1`, `v1.86.2`, `v1.86.3`, `v1.86.4`, `v1.86.5`, `v1.86.6`, `v1.86.7`, `v1.86.8`, `v1.86.9`, and `v1.86.10`, and `v1.86.11` are now **Released**; Pending corrective is `v1.86.12`）
- Repository-wide Baseline Synchronization を **実行しない**（別認可フェーズ）
- Derived Target / Git / Quality / Release History からの **reverse synchronization を許可しない**

---

## Governance Lifecycle

すべての Architecture 関連変更は以下の Lifecycle に従います。

```text
1. Change Request          … 変更意図・スコープ・影響 Layer の記録
2. Scope Classification    … Architecture Change Flow で分類
3. Layer Review            … Layer Rule / Invariants / Dependency
4. ADR Review              … 該当時 ADR 起草・Accepted
5. Risk Review             … Risk Register + 観点チェック
6. Compatibility Review    … Backward Compatibility 最優先
7. Public Contract Review  … Catalog 整合・公開境界
8. Compliance Review       … Architecture Compliance Checklist
9. Documentation Update    … README / VERSION / CHANGELOG / architecture docs
10. Quality Pipeline Update … test_quality_pipeline.sh（Machine Check 拡張）
11. Release Decision       … Release Governance Flow
12. Post Release Review    … 後方互換・ドキュメント整合・残リスク確認
```

各ステップは **スキップ禁止**（Scope Classification で「不要」と判定された Review は **明示的 N/A 記録** が必要）。

---

## Architecture Review Flow

Architecture Review は以下の **確認対象文書** を Read + Verify します。

| 確認対象 | 文書 |
|----------|------|
| Layer Rule | [LAYER_MODEL.md](./LAYER_MODEL.md) |
| Layer Invariants | [LAYER_INVARIANTS.md](./LAYER_INVARIANTS.md) |
| Dependency Rule | [DEPENDENCY_RULES.md](./DEPENDENCY_RULES.md) |
| Public Contract Policy | [PUBLIC_CONTRACT_POLICY.md](./PUBLIC_CONTRACT_POLICY.md) |
| Compatibility Policy | [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md) |
| Versioning Policy | [VERSIONING_POLICY.md](./VERSIONING_POLICY.md) |
| Deprecation Policy | [DEPRECATION_POLICY.md](./DEPRECATION_POLICY.md) |
| Compliance Checklist | [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md) |

**手順:**

1. 変更が触れる Layer を特定（Platform / Application / Governance / Future）
2. Layer Invariants 違反がないか確認
3. Dependency 方向（内→外のみ）を確認
4. Mandatory Policy Review（[CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md)）を実施
5. Compliance Checklist — Universal Compliance Items を PASS

---

## Design Review Flow

**Future Design ≠ Implementation。** 設計レビューはコード追加を **許可しない**。

| 手順 | 内容 |
|------|------|
| D1 | [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) — Design Only 節との整合 |
| D2 | [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — 該当領域 Entry Criteria 参照 **必須** |
| D3 | [NON_GOALS.md](./NON_GOALS.md) — 対象が **依然禁止** であることの確認 |
| D4 | 設計成果物が JSON / Markdown / CLI / Public Contract / Compatibility に **影響するか** 判定 |
| D5 | 影響あり → Public Contract Review + Compatibility Review を **先行** |
| D6 | 影響なし（doc-only design）→ Documentation Update Flow のみ |

Future Layer 設計変更は **Future Layer Approval Flow** に接続する。

---

## ADR Workflow

以下の変更は **ADR 必須**（[ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) ADR Format）:

| 変更種別 | ADR 必須 |
|----------|----------|
| 新規 Layer | ✅ |
| Public Contract 変更 | ✅ |
| Dependency 変更 | ✅ |
| External API 接続 | ✅ |
| Runtime | ✅ |
| Scheduler | ✅ |
| Provider | ✅ |
| OAuth | ✅ |
| Database | ✅ |
| Queue | ✅ |
| Worker | ✅ |

**Workflow:**

1. Change Request で ADR 必要性を判定
2. ADR 起草（Context / Decision / Consequences / Status）
3. Architecture Review Flow PASS
4. Status = **Accepted** になるまで Implementation 着手不可
5. [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md) — ADR Check 節 PASS

---

## Risk Review Workflow

[CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) + [RISK_REGISTER.md](./RISK_REGISTER.md) + [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md) Risk Check 節と接続。

**必須観点:**

| 観点 | 例 |
|------|-----|
| Security | OAuth / API key / token 漏洩 |
| Privacy | PII / 実投稿データ |
| Reliability | Single point of failure |
| Compatibility | Breaking change リスク |
| Operational | on-call / runbook 未定義 |
| Vendor Lock-in | Cloud / SNS API 依存 |
| Cost | 従量課金・API コスト |
| Data Loss | Database / Queue 障害 |
| Compliance | ToS / 規制 |

**Workflow:** 変更ごとに Risk Register エントリ追加または更新 → mitigation owner 明示 → Compliance Risk Check PASS。

---

## Compatibility Review Workflow

[COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md) を正とする。

| 原則 | 内容 |
|------|------|
| 最優先 | **Backward Compatibility** |
| Breaking Change | **原則禁止** |
| 例外 | [VERSIONING_POLICY.md](./VERSIONING_POLICY.md) Major + [DEPRECATION_POLICY.md](./DEPRECATION_POLICY.md) 完了 + ADR 必須 |

**Workflow:**

1. Public Contract Catalog diff 確認
2. Compatibility Matrix 影響評価
3. additive change → Minor 文書化
4. breaking change → ADR + Deprecation 計画 + Major バージョン
5. Compliance — Backward Compatibility Check PASS

---

## Public Contract Review Workflow

[CATALOG_USAGE.md](./CATALOG_USAGE.md) + [PUBLIC_CONTRACT_POLICY.md](./PUBLIC_CONTRACT_POLICY.md) と整合。

| 操作 | 条件 |
|------|------|
| Public Contract **追加** | schema 定義 → Catalog 登録計画 → Compatibility Matrix 更新 |
| Public Contract **変更** | Compatibility Review + Versioning / Deprecation 遵守 |
| Public Contract **削除** | Deprecation 期間経過 + ADR |

**禁止:** Private implementation details（内部 helper / env 詳細 / 非公開 dependency）を Public Contract に **漏らさない**。

---

## Compliance Review Workflow

[ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md) を **必須ゲート** とする。

| 変更分類 | 必須 Checklist 節 |
|----------|-------------------|
| Foundation 追加 | Foundation Addition |
| Public Contract 変更 | Public Contract Change |
| Future Architecture | Future Architecture Addition |
| Provider / Runtime / Scheduler / API | Provider Runtime Scheduler API Pre Addition |
| Release | Release Pre Check |

[FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) の **領域別 Entry Criteria** と 1:1 で接続（Compliance PASS ≠ Entry Criteria Gate 通過）。

---

## Documentation Update Flow

Architecture 変更後、以下を **整合更新**:

| 対象 | 更新内容 |
|------|----------|
| [docs/architecture/README.md](./README.md) | 文書数・インデックス・読了順序 |
| [README.md](../../README.md) | バージョンセクション・Governance 入口 |
| [docs/CHANGELOG.md](../CHANGELOG.md) | バージョンエントリ・設計判断 |
| [docs/VERSION.md](../VERSION.md) | Required Derived Target — Current Version **display**・Quality Pipeline PASS 数・完成判定（Current Version **value** authority ではない） |

doc-only release でも VERSION / CHANGELOG 整合は **必須**（認可済み Current Baseline Record からの derived synchronization 後、または明示的に認可された release phase 内）。

```text
Current Baseline Record（認可済み値）
        ↓
docs/VERSION.md（Derived display / summary / history）
```

Documentation Update だけでは Current Baseline Record は更新されない。
Planning / candidate 表記の文書編集は Recorded baseline ではない。

---

## Architecture Change Flow

変更を以下に **分類** し、必要 Review を決定する。

| 分類 | 説明 | 典型 Review |
|------|------|-------------|
| **small doc-only change** |  typo / リンク修正 | Documentation Update |
| **architecture governance change** | Governance 文書追加・更新 | Architecture + Compliance + Quality Pipeline |
| **public contract change** | Catalog / schema 影響 | + Public Contract + Compatibility + ADR |
| **future layer design change** | Design Only 文書 | Design Review + Future Entry Criteria 参照 |
| **implementation enabling change** | Non-Goals 解除・Level 4 向け | **全 Review** + Future Layer Approval Flow + Level 3→4 Gate |

**v1.51.0:** implementation enabling change は **プロセス定義のみ** — 実際の着手は **禁止**。

---

## Future Layer Approval Flow

[FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) を満たすまで **Implementation Ready にしない**。

| 原則 | 内容 |
|------|------|
| 個別解除 | 領域ごとに ADR + Entry Criteria + Compliance |
| 一括解除 | **禁止** |
| Gate 未通過 | Production Code 追加 **禁止** |

**領域別承認フロー（共通骨格）:**

```text
Provider / Runtime / Scheduler / OAuth / SNS API / …
  → 領域 Entry Criteria 全項目レビュー
  → Non-Goals Release Criteria（該当節）
  → ADR Accepted
  → Risk / Compatibility / Public Contract Review
  → Compliance Checklist — Pre Addition PASS
  → Level 3 to Level 4 Gate 該当項目 PASS
  → のみ Implementation 着手可（将来 Epic）
```

**v1.51.0:** 上記は **フロー定義** のみ。いずれの領域も **未承認・未解除**。

---

## Release Governance Flow

Release は以下の **順序** で実施（Human Approval Gate）:

```text
1. Quality Pipeline 全 PASS（Machine Check — enforcement / verification）
2. Current Baseline Record population / update authorized（explicit phase）
3. Documentation updated（architecture / README / CHANGELOG / VERSION as Required Derived Targets）
4. VERSION derived display synchronized from Current Baseline Record（PASS 数・完成判定含む）
5. CHANGELOG updated（設計判断・非実装明記）
6. README updated（Governance 入口・成熟度）
7. git status clean（Working Tree evidence — not Record authority）
8. commit（明示的依頼時のみ — Git evidence）
9. tag（明示的依頼時のみ — Git evidence / release identity surface）
10. push（明示的依頼時のみ — remote evidence）
11. Post Release Review
```

**Critical distinctions:**

```text
Planning Release
≠ Current Release（Recorded）

Documentation Update
≠ Current Baseline Record population

Quality Pipeline PASS
≠ Record authority / release declaration

Git commit / tag / push
≠ Current Baseline Record substitute
```

PASS 数更新だけでは Release 完了と **みなさない**（[QUALITY_GOVERNANCE.md](./QUALITY_GOVERNANCE.md)）。
Current Baseline Record 未認可のまま derived VERSION 表示だけを上げることは **禁止**。
Release History を編集しても Current Baseline Record は上書きされない。

---

## Quality Governance Integration

| 項目 | 内容 |
|------|------|
| Machine Check | `scripts/test_quality_pipeline.sh` 全 PASS |
| Governance Check | Compliance Checklist + Mandatory Policy Review |
| 本書の検証 | Test 461–470（v1.51.0） |
| PASS 数 | **470 PASS** = Machine Check 件数（≠ Governance 完了の十分条件） |
| Authority role | Quality Pipeline = **enforcement / verification only** — not Current Baseline Record authority |

Governance Flow 変更時は Quality Pipeline テスト追加を **Documentation Update Flow** の一部とする。
Quality 結果は Evidence であり、Record 値を決定しない。

---

## Future Entry Criteria Integration

| 関係 | 内容 |
|------|------|
| Entry Criteria | **What** — 着手前に満たす条件（[FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md)） |
| Governance Flow | **How** — レビュー・承認の **実行順序**（本書） |
| Level 3→4 Gate | Entry Criteria 全項目 + 本 Flow 全 Review 完了が必要 |

**Entry Criteria 文書化完了 ≠ Implementation Ready。** v1.50.0 Future Entry Criteria + v1.51.0 Governance Flow 追加後も **Level 4 未到達**。

---

## Completion Criteria

Governance Flow 文書自体の完成条件（v1.51.0）:

- [x] 本書（GOVERNANCE_FLOW.md）存在
- [x] 全必須見出し（Purpose 〜 Related Documents）
- [x] docs/architecture/README.md インデックス登録（22 必須文書）
- [x] Quality Pipeline Test 461–470
- [x] Level 4 **未宣言**
- [x] 実装禁止領域 **未解除**
- [x] Production Code **変更なし**

---

## Final Architecture Review Flow

**Final Architecture Review** is a mandatory governance step **after Cross Layer Design Complete** and **before Level 4 Entry Decision**.

### Input（required）

| Input | Authority |
|-------|-----------|
| Core Layer Design Complete | v1.54–v1.59 Layer Designs |
| Cross Layer Design Complete | v1.60–v1.65 Interaction models |
| Governance baseline | FUTURE_ENTRY_CRITERIA / ARCHITECTURE_MATURITY_MODEL |
| Compatibility governance | COMPATIBILITY_POLICY |
| Compliance Checklist | ARCHITECTURE_COMPLIANCE_CHECKLIST |
| Risk Register | RISK_REGISTER |

### Review Scope

- Architecture completeness / consistency
- Authority integrity / responsibility separation
- Dependency direction / boundary consistency
- Contract completeness / compatibility readiness
- Governance completeness / risk coverage / compliance readiness
- Implementation prerequisites / remaining gaps

### Finding Classifications

| Classification | Action |
|----------------|--------|
| **Critical Blocker** | Stop Level 4 Entry — redesign or major remediation |
| **Major Gap** | Remediation required before Level 4 Entry |
| **Minor Gap** | Correct before or during stabilization |
| **Improvement Opportunity** | Optional enhancement |
| **No Issue** | Confirmed consistent |

### Possible Decisions

| Decision | Meaning |
|----------|---------|
| **Proceed to Level 4 Entry Review** | No Critical Blocker; Major Gaps resolved or accepted with ADR |
| **Architecture Stabilization / Remediation Required** | Major Gaps require documentation/governance fix（v1.66.0 path） |
| **Architecture Redesign Required** | Critical Blocker — SSOT conflict |

### Output（required artifact）

- Review evidence（human record）
- Gap classification counts
- Remediation decision
- Level 4 readiness assessment

**Quality Pipeline PASS MUST NOT substitute for Final Architecture Review.**

---

## Cross Layer Design Review Flow

Cross Layer Design 変更時（v1.60–v1.65 models）:

1. Read SSOT chain — Lifecycle → Context → State → Error → Metadata
2. Verify no authority overlap / no semantic redefinition
3. Run Cross Model Compliance（ARCHITECTURE_COMPLIANCE_CHECKLIST §Cross Model）
4. Update Risk Register if new Cross Layer risks identified
5. Extend Quality Pipeline with governance consistency checks only

---

## Level 3 to Level 4 Role

本書は Level 3（Future Design **Complete**）から Level 4 Entry Review への **運用 Process** を定義する。

| 項目 | v1.66.0 状態 |
|------|--------------|
| Current Maturity | **Level 3.7** — Architecture Governance Stabilized / Level 4 Entry Review Ready |
| Level 3 Future Design | **Completed** |
| Final Architecture Review | **Completed**（Decision B → v1.66.0 remediation） |
| Level 4 Entry Review Ready | **Yes** |
| Level 4 Implementation Ready | **未到達** |
| 本書の役割 | Entry Criteria → 実行順序 + Final Architecture Review |
| Gate 通過 | **未完了** |

Level 4 到達には [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) Level 3 to Level 4 Gate **全項目** + 本 Governance Flow の **全 Review 完了** が必要。

---

## Prohibited Shortcuts

以下は **禁止**:

| Shortcut | 理由 |
|----------|------|
| PASS 数だけで Gate 通過宣言 | [QUALITY_GOVERNANCE.md](./QUALITY_GOVERNANCE.md) 違反 |
| Compliance Checklist 省略 | Governance Check 欠落 |
| ADR なし Public Contract 変更 | Policy 違反 |
| Non-Goals 一括解除 | [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) 違反 |
| Design Review 省略して Implementation | Future Design ≠ Implementation |
| Production Code 追加（v1.51.0） | Non-Goals 維持 |
| Level 4 / Production Ready 宣言 | Maturity 根拠不足 |
| Private detail の Public Contract 漏洩 | 公開境界違反 |

---

## Related Documents

| 文書 | 関係 |
|------|------|
| [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) | Entry Gate 条件（What） |
| [ARCHITECTURE_MATURITY_MODEL.md](./ARCHITECTURE_MATURITY_MODEL.md) | 成熟度位置づけ |
| [QUALITY_GOVERNANCE.md](./QUALITY_GOVERNANCE.md) | Machine vs Governance Check |
| [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md) | Compliance Review ゲート |
| [CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) | 変更判断・Mandatory Policy Review |
| [NON_GOALS.md](./NON_GOALS.md) | 実装禁止リスト |
| [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) | Design Only 将来設計 |
