# P3A — Approval Record Specification

**Document type:** P3A Approval Record Specification（docs-only; no implementation）
**Lifecycle:** P3A — **Specification Complete**; P3B Implementation **Not Authorized**
**Authority:** [ADR-0024](../adr/ADR-0024-bounded-productization-entry.md)
**Related:** [P3_HUMAN_APPROVAL_WORKFLOW_PLANNING.md](./P3_HUMAN_APPROVAL_WORKFLOW_PLANNING.md), [SECURITY_CREDENTIAL_BOUNDARY.md](./SECURITY_CREDENTIAL_BOUNDARY.md), [P2_THREAT_MODEL.md](./P2_THREAT_MODEL.md), [TEXT_POST_SLICE.md](./TEXT_POST_SLICE.md)

---

## 1. Purpose

Approval Record は、CLI オペレーターが特定コンテンツを承認した事実を、プロセス境界をまたいで検証可能な形式で永続化するための **署名なし JSON アーティファクト** である。

本書は Approval Record の:

- フィールド定義とスキーマ
- 禁止フィールド（secret material 混入防止）
- ストレージ仕様（場所・gitignore 要件）
- 検証コントラクト（`validateApprovalRecord()` が確認すべき条件）
- 無効化ルール（どのような場合に承認が失効するか）
- 脅威モデルとの対応（T-14, T-15）
- P3B 実装要件

を正式に定義する。本書は **仕様のみ**。コード変更を許可しない。

---

## 2. Scope

### 2.1 In scope

- Approval Record JSON フォーマット定義
- フィールドごとの型・制約・意味
- 禁止フィールドリスト
- ストレージパス規約
- `.gitignore` 追記要件（P3B 実装時の参照仕様）
- `validateApprovalRecord()` 検証コントラクト
- 承認無効化条件
- cross-session digest 検証プロトコル
- 監査イベントコントラクト（P3B 実装時の参照仕様）

### 2.2 Out of scope（not authorized）

- `validateApprovalRecord()` 実装（P3B）
- `text_post_approval_file_store.js` 実装（P3B）
- `text_post_approve.js` CLI 実装（P3B）
- `.gitignore` への `tmp/` 追記（P3B）
- Real Provider / External IO / OAuth / credentials
- Automatic approval
- Approval expiry enforcement（P5/P6）
- Remote approval（webhook / email）

---

## 3. Approval Record Format

### 3.1 正規フォーマット

```json
{
  "schema_version": "1.0",
  "actorId": "<operator-identity-string>",
  "approvedAt": "<ISO-8601-UTC>",
  "correlationId": "<corr-id>",
  "contentDigest": "sha256:<64-hex-chars>",
  "normalizedText": "<exact-approved-text>",
  "approvalMode": "dry_run",
  "providerId": "<provider-id-string>",
  "expiresAt": null
}
```

### 3.2 フィールド定義

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `schema_version` | `string` | ✅ | 固定値 `"1.0"` |
| `actorId` | `string` | ✅ | 承認したオペレーターの識別子（空文字禁止）。認証情報ではない |
| `approvedAt` | `string` | ✅ | ISO-8601 UTC タイムスタンプ（例: `2026-08-12T11:00:00.000Z`）|
| `correlationId` | `string` | ✅ | 対応する publication attempt の correlation ID（空文字禁止）|
| `contentDigest` | `string` | ✅ | `sha256:<hex>` 形式。承認時の `normalizedText` のダイジェスト |
| `normalizedText` | `string` | ✅ | 承認された正規化テキスト（空文字禁止）。digest の原文 |
| `approvalMode` | `string` | ✅ | P3B では `"dry_run"` のみ許容。将来: `"live"` は P4+ |
| `providerId` | `string` | ✅ | 対象 provider の ID（例: `"x-text-post-mock-provider"`） |
| `expiresAt` | `string \| null` | ✅ | P3B では `null` 固定。expiry は P5/P6 で実装 |

### 3.3 制約

| # | 制約 |
|---|------|
| C-01 | `schema_version` は `"1.0"` のみ許容（将来バージョンは別仕様で定義）|
| C-02 | `actorId` は 1 文字以上の文字列（trim 後も空文字でないこと）|
| C-03 | `approvedAt` は ISO-8601 形式としてパース可能であること |
| C-04 | `correlationId` は 1 文字以上の文字列 |
| C-05 | `contentDigest` は `sha256:` プレフィックス + 64 文字の hex |
| C-06 | `normalizedText` は 1 文字以上 |
| C-07 | `approvalMode` は `"dry_run"` （P3B の実装スコープ内）|
| C-08 | `providerId` は 1 文字以上の文字列 |
| C-09 | `expiresAt` は `null` または ISO-8601 文字列（P3B では `null` のみ）|
| C-10 | Approval Record は **追加フィールドを禁止**（下記 §4 の禁止フィールドを含むいかなる未知フィールドも拒否）|

---

## 4. 禁止フィールド

以下のフィールド名は Approval Record に **絶対に含まれてはならない**:

```text
secret       token        password      apiKey        oauth
accessToken  refreshToken clientSecret  credential    bearer
value        apiSecret    authToken     sessionToken  privateKey
```

**実装要件（P3B）:**

- `validateApprovalRecord()` は上記フィールドの存在を検出した場合、即時 `{ ok: false, error: "forbidden field in approval record: <fieldName>" }` を返す
- パース前に禁止フィールドを検出する（JSON.parse 後のオブジェクトキー走査）
- 大文字小文字の正規化（`toLowerCase()`）後にチェックすること（`Token`, `TOKEN` なども検出）

---

## 5. ストレージ仕様

### 5.1 保存先パス

```text
tmp/approvals/approval-{correlationId}.json
```

例:

```text
tmp/approvals/approval-corr-00000001.json
```

### 5.2 ルール

| # | ルール |
|---|--------|
| S-01 | `tmp/` ディレクトリは **Git 追跡対象外**（`.gitignore` に追記必須、下記 §5.3 参照）|
| S-02 | Approval Record ファイルを `git add` することは **禁止** |
| S-03 | ファイル名は `approval-{correlationId}.json` 固定パターン（パストラバーサル禁止）|
| S-04 | `correlationId` にパス区切り文字（`/`, `\`, `..`）や改行を含む場合はファイル名生成を拒否 |
| S-05 | `tmp/approvals/` ディレクトリが存在しない場合、書き込み前に自動作成（mkdir -p 相当）|
| S-06 | ファイルはプロセス終了後も残留する（永続化が目的）。削除は手動またはクリーンアップ CLI で行う |
| S-07 | 同一 `correlationId` の既存ファイルが存在する場合、上書きを **禁止** し `DUPLICATE_APPROVAL_RECORD` エラーを返す |

### 5.3 `.gitignore` 追記要件（P3B 実装時）

P3B の実装フェーズで `.gitignore` に以下を追記する:

```gitignore
# P3 Approval Records (local only; never commit)
tmp/
```

**現時点（P3A）では `.gitignore` を変更しない。**

---

## 6. 検証コントラクト

### 6.1 `validateApprovalRecord(record)` インターフェース

```text
Input:  unknown（raw parsed JSON）
Output: { ok: true }
     OR { ok: false, error: string }
```

### 6.2 検証順序

P3B の実装は以下の順序で検証を行うこと:

```text
1. Type check      record が plain object（Array / null ではない）
2. Forbidden fields  §4 の禁止フィールドが存在しないか確認
3. schema_version  === "1.0"
4. actorId         string, trim 後 length >= 1
5. approvedAt      string, ISO-8601 パース可能
6. correlationId   string, trim 後 length >= 1
7. contentDigest   string, /^sha256:[0-9a-f]{64}$/ にマッチ
8. normalizedText  string, length >= 1
9. approvalMode    === "dry_run"（P3B 実装スコープ）
10. providerId     string, length >= 1
11. expiresAt      null または string（P3B では null のみ）
```

検証エラーは最初に検出した問題を返す（early-exit）。

### 6.3 Cross-session Digest 検証プロトコル

`requestDryRunPublish` が file-backed approval を受け取った場合、以下を検証する:

```text
Step 1  validateApprovalRecord(record) → ok
Step 2  liveDigest = contentDigest(content.normalizedText)  ← 現在のコンテンツ
Step 3  liveDigest === record.contentDigest                 ← record の digest と一致
Step 4  content.normalizedText === record.normalizedText    ← テキスト直接一致
Step 5  record.approvalMode === "dry_run"                   ← P3B スコープ内
Step 6  record.providerId === 期待 providerId               ← provider 一致
```

いずれかが失敗した場合: `APPROVAL_CONTENT_MISMATCH` または `APPROVAL_REQUIRED` を返す。
Network 実行は行わない。

---

## 7. 承認無効化ルール

以下のいずれかに該当する場合、Approval Record は **無効（invalid）** として扱う:

| # | 無効化条件 | エラー種別 |
|---|-----------|-----------|
| I-01 | `validateApprovalRecord()` が失敗 | `APPROVAL_REQUIRED` |
| I-02 | `contentDigest` が現在の `normalizedText` のダイジェストと不一致 | `APPROVAL_CONTENT_MISMATCH` |
| I-03 | `normalizedText` フィールドが現在の `content.normalizedText` と不一致 | `APPROVAL_CONTENT_MISMATCH` |
| I-04 | `providerId` が現在の実行ターゲット provider と不一致 | `APPROVAL_REQUIRED` |
| I-05 | `approvalMode` が `"dry_run"` 以外（P3B スコープ内）| `APPROVAL_REQUIRED` |
| I-06 | `expiresAt` が非 null かつ現在時刻より過去（P5/P6 実装後）| `APPROVAL_REQUIRED`（将来）|
| I-07 | 禁止フィールドが含まれる | `APPROVAL_REQUIRED` |

**Automatic re-approval は禁止。** 無効化後はオペレーターが明示的に再承認する必要がある。

---

## 8. 脅威モデル対応

### T-14: Approval bypass（承認迂回）

| 攻撃パターン | Approval Record による防止 |
|------------|--------------------------|
| actorId を省略して publish | C-02 で拒否（必須 non-empty）|
| approval なしで publish 呼び出し | `requestDryRunPublish` が `approval` 必須チェック（既存） |
| ファイルなしで --approval フラグ | ファイル読み込み失敗 → `APPROVAL_REQUIRED` |
| 空ファイルで --approval | `validateApprovalRecord()` が失敗 |
| 禁止フィールド混入で迂回試行 | §4 チェックで拒否 |

### T-15: Content changed after approval（承認後コンテンツ変更）

| 変更パターン | Cross-session 検証による防止 |
|------------|---------------------------|
| テキスト変更後に同じ approval ファイルで publish | I-02 / I-03 で検出 → `APPROVAL_CONTENT_MISMATCH` |
| digest のみ書き換え（テキスト不変）| I-03（テキスト直接比較）で検出 |
| テキストのみ書き換え（digest 不変）| I-02（digest 再計算）で検出 |
| 両方書き換え（完全偽造）| `validateApprovalRecord()` 通過後も contentDigest(live) ≠ record.contentDigest |

---

## 9. 監査イベントコントラクト（P3B 実装参照仕様）

P3B の実装で追加する監査イベント（既存 `text_post_audit.js` へ追記）:

| イベント種別 | トリガー | 必須フィールド |
|------------|---------|--------------|
| `approval_record_written` | CLI が approval ファイルを書き込んだとき | `correlation_id`, `actor_id`, `content_digest`, `provider_id` |
| `approval_record_loaded` | publish 前に approval ファイルを読み込んだとき | `correlation_id`, `content_digest` |
| `approval_record_invalid` | cross-session 検証が失敗したとき | `correlation_id`, `error_category` |
| `approval_record_validated` | cross-session 検証が成功したとき | `correlation_id`, `content_digest`, `actor_id` |

**禁止:** イベントに `normalizedText`（コンテンツ本文）を含めない（大きくなりうる）。`content_digest` のみで十分。

---

## 10. P3B 実装要件サマリー

本仕様から導かれる P3B の最低実装要件:

| # | 要件 |
|---|------|
| R-01 | `validateApprovalRecord(record)` — §6.2 の順序で検証 |
| R-02 | `writeApprovalRecord(record, correlationId)` — `tmp/approvals/` に書き込み。重複防止（S-07）|
| R-03 | `readApprovalRecord(correlationId)` — ファイル読み込み・JSON パース・`validateApprovalRecord` 呼び出し |
| R-04 | `buildApprovalRecord({ actorId, content, correlationId, providerId })` — §3.1 形式のオブジェクト生成 |
| R-05 | `text_post_approve.js` CLI — コンテンツ表示 → operator 確認 → `buildApprovalRecord` → `writeApprovalRecord` |
| R-06 | `requestDryRunPublish` 拡張 — `--approval <path>` を受け取り §6.3 プロトコルで検証 |
| R-07 | `.gitignore` 追記 — `tmp/` を追加 |
| R-08 | 監査イベント追加 — §9 の 4 イベントを `AUDIT_EVENT_TYPE` に追加 |
| R-09 | P3 offline tests — `scripts/test_text_post_approval.sh` |
| R-10 | TP-AUX hook 追加 — Quality Pipeline が P3 テストを自動実行 |

---

## 11. 明示的非目標

| 非目標 | 理由 |
|--------|------|
| `validateApprovalRecord()` 実装 | P3B |
| ファイルストア実装 | P3B |
| CLI 実装 | P3B |
| `.gitignore` 変更 | P3B |
| Real Provider / External IO | 禁止 |
| Automatic approval | MVP 境界禁止 |
| Approval expiry 実装 | P5/P6 |
| Remote approval | MVP 境界外 |
| Approval record への署名 | MVP 境界外（将来 Epic） |
| Catalog 変更 | 不要（approval record は Provider Contract ではない）|

---

## 12. ガバナンスマーカー

```text
P3-Plan:      Complete / Published（2de47d0…）
P3A-Spec:     In Progress（本文書）
P3-ImplAuth:  Not Authorized（P3A IR A.GO 後に開始）
P3B-Impl:     Not Started / Not Authorized
P3-IR:        Not Started
Real Provider: Prohibited
External IO:   Prohibited
Version:       Not Assigned
```

---

## Document Control

| Field | Value |
| ----- | ----- |
| Status | **Specification Complete** |
| Implementation | **Not Authorized**（P3-ImplAuth ゲート必要）|
| Real Provider / External IO | **Prohibited** |
| Version | **Not Assigned** |
| Mutation | Requires P3A governance update + re-review |
