# バージョン情報

## 現在のバージョン

**v1.2**（Nano Banana 画像改善 — 完了）

---

## バージョン履歴

| バージョン | 名称 | 状態 | 概要 |
|------------|------|------|------|
| **v1.2** | Nano Banana 画像改善 | ✅ 完了 | Nano Banana による画像改善・Gemini 再レビュー・レポート生成 |
| **v1.1.1** | 運用品質向上 | ✅ 完了 | Health Check / Doctor / Smart Auto Fix で日常運用を支援 |
| **v1.1** | Genspark連携 | ✅ 完了 | Genspark の調査結果を投稿生成に反映（半自動運用） |
| **v1.0** | Instagramカルーセル自動生成 | ✅ 完了 | 投稿〜カルーセル〜画像〜出力まで `npm run daily` で一括実行 |

---

## v1.2 でできること（完了済み）

- **Nano Banana 画像改善** … 80 点未満スライドを Gemini 画像 API で改善
- **画像改善 API ラッパー** … `src/lib/nano_banana.js`（timeout / retry / elapsedMs / dry-run）
- **改善対象抽出** … `scripts/improve_with_nano_banana.js`（score < 80、rootCause 対応、manifest 生成）
- **Gemini 再レビュー** … `scripts/review_improved_images.js`（improved のみ、before / after / deltaScore）
- **Markdown レポート** … `reports/nano-banana-improve/report.md`
- **JSON レポート** … `reports/nano-banana-improve/report.json`（recommendation 自動判定）
- **manifest 管理** … `output/carousel/improved/manifest.json`
- **timeout** … デフォルト 60 秒（`--timeout-ms` で変更可）
- **retry** … 最大 3 回、指数バックオフ
- **elapsedMs** … 改善・再レビューの所要時間を記録
- **dry-run** … improve / review ともにデフォルト dry-run、`--apply` で本番実行
- **元画像非破壊** … `images/carousel/output/` は上書きしない

### v1.2 の運用イメージ

```
画像レビュー不合格（80 点未満あり）:
  node scripts/improve_with_nano_banana.js --review images/carousel/review/image_review.json
  node scripts/improve_with_nano_banana.js --apply --review images/carousel/review/image_review.json
  node scripts/review_improved_images.js --apply
  node scripts/report_nano_banana_improvement.js
  reports/nano-banana-improve/report.md を確認
```

### 品質基準（v1.2）

| 点数 / 条件 | 判定 | 対応 |
|-------------|------|------|
| **90 点以上** | 公開推奨 | そのまま投稿可能 |
| **80 点以上** | 合格 | 基準を満たしている |
| **79 点以下** | Nano Banana 改善対象 | `improve_with_nano_banana.js` で改善 |
| **TEXT rootCause** | Smart Auto Fix 対象 | Nano Banana では修正しない |
| **LAYOUT / STYLE / PROMPT 等** | Nano Banana 対象 | 視認性・余白・配色を画像 API で改善 |

### v1.2 完成判定

| 項目 | 状態 |
|------|------|
| 設計 | ✅ 完了（`docs/V1.2_NANO_BANANA_IMAGE_IMPROVEMENT_DESIGN.md`） |
| 実装 | ✅ 完了 |
| テスト | ✅ 完了（改善 PNG 実保存成功のみ API クォータにより未確認） |
| README | ✅ 完了 |
| CHANGELOG | ✅ 完了 |
| VERSION | ✅ 完了 |

### 既知事項（v1.2）

- API クォータ超過（HTTP 429）時は該当スライドを **`status: failed`** として manifest に記録する
- 1 枚失敗しても **パイプライン全体は停止しない**（他スライドは続行）
- `reports/` は Git 管理対象外（`.gitignore` で除外）
- v1.2 コマンドは **npm script 未登録**。`node scripts/...` で直接実行する

---

## v1.0 でできること（完了済み）

- Instagram 用キャプション（投稿文）の AI 生成
- カルーセル 5 枚のテキスト生成・品質レビュー
- OpenAI によるカルーセル画像 5 枚の生成
- Gemini による画像品質レビュー・改善ループ
- `output/instagram/` への投稿素材出力
- Gemini API キャッシュ・クォータ超過時のエラー表示

---

## v1.1 でできること（完了済み）

- Genspark で調べたネタを投稿生成に活用（**半自動**）
- `content/research/latest.md` / `latest.json` / `metadata.json` の 3 ファイル構成
- `latest.json` の `postValueScore` 最高 topic を最優先テーマとして使用
- `npm run research-check` でリサーチ状態を確認
- `npm run daily` 冒頭でのリサーチ確認（失敗しても続行）
- リサーチファイルがない場合の固定テーマフォールバック
- `latest.json` が壊れていても daily は停止しない

### v1.1 の運用イメージ

```
人間：Genspark で調査 → 3 ファイル保存（5〜10分）
  ↓
自動：npm run daily → output/instagram/ に投稿素材出力
```

---

## v1.1.1 でできること（完了済み）

- **Health Check** … 環境（.env、API キー、フォルダ）を 1 コマンドで確認
- **Doctor** … リサーチ・画像・出力の現在状態を診断し、次のコマンドを提案
- **rootCause 判定** … 不合格原因を TEXT / LAYOUT / PROMPT / STYLE / OTHER に分類
- **Smart Auto Fix** … 原因別の改善計画を表示（dry-run 標準）
- **Smart Auto Fix apply** … 改善指示を Markdown ファイル末尾に追記
- **Smart Auto Fix Report** … 実行結果を `reports/smart-auto-fix/` に自動保存

### v1.1.1 の運用イメージ

```
初回：npm run health-check  … 環境確認
日常：npm run doctor         … 状態確認 + 次の一手

画像不合格時：
  npm run smart-auto-fix              … 改善計画（dry-run）
  npm run smart-auto-fix -- --apply   … 指示をファイルに追記
  reports/smart-auto-fix/*.md         … 実行ログを確認
```

### 品質基準（画像レビュー）

| 点数 | 判定 |
|------|------|
| 90〜100 | 公開推奨 |
| 80〜89 | 合格 |
| 79 以下 | 要改善（Smart Auto Fix を検討） |

---

## 関連ドキュメント

| ファイル | 内容 |
|----------|------|
| [README.md](../README.md) | 使い方・コマンド一覧 |
| [CHANGELOG.md](./CHANGELOG.md) | バージョンごとの変更履歴 |
| [V1.2_NANO_BANANA_IMAGE_IMPROVEMENT_DESIGN.md](./V1.2_NANO_BANANA_IMAGE_IMPROVEMENT_DESIGN.md) | v1.2 Nano Banana 画像改善の設計 |
| [Genspark連携設計.md](./Genspark連携設計.md) | v1.1 Genspark 連携の設計・運用 |
| [SmartAutoFix設計.md](./SmartAutoFix設計.md) | v1.1.1 Smart Auto Fix の設計 |

---

*最終更新：2026-06-27*
