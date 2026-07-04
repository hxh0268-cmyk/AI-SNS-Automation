# Layer Interaction Model

Future Layer **Boundary Design** の上に位置する **Layer 間通信・連携・責務分担ルール** を定義する Architecture Governance 基準書です。Provider / Runtime / Scheduler / Automation 等の **実装前** に、Interaction Contract を固定します。

> **重要（v1.53.0）:** 本書は **Architecture Design** のみ。Production Code 変更なし。**Implementation Ready（Level 4）ではありません。** [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) の責務定義は **変更しません**。

---

## 1. Purpose

- Future Layer 間および Application ↔ Future 間の **通信・連携ルール** を明文化する
- [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) で定義した **Boundary の上** に Interaction Contract を置く
- Request / Response / Command / Query / Sync / Async / Error / Retry / Timeout / Transaction / Event / State の **設計前提** を固定する
- Future Provider / Runtime / Scheduler / Automation 設計の **前提契約** として機能する
- **Current Maturity Level 2.5** を維持し、Level 4 到達を **宣言しない**

---

## 2. Scope

- Interaction Principles / Layer Communication Rules
- Request / Response Flow、Command vs Query、Sync / Async
- Error Propagation、Retry Responsibility、Timeout Ownership
- Transaction / Event / State Boundaries
- Observability Points（設計のみ — Real Metrics 非実装）
- Interaction Anti-Patterns、Sequence Examples（Architecture 記述）
- [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) / [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) Integration

Platform Layer / Application Layer の **既存 Public Contract** は変更しません。

---

## 3. Non-Goals

- 本書は **実装ロードマップ** ではない
- Provider / Adapter / Runtime / Scheduler / OAuth / SNS API / External API / Database / Queue / Worker / Cloud Runtime / Cache / Real Metrics / Real Automation / Background Job / Message Broker の **実装を許可しない**
- **Boundary Design の責務再定義** を行わない
- Public Contract Catalog の **破壊的変更** を行わない
- Real Metrics / 外部 API / DB / Queue / Worker の **実体追加** を行わない
- **Level 4 Implementation Ready** 到達を意味しない

---

## 4. Relationship to Future Layer Boundaries

| 観点 | Future Layer Boundaries | Layer Interaction Model（本書） |
|------|-------------------------|--------------------------------|
| 定義対象 | 各 Layer の **責務・所有範囲** | Layer 間の **通信・連携ルール** |
| 変更関係 | 正（Source of boundary truth） | Boundary を **変更しない** |
| 依存 | Layer Map / Owns / Forbidden Deps | Boundary 上の **Interaction Contract** |
| 実装 | Prohibited（v1.53.0） | Prohibited（v1.53.0） |

- **Boundary Design** は各 Layer が **何を所有し、何を所有しないか** を定義する
- **Interaction Model** は Layer が **どう通信し、誰が Retry/Timeout を担うか** を定義する
- Interaction Model は Future Provider / Runtime / Scheduler / Automation 設計の **前提契約** である
- Boundary 文書と矛盾する Interaction は **無効** — 矛盾時は Governance Flow + ADR

---

## 5. Interaction Principles

| 原則 | 内容 |
|------|------|
| **Contract First** | すべての Interaction は Public Contract 経由 |
| **Explicit Direction** | 呼び出し方向は [DEPENDENCY_RULES.md](./DEPENDENCY_RULES.md) に従い明示 |
| **Minimal Coupling** | Layer 間は Contract のみ共有 — 内部 state 非共有 |
| **No Hidden Side Effects** | 副作用は owning Layer に隔離 |
| **Observable Interaction** | 各 Interaction に観測点を定義 |
| **Failure Explicitness** | Error は Contract として返却 — 握りつぶし禁止 |
| **Retry Ownership Clarity** | Retry 担当 Layer を Interaction 定義時に固定 |
| **Timeout Ownership Clarity** | Timeout 値・責任 Layer を明示 |
| **Backward Compatibility** | Interaction Contract 変更は additive default |
| **Governance First** | 変更は [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) 経由 |

---

## 6. Layer Communication Rules

| ルール | 内容 |
|--------|------|
| C1 | Layer 間通信は **Public Contract 経由のみ** |
| C2 | Private Internal State への **直接アクセス禁止** |
| C3 | **下位 Layer が上位 Layer を呼び出すこと禁止**（依存方向は内→外） |
| C4 | **Cross-layer shortcut 禁止**（Layer skipping） |
| C5 | 実装前の **仮想 Interaction** として本書に定義 — コード追加なし（v1.53.0） |

```text
Application Layer
  ↔ (Public Contract JSON only)
Future Layer stack
  Provider / Adapter / Runtime / Scheduler / Queue / Worker
  — いずれも Contract boundary を越えない
```

---

## 7. Request / Response Flow

| 要素 | ルール |
|------|--------|
| **Request** | 入力 Public Contract を持つ（schema 固定） |
| **Response** | 出力 Public Contract を持つ |
| **Error** | Error も **Contract** として扱う（error summary JSON） |
| **Source** | JSON = Source / Markdown = View / CLI = Summary と **矛盾しない** |
| **Direction** | Request initiator は依存方向の **呼び出し側** のみ |

Future Interaction でも Foundation artifact JSON が **正** である。

---

## 8. Command vs Query Rules

| 種別 | 定義 | 制約 |
|------|------|------|
| **Query** | 状態を **変更しない** 読取専用 Interaction | idempotent、副作用なし |
| **Command** | 状態変更の **意図** を持つ Interaction | 明示的 Command Contract |
| **分離** | Command と Query を **同一 Contract に混在させない** | CQRS 風分離（Future 必須） |

Future Runtime / Scheduler / Worker では Command / Query 分離を **必須** とする（実装前設計）。

---

## 9. Sync / Async Interaction Rules

| 種別 | 用途 | v1.53.0 |
|------|------|---------|
| **Sync** | 即時応答が必要な Interaction のみ | 設計定義のみ |
| **Async** | 長時間処理、外部 API、Queue、Worker、Automation **候補** | **実装しない** |

- Async 設計は将来 **Queue / Worker / Scheduler** 設計の前提とする
- Sync Contract の背後に Async 振る舞いを **隠さない**（Anti-Pattern）
- Async 着手前: Scheduler + Queue + Worker Entry Criteria Gate 必須

---

## 10. Error Propagation Rules

| ルール | 内容 |
|--------|------|
| E1 | Error は **握りつぶさない** — Contract error shape で返却 |
| E2 | Provider / External API 失敗を Application Layer に **漏らしすぎない** — Adapter で正規化 |
| E3 | **User-facing failure** と **System-facing failure** を分離 |
| E4 | Error は Observability Point（§16）で記録可能な shape とする |
| E5 | 未処理 Error の Layer 越境伝播は **明示的** にのみ許可 |

---

## 11. Retry Responsibility

| Layer / 領域 | Retry 責任（設計） |
|--------------|-------------------|
| **Provider / External API** | Transient failure retry（rate limit 遵守） |
| **Adapter** | Retry 後も shape 正規化 — retry ロジックを Application へ漏らさない |
| **Runtime** | Invoke 失敗の orchestration-level retry（idempotent Command のみ） |
| **Application Layer** | **Retry しない**（Future external IO 非保持） |
| **Queue / Worker** | At-least-once 配信 retry（承認後・設計のみ） |

Retry 担当 Layer は Interaction 定義時に **1 箇所** に固定 — hidden retry 禁止。

---

## 12. Timeout Ownership

| Layer / 領域 | Timeout 所有（設計） |
|--------------|---------------------|
| **Provider / External API** | HTTP / API call timeout |
| **Runtime** | Pipeline orchestration timeout |
| **Scheduler** | Trigger window / max wait（将来） |
| **Application Foundation** | Pure function — **external timeout なし**（v1.47 現状維持） |

Timeout 値は Contract または Runtime config に **明示** — silent timeout 禁止。

---

## 13. Transaction Boundaries

- Transaction Boundary は Layer をまたいで **曖昧にしない**
- 単一 Transaction は **単一 owning Layer** 内で完結（将来 Database 承認後）
- Cross-layer 「分散トランザクション」は **原則禁止** — Saga / Event 補償は ADR 必須
- JSON artifact write は **atomic file replace** パターン（現 Application 慣行）を維持
- Database Transaction は Entry Criteria + ADR 後のみ

---

## 14. Event Boundaries

- **Event** は **事実の記録** であり **Command ではない**
- Event emitter は **事実を起こした Layer** のみ
- Event payload は Public Contract または **Private event envelope**（Catalog 非公開可）
- Event 消費は Async / Queue 経由（将来）— Sync handler への混在禁止
- Event ≠ State — Event は append-only 事実、State は owning Layer が管理

---

## 15. State Transition Rules

- **State Transition** の責任は **owning Layer** が持つ
- Future Runtime / Queue / Worker で状態所有を **分散させない** — 単一 owner 原則
- Application Foundation pipeline state（`state.json` 等）は **Application / Platform 領域** — Future Layer が上書きしない
- State 変更は **Command Interaction** 経由のみ
- Illegal transition は Error Contract で拒否

---

## 16. Observability Points

Interaction ごとに以下の **観測点** を設計上定義（Real Metrics **実装なし**）:

| 観測点 | 意味 |
|--------|------|
| Request accepted | Contract 検証通過・処理開始 |
| Response returned | 正常 Response Contract 返却 |
| Error occurred | Error Contract 返却 |
| Retry attempted | Retry 担当 Layer が retry 実行 |
| Timeout occurred | Timeout 所有 Layer が timeout 検知 |
| State transitioned | Owning Layer が state 変更 |
| Event emitted | Event 事実が記録 |

Developer Automation metrics（Platform）と Future Real Metrics は **分離**（Boundary 整合）。

---

## 17. Interaction Anti-Patterns

| Anti-Pattern | 問題 |
|--------------|------|
| **Layer skipping** | Cross-layer shortcut — Dependency 違反 |
| **Circular call** | Layer 間循環依存 |
| **Shared mutable state** | Coupling / race |
| **Hidden retry** | Retry ownership 不明 |
| **Silent timeout** | Timeout ownership 不明 |
| **Mixed command/query** | 副作用の不可预测性 |
| **Internal state leak** | Private state が Contract 外漏洩 |
| **Provider-specific logic leaking upward** | Application 侵食 |
| **Runtime-specific logic leaking into Application Layer** | Layer 混同 |
| **Async behavior hidden behind sync contract** | Contract 嘘 |

---

## 18. Sequence Examples

Architecture Sequence（**実装なし**）— 将来 Interaction の参照モデル。

### 18.1 Query Interaction Example

```text
Application Layer
  → Query Request Contract (JSON)
  → Foundation pure function
  ← Query Response Contract (JSON)
  (no state change)
```

### 18.2 Command Interaction Example

```text
Application Layer
  → Command Request Contract (JSON)
  → Owning Layer validates + state transition intent
  ← Command Response Contract (JSON) or Error Contract
```

### 18.3 Async Candidate Interaction Example

```text
Scheduler (future)
  → enqueue Command envelope
Queue (future)
  → deliver to Worker (future)
Worker (future)
  → Runtime invoke
Runtime (future)
  → Foundation CLI
  ← artifact JSON
  (Async — v1.53.0 未実装)
```

### 18.4 Error Propagation Example

```text
External API (future Provider)
  → failure
Adapter (future)
  → normalize to Error Contract
Application Layer
  ← Error Contract (not raw stack/API body)
```

### 18.5 Retry Ownership Example

```text
Provider: transient 503 → retry (max N, backoff)
Adapter: receives normalized result or Error Contract after retries exhausted
Application: no retry — receives final Contract only
```

### 18.6 Timeout Ownership Example

```text
Provider: owns API timeout (30s)
Runtime: owns pipeline timeout (5m)
Application Foundation: no external timeout
```

### 18.7 Event Emission Example

```text
Runtime (future): pipeline completed (fact)
  → emit event: pipeline.completed (Event Contract)
Queue (future): transport only — not Command
Subscriber (future): read-only reaction — separate Command if state change needed
```

---

## 19. Compatibility Requirements

- Interaction Contract 追加は **additive default**
- Breaking Interaction change は [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md) + ADR + Deprecation
- 既存 Application Foundation CLI / JSON output と **後方互換** 維持
- Boundary 文書（[FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md)）との **整合必須**

---

## 20. Testing Requirements

Machine Check（Quality Pipeline）で検証:

| 要件 | Test |
|------|------|
| 文書存在 | Test 483 |
| Purpose / Scope / Non-Goals | Test 484 |
| Boundary 関係 | Test 485 |
| Communication / CQ / Sync-Async | Test 486–488 |
| Error / Retry / Timeout / Transaction / Event / State | Test 489–490 |
| Anti-Patterns | Test 491 |
| Governance / Entry Criteria 統合 | Test 492 |
| README / VERSION / CHANGELOG 整合 | Test 493 |

PASS 数 ≠ Interaction 承認（[QUALITY_GOVERNANCE.md](./QUALITY_GOVERNANCE.md)）。

---

## 21. Documentation Requirements

Interaction Model 変更時:

| 文書 | 更新 |
|------|------|
| [docs/architecture/README.md](./README.md) | 24 文書インデックス |
| [README.md](../../README.md) | v1.53.0 セクション |
| [docs/CHANGELOG.md](../CHANGELOG.md) | 設計判断 |
| [docs/VERSION.md](../VERSION.md) | PASS 数・完成判定 |

Boundary 変更が必要な場合は **別 ADR** — 本書から Boundary を書き換えない。

---

## 22. Governance Flow Integration

- Interaction Model 変更は [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) — **future layer design change** 分類
- Implementation-enabling Interaction（Async 実装等）は **ADR + Risk + Compatibility + Public Contract + Compliance Review** 必須
- v1.53.0 追加は **architecture governance change** — Production Code 変更なし

---

## 23. Future Entry Criteria Integration

- 各 Future Layer Interaction 着手前に [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) 該当 Entry Criteria を **満たす**
- Interaction Model 定義 ≠ Entry Criteria **充足**
- Entry Criteria 完了 ≠ **Level 4** 自動到達
- Async / Queue / Worker Interaction 実装は Queue + Worker + Scheduler Entry Criteria **全 PASS** 後

---

## 24. Completion Criteria

Layer Interaction Model 文書の完成条件（v1.53.0）:

- [x] LAYER_INTERACTION_MODEL.md 存在（全必須見出し §1–§24）
- [x] Boundary と Interaction の役割分担明確
- [x] FUTURE_LAYER_BOUNDARIES.md **未変更**
- [x] Production Code **変更なし**
- [x] Architecture Documents **24** 必須文書
- [x] Quality Pipeline **493 PASS**（Test 483–493）
- [x] Level 4 **未宣言**
- [x] Implementation **Prohibited** 維持

---

## Related Documents

| 文書 | 関係 |
|------|------|
| [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) | Boundary（What each layer owns） |
| [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) | 将来設計構想 |
| [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) | Entry Gate |
| [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) | Review Process |
| [DEPENDENCY_RULES.md](./DEPENDENCY_RULES.md) | 依存方向 |
| [LAYER_MODEL.md](./LAYER_MODEL.md) | Layer 構造 |
