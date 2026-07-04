# Provider Layer Design

将来の外部サービス・AI Provider・SNS Provider・Storage Provider・Metrics Provider 等を **Application Layer から直接依存させない** ための Provider Layer **設計契約** を定義する Design Only 基準書です。

> **重要（v1.54.0）:** 本書は **Provider Layer Design** のみ。Provider / Adapter 実装、API call、OAuth、Production Code 変更は **禁止**。**Implementation Ready（Level 4）ではありません。**

---

## 1. Purpose

Provider Layer は、将来の外部 capability を **抽象化** し、Application Layer に **安定した Contract** を提供する Future Layer 設計領域です。

- External service / AI / SNS / storage / metrics 等を Application から **隔離**
- Provider input / output / error **Contract** を設計段階で固定
- Provider-specific behavior を Provider + Adapter 内に **閉じ込める**
- [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) / [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) / [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) に **整合**

---

## 2. Scope

| 対象 | 内容 |
|------|------|
| Provider 責務 | Responsibility / 非責務 |
| Provider Contract | Input / Output / Error / Configuration |
| Provider Capability | 将来 capability 宣言モデル |
| Credential / Runtime / Adapter / External API Boundary | 設計境界 |
| State Ownership / Side Effect / Observability | ルール定義 |
| Testing Strategy / Anti-Patterns / Extension Criteria | Design Only 検証方針 |

Platform Layer / Application Layer の **既存 Public Contract** は変更しません。

---

## 3. Non-Goals

- **Provider 実装** はしない
- **API call** はしない — 実ネットワーク通信禁止
- **OAuth** は扱わない — OAuth Layer 責務
- **token 保存** はしない
- **Database** / **Queue** / **Worker** は使わない
- **Runtime execution** は追加しない
- **Production Code** は変更しない
- **Level 4 Implementation Ready** 到達を意味しない

---

## 4. Relationship to Future Layer Boundaries

| 観点 | 内容 |
|------|------|
| 前提 | [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) — **Provider Layer Boundary** |
| 本書の役割 | Boundary の **詳細化** — Boundary **非変更** |
| 責務 | Provider 領域のみ — Runtime / Scheduler / OAuth 等は **侵害しない** |
| 整合 | Allowed / Forbidden Dependencies との **矛盾禁止** |

Provider Layer Design は Boundary 文書を **上書きしない**。矛盾時は Governance Flow + ADR。

---

## 5. Relationship to Layer Interaction Model

| 観点 | 内容 |
|------|------|
| Request / Response | [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) §7 に従う |
| Command / Query | Query Provider = 副作用なし / Command Provider = 副作用宣言 |
| Retry / Timeout | **Provider / Adapter が Retry 所有** — Application は retry しない |
| Error | Provider 固有エラーを Application に **漏らしすぎない** — Error Contract 正規化 |
| Async | **未実装** — Async は Queue / Worker 設計後（v1.54.0） |

---

## 6. Provider Layer Responsibility

### Provider の責務

| 責務 | 説明 |
|------|------|
| External capability 抽象化 | LLM / Image / SNS / Metrics 等 |
| Capability 宣言 | Provider が提供する capability 一覧 |
| Contract 定義 | input / output / error schema |
| Behavior 隔離 | Provider-specific logic を Application 非公開 |
| External API detail 隠蔽 | SDK / URL / field を Contract 外 |
| 安定 Contract 提供 | Application 向け正規化 output |

### Provider の責務ではないもの

| 非責務 | 所属 Layer |
|--------|------------|
| UI | Application / Platform |
| Scheduler | Scheduler Layer |
| Runtime orchestration | Runtime Layer |
| Queue management | Queue Layer |
| Worker execution | Worker Layer |
| OAuth lifecycle | OAuth Layer |
| Database persistence | Database Layer |
| Direct business logic ownership | Application Layer |

---

## 7. Provider Abstraction Principles

| 原則 | 内容 |
|------|------|
| Contract First | Application は Provider Contract のみ参照 |
| Capability Explicit | 未宣言 capability 呼び出し禁止 |
| Mock Default | 将来: Mock Provider default、Real は flag |
| Adapter Separation | Raw API ↔ Contract shape は Adapter 経由 |
| No Upward Leak | SDK response を Application へ直接返さない |
| Side Effect Declared | Command capability は明示宣言 |
| Credential External | Secret は Contract / 文書に含めない |

---

## 8. Provider Contract Model

各 Provider（設計）は以下フィールドを持つ **Contract 宣言**:

| フィールド | 説明 |
|------------|------|
| **Provider Name** | 一意識別子（例: `mock-text-generation`） |
| **Provider Type** | ai / sns / storage / metrics / notification 等 |
| **Capability List** | §12 参照 |
| **Input Schema** | §9 |
| **Output Schema** | §10 |
| **Error Schema** | §11 |
| **Configuration Schema** | §13 — non-secret のみ |
| **Credential Requirement Declaration** | §14 — 要否のみ |
| **Side Effect Declaration** | query / command |
| **Timeout Policy Declaration** | 所有 Layer + 上限 |
| **Retry Policy Declaration** | 所有 Layer + max attempts |

JSON schema 化は将来 Catalog 登録時 — v1.54.0 は **設計定義のみ**。

---

## 9. Provider Input Contract

- Application Public Contract JSON を **入力** とする（Foundation output 等）
- Provider-specific 拡張 field は **Provider private envelope** 内
- Validation failure → `validation_error`（§11）
- Input Contract は **versioned** — breaking change は ADR + Deprecation

---

## 10. Provider Output Contract

- Adapter 経由で **Foundation-compatible JSON shape** を返す
- Raw external API body は **Output Contract に含めない**
- Output は JSON = Source 原則に従い artifact として永続化可能
- Partial success は explicit contract field で表現 — 暗黙 nil 禁止

---

## 11. Provider Error Contract

標準 error kind（設計）:

| kind | 意味 |
|------|------|
| `validation_error` | Input Contract 違反 |
| `configuration_error` | Configuration 不正 |
| `credential_required` | Credential 未設定 |
| `credential_invalid` | Credential 無効 |
| `provider_unavailable` | Provider ダウン |
| `provider_timeout` | Timeout 超過 |
| `provider_rate_limited` | Rate limit |
| `external_api_error` | 外部 API 一般エラー（正規化後） |
| `unsupported_capability` | 未宣言 capability 要求 |

Error は [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) Error Contract に **マップ** される。

---

## 12. Provider Capability Model

Capability は将来 Provider が **何をできるか** を表す（**実装なし**）:

| Capability | 種別 | 例 |
|------------|------|-----|
| `text_generation` | query/command | LLM テキスト |
| `image_generation` | command | 画像生成 |
| `sns_publish` | command | SNS 投稿 |
| `analytics_fetch` | query | metrics 取得 |
| `storage_write` | command | 補助 storage |
| `notification_send` | command | 通知送信 |

未宣言 capability の invoke → `unsupported_capability`。

---

## 13. Provider Configuration Model

- Configuration は **Provider behavior** を制御（model name、timeout 上限等）
- **Credential と Configuration を混同しない**
- **Secret は設定文書・Contract に直接書かない**
- Environment-specific value（endpoint URL 等）は将来 **Runtime Layer** 注入
- Configuration schema は Public Catalog に **non-secret field のみ**

---

## 14. Provider Credential Boundary

- Credential を Provider Layer **内部実装に直接埋め込まない**
- **OAuth lifecycle** は OAuth Layer 責務
- **Secret storage** は Provider Layer 責務 **ではない**（env / secret store — Runtime 注入）
- Provider は **credential requirement を宣言するのみ**（boolean + scope hint）
- Credential を Public Contract / Governance 文書に **記載禁止**

---

## 15. Provider Runtime Boundary

- Provider は **Runtime を所有しない**
- Provider は **実行環境を決定しない**
- **Runtime Layer** が実行制御を持つ
- Provider は **callable contract** を提供する設計に留める（v1.54.0）
- Provider invoke は Runtime 経由 — 直接 shell / network 起動禁止

---

## 16. Provider Adapter Boundary

- **Adapter** は Provider と external API / SDK / protocol の **変換責務**
- Provider は Adapter implementation detail に **依存しすぎない**
- Adapter は **Application Layer に漏れない**
- **Provider Contract** と **Adapter implementation** を分離
- 1 Adapter ≈ 1 external service family（Boundary 整合）

---

## 17. Provider External API Boundary

- External API **仕様変更**を Application Layer に **直接漏らさない**
- Provider は **安定 Contract** を維持 — API version pin は Adapter 内
- API-specific field を Public Contract に **安易に露出しない**
- External API 依存は将来 **Adapter / Provider 実装 Epic** で ADR 必須
- v1.54.0: **実 API 接続なし**

---

## 18. Provider State Ownership

- Provider は **session / connection state** を最小化
- Long-lived state は **Database / Queue 禁止**（未承認）
- Provider output JSON が **正** — Provider 内部 cache は derived のみ
- Stateful Provider は ADR + Entry Criteria 必須（将来）

---

## 19. Provider Side Effect Rules

| ルール | 内容 |
|--------|------|
| Query Provider | **side effect なし** |
| Command Provider | side effect を **Capability 宣言で明示** |
| External write / publish / send | **Command 扱い** |
| Hidden side effect | **禁止** |

Side effect 未宣言の Command invoke → Governance 違反 + `validation_error`。

---

## 20. Provider Observability Rules

観測点（設計 — Real Metrics **実装なし**）:

| 観測点 | 意味 |
|--------|------|
| `provider_selected` | Runtime が Provider を選択 |
| `provider_request_created` | Input Contract 検証後 |
| `provider_response_received` | Output Contract 返却前 |
| `provider_error_returned` | Error Contract 返却 |
| `provider_timeout_occurred` | Timeout 所有 Layer 検知 |
| `provider_retry_requested` | Retry 所有 Layer が retry |
| `provider_capability_rejected` | unsupported_capability |

Platform metrics と Future Real Metrics は **分離**。

---

## 21. Provider Testing Strategy

Design / Machine Check（**実 API テストなし**）:

| 検証 | 内容 |
|------|------|
| Contract validation | Input / Output / Error schema 整合 |
| Capability validation | 宣言と Contract 一致 |
| Error contract validation | §11 全 kind 定義 |
| Configuration validation | non-secret schema |
| Credential requirement validation | 宣言のみ — secret なし |
| Side effect declaration validation | query vs command |
| Compatibility validation | Catalog / Boundary 整合 |
| Documentation validation | Quality Pipeline Test 494–505 |

---

## 22. Provider Anti-Patterns

| Anti-Pattern | 問題 |
|--------------|------|
| Direct external API call from Application Layer | Boundary 違反 |
| Provider-specific logic in Application Layer | Coupling |
| Secret embedded in Provider Contract | Security |
| Hidden retry | Retry ownership 不明 |
| Hidden timeout | Timeout ownership 不明 |
| Mixed command/query provider | Side effect 不可预测 |
| Provider owning runtime | 責務逆転 |
| Provider owning OAuth lifecycle | Layer 混同 |
| Provider leaking SDK response | Upward leak |
| Provider bypassing Adapter | External detail 漏洩 |

---

## 23. Provider Extension Criteria

新 Provider 設計（将来実装前）に必要:

| # | 条件 |
|---|------|
| E1 | [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — Provider Entry Criteria |
| E2 | 本書 §8–§20 に従った Contract 草案 |
| E3 | [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) — ADR + Reviews |
| E4 | [NON_GOALS.md](./NON_GOALS.md) — Provider 節解除 ADR（実装時） |
| E5 | Public Contract Catalog additive 登録計画 |

v1.54.0: **Extension Criteria 文書化のみ** — 新 Provider 実装なし。

---

## 24. Governance Flow Integration

- Provider Layer Design 変更は **future layer design change**（[GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md)）
- Provider **実装**着手は **implementation enabling change** — 全 Review 必須
- v1.54.0 追加は **architecture governance change** — Production Code 変更なし

---

## 25. Future Entry Criteria Integration

- [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) — **Provider Entry Criteria** が実装 Gate
- 本書は Entry Criteria の **設計詳細** — Gate 通過 ≠ 実装許可（Non-Goals 解除 ADR 別途）
- Provider Design 完成 ≠ **Level 4** 自動到達

---

## 26. Compatibility Requirements

- 既存 Application Foundation Public Contract **後方互換**
- Provider Contract 追加は **additive default**
- Breaking Provider Contract は Major + ADR + [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md)
- Mock Provider（将来）は既存 rule-based MVP と **同一 output shape** 維持

---

## 27. Completion Criteria

Provider Layer Design 文書の完成条件（v1.54.0）:

- [x] PROVIDER_LAYER_DESIGN.md 存在（§1–§27）
- [x] FUTURE_LAYER_BOUNDARIES / LAYER_INTERACTION_MODEL **未変更**
- [x] Provider **実装なし**
- [x] Production Code **変更なし**
- [x] Architecture Documents **25** 必須文書
- [x] Quality Pipeline **505 PASS**（Test 494–505）
- [x] Level 4 **未宣言**

---

## Related Documents

| 文書 | 関係 |
|------|------|
| [FUTURE_LAYER_BOUNDARIES.md](./FUTURE_LAYER_BOUNDARIES.md) | Provider Layer Boundary |
| [LAYER_INTERACTION_MODEL.md](./LAYER_INTERACTION_MODEL.md) | Interaction Contract |
| [FUTURE_ARCHITECTURE.md](./FUTURE_ARCHITECTURE.md) | Provider Layer 構想 |
| [FUTURE_ENTRY_CRITERIA.md](./FUTURE_ENTRY_CRITERIA.md) | Provider Entry Gate |
| [GOVERNANCE_FLOW.md](./GOVERNANCE_FLOW.md) | Review Process |
| [NON_GOALS.md](./NON_GOALS.md) | 実装禁止 |
