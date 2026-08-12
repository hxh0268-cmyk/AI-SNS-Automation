# P3 Implementation Authorization (P3-ImplAuth)

**Document type:** P3 Implementation Authorization
**Lifecycle:** P3-ImplAuth — **Authorization Granted**; P3B Implementation **Authorized**
**Authority:** [ADR-0024](../adr/ADR-0024-bounded-productization-entry.md)
**Related:** [P3_HUMAN_APPROVAL_WORKFLOW_PLANNING.md](./P3_HUMAN_APPROVAL_WORKFLOW_PLANNING.md), [P3_APPROVAL_RECORD_SPEC.md](./P3_APPROVAL_RECORD_SPEC.md), [SECURITY_CREDENTIAL_BOUNDARY.md](./SECURITY_CREDENTIAL_BOUNDARY.md), [P2_THREAT_MODEL.md](./P2_THREAT_MODEL.md), [LAYER_MODEL.md](./LAYER_MODEL.md)

---

## 1. Authorization Summary

| Field | Value |
| ----- | ----- |
| Phase | **P3B — Human Approval Workflow Foundation Implementation** |
| Authorization | **GRANTED** |
| Scope | Approval Record validation / file store / CLI / Service extension / tests |
| Real Provider | **Prohibited** |
| External IO | **Prohibited** |
| OAuth / Credentials | **Prohibited** |
| Automatic approval | **Prohibited** |
| Version assignment | **Not Assigned**（versionless governance tip） |
| Catalog changes | **Not required**（approval record は Provider Contract ではない） |

---

## 2. Entry Conditions Verification

以下の条件をすべて満たしたことを確認した上で本認可を発行する。

| ID | Condition | Status |
| -- | --------- | ------ |
| IA-01 | P3A Approval Record Spec — Independent Review **A.GO** | ✅ **Satisfied** |
| IA-01r | P3A Re-verification（Remediation 後）— **A.GO** | ✅ **Satisfied** |
| IA-02 | P3 scope: no Real Provider / External IO / OAuth | ✅ **Confirmed**（see §6） |
| IA-03 | Architecture Review: Layer consistency | ✅ **Satisfied**（see §7） |
| IA-04 | ADR review: P3B scope では ADR 不要と判断 | ✅ **Satisfied**（see §8） |
| IA-05 | Compliance Checklist — Foundation Addition 節 | ✅ **Satisfied**（see §9） |
| IA-06 | Risk Review: T-14 / T-15 implementation risk | ✅ **Accepted**（see §10） |
| IA-07 | Public Contract Review: Catalog 変更不要 | ✅ **Satisfied**（see §11） |
| IA-08 | Compatibility Review: backward compat maintained | ✅ **Satisfied**（see §12） |
| — | Quality Pipeline **1232 PASS / 0 FAIL** | ✅ **Verified** |
| — | Catalog PASS（catalogVersion `1.0`） | ✅ **Verified** |
| — | HEAD = origin/main = `c63364d…` / divergence `0 0` | ✅ **Verified** |

---

## 3. Implementation Authorization Scope

### 3.1 Authorized new files

| File | Role |
| ---- | ---- |
| `src/lib/text_post_approval_record.js` | Approval Record validation（`validateApprovalRecord`）and serialization（`buildApprovalRecord`） |
| `src/lib/text_post_approval_file_store.js` | File-backed store（`writeApprovalRecord`, `readApprovalRecord`）under `tmp/approvals/` |
| `src/text_post_approve.js` | Operator-facing CLI: content presentation → explicit confirmation → record write |
| `scripts/test_text_post_approval.sh` | Offline P3 approval tests |

### 3.2 Authorized modifications to existing files

| File | Authorized change |
| ---- | ----------------- |
| `src/lib/text_post_service.js` | Add file-backed approval path to `requestDryRunPublish`（§6.3 cross-session protocol） |
| `src/lib/text_post_audit.js` | Add 4 new `AUDIT_EVENT_TYPE` constants（`approval_record_written/loaded/invalid/validated`） |
| `.gitignore` | Add `tmp/` entry（approval records must never be committed） |
| `scripts/test_quality_pipeline.sh` | Add TP-AUX hook invoking `test_text_post_approval.sh` |

### 3.3 Explicitly NOT authorized

| Item | Reason |
| ---- | ------ |
| `src/lib/text_post_draft.js`（新規 CLI）| 既存 `text_post_service.js` の `createDraft` + `validateDraft` をテストから呼ぶ形で対応可。別 Epic で検討 |
| Catalog changes（`providerContracts[]` 追加） | Approval Record は Provider Contract ではない |
| `src/lib/x_api_provider.js` 等のReal Provider ファイル | 禁止 |
| OAuth handler / token store / credential resolver | 禁止 |
| Network execution / HTTP client | 禁止 |
| Automatic approval logic | 禁止 |

---

## 4. Authorization Boundary

```
AUTHORIZED                          NOT AUTHORIZED
─────────────────────────────────   ──────────────────────────────────
Approval Record types               Real Provider adapter
File-backed approval store          External IO / network calls
Operator-facing approve CLI         OAuth / token handling
Service cross-session extension     Credential resolver / secret store
Audit event additions               Catalog Real Provider registration
.gitignore tmp/ entry               Automatic approval
P3 offline tests                    Multi-actor / remote approval
Quality Pipeline TP-AUX hook        Approval expiry enforcement (P5/P6)
```

```
Implementation perimeter:
  src/lib/text_post_approval_record.js
  src/lib/text_post_approval_file_store.js
  src/text_post_approve.js
  src/lib/text_post_service.js  (extend only; no Real Provider path)
  src/lib/text_post_audit.js    (AUDIT_EVENT_TYPE additions only)
  .gitignore                    (tmp/ entry only)
  scripts/test_text_post_approval.sh
  scripts/test_quality_pipeline.sh  (TP-AUX hook only)
```

---

## 5. Exit Criteria（P3B Complete-When）

P3B は以下をすべて満たしたとき完了とみなす:

| # | Criterion |
| - | --------- |
| E-01 | `validateApprovalRecord(record)` — §6.2 の 11ステップ検証を正確に実装 |
| E-02 | `buildApprovalRecord({ actorId, content, correlationId, providerId })` — §3.1 フォーマット生成 |
| E-03 | `writeApprovalRecord` — `tmp/approvals/approval-{correlationId}.json` 書き込み。重複防止（S-07） |
| E-04 | `readApprovalRecord` — 読み込み + `validateApprovalRecord` 呼び出し |
| E-05 | `text_post_approve.js` CLI — content 表示 → 明示確認 → record 書き込み |
| E-06 | `requestDryRunPublish` 拡張 — `approvalRecord` 引数で §6.3 cross-session 6ステップ検証 |
| E-07 | `.gitignore` に `tmp/` 追記済み |
| E-08 | `AUDIT_EVENT_TYPE` に 4 イベント追加済み |
| E-09 | `test_text_post_approval.sh` — offline テスト全件 PASS |
| E-10 | Quality Pipeline **1232+ PASS / 0 FAIL**（TP-AUX で P3 テストが実行される） |
| E-11 | Catalog 変更なし（baseline `providerContracts: 3 / publicContracts: 7` 維持） |
| E-12 | `tmp/approvals/` が `.gitignore` に含まれ、テストで approval record ファイルが commit されないことを確認 |
| E-13 | Approval record に secret 値が混入しないこと（`validateApprovalRecord` が禁止フィールドを検出して拒否） |
| E-14 | T-14 / T-15 の全攻撃パターンがテストでカバーされること |

---

## 6. 外部 IO / Real Provider 禁止維持の確認

P3B 実装は以下の禁止を **引き継ぐ**:

| 禁止事項 | 根拠 | 確認 |
| -------- | ---- | ---- |
| Real Provider 接続 | ADR-0024 / NON_GOALS.md | P3B スコープ外。`text_post_approval_file_store.js` は local file のみ |
| HTTP / DNS / socket | EXTERNAL_IO_BOUNDARY.md §3 | `text_post_approve.js` / store にネットワーク処理なし |
| Automatic SNS publishing | PRODUCT_MVP_BOUNDARY.md | Approval は dry-run のみ許可（`approvalMode: "dry_run"`） |
| Secret 値の永続化 | SECRET_HANDLING_POLICY.md §3 | Approval Record フォーマットは §4 禁止フィールドで保護 |
| Credential resolver / OAuth | SECURITY_CREDENTIAL_BOUNDARY.md | P3B スコープ外 |

**Kill-switch は引き続き default-OFF。** Approval record が存在しても kill-switch は自動的には有効化されない。

---

## 7. Architecture Review（IA-03）

### 7.1 Layer 配置

P3B の新規モジュールはすべて **Application Layer（Future Layer への境界設計内）** に配置する。

```
text_post_approval_record.js    → Application Layer（domain types）
text_post_approval_file_store.js → Application Layer（local file I/O; no network）
text_post_approve.js            → Application Layer（CLI entry point）
```

P3B は Provider Layer / Adapter / Runtime / Scheduler に触れない。LAYER_MODEL.md の Future Layer 依存ルールに抵触しない。

### 7.2 依存方向

```
text_post_approve.js (CLI)
  ↓
text_post_approval_record.js   ← domain types / validation
text_post_approval_file_store.js ← local persistence
text_post_service.js            ← extended requestDryRunPublish

text_post_approval_record.js
  ↓
text_post_content.js (contentDigest 参照)
text_post_lifecycle.js (ERROR_KIND 参照)
```

外向き（Provider Layer / Cloud / Network）への依存: **なし**

### 7.3 Public Contract 影響

`text_post_approval_record.js` / `text_post_approval_file_store.js` は **internal modules**。Public Contract Catalog への登録は不要（Approval Record は operator-local artifact であり Provider Contract ではない）。

---

## 8. ADR Review（IA-04）

**判定: ADR 不要**

ADR が必要な変更種別（GOVERNANCE_FLOW.md ADR Workflow 節）:

| 種別 | 該当 |
| ---- | ---- |
| 新規 Layer | No |
| Public Contract 変更 | No（Catalog 変更なし） |
| Dependency 変更 | No（既存 Application Layer 内） |
| External API 接続 | No |
| Runtime / Scheduler / Provider / OAuth / Database / Queue / Worker | No |

P3B は Application Layer 内部モジュールの追加であり、ADR 必須種別に該当しない。

---

## 9. Compliance Checklist（IA-05）

| Checklist 節 | 適用 | 判定 |
| ------------ | ---- | ---- |
| Foundation Addition | ✅ 適用（新規 lib モジュール追加） | PASS — Layer ルール遵守、Public Contract 変更なし、Backward Compat 維持 |
| Public Contract Change | ❌ 非適用（Catalog 変更なし） | N/A |
| Future Architecture Addition | ❌ 非適用（Design Only 節の変更なし） | N/A |
| Provider Runtime Scheduler API Pre Addition | ❌ 非適用（Provider / External IO に触れない） | N/A |
| Release Pre Check | ❌ 非適用（versionless; Pending Release None） | N/A |

**Result: PASS**

---

## 10. Risk Review（IA-06）

| Threat | 実装リスク | Mitigation |
| ------ | ---------- | ---------- |
| T-14: Approval bypass | Medium | `validateApprovalRecord()` 必須 / `requestDryRunPublish` で approval 引数チェック / テストカバレッジ |
| T-15: Content mutation | Medium | §6.3 cross-session 6ステップ / digest + text 2重比較 / テストカバレッジ |
| T-01: Secret in Git | Low | `.gitignore` + S-02（approval file commit 禁止）+ 禁止フィールド検証 |
| T-02: Secret logged | Low | audit fields allowlist（`content_digest` のみ; `normalizedText` 禁止） |
| Path injection（S-04） | Low | correlationId の sanitize チェック（`/`, `\`, `..`, newline 禁止） |

**Risk 判定: ACCEPTED**

Residual risk は Quality Pipeline（E-09/E-10）と P3-IR（Independent Review）で検証する。

---

## 11. Public Contract Review（IA-07）

Approval Record は local JSON artifact である。`src/lib/public_contract_catalog.js` の `providerContracts[]` / `publicContracts[]` への追加は **不要**。

Catalog baseline は変更しない:

```
catalogVersion:    1.0  (unchanged)
providerContracts: 3    (unchanged)
publicContracts:   7    (unchanged)
```

**Result: PASS — Catalog 変更なし**

---

## 12. Compatibility Review（IA-08）

P3B の変更は以下の方針で後方互換を維持する:

| 変更 | 互換性 |
| ---- | ------ |
| `requestDryRunPublish` に `approvalRecord` 引数追加 | Optional parameter（`null` デフォルト）— 既存の in-memory approve() パスを破壊しない |
| `AUDIT_EVENT_TYPE` に 4 定数追加 | Additive — 既存イベントを削除・変更しない |
| `.gitignore` に `tmp/` 追記 | Additive — 既存エントリを変更しない |
| `test_quality_pipeline.sh` に TP-AUX hook 追加 | Additive — 既存テスト番号（1232）を変更しない |

**Result: PASS — Breaking changes: なし**

---

## 13. Approval Workflow 整合性確認

P3B 実装は以下の承認フローチェーンを正確に実装すること:

```
[Draft]       createDraft(rawText)
     ↓
[Validate]    validateDraft(draft)
     ↓
[Present]     text_post_approve.js が normalizedText を表示
     ↓
[Confirm]     operator が --actor <id> で明示承認
     ↓
[Record]      buildApprovalRecord → writeApprovalRecord → tmp/approvals/approval-<corrId>.json
     ↓
[Publish]     requestDryRunPublish({ ..., approvalRecord: record })
     ↓
[Validate]    §6.3 cross-session 6ステップ検証
     ↓
[Gate]        kill-switch → idempotency → Gateway → Fake Adapter
     ↓
[Result]      dry_run_succeeded（real publish: 禁止）
```

**Automatic approval は禁止。** フロー上で人間の `--actor` 入力なしに承認が記録されてはならない。

---

## 14. Implementation Constraints

### 14.1 P3B に適用される制約（P2A からの継承）

| 制約 | 内容 |
| ---- | ---- |
| No network | `text_post_approval_file_store.js` は local file system のみ |
| No credentials | Approval Record に `token` / `secret` 等の禁止フィールド混入禁止 |
| Kill-switch default-OFF | Approval record の存在は kill-switch を自動 ON にしない |
| No real publish | `approvalMode: "dry_run"` のみ許容（§6.3 Step 5） |
| No catalog change | `providerContracts[]` / `publicContracts[]` 変更禁止 |

### 14.2 P3B 固有の制約

| 制約 | 内容 |
| ---- | ---- |
| Approval Record は `tmp/` のみ | `src/` / `docs/` / `reports/` への書き込み禁止 |
| `correlationId` sanitize 必須 | `S-04`: `/`, `\`, `..`, newline を含む場合はファイル名生成を拒否 |
| 重複書き込み禁止（S-07） | 同 correlationId の既存ファイルは上書きしない |
| Automatic re-approval 禁止 | 承認無効化後はオペレーターが再承認 |

---

## 15. Delivery Manifest Policy

P3B のコミットは以下のマニフェスト方針に従う:

```json
{
  "allowed_paths": [
    "src/lib/text_post_approval_record.js",
    "src/lib/text_post_approval_file_store.js",
    "src/text_post_approve.js",
    "src/lib/text_post_service.js",
    "src/lib/text_post_audit.js",
    ".gitignore",
    "scripts/test_text_post_approval.sh",
    "scripts/test_quality_pipeline.sh",
    "config/delivery/p3b_impl_manifest.json"
  ],
  "forbidden_paths": [
    ".env",
    "src/lib/x_api_provider.js",
    "src/lib/real_x_provider.js",
    "src/lib/oauth_handler.js",
    "src/lib/credential_resolver.js",
    "src/lib/token_store.js",
    "src/lib/x_api_client.js"
  ],
  "version_assignment": "none",
  "tag_policy": "none",
  "force_push": "prohibited",
  "provider_authorization": "none",
  "endpoint_approval": "none",
  "external_io": "prohibited",
  "real_provider": "prohibited",
  "automatic_publishing": "prohibited"
}
```

---

## 16. ガバナンスマーカー

```text
P3-Plan:      Complete / Published（2de47d0…）
P3A-Spec:     Complete / Published（c63364d…）
P3A-IR:       A.GO（Re-verification A.GO）
P3-ImplAuth:  GRANTED（本文書）
P3B-Impl:     Authorized / Not Started
P3-IR:        Not Started
Real Provider: Prohibited
External IO:   Prohibited
Version:       Not Assigned
```

---

## Document Control

| Field | Value |
| ----- | ----- |
| Status | **Implementation Authorization GRANTED** |
| P3B Implementation | **Authorized** |
| Real Provider / External IO | **Prohibited** |
| Version | **Not Assigned** |
| Mutation | Requires re-authorization if scope changes |
