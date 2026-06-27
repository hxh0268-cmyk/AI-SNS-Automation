# manifest.json スキーマ定義

`output/carousel/improved/manifest.json` は、Nano Banana 画像改善の実行結果を記録する JSON ファイルです。

v1.3 / v2.0 以降も同じファイルを安全に読み込めるよう、**スキーマバージョン** と **後方互換ルール** を固定します。

---

## 目的

| 用途 | 説明 |
|------|------|
| 改善実行の記録 | どのスライドを対象とし、成功 / 失敗 / スキップしたか |
| 下流ツールの入力 | `review_improved_images.js` / `report_nano_banana_improvement.js` が参照 |
| 監査・再現 | `elapsedMs` / `attempts` / `error` で API 実行の痕跡を残す |

---

## schemaVersion

| 値 | 意味 |
|----|------|
| **`"1.0"`** | v1.2.1 時点の初版スキーマ（現行） |

読み込み側は `schemaVersion` が未設定の古い manifest を **schemaVersion `"1.0"` 相当** として扱ってよい（後方互換）。

---

## ルートオブジェクトの必須フィールド

| フィールド | 型 | 説明 |
|------------|-----|------|
| `schemaVersion` | `string` | スキーマ識別子。現行は `"1.0"` |
| `tool` | `string` | 生成ツール識別子。現行は `"nano_banana_image_improvement"` |
| `version` | `string` | 生成スクリプトのリリースラベル。例：`"v1.2.1"` |
| `generatedAt` | `string` | ISO 8601 形式の生成日時 |
| `reviewFile` | `string` | 入力に使った `image_review.json` のプロジェクト相対パス |
| `dryRun` | `boolean` | `true` = API 未呼び出し（dry-run）、`false` = `--apply` 実行 |
| `threshold` | `number` | 改善対象判定の score 閾値（現行 **80**） |
| `totalImages` | `number` | `items` の件数 |
| `targetCount` | `number` | `beforeScore < threshold` の件数 |
| `skippedCount` | `number` | `status: "skipped"` の件数 |
| `failedCount` | `number` | `status: "failed"` の件数 |
| `improvedCount` | `number` | `status: "improved"` の件数 |
| `items` | `array` | スライドごとの結果（下記） |

### ルートの任意フィールド

| フィールド | 型 | 説明 |
|------------|-----|------|
| `afterReview` | `object` | `review_improved_images.js --apply` 実行後、各 item に付与される再レビュー結果（任意） |

---

## items[] の必須フィールド

| フィールド | 型 | 説明 |
|------------|-----|------|
| `slideId` | `string` | スライド ID。例：`"slide03"` |
| `sourceImagePath` | `string` | 元画像のプロジェクト相対パス |
| `outputPath` | `string` | 改善画像の出力先パス |
| `beforeScore` | `number \| null` | 改善前 score |
| `rootCause` | `string \| null` | TEXT / LAYOUT / PROMPT / STYLE / OTHER / null |
| `status` | `string` | 改善結果（下記「status 値の定義」） |
| `error` | `string \| null` | 失敗・dry-run 計画メッセージ等 |
| `elapsedMs` | `number` | 改善処理の所要時間（ミリ秒） |
| `attempts` | `number` | API 試行回数 |
| `timeoutMs` | `number` | 使用したタイムアウト（ミリ秒） |
| `retry` | `number` | 設定された最大試行回数 |

### items[] の任意フィールド

| フィールド | 型 | 説明 |
|------------|-----|------|
| `afterReview` | `object` | 再レビュー後に付与。`afterScore` / `deltaScore` / `status` 等 |

#### afterReview オブジェクト（任意）

| フィールド | 型 | 説明 |
|------------|-----|------|
| `reviewedAt` | `string` | ISO 8601 |
| `afterScore` | `number \| null` | 再レビュー後 score |
| `deltaScore` | `number \| null` | afterScore − beforeScore |
| `afterRootCause` | `string \| null` | 再レビュー後 rootCause |
| `status` | `string` | `reviewed` / `failed_review` 等 |
| `error` | `string \| null` | 再レビュー失敗時のメッセージ |
| `reviewElapsedMs` | `number` | 再レビュー所要時間 |

---

## status 値の定義（items[].status）

改善実行（`improve_with_nano_banana.js`）が付与する値です。

| status | 意味 |
|--------|------|
| **`improved`** | `--apply` で Nano Banana 改善に成功。`outputPath` に PNG が保存された |
| **`skipped`** | 改善対象外。例：`beforeScore >= threshold`、または `rootCause: TEXT` |
| **`failed`** | 改善失敗。例：元画像なし、API エラー、クォータ超過 |
| **`planned`** | dry-run。API 未呼び出し。本番実行予定として記録 |

---

## 生成元

| 項目 | 値 |
|------|-----|
| スクリプト | `scripts/improve_with_nano_banana.js` |
| 出力先 | `output/carousel/improved/manifest.json` |
| tool | `nano_banana_image_improvement` |

---

## 後方互換性ルール

v1.3 / v2.0 以降、manifest を読み書きする際は次を守ります。

1. **既存フィールドを削除しない**
2. **既存フィールド名を変更しない**
3. **新規フィールドは追加のみ**（任意フィールドとして追加可能）
4. **破壊的変更が必要な場合は `schemaVersion` を上げる**（例：`"2.0"`）

### 読み込み側の推奨

```javascript
const schemaVersion = manifest.schemaVersion ?? "1.0";
const tool = manifest.tool ?? "nano_banana_image_improvement";
```

- `schemaVersion` 未知の値 → 警告を出し、既知フィールドのみ利用
- `tool` が異なる → 想定外ツールの manifest として警告

---

## 関連ドキュメント

| ファイル | 内容 |
|----------|------|
| [V1.2_NANO_BANANA_IMAGE_IMPROVEMENT_DESIGN.md](./V1.2_NANO_BANANA_IMAGE_IMPROVEMENT_DESIGN.md) | v1.2 全体設計 |
| [CHANGELOG.md](./CHANGELOG.md) | バージョン履歴 |

---

*スキーマ初版：v1.2.1（schemaVersion `"1.0"`）*
