# 変更履歴（CHANGELOG）

このファイルでは、AI-SNS-Automation のバージョンごとの変更内容を記録します。

---

## v1.2 — Nano Banana画像改善（完了）

OpenAI Images で生成したカルーセル画像を **Nano Banana（Gemini 画像 API）** で改善し、Gemini による再レビューと改善レポート生成までを自動化しました。

### 概要

- 改善対象は `image_review.json` で **score が 80 未満** のスライドのみ
- 元画像（`images/carousel/output/`）は **上書きしない**
- 改善画像は `output/carousel/improved/` に保存
- **dry-run 標準**、`--apply` で API 実行
- 実行ログ・レポートは `reports/nano-banana-improve/`（Git 管理外）

### 新機能

#### Nano Banana API ラッパー

| 項目 | 内容 |
|------|------|
| ファイル | `src/lib/nano_banana.js` |
| 機能 | timeout（デフォルト 60 秒）、retry（指数バックオフ）、elapsedMs / attempts 記録 |
| dry-run | API 未呼び出しで計画のみ返却 |
| 保存先 | `output/carousel/improved/` のみ（元画像非破壊） |

#### 改善対象抽出・実行

| 項目 | 内容 |
|------|------|
| ファイル | `scripts/improve_with_nano_banana.js` |
| 対象 | score < 80 のスライドのみ（80 以上は skip） |
| rootCause | LAYOUT / PROMPT / STYLE / OTHER に応じた改善プロンプト |
| TEXT | Nano Banana 対象外（自動 skip → Smart Auto Fix 推奨） |
| 出力 | `output/carousel/improved/manifest.json` |

#### 改善後再レビュー

| 項目 | 内容 |
|------|------|
| ファイル | `scripts/review_improved_images.js` |
| 対象 | manifest の `status: improved` のみ |
| 比較 | beforeScore / afterScore / deltaScore |
| 出力 | `reports/nano-banana-improve/review_result.json` |

#### レポート生成

| 項目 | 内容 |
|------|------|
| ファイル | `scripts/report_nano_banana_improvement.js` |
| 出力 | `reports/nano-banana-improve/report.md` / `report.json` |
| 機能 | manifest + review_result を統合、recommendation 自動判定 |

### 品質改善

| 項目 | 内容 |
|------|------|
| timeout | デフォルト 60 秒（`--timeout-ms` で変更可） |
| retry | 最大 3 回、指数バックオフ（429 / 5xx でリトライ） |
| 記録 | attempts / elapsedMs / reviewElapsedMs を manifest・review_result に保存 |
| 元画像非破壊 | `images/carousel/output/` は読み取り専用 |
| dry-run 標準 | improve / review ともにデフォルト dry-run |
| manifest 管理 | 改善結果を `manifest.json` に集約 |
| reports | `reports/` は `.gitignore` で除外（Git 管理しない） |

### 新規ファイル

| ファイル | 内容 |
|----------|------|
| `docs/V1.2_NANO_BANANA_IMAGE_IMPROVEMENT_DESIGN.md` | v1.2 設計書 |
| `src/lib/nano_banana.js` | Nano Banana API ラッパー |
| `scripts/improve_with_nano_banana.js` | 改善対象抽出・実行 |
| `scripts/review_improved_images.js` | 改善後 Gemini 再レビュー |
| `scripts/report_nano_banana_improvement.js` | レポート生成 |

### 更新ファイル

| ファイル | 内容 |
|----------|------|
| `README.md` | v1.2 の使い方・コマンド・採点基準を追記 |

### 運用方法（v1.2 追加コマンド）

```
【画像レビュー不合格後・Nano Banana で視覚改善したい場合】

# 1. 改善計画確認（dry-run）
node scripts/improve_with_nano_banana.js --review images/carousel/review/image_review.json

# 2. 改善実行
node scripts/improve_with_nano_banana.js --apply --review images/carousel/review/image_review.json

# 3. 再レビュー（dry-run → apply）
node scripts/review_improved_images.js
node scripts/review_improved_images.js --apply

# 4. レポート生成
node scripts/report_nano_banana_improvement.js

【レポート確認】
reports/nano-banana-improve/report.md を開く
```

### 品質基準（画像レビュー・v1.1.1 維持）

| 点数 | 判定 | 意味 |
|------|------|------|
| **90〜100** | 公開推奨 | そのまま Instagram に投稿してよい品質 |
| **80〜89** | 合格 | 基準を満たしている。公開可能 |
| **79 以下** | 再改善候補 | Nano Banana 再実行または Smart Auto Fix を検討 |

### 設計思想

| 判断 | 理由 |
|------|------|
| **80 点以上＝合格、90 点以上＝公開推奨** | v1.1.1 の品質基準を維持 |
| **TEXT は Smart Auto Fix** | 誤字・文字崩れは Nano Banana ではなく文言・OpenAI 再生成が有効 |
| **LAYOUT / STYLE / PROMPT は Nano Banana** | 視認性・余白・配色は画像 API で直接改善 |
| **`reports/` は Git 管理しない** | 実行ログはローカルに残し、リポジトリを汚さない |
| **dry-run を標準** | API コストと結果を確認してから `--apply` |

### テスト結果

**確認済み**

| 項目 | 内容 |
|------|------|
| dry-run | improve / review ともに API 未呼び出しで manifest・review_result 生成 |
| apply | Nano Banana API 呼び出しフロー（クライアント初期化〜リトライ） |
| timeout / retry | 60 秒デフォルト、3 回リトライ、attempts 記録 |
| manifest | 対象判定・status・elapsedMs・attempts を記録 |
| report | `report.md` / `report.json` 生成、recommendation 判定 |
| review_result | improved 対象の planned / reviewed / failed_review 記録 |
| 元画像非破壊 | `images/carousel/output/` の mtime 不変を確認 |
| エラー継続処理 | 1 枚失敗しても全体処理継続、exit code 0 |

**未確認**

| 項目 | 内容 |
|------|------|
| 改善画像保存成功 | API クォータ超過（HTTP 429）のため、`output/carousel/improved/slideXX.png` の実保存成功は未確認。失敗時は manifest に `status: failed` として記録されることを確認済み |

### 注意点

- Nano Banana は `GEMINI_API_KEY` または `NANO_BANANA_API_KEY` を使用します
- TEXT rootCause のスライドは improve スクリプトが **自動 skip** します
- クォータ超過時は該当スライドのみ `failed`、他スライドは続行します
- v1.2 コマンドは現時点 **npm script 未登録** です。README 記載の `node scripts/...` で実行します

---

## v1.1.1 — 運用品質向上（2026-06-26 完了）

日常運用で「環境は整っているか」「今どこまで進んでいるか」「画像の問題をどう直すか」を、**1 コマンドで確認・計画** できるようになりました。

### 追加した機能

| 機能 | コマンド | 説明 |
|------|----------|------|
| **Health Check** | `npm run health-check` | `.env`、API キー、必要フォルダが揃っているかを 12 項目チェック |
| **Doctor** | `npm run doctor` | リサーチ・画像レビュー・出力素材の状態を診断し、次のコマンドを提案 |
| **rootCause 判定** | `npm run root-cause-check` | 不合格スライドの原因を TEXT / LAYOUT / PROMPT / STYLE / OTHER に分類 |
| **Smart Auto Fix** | `npm run smart-auto-fix` | 原因別の改善計画を表示（**dry-run 標準**） |
| **Smart Auto Fix apply** | `npm run smart-auto-fix -- --apply` | 対象ファイルをバックアップし、Smart Auto Fix 指示を Markdown 末尾に追記 |
| **Smart Auto Fix Report** | （smart-auto-fix 実行時に自動） | 実行結果を `reports/smart-auto-fix/` に Markdown レポートとして保存 |

### 変更・追加したファイル

**新規**

| ファイル | 内容 |
|----------|------|
| `src/health_check.js` | 環境チェック（Health Check） |
| `src/doctor.js` | 状態診断（Doctor） |
| `src/lib/root_cause.js` | rootCause 判定モジュール |
| `src/check_root_cause.js` | rootCause 判定結果の表示 |
| `src/smart_auto_fix.js` | Smart Auto Fix 本体（dry-run / apply / Report） |
| `docs/SmartAutoFix設計.md` | Smart Auto Fix の設計書 |

**更新**

| ファイル | 内容 |
|----------|------|
| `src/doctor.js` | 不合格時に rootCause 表示、`smart-auto-fix` を優先提案 |
| `package.json` | `health-check` / `doctor` / `root-cause-check` / `smart-auto-fix` を追加 |
| `README.md` | 各コマンドの使い方・Report 説明を追記 |
| `.gitignore` | `reports/` を除外 |

### 運用方法（v1.1.1 追加コマンド）

```
【初回セットアップ後】
npm run health-check     … 環境が整っているか確認

【日常の確認】
npm run doctor           … 全体状態 + 次に何をすべきか

【画像レビュー不合格時】
npm run smart-auto-fix              … 改善計画を確認（dry-run）
npm run smart-auto-fix -- --apply   … 指示をファイルに追記
npm run root-cause-check            … 原因分類だけ確認

【レポート確認】
reports/smart-auto-fix/YYYY-MM-DD-HHmmss.md を開く
```

### 今回の設計判断

| 判断 | 理由 |
|------|------|
| **画像改善はプロンプトだけでなくコンテンツも** | 誤字・文字崩れは `slideXX.md` の文言短縮が必要なケースがある（slide01 事例） |
| **80 点以上＝合格、90 点以上＝公開推奨** | 合格ラインは維持しつつ、より高品質な投稿を区別できるようにする |
| **Smart Auto Fix は dry-run を標準** | いきなりファイルを変えず、まず計画を確認してから `--apply` で実行 |
| **`reports/` は Git 管理しない** | 実行ログはローカルに残し、リポジトリを汚さない |

### 品質基準（画像レビュー）

| 点数 | 判定 | 意味 |
|------|------|------|
| **90〜100** | 公開推奨 | そのまま Instagram に投稿してよい品質 |
| **80〜89** | 合格 | 基準を満たしている。公開可能 |
| **79 以下** | 要改善 | Smart Auto Fix で原因別改善を検討 |

### 注意点

- Smart Auto Fix の `--apply` は **指示の追記まで**。画像の自動再生成は v1.1.1 では行いません
- `reports/` は `.gitignore` で除外されています（別 PC には自動では引き継がれません）
- Doctor 不合格時の第一提案は **`image-improve` ではなく `smart-auto-fix`** です
- `health-check` / `doctor` は Error があっても最後まで実行し、exit code は 0 です

---

## v1.1 — Genspark連携（2026-06-26 完了）

投稿生成の前に **Genspark で調べたネタ** を使えるようになりました。  
v1.1 は **半自動運用** です（Genspark での調査は人間が行い、以降は `npm run daily` が自動実行します）。

### 追加した機能

| 機能 | 説明 |
|------|------|
| Genspark リサーチ連携 | 調査結果を `content/research/` に保存し、投稿生成に反映 |
| リサーチテンプレート | `prompts/genspark/research_template.md`（Genspark に貼り付けるプロンプト） |
| 3 ファイル構成 | `latest.md`（人間向け）/ `latest.json`（AI 向け）/ `metadata.json`（メタ情報） |
| JSON 最優先テーマ | `postValueScore` が最も高い topic を投稿生成の中心ネタに使用 |
| リサーチ状態確認 | `npm run research-check` でファイルの有無と使用テーマを表示 |
| daily 冒頭リサーチ確認 | `npm run daily` 実行時、最初に `research-check` を自動実行 |
| フォールバック | リサーチファイルがない／JSON が壊れている場合も daily は停止しない |

### 変更・追加したファイル

**新規**

| ファイル | 内容 |
|----------|------|
| `src/check_research.js` | リサーチファイルの状態確認スクリプト |
| `prompts/genspark/research_template.md` | Genspark 調査用テンプレート |
| `content/research/latest.md` | リサーチ結果サンプル（人間向け） |
| `content/research/latest.json` | リサーチ結果サンプル（AI 向け） |
| `content/research/metadata.json` | 調査メタ情報サンプル |
| `docs/Genspark連携設計.md` | Genspark 連携の設計・運用ドキュメント |

**更新**

| ファイル | 内容 |
|----------|------|
| `src/generate_post.js` | `latest.md` / `latest.json` の読み込みと Claude への反映 |
| `scripts/run_daily.sh` | 冒頭に「リサーチ確認」ステップを追加 |
| `package.json` | `"research-check"` スクリプトを追加 |
| `README.md` | Genspark 連携の使い方を追記 |

### 運用方法

```
【朝（5〜10分・人間）】
1. prompts/genspark/research_template.md を Genspark に貼り付けて調査
2. 結果を content/research/ に 3 ファイル保存
   - latest.md
   - latest.json
   - metadata.json

【確認（任意）】
npm run research-check

【自動実行】
npm run daily
  → リサーチ確認 → 投稿生成（リサーチ反映）→ カルーセル → 画像 → 出力
```

### 投稿生成の優先順位

| 状態 | 動作 |
|------|------|
| `latest.json` 正常 + `latest.md` あり | JSON 最優先テーマ + Markdown 参考 |
| `latest.md` のみ | Markdown の推奨テーマを参考 |
| 両方なし | 固定テーマ（`prompts/instagram/user.md`） |
| `latest.json` が壊れている | **停止しない**。`latest.md` があれば Markdown のみで続行 |

### 注意点

- **Genspark API の自動連携は v1.1 では行いません。** 調査とファイル保存は人間の作業です
- `latest.json` を保存するとき、JSON コードブロックの **中身だけ** を保存してください（```json 行は含めない）
- リサーチファイルがなくても `npm run daily` は動きます（固定テーマにフォールバック）
- `research-check` が失敗しても `npm run daily` は止まりません
- 生成内容は必ず人間が確認してから Instagram に投稿してください

---

## v1.0 — Instagramカルーセル自動生成（2026-06-25 完了）

飲食店向け Instagram カルーセル投稿を、`npm run daily` 1 本で生成できる最初のバージョンです。

### 主な機能

| 機能 | 説明 |
|------|------|
| 投稿生成 | Claude Code でキャプション（本文）を生成 |
| Gemini レビュー | 投稿文の品質改善 |
| カルーセル生成 | 5 枚構成のストーリー型テキスト |
| 画像生成 | OpenAI Images API で 5 枚の画像を生成 |
| 品質チェック | テキスト・画像の AI 採点と改善ループ |
| Instagram 出力 | `output/instagram/` に投稿素材をまとめて出力 |
| Gemini キャッシュ | API 使用回数削減（`.cache/gemini/`） |
| クォータ超過対応 | Gemini 429 エラー時の分かりやすいメッセージ |
| 画像レビューゲート | 最終画像レビュー不合格時は export 前に停止 |

### 主なコマンド

```bash
npm run daily              # 一括実行（13 ステップ）
npm run research-check     # （v1.1 で追加）
npm run image-improve      # 不合格スライドの画像再生成
npm run export-instagram   # 投稿素材の出力
```

---

*詳しい使い方は [README.md](../README.md) を参照してください。*
