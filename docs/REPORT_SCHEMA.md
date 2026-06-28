# report.json スキーマ定義

`reports/**/report.json` は、各種運用スクリプトの **実行結果を人間・機械の両方で読める JSON** として保存する標準フォーマットです。

v1.2.1 では Nano Banana 画像改善レポート（`scripts/report_nano_banana_improvement.js`）が初の実装例です。  
今後 **Smart Auto Fix / Doctor / Health Check / Image Review** なども、同じ骨格を共有します。

---

## 目的

| 用途 | 説明 |
|------|------|
| 実行結果の統合 | 複数ソース（manifest、review_result 等）を 1 ファイルにまとめる |
| CI / n8n 連携 | `summary` の件数・`items[].recommendation` で分岐 |
| 人間向け Markdown の元データ | `report.md` は `report.json` から生成可能 |
| 監査・再現 | `generatedAt` / 入力ファイルパス / エラー内容を残す |

`reports/` 配下は **Git 管理対象外**（`.gitignore` で除外）。

---

## schemaVersion

| 値 | 意味 |
|----|------|
| **`"1.0"`** | v1.2.1 時点の共通 report 骨格（現行） |

読み込み側は `schemaVersion` 未設定の古い report を **`"1.0"` 相当** として扱ってよい（後方互換）。

---

## 全 report 共通の必須フィールド（ルート）

| フィールド | 型 | 説明 |
|------------|-----|------|
| `schemaVersion` | `string` | スキーマ識別子。現行 `"1.0"` |
| `tool` | `string` | レポート生成ツール識別子（ツールごとに固定文字列） |
| `version` | `string` | 生成スクリプトのリリースラベル。例：`"v1.2.1"` |
| `generatedAt` | `string` | ISO 8601 形式の生成日時 |
| `summary` | `object` | 集計サマリー（下記「summary の基本方針」） |
| `items` | `array` | 明細行（下記「items[] の基本方針」） |

### tool 識別子の例（将来拡張）

| tool | 生成元（予定・例） |
|------|-------------------|
| `nano_banana_image_improvement_report` | `scripts/report_nano_banana_improvement.js` |
| `smart_auto_fix_report` | Smart Auto Fix レポート JSON 化（将来） |
| `doctor_report` | Doctor 診断 JSON 化（将来） |
| `health_check_report` | Health Check 結果 JSON 化（将来） |
| `image_review_report` | 画像レビュー統合レポート（将来） |
| **`quality_pipeline_report`** | **`src/lib/pipeline_report.js`（v1.3+）** |

---

## quality_pipeline_report の追加フィールド（v1.4.0）

`tool: "quality_pipeline_report"`、`version: "v1.4.0"` 以降、summary / items に以下が **任意フィールド** として追加されます（後方互換：追加のみ）。

### summary 追加（v1.4）

| フィールド | 型 | 説明 |
|------------|-----|------|
| `textChainConnected` | `boolean` | TEXT チェーン（Smart Auto Fix → Regeneration）が improvement history に存在するか |
| `executedSmartAutoFix` | `number` | Smart Auto Fix 実行数（dry-run 時は planned 含む） |
| `successfulSmartAutoFix` | `number` | Smart Auto Fix 成功数 |
| `failedSmartAutoFix` | `number` | Smart Auto Fix 失敗数 |
| `executedRegeneration` | `number` | Regeneration 実行数 |
| `successfulRegeneration` | `number` | Regeneration 成功数 |
| `failedRegeneration` | `number` | Regeneration 失敗数 |
| `executedGeminiReReview` | `number` | Gemini ReReview 実行数 |

### items[] 追加（v1.4）

| フィールド | 型 | 説明 |
|------------|-----|------|
| `improvementPipeline` | `string[] \| null` | 例：`["smart_auto_fix", "regeneration_engine"]` |
| `regenerationAdapter` | `string \| null` | 例：`"nano_banana"` |
| `smartAutoFixStatus` | `string \| null` | 例：`planned` / `applied` / `skipped` |
| `regenerationStatus` | `string \| null` | 例：`planned` / `improved` / `failed` |
| `textChainConnected` | `boolean` | 当該スライドが TEXT チェーン対象か |
| `source` | `string \| null` | scoreSummary source。`smart_auto_fix_re_review` / `nano_banana_re_review` 等 |

### reviewStatus 値（v1.4 拡張）

| 値 | 意味 |
|----|------|
| `reviewed` | ReReview 完了（`smart_auto_fix_re_review` または `nano_banana_re_review`） |
| `planned` | dry-run 時の TEXT チェーン計画 |
| `review_pending` | improved だが ReReview 未反映 |

### metrics.json（pipeline_metrics）v1.4 追加

`metrics.improvement` ブロックに以下を追加（累積）:

| フィールド | 説明 |
|------------|------|
| `executedSmartAutoFix` | Smart Auto Fix 実行数 |
| `successfulSmartAutoFix` | 成功数 |
| `failedSmartAutoFix` | 失敗数 |
| `executedRegeneration` | Regeneration 実行数 |
| `successfulRegeneration` | 成功数 |
| `failedRegeneration` | 失敗数 |

### export_manifest selections[] 追加（v1.4）

| フィールド | 説明 |
|------------|------|
| `improvementTool` | manifest tool（`smart_auto_fix` 等） |
| `improvementPipeline` | 改善パイプライン |
| `regenerationAdapter` | 使用 adapter |
| `reviewSource` | ReReview source |
| `selectionReason` | `improved_adopted_text_chain`（TEXT チェーン採用時） |

---

## Nano Banana report の追加フィールド（v1.2.1）

`nano_banana_image_improvement_report` では、入力トレーサビリティのため次を **ルートに追加** します（削除・改名しない）。

| フィールド | 型 | 説明 |
|------------|-----|------|
| `manifestFile` | `string` | 入力 manifest のプロジェクト相対パス |
| `reviewResultFile` | `string` | 入力 review_result のプロジェクト相対パス |

---

## summary の基本方針

- **件数系** を必ず含める（総数・対象数・成功数・失敗数・スキップ数など）
- ツール固有のキー名は許容するが、**意味が分かる名前** に統一する
- 平均 score や差分など、**集計可能な数値** は `null` 可（対象 0 件時）
- `summary` は `items` から再計算可能であることが望ましい

### Nano Banana report の summary フィールド（参考）

| フィールド | 説明 |
|------------|------|
| `totalImages` | 総スライド数 |
| `targetCount` | 改善対象数（score &lt; 80） |
| `improvedCount` | 改善成功数 |
| `failedCount` | 改善失敗数 |
| `skippedCount` | 改善スキップ数 |
| `reviewedCount` | 再レビュー成功数 |
| `failedReviewCount` | 再レビュー失敗数 |
| `averageBeforeScore` | 再採点済み item の改善前平均 |
| `averageAfterScore` | 改善後平均 |
| `averageDeltaScore` | 平均差分 |
| `publishRecommendedCount` | recommendation が `publish_recommended` の件数 |
| `passCount` | `passed` の件数 |
| `needsReImprovementCount` | `needs_re_improvement` の件数 |

---

## items[] の基本方針

- **1 要素 = 1 論理単位**（Nano Banana では 1 スライド）
- 識別子（`slideId` 等）を必ず含める
- 処理前後の状態（score、status、rootCause 等）を並置できる構造にする
- 失敗時は `error` にメッセージを残す（null 可）
- 推奨アクションは `recommendation` に集約する（下記）

### Nano Banana report の items フィールド（参考）

| フィールド | 説明 |
|------------|------|
| `slideId` | スライド ID |
| `sourceImagePath` | 元画像パス |
| `improvedImagePath` | 改善画像パス |
| `beforeScore` / `afterScore` / `deltaScore` | 採点と差分 |
| `beforeRootCause` / `afterRootCause` | rootCause |
| `improvementStatus` | manifest の改善 status |
| `reviewStatus` | review_result の status |
| `elapsedMs` / `reviewElapsedMs` | 所要時間 |
| `attempts` | API 試行回数 |
| `error` | エラーメッセージ |
| `recommendation` | 推奨アクション（下記） |

---

## recommendation 値の定義

`items[].recommendation` は、**次に取るべきアクション** を機械可読に表します。

| 値 | 意味 |
|----|------|
| **`publish_recommended`** | 再レビュー後 score ≥ 90。公開推奨 |
| **`passed`** | 再レビュー後 score ≥ 80 かつ &lt; 90。合格 |
| **`needs_re_improvement`** | 再レビュー後 score &lt; 80。再改善候補 |
| **`improvement_failed`** | Nano Banana 改善が `failed` |
| **`review_pending`** | 改善済みだが再レビュー未実施、または dry-run / スキップ |

### 判定優先順位（Nano Banana）

1. manifest `status: failed` → `improvement_failed`
2. `status: improved` かつ `afterScore` あり → score 帯で `publish_recommended` / `passed` / `needs_re_improvement`
3. 上記以外 → `review_pending`

---

## 後方互換性ルール

v1.3 / v2.0 以降、report.json を読み書きする際は次を守ります。

1. **既存フィールドを削除しない**
2. **既存フィールド名を変更しない**
3. **新規フィールドは追加のみ**（任意フィールドとして追加可能）
4. **破壊的変更が必要な場合は `schemaVersion` を上げる**（例：`"2.0"`）

### 読み込み側の推奨

```javascript
const schemaVersion = report.schemaVersion ?? "1.0";
const tool = report.tool ?? "unknown";
```

- `schemaVersion` 未知 → 警告し、既知フィールドのみ利用
- `tool` 不一致 → 想定外レポートとして警告（処理は続行可）

---

## 関連ドキュメント

| ファイル | 内容 |
|----------|------|
| [MANIFEST_SCHEMA.md](./MANIFEST_SCHEMA.md) | manifest.json スキーマ |
| [CLI_EXIT_CODES.md](./CLI_EXIT_CODES.md) | CLI 終了コード |
| [V1.4_SMART_AUTO_FIX_INTEGRATION_DESIGN.md](./V1.4_SMART_AUTO_FIX_INTEGRATION_DESIGN.md) | v1.4 Smart Auto Fix 統合 |
| [CHANGELOG.md](./CHANGELOG.md) | バージョン履歴 |

---

*スキーマ初版：v1.2.1（schemaVersion `"1.0"`、tool `nano_banana_image_improvement_report`）*  
*v1.4.0 追記：tool `quality_pipeline_report` の summary / items / metrics / export 拡張*
