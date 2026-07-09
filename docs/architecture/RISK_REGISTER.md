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

## Cross Layer / Level 4 Entry Risk（v1.66.0）

| ID | Risk | Affected Authority | Impact | Likelihood | Mitigation | Remaining Exposure | L4 Entry Impact |
|----|------|-------------------|--------|------------|------------|-------------------|-----------------|
| CL-001 | Governance maturity drift（docs contradict VERSION） | Maturity / Entry Criteria | High | Medium | v1.66.0 sync + Quality Pipeline governance tests | Low after remediation | Blocks Entry if unresolved |
| CL-002 | Runtime Lifecycle vs Interaction Lifecycle confusion | Runtime / Lifecycle SSOT | High | Medium | RUNTIME_LAYER_DESIGN disambiguation + Compliance | Medium until impl | Major at implementation |
| CL-003 | Metadata dumping ground | Metadata Model | High | Medium | INTERACTION_METADATA_MODEL boundaries + Compliance | Medium until runtime | Major at implementation |
| CL-004 | Retry / Recovery ad hoc implementation | Lifecycle / Error | High | High | FUTURE_ENTRY_CRITERIA §Deferred Operational Semantics | **High** — deferred by design | **Prerequisite before retry impl** |
| CL-005 | Cross-layer idempotency ownership ambiguity | Event / Scheduler / Runtime | Medium | High | Explicit deferral + ADR requirement | **High** — unowned | Prerequisite before idempotency impl |
| CL-006 | Duplicate interaction handling unowned | Cross Layer | Medium | Medium | Explicit deferral in Entry Criteria | Medium | Prerequisite before dedup impl |
| CL-007 | Provider raw response leakage | Provider / Error / Metadata | Critical | Medium | ADR-0010 normalization prohibition + PROVIDER_ENTRY_PREPARATION_REVIEW | Medium until impl | Critical at implementation |
| CL-008 | Runtime Exception leakage into contracts | Error / Metadata / Context | High | Medium | Forbidden fields + Compliance | Low at design | Major at implementation |
| CL-009 | Uncontrolled extension.* namespace | Metadata | Medium | Medium | Extension Governance + Compliance | Low | Major if bypass occurs |
| CL-010 | Quality Pipeline false confidence | Quality Governance | Medium | Medium | QUALITY_GOVERNANCE + Final Architecture Review | Medium | Blocks naive L4 claim |
| CL-011 | Premature Level 4 Implementation Ready declaration | Maturity Model | Critical | Low | Gate criteria + human review | Low after v1.66.0 | Critical |
| CL-012 | Missing Final Architecture Review evidence | Governance Flow | High | Low | GOVERNANCE_FLOW §Final Architecture Review | Low after v1.66.0 | Blocks Entry |
| CL-013 | Public Contract traceability gap（Future Layer） | Catalog / Policy | High | High | ADR-0011 + ADR-0012 + ADR-0015 `providerContracts[]` registration | **Mitigated** — abstract authority in JSON（v1.72.0） | Concrete Provider impl still gated |

**Risk status:** Documented and mitigated at governance level — **not resolved** merely by documentation existence. CL-004, CL-005, CL-006 remain **open exposure**. CL-013 **mitigated** at catalog governance layer（v1.75.0）— concrete JSON traceability pending Implementation Release. PR-005 **reframed** post-ADR-0017 — Governed / Authorized / Registered distinction explicit. PR-006 **reframed** post-ADR-0017 — identity mapping defined at governance level.

---

## Provider Entry Preparation Risk（v1.68.0）

| ID | Risk | Affected Authority | Impact | Likelihood | Mitigation | Remaining Exposure | Provider Impl Impact |
|----|------|-------------------|--------|------------|------------|-------------------|---------------------|
| PR-001 | Mock vs Real Provider confusion | Provider / ADR-0010 | High | Medium | Mock default policy + feature flag design | Medium until impl | Blocks safe default path |
| PR-002 | Premature Real Provider external IO | Provider / NON_GOALS | Critical | Medium | ADR-0013 Real Provider prohibition + NON_GOALS Real Provider section | **Medium** — Real Provider still prohibited; G-25 does not authorize Real IO | Critical |
| PR-003 | Provider boundary overreach（owns Runtime/Retry/Idempotency） | Layer boundaries | High | Medium | ADR-0010 non-ownership table | Low at governance | Major at implementation |
| PR-004 | Public Contract Catalog bypass | Catalog / Policy | High | Low | ADR-0011 + ADR-0012 + ADR-0015 registration + bypass prohibition | **Low** — catalog registration executed（v1.72.0） | Critical if bypassed |
| PR-005 | Implementation Ready mistaken for Production Implementation | NON_GOALS / G-25 / Maturity | Critical | Medium | ADR-0014 scope limits + ADR-0015 Catalog Extension + ADR-0016 Authorized vs Started + ADR-0017 Governed vs Registered distinction | **Medium** — governance distinction explicit; watch Registered vs Production Ready confusion | Critical |
| PR-006 | Mock Provider semantic drift / Application mock conflation | Provider / Application Layer | High | Medium | ADR-0016 Mock Provider definition + ADR-0017 identity mapping + Decision B catalog policy | **Medium** — identity mapping governed; concrete registration pending | Major |

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
| CL-001 … CL-013 Cross Layer / L4 Entry | Final Architecture Review + Level 4 Entry Review |
| PR-001 … PR-006 Provider Entry Preparation | Provider Entry Preparation Review + Provider Production ADR gate + Mock Authorization Review |
| Provider Contract Definition | PROVIDER_CONTRACT_DEFINITION_REVIEW + Catalog extension Release gate |

新リスク発見時は本 Register に ID を付与して追記します。
