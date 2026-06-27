# CLI 終了コード

Nano Banana 画像改善関連スクリプトの **終了コード（exit code）** を統一しています。  
CI・自動実行・n8n 連携では、このコードで成功 / 要確認 / 失敗を分岐してください。

---

## 終了コード一覧

| コード | 意味 | 説明 |
|--------|------|------|
| **0** | 正常終了 | 処理完了。dry-run、対象 0 件、全件成功も含む |
| **1** | 入力エラー・設定エラー | 入力ファイル不在、JSON 不正、CLI 引数不正など |
| **2** | API エラー | 改善 / 再レビュー **対象がすべて失敗**（例: 全件 429 クォータ超過） |
| **3** | 部分成功 | **一部成功・一部失敗**。完全失敗ではなく **要確認** |
| **4** | 内部エラー | 想定外の例外 |

### コード 3 について

**3 は「完全失敗ではない」** ことを示します。

- manifest / review_result / report は生成済みのことが多い
- 成功分は利用可能、失敗分だけ再実行または手動確認が必要
- CI では **警告扱い（continue-on-error または通知）** が適切

---

## 対象スクリプト

| スクリプト | 用途 |
|------------|------|
| `scripts/improve_with_nano_banana.js` | Nano Banana 画像改善 |
| `scripts/review_improved_images.js` | 改善後 Gemini 再レビュー |
| `scripts/report_nano_banana_improvement.js` | レポート生成 |

実装: `src/lib/exit_codes.js`（`EXIT_CODES` / `getExitCodeByResult()` / `getErrorExitCode()`）

---

## スクリプト別の判定

### improve_with_nano_banana.js

| 条件 | 終了コード |
|------|------------|
| 改善対象 0 件 | 0 |
| dry-run（`planned` のみ） | 0 |
| `--apply` で全件 `improved` | 0 |
| 対象あり・すべて `skipped`（例: TEXT） | 0 |
| 入力ファイルなし / JSON 不正 / CLI 引数不正 | 1 |
| `--apply` で対象すべて `failed`（API 等） | 2 |
| `--apply` で `improved` と `failed` が混在 | 3 |
| 想定外例外 | 4 |

**例:** `target=1`, `failed=1`, `improved=0`（429 クォータ超過）→ **2**

### review_improved_images.js

| 条件 | 終了コード |
|------|------------|
| 再レビュー対象 0 件（`improved` なし） | 0 |
| dry-run（`planned` のみ） | 0 |
| `--apply` で全件 `reviewed` | 0 |
| manifest なし / JSON 不正 / CLI 引数不正 | 1 |
| `--apply` で対象すべて `failed_review` | 2 |
| `--apply` で `reviewed` と `failed_review` が混在 | 3 |
| 想定外例外 | 4 |

### report_nano_banana_improvement.js

| 条件 | 終了コード |
|------|------------|
| report.md / report.json 生成成功 | 0 |
| manifest または review_result 不在 / JSON 不正 | 1 |
| 想定外例外 | 4 |

API を使用しないため、通常 **2 は使いません**。

---

## n8n / CI での扱い例

### GitHub Actions

```yaml
- name: Nano Banana improve (dry-run)
  run: node scripts/improve_with_nano_banana.js --review images/carousel/review/image_review.json

- name: Nano Banana improve (apply)
  run: node scripts/improve_with_nano_banana.js --apply --review images/carousel/review/image_review.json
  continue-on-error: true  # exit 2 or 3 のときも後続ステップへ

- name: Check exit code
  if: always()
  run: |
    case $? in
      0) echo "OK" ;;
      3) echo "Partial success - review manifest" ;;
      2) echo "All API failed" ; exit 1 ;;
      1|4) echo "Input or internal error" ; exit 1 ;;
    esac
```

### n8n（Execute Command ノード）

| exit code | 分岐 |
|-----------|------|
| 0 | 次ステップ（再レビュー or レポート）へ |
| 3 | 通知「一部失敗」→ manifest 確認 → 必要なら再実行 |
| 2 | 通知「API 全失敗」→ クォータ / キー確認 |
| 1 | 入力パス・JSON を確認 |
| 4 | ログ確認・開発者へエスカレーション |

```text
improve (--apply) → exit 0 → review (--apply) → exit 0 → report → 完了
                 → exit 3 → report 生成 → 人手確認
                 → exit 2 → 停止（API 設定見直し）
```

---

## 関連ドキュメント

| ファイル | 内容 |
|----------|------|
| [MANIFEST_SCHEMA.md](./MANIFEST_SCHEMA.md) | manifest.json スキーマ |
| [CHANGELOG.md](./CHANGELOG.md) | バージョン履歴 |

---

*v1.2.1 運用品質パッチ — CLI 終了コード統一*
