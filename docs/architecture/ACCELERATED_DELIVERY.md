# Accelerated Delivery Model

AI-SNS-Automation における **Accelerated Delivery** の公式運用定義です。品質・Governance を維持しながら、通常の変更サイクルを高速化するための標準フロー・ツール・役割分担を定義します。

> **Boundary:** 本書は **Delivery Process の設計** です。Provider Authorization / Endpoint Approval / Real Provider / External IO / Automatic SNS Publishing は許可しません。

---

## 1. Operating Model

### 役割分担

| 担当 | 責務 |
|------|------|
| **Claude Code** | Repository inspection / Implementation / Self-review / Bounded remediation / Exact allowlist verification / Quality & Catalog execution / Governance verification / Commit preparation / commit-tree + update-ref CAS / Commit reverification / Push preparation / Authorized push execution / Post-push verification / Final Report generation |
| **ChatGPT / Human** | Product objective / Authorization boundary decisions / Architecture decisions / Acceptance criteria / Final Report review / Next product slice selection |

### 変更の分類

| 分類 | フロー |
|------|--------|
| **通常変更**（documentation / implementation / remediation） | Accelerated 4-step cycle |
| **高リスク変更**（Provider Authorization / Endpoint Approval / secret handling / release declaration / destructive migration） | 従来型厳格フェーズ（個別ゲート必須） |

---

## 2. Standard 4-Step Accelerated Cycle

通常変更はこの 4 ステップで完結します。

```
1. Product Slice Planning
   → 変更スコープ・manifest 定義・acceptance criteria 確認

2. Implement + Automated Verification + Bounded Remediation
   → 実装 → delivery_gate.sh verify → 自動修正 → 再検証

3. Commit + Publish
   → delivery_gate.sh commit  (commit-tree + CAS)
   → delivery_gate.sh publish (push origin main + post-push verify)

4. Production Observation
   → post-push state confirmation
   → Quality / Catalog re-verification
```

---

## 3. Delivery Gate CLI

### エントリーポイント

```
scripts/delivery_gate.sh <mode> [options]
```

### Modes

| Mode | 説明 |
|------|------|
| `help` | ヘルプ表示 |
| `verify` | Read-only: repo / scope / governance / Quality / Catalog 検証 |
| `prepare` | Verify + staging 予定の表示（常に dry-run safe） |
| `commit` | Verify + stage + commit-tree + update-ref CAS |
| `publish` | Verify + commit + push + post-push verify |
| `full` | すべてのステップを順に実行 |
| `report` | 現在状態からレポート生成のみ |

### 主要オプション

| オプション | 説明 |
|-----------|------|
| `--manifest <path>` | JSON manifest ファイルパス（必須） |
| `--dry-run` | 実行予定を表示するが、repo / index / remote を変更しない |
| `--report-dir <path>` | レポート出力先（デフォルト: `reports/delivery-gate/latest/`） |
| `--no-network` | ネットワークアクセスを要するステップをスキップ |
| `--verbose` | 詳細出力 |

### 使用例

```bash
# 変更の事前検証（read-only）
./scripts/delivery_gate.sh verify --manifest config/delivery/my_manifest.json

# commit の予定確認（dry-run）
./scripts/delivery_gate.sh commit --dry-run --manifest config/delivery/my_manifest.json

# commit 実行（commit-tree + CAS）
./scripts/delivery_gate.sh commit --manifest config/delivery/my_manifest.json

# push の予定確認（dry-run）
./scripts/delivery_gate.sh publish --dry-run --manifest config/delivery/my_manifest.json

# push 実行
./scripts/delivery_gate.sh publish --manifest config/delivery/my_manifest.json

# 全ステップ dry-run
./scripts/delivery_gate.sh full --dry-run --manifest config/delivery/my_manifest.json
```

---

## 4. Manifest Format

変更単位を JSON で記述します。スキーマ: `config/delivery/manifest_schema.json`

### 最小必須項目

| 項目 | 型 | 説明 |
|------|----|------|
| `schema_version` | string | `"1.0"` 固定 |
| `change_id` | string | 変更ユニーク ID |
| `commit_subject` | string | コミットメッセージ subject（1行のみ） |
| `allowed_paths` | string[] | 変更を許可するファイルパスの完全列挙 |
| `expected_file_count` | integer | `allowed_paths` の要素数と一致必須 |

### 安全なデフォルト値

| 項目 | デフォルト | 説明 |
|------|-----------|------|
| `allow_delete` | `false` | 削除は明示 opt-in |
| `allow_rename` | `false` | リネームは明示 opt-in |
| `version_assignment` | `"none"` | バージョン未割り当て |
| `tag_policy` | `"none"` | タグ作成なし |
| `push_policy` | `"none"` | push なし（`"main_only"` で有効化） |
| `provider_authorization` | `"none"` | Provider 未認可 |
| `endpoint_approval` | `"none"` | Endpoint 未承認 |
| `external_io` | `"prohibited"` | External IO 禁止 |
| `real_provider` | `"prohibited"` | Real Provider 禁止 |
| `automatic_publishing` | `"prohibited"` | 自動 SNS 禁止 |
| `force_push` | `"prohibited"` | force push 禁止（変更不可） |

---

## 5. Exit Codes

| Code | 意味 |
|------|------|
| 0 | 成功 |
| 1 | 使用方法エラー |
| 2 | Repository identity 不一致 |
| 3 | Dirty working tree |
| 4 | Staged state mismatch |
| 5 | Allowlist mismatch |
| 6 | Forbidden path 検出 |
| 7 | Delete 検出 |
| 8 | Rename 検出 |
| 9 | Governance violation |
| 10 | Quality Pipeline 失敗 |
| 11 | Catalog 失敗 |
| 12 | Commit identity 不一致 |
| 13 | CAS failure |
| 14 | Push preflight 失敗 |
| 15 | Push 失敗 |
| 16 | Post-push verification 失敗 |
| 17 | Manifest schema エラー |
| 18 | Unexpected untracked file |

---

## 6. Safety Model

### Commit 方式

通常の `git commit` は **使用禁止**。

```
git write-tree                           # staged tree を確定
git commit-tree <tree> -p <parent>      # commit object 作成
git update-ref refs/heads/main <new> <old>  # CAS で ref 更新
```

`update-ref` は必ず old commit を指定した **Compare-And-Swap** 方式。

### 禁止事項（ツール設計レベルで強制）

- `git add .` / `git add -A`（implicit staging 禁止）
- `git commit` / `git commit --amend`（normal commit 禁止）
- force push（`--force` / `--force-with-lease`）
- 自動 tag 作成
- 自動バージョン割り当て
- Provider Authorization の自動付与
- Endpoint Approval の自動付与
- External IO の自動有効化
- Real Provider の自動有効化
- Automatic SNS publishing の自動有効化

---

## 7. High-Risk Changes — Strict Phase Retention

以下は Accelerated Cycle の対象外です。個別フェーズゲートを維持してください。

| 変更種別 | 理由 |
|----------|------|
| Provider Authorization | 独立した human approval 必須 |
| Endpoint Approval | 独立した human approval 必須 |
| Authentication / Secret handling | P2A 境界定義に従う |
| Destructive migration | 影響範囲が広く reversibility が低い |
| Production enablement | Level 4 / Global Production Ready 宣言が前提 |
| Release / version declaration | BASELINE_SYNCHRONIZATION.md 手順に従う |
| High-risk governance change | ADR / Independent Review 必須 |

---

## 8. Failure Recovery

失敗時の操作:

1. `delivery_gate.sh verify` の出力でエラーを特定
2. Allowlist 内のみ修正
3. `verify` を再実行して確認
4. `commit` / `publish` へ進む

**禁止:**
- `git reset --hard`（変更を失う）
- `git commit --amend`（published commit の改ざん）
- force push
- Allowlist 外ファイルの変更

---

## 9. Reports

レポートは `reports/delivery-gate/latest/` に出力されます（`reports/` は `.gitignore` 対象）。

| ファイル | 内容 |
|---------|------|
| `delivery-gate-report.md` | Markdown 形式の実行レポート |
| `delivery-gate-report.json` | JSON 形式のマシン可読レポート |

---

## 10. Governance Boundary

本 Accelerated Delivery Foundation の適用範囲・境界:

- **適用対象:** documentation / implementation / remediation / Quality 変更
- **適用外:** Provider Authorization / Endpoint Approval / version declaration / tag creation / real provider / external IO
- **Current Governance State:** Level 3.19 / Real Provider Prohibited / External IO Prohibited / Authorized Provider None / Endpoints Not Approved（ADR-0024）
- **Commit 方式:** commit-tree + update-ref CAS のみ（normal git commit 禁止）
- **Push 対象:** `main` ブランチのみ（force 禁止 / tag push 禁止）
