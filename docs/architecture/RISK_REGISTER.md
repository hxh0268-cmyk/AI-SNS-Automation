# Risk Register

Architecture / Compatibility / Dependency / Technical Debt リスクと Mitigation を管理する Architecture Governance 基準書です。

---

## Mitigation Owner

v1.49.0 時点の **mitigation owner** は以下に限定します。

- **Governance 文書**（`docs/architecture/`）
- **Quality Pipeline テスト**（`scripts/test_quality_pipeline.sh`）
- **Architecture / Governance Review**（変更 PR 時の Mandatory Policy Review）

**実装チーム**、**外部運用**、**on-call 体制** は v1.49.0 時点では **未定義** です。Future Layer 実装 Epic 開始時に owner モデルを [CHANGE_GOVERNANCE.md](./CHANGE_GOVERNANCE.md) で再定義します。

---

## Architecture Risk

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| AR-001 | Layer Boundary 侵害（Platform ↔ Application import） | High | Low | Layer Invariants + Quality Pipeline |
| AR-002 | Governance docs と Catalog drift | Medium | Medium | Catalog regeneration + docs cross-link |
| AR-003 | Future Layer  premature 実装 | High | Medium | NON_GOALS + Non-scope tests |
| AR-004 | v1.37.1 legacy docs との矛盾 | Low | Medium | README で Governance 優先を明記 |

---

## Compatibility Risk

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| CR-001 | Public Contract breaking change 無通知 | High | Low | Deprecation Policy 4-stage |
| CR-002 | Compatibility Matrix 未更新 merge | Medium | Medium | CHANGE_GOVERNANCE checklist |
| CR-003 | optional field 追加が downstream を破壊 | Low | Low | additive-only Minor rule |
| CR-004 | schema version と repo SemVer 混同 | Medium | Medium | VERSIONING_POLICY 明文化 |

---

## Dependency Risk

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| DR-001 | 循環依存導入 | High | Low | DAG invariant + catalog cyclic=false |
| DR-002 | internal API 依存（extract 迂回） | High | Medium | Public Contract only tests |
| DR-003 | 複数 upstream 依存 | Medium | Low | single upstream rule |
| DR-004 | Idea / AI Idea root 統合圧力 | Low | Medium | OVERVIEW で独立 root 維持 |

---

## Technical Debt

| ID | Debt | Impact | Mitigation Plan |
|----|------|--------|-----------------|
| TD-001 | content-generation/1.0 legacy（v1.25 dry-run） | Low | legacy module 分離済み。Removal Candidate 未設定 |
| TD-002 | Platform Developer Analytics に extract なし | Low | Platform maintenance-only。Future で extract 追加検討 |
| TD-003 | v1.37.1 PRINCIPLES / ROADMAP レガシー | Low | v1.49 Governance docs を正とする |
| TD-004 | 7 Foundation 手動 Catalog 定義 | Medium | 将来: extract signature introspection 検討 |

---

## Review Cadence

| 領域 | 頻度 |
|------|------|
| Risk Register 全体 | Minor release |
| CR / DR 高 Impact | 毎 Foundation 変更 |
| AR-003 Future 実装圧力 | 毎 Epic 開始前 |

新リスク発見時は本 Register に ID を付与して追記します。
