# AI-SNS-Automation

飲食店向け Instagram 投稿を、AI で自動生成するツールです。

投稿文の作成から、カルーセル（5枚の画像付き投稿）の生成、画像の品質チェック、Instagram に投稿する直前の素材まとめまでを、1 本のコマンドで実行できます。

---

## このツールでできること

1. **投稿文を作る** … AI が Instagram 用のキャプション（本文）を書きます
2. **カルーセルを作る** … 5 枚構成のストーリー型テキスト（表紙→共感→失敗例→成功例→CTA）に分解します
3. **画像を作る** … 各スライド用の画像を AI で生成します
4. **品質チェック** … テキストと画像を AI が採点し、基準を満たしているか確認します
5. **投稿素材をまとめる** … Instagram に投稿するときに使いやすい形でファイルを出力します

---

## 運用品質向上（v1.1.1）

v1.1.1 では、投稿生成だけでなく **日常運用の確認・トラブル対応** を支援するコマンドが追加されました。

| 困ったとき | 使うコマンド | 何がわかるか |
|------------|-------------|-------------|
| 初回セットアップ後 | `npm run health-check` | .env や API キー、必要フォルダが揃っているか |
| 今どこまで進んでいる？ | `npm run doctor` | リサーチ・画像・出力の状態と、次に実行すべきコマンド |
| 画像レビュー不合格 | `npm run smart-auto-fix` | 原因（rootCause）別の改善計画 |
| 改善をファイルに反映 | `npm run smart-auto-fix -- --apply` | slide / プロンプトに Smart Auto Fix 指示を追記 |

**品質の目安（画像レビュー）：** 80 点以上で合格、**90 点以上で公開推奨** です。

実行ログは `reports/smart-auto-fix/` に自動保存されます（Git 管理対象外）。

詳しくは後述の「`npm run health-check`」「`npm run doctor`」「`npm run smart-auto-fix`」を参照してください。

---

## Nano Banana 画像改善（v1.2）

v1.2 では、画像レビューで **80 点未満** となったスライドについて、**Nano Banana（Gemini 画像 API）** で画像そのものを改善する機能が追加されました。Smart Auto Fix が「文言・プロンプトの修正計画」を担うのに対し、Nano Banana は **生成済み PNG を入力として視覚面を改善** します。

### 概要

| 項目 | 内容 |
|------|------|
| 改善対象 | `image_review.json` で **score が 80 未満** のスライドのみ |
| 入力画像 | `images/carousel/output/slideXX.png`（**上書きしません**） |
| 出力画像 | `output/carousel/improved/slideXX.png` |
| 再レビュー | 改善成功分を Gemini で再採点 |
| レポート | `reports/nano-banana-improve/` に Markdown / JSON を出力 |

### 使うタイミング

次のような場合に使います。

- 画像レビュー不合格で、**LAYOUT / STYLE / PROMPT** 系の rootCause が疑われるとき
- Smart Auto Fix でプロンプト修正後も、**画像の視認性・余白・配色** を直接直したいとき
- `npm run doctor` や `npm run smart-auto-fix` で原因を確認した **あと**、画像レイヤーでの改善を試したいとき

**Smart Auto Fix との使い分け：**

| rootCause | 第一選択 |
|-----------|----------|
| **TEXT**（誤字・文字崩れ） | **Smart Auto Fix** → Regeneration Engine → Nano Banana（品質パイプライン v1.4 で接続済み） |
| **LAYOUT / STYLE / PROMPT** | Nano Banana 画像改善 |

### 前提ファイル

実行前に、次が揃っている必要があります。

| ファイル / 設定 | 役割 |
|-----------------|------|
| `images/carousel/review/image_review.json` | 改善対象の判定（各スライドの score） |
| `images/carousel/output/slideXX.png` | Nano Banana の入力元画像 |
| `GEMINI_API_KEY` または `NANO_BANANA_API_KEY` | Nano Banana API キー（未設定時は改善失敗） |
| `GEMINI_API_KEY` | 改善後画像の再レビュー用 |

### 実行コマンド（推奨フロー）

#### 1. Nano Banana で画像改善

```bash
# dry-run（デフォルト）… API を呼ばず、対象と計画だけ確認
node scripts/improve_with_nano_banana.js --review images/carousel/review/image_review.json

# 本番実行 … 80 点未満のスライドだけ API で改善
node scripts/improve_with_nano_banana.js --apply --review images/carousel/review/image_review.json
```

#### 2. 改善後画像を再レビュー

```bash
# dry-run … 再レビュー対象の確認のみ
node scripts/review_improved_images.js

# 本番実行 … status=improved の画像だけ Gemini で再採点
node scripts/review_improved_images.js --apply
```

#### 3. レポート生成

```bash
node scripts/report_nano_banana_improvement.js
```

manifest と review_result を統合し、改善前後の score 差分を人間が読みやすい形で出力します。

### dry-run と `--apply` の違い

| ステップ | dry-run（デフォルト） | `--apply` |
|----------|----------------------|-----------|
| **improve_with_nano_banana** | API 未呼び出し。対象は `planned` として manifest に記録 | Nano Banana API を呼び出し、改善画像を保存 |
| **review_improved_images** | API 未呼び出し。対象は `planned` として記録 | Gemini で再採点し、before / after score を記録 |

**ポイント：**

- どちらも **まず dry-run で対象件数を確認** してから `--apply` する運用が安全です
- 1 枚失敗しても **全体処理は続行** し、失敗内容は manifest / review_result に残ります

### 出力ファイル

| ファイル | 内容 |
|----------|------|
| `output/carousel/improved/manifest.json` | 改善実行の記録（対象 / 成功 / 失敗 / elapsedMs / attempts など） |
| `output/carousel/improved/slideXX.png` | 改善後画像（成功時のみ） |
| `reports/nano-banana-improve/review_result.json` | 再レビュー結果 |
| `reports/nano-banana-improve/report.md` | 人間向けサマリー・スライド別表 |
| `reports/nano-banana-improve/report.json` | レポートの機械可読版 |

`reports/` 配下は **Git 管理対象外** です（`.gitignore` で除外）。ローカル確認用として保存されます。

### 採点基準（v1.1.1 と同じ）

| 点数 | 判定 |
|------|------|
| **90 点以上** | 公開推奨 |
| **80 点以上** | 合格 |
| **79 点以下** | 再改善候補 |

再レビュー後の score は `review_result.json` と `report.json` の `afterScore` / `deltaScore` で確認できます。

### TEXT rootCause について

**TEXT**（誤字・日本語崩れ・文字欠けなど）は Nano Banana 単体では修正しません。

**v1.4 以降（品質パイプライン）：** TEXT rootCause は `npm run quality-pipeline:apply` 実行時に **Smart Auto Fix チェーン** で自動改善されます（slide / プロンプト追記 → Regeneration Engine → Nano Banana adapter → Gemini ReReview）。

**スタンドアロン実行：**

```bash
npm run smart-auto-fix          # 原因別の改善計画（dry-run）
npm run smart-auto-fix -- --apply   # slide / プロンプトへ指示追記
npm run image-improve           # 不合格スライドの OpenAI 再生成（従来方式）
```

### API クォータ超過時の扱い

Nano Banana も Gemini API を使用します。無料枠の上限に達すると **HTTP 429（RESOURCE_EXHAUSTED）** となり、該当スライドは manifest 上 **`status: failed`** として記録されます。他スライドの処理は続行されます。

**対処例：**

1. 翌日以降に `--apply` を再実行する
2. [Google AI Studio](https://aistudio.google.com/) で利用状況を確認する
3. 必要に応じて有料プランを検討する

改善画像の実保存は API 成功時のみ行われます。クォータ超過時は `output/carousel/improved/` に PNG は増えず、manifest の `error` フィールドに理由が残ります。

### レポートの確認方法

```bash
node scripts/report_nano_banana_improvement.js
```

生成後、次を確認します。

```bash
cat reports/nano-banana-improve/report.md
cat reports/nano-banana-improve/report.json
```

**report.md で見る項目：**

- サマリー表（改善対象数 / 成功数 / 再レビュー数）
- スライド別結果表（改善前 score → 改善後 score → 差分）
- 公開推奨一覧（90 点以上）
- 再改善候補一覧（80 点未満）
- 失敗一覧（改善失敗・再レビュー失敗）

パスを変えた場合は `--manifest` / `--review-result` で指定できます（詳細は各スクリプトの `--help` を参照）。

---

## 完全自動品質パイプライン（v1.3）

v1.3 では、画像レビュー・改善・再レビュー・export・レポートを **1 本のパイプライン** で管理する **上位品質パイプライン** が追加されました。`npm run daily` で素材を生成した **あと**、90 点（公開推奨）まで品質改善をループする用途を想定しています。

### 目的

- 投稿・画像レビュー・改善・再レビュー・export・report を統合する
- 全スライド **90 点以上（公開推奨）** になるまで改善ループ（`maxRounds` まで）を回す
- 実行状態を `pipeline_state.json` / `metrics.json` / `report.json` に記録する

### `npm run daily` との違い

| 項目 | `npm run daily` | `npm run quality-pipeline` |
|------|-----------------|----------------------------|
| 位置づけ | v1.0〜v1.1 の **従来一括実行** | **品質ループ付き上位パイプライン** |
| 投稿〜画像生成 | 含む（13 ステップ） | 現 MVP では **未接続**（`--from-phase image-review` からが実用） |
| 画像改善 | OpenAI 再生成中心 | rootCause 別（Nano Banana 実接続済み） |
| 合格基準 | 80 点で export ゲート | **90 点まで自動ループ** |
| 共存 | **維持（変更なし）** | 新規追加（置き換えではない） |

### dry-run 標準

デフォルトは **API 未呼び出し** の dry-run です。本番実行は `--apply` を付けます。

```bash
npm run quality-pipeline:dry-run
npm run quality-pipeline:apply
npm run quality-pipeline -- --from-phase image-review
npm run test:quality-pipeline
```

追加オプションは `--` の後に渡します。

```bash
npm run quality-pipeline:dry-run -- --from-phase image-review --max-rounds 3
npm run quality-pipeline:apply -- --from-phase image-review --allow-partial-export
npm run quality-pipeline:dry-run -- --clean-latest --from-phase image-review
```

追加オプション（v1.3.1）:

| オプション | 説明 |
|------------|------|
| `--clean-latest` | 実行前に `reports/quality-pipeline/latest` を削除してから開始 |
| （デフォルト） | 既存 `latest` がある場合、上書き前に `reports/quality-pipeline/archive/YYYY-MM-DD-HHmmss/` へ退避 |

### npm scripts

| コマンド | 説明 |
|----------|------|
| `npm run quality-pipeline` | デフォルト（dry-run）で実行 |
| `npm run quality-pipeline:dry-run` | 明示 dry-run |
| `npm run quality-pipeline:apply` | API 実行モード |
| `npm run quality-pipeline:report` | REPORT フェーズから実行 |
| `npm run quality-pipeline:export` | EXPORT フェーズから実行 |
| `npm run test:quality-pipeline` | 最小テスト（API 未使用） |

### 推奨フロー（画像レビュー済みの場合）

```bash
# 1. 計画確認（dry-run）
npm run quality-pipeline:dry-run -- --from-phase image-review --max-rounds 3

# 2. 本番実行
npm run quality-pipeline:apply -- --from-phase image-review --max-rounds 3

# 3. 90 点未達でも 80 点以上なら export したい場合
npm run quality-pipeline:apply -- --from-phase image-review --allow-partial-export
```

### 出力ファイル

| ファイル | 内容 |
|----------|------|
| `reports/quality-pipeline/latest/pipeline_state.json` | 実行状態・scoreSummary・改善履歴 |
| `reports/quality-pipeline/latest/metrics.json` | API 呼び出し数・ラウンド別 metrics |
| `reports/quality-pipeline/latest/report.json` | REPORT_SCHEMA 準拠（`quality_pipeline_report`） |
| `reports/quality-pipeline/latest/report.md` | 人間向けサマリー |
| `reports/quality-pipeline/latest/export_manifest.json` | export 画像選定結果 |
| `reports/quality-pipeline/archive/` | 上書き前に退避した過去実行（v1.3.1） |
| `output/instagram/` | apply + export 条件達成時の Instagram Package |

`reports/` 配下は **Git 管理対象外** です。

### dry-run と latest / archive（v1.4.1）

| 項目 | 内容 |
|------|------|
| dry-run でも `latest` 更新 | **はい** — 計画結果・report を `reports/quality-pipeline/latest/` に保存 |
| archive 退避 | **毎回 pipeline 開始時**。既存 `latest` があれば `archive/YYYY-MM-DD-HHmmss/` へコピーしてから上書き |
| `--clean-latest` | 退避せず `latest` を削除してから実行 |

dry-run は API を呼ばず **slide / prompt は基本変更しません** が、state / metrics / report は更新されます。

### 推奨フロー（apply 前チェックリスト）

```bash
# 1. 環境確認
npm run health-check

# 2. 計画確認（dry-run — latest / report 更新）
npm run quality-pipeline:dry-run -- --from-phase image-review --max-rounds 3

# 3. レポート確認（Next Actions / API キー / apply 実行判断）
cat reports/quality-pipeline/latest/report.md

# 4. 本番実行（API 呼び出し・output 変更あり）
npm run quality-pipeline:apply -- --from-phase image-review --max-rounds 3
```

**apply 前チェックリスト：**

- [ ] dry-run を実行済み
- [ ] `report.md` の改善計画を確認済み
- [ ] 必要な API キー（`GEMINI_API_KEY` 等）を `.env` に設定済み
- [ ] quota に余裕がある（limit:0 直後でない）

### output 副産物と git（v1.3.1 / v1.4.1）

apply 実行後、次のパスが `git status` に残ることがあります。これらは **実行結果の副産物** で、通常は commit しません。

| パス | 内容 | git status |
|------|------|------------|
| `reports/quality-pipeline/latest/*` | state / metrics / report | **出ない**（`.gitignore`） |
| `output/carousel/improved/manifest.json` | 改善 manifest | 追跡済みなら **M** |
| `output/carousel/improved/slideXX.png` | 改善済み画像 | 新規は **??** |
| `output/instagram/package-info.json` | Instagram Package メタ | 追跡済みなら **M** |
| `output/instagram/review-summary.md` | export レビューサマリー | 追跡済みなら **M** |

**整理コマンド（変更を破棄）：**

```bash
git restore output/
git clean -fd output/carousel/improved/
```

`report.md` の「通常 commit 不要の副産物」セクションにも同内容が出力されます。

### report.md の運用案内（v1.4.1）

`report.md` には次が含まれます。

- **Next Actions** … stopReason / dry-run 完了後の次手順
- **API キー設定** … 不足キーと設定理由（dry-run 計画 / apply 失敗）
- **dry-run / latest / archive** … latest 更新と退避の説明
- **--apply 実行判断** … キーあり/なし時の apply 可否
- **通常 commit 不要の副産物** … output 整理コマンド
- **Smart Auto Fix / TEXT チェーン**（v1.4）

### 品質基準（v1.3 パイプライン）

| 点数 | 判定 | パイプラインの動き |
|------|------|-------------------|
| **90 点以上** | 公開推奨 | 全スライド達成で export 可能（デフォルト） |
| **80 点以上** | 合格 | `--allow-partial-export` 時のみ export 可能 |
| **79 点以下** | 要改善 | 改善ループ対象 |

### 現時点の制限（将来拡張）

- POST_GENERATION 〜 IMAGE_GENERATION フェーズは **placeholder**（未接続）
- **TEXT rootCause** は v1.4 で Smart Auto Fix チェーン接続済み（下記 v1.4 参照）
- **PROMPT / openai_regenerate** は **placeholder のまま**
- `--resume` 途中再開は未実装
- GitHub Actions 連携は未実装

設計詳細: [docs/V1.3_QUALITY_PIPELINE_DESIGN.md](docs/V1.3_QUALITY_PIPELINE_DESIGN.md)

---

## Smart Auto Fix 統合（v1.4）

v1.4 では、品質パイプラインにおいて **TEXT rootCause**（誤字・文字崩れ等）が **Smart Auto Fix チェーン** に接続されました。v1.3 まで placeholder だった `smart_auto_fix` ルートが、apply 時に実改善から quality loop まで一気通貫で動きます。

### 概要

| 項目 | 内容 |
|------|------|
| 対象 rootCause | **TEXT**（誤字・日本語崩れ・文字欠け等） |
| 改善手段 | Smart Auto Fix → Regeneration Engine → Nano Banana adapter |
| 再評価 | Gemini ReReview → scoreSummary 更新 |
| LAYOUT / STYLE / BOOST | 従来どおり **Nano Banana 直呼び**（退行なし） |
| dry-run 標準 | **維持**（デフォルト API 未呼び出し） |
| 品質基準 | **80 点合格 / 90 点公開推奨**（v1.3 維持） |

### TEXT 改善チェーン（apply モード）

```
TEXT rootCause（scoreSummary / classifyRootCause）
        ↓
Smart Auto Fix（slide.md / prompt.md 追記・backup）
        ↓
Regeneration Engine（共通 IF）
        ↓
Nano Banana adapter（v1.4 暫定実装）
        ↓
output/carousel/improved/slideXX.png + manifest item
        ↓
Gemini ReReview（applyReReviewFromManifest）
        ↓
scoreSummary 更新（source: smart_auto_fix_re_review）
        ↓
quality loop 継続（shouldContinueImprovement）
        ↓
export / report / metrics 反映
```

**責務分離（重要）：**

- Smart Auto Fix は **Regeneration Engine / Nano Banana を直接 import しない**
- Regeneration Engine は **Smart Auto Fix に依存しない**
- 両者の接続は **`pipeline_improvement.js` のみ** で行う

### rootCause 別ルーティング（v1.4）

| rootCause | 改善ツール | 経路 |
|-----------|-----------|------|
| **TEXT** | `smart_auto_fix` | SAF → Regeneration Engine → Nano Banana adapter → ReReview |
| **LAYOUT / STYLE / BOOST** | `nano_banana` | Nano Banana 直呼び → ReReview |
| **PROMPT** | `openai_regenerate` | **placeholder**（未実装） |
| **OTHER** 等 | `manual_review` | 手動確認 |

### dry-run 標準（v1.4 も維持）

```bash
# 計画確認（API 未呼び出し・ファイル未変更）
npm run quality-pipeline:dry-run -- --from-phase image-review --max-rounds 3

# 本番実行（TEXT チェーン含む改善を実実行）
npm run quality-pipeline:apply -- --from-phase image-review --max-rounds 3

# テスト（21 件・API 未使用）
npm run test:quality-pipeline
```

dry-run 時、TEXT 対象は `status: planned` として report / metrics に記録されます。

### report / metrics の追加表示（v1.4）

`report.json` / `report.md` に以下が追加されます。

- Smart Auto Fix 実行 / 成功 / 失敗
- Regeneration 実行 / 成功 / 失敗
- Gemini ReReview 結果
- TEXT チェーン接続有無（`textChainConnected`）
- score before / after、regeneration adapter 名

### 未実装（v1.4 スコープ外）

| 項目 | 状態 |
|------|------|
| `openai_regenerate` | placeholder のまま |
| `--resume` | 未実装 |
| GitHub Actions | 未実装 |
| `run_daily.sh` | **変更なし**（v1.0〜v1.4 維持） |

設計詳細: [docs/V1.4_SMART_AUTO_FIX_INTEGRATION_DESIGN.md](docs/V1.4_SMART_AUTO_FIX_INTEGRATION_DESIGN.md)

---

## 事前準備

### 1. Node.js をインストールする

[Node.js 公式サイト](https://nodejs.org/) から LTS 版をインストールしてください。

### 2. 依存パッケージをインストールする

プロジェクトのフォルダで、ターミナル（コマンド入力画面）を開き、次を実行します。

```bash
npm install
```

### 3. 動作環境を確認する（おすすめ）

セットアップ後、次のコマンドで必要なファイルや API キーが揃っているか確認できます。

```bash
npm run health-check
```

問題がなければ `✅ OK`、注意が必要なら `⚠ Warning`、修正が必要なら `❌ Error` と表示されます。  
詳しくは後述の「`npm run health-check` の使い方」を参照してください。

### 4. API キーを設定する

`.env.example` をコピーして `.env` を作成し、必要な API キーを入力します。

```bash
cp .env.example .env
```

最低限、次の 3 つが必要です。

| 環境変数 | 用途 |
|----------|------|
| `ANTHROPIC_API_KEY` | 投稿文の生成（Claude） |
| `GEMINI_API_KEY` | レビュー・カルーセル・画像レビュー（Gemini） |
| `OPENAI_API_KEY` | 画像生成（OpenAI Images API） |

---

## `npm run health-check` の使い方（v1.1.1）

`npm run daily` を実行する前に、**環境が正しく整っているか** を 1 コマンドで確認できます。

```bash
npm run health-check
```

### 何を確認できるか

| 確認項目 | 説明 |
|----------|------|
| `.env` | API キー設定ファイルがあるか |
| `OPENAI_API_KEY` | 画像生成用のキーが設定されているか |
| `GEMINI_API_KEY` | レビュー・カルーセル用のキーが設定されているか |
| `prompts/` | プロンプト用フォルダがあるか |
| `content/` | 投稿データ用フォルダがあるか |
| `content/research/` | Genspark リサーチ用フォルダがあるか |
| `.cache/` | Gemini キャッシュ用フォルダがあるか |
| `output/` | 出力用フォルダがあるか |
| `logs/` | ログ用フォルダがあるか |
| `package.json` | プロジェクト設定ファイルがあるか |
| `node_modules/` | `npm install` 済みか |
| `scripts/run_daily.sh` | 一括実行スクリプトがあるか |

実行後、次のような **件数サマリー** が表示されます。

```
Health Check 完了
OK: （件数）
Warning: （件数）
Error: （件数）
```

### Error / Warning が出たときの見方

| 表示 | 意味 | 対処 |
|------|------|------|
| **✅ OK** | 問題なし | そのままで大丈夫です |
| **⚠ Warning** | 注意（すぐに止まる原因ではない） | 例：`content/research/` や `logs/` がまだない → 初回実行時に自動作成される、または Genspark 未使用なら無視してよい |
| **❌ Error** | 修正が必要 | 表示されたメッセージに従って対応してください（例：`.env` 作成、`npm install`） |

**ポイント：**

- Error が 1 つでもあると、`npm run daily` は途中で失敗する可能性が高いです
- `health-check` 自体は **Error があっても最後まで実行** し、終了コードは常に 0 です（確認用コマンドのため）
- API キーの値そのものは表示しません（安全のため）

---

## `npm run doctor` の使い方（v1.1.1）

`health-check` より **一段詳しく**、リサーチ・画像レビュー・投稿素材の状態を診断し、**次に何を実行すべきか** を教えてくれます。

```bash
npm run doctor
```

### health-check との違い

| コマンド | 確認内容 |
|----------|----------|
| `npm run health-check` | 環境（.env、API キー、フォルダなど）が整っているか |
| `npm run doctor` | 上記に加え、リサーチ・画像レビュー・出力素材の **現在の進捗** を診断 |

### 何を確認できるか

| 確認項目 | 説明 |
|----------|------|
| Health Check の実行 | 内部で health-check を走らせ、環境の状態を確認 |
| `latest.md` / `latest.json` | Genspark リサーチファイルの有無 |
| `latest.json` の読み込み | JSON が正しく読めるか、最高 `postValueScore` はいくつか |
| `image_review.json` | 画像レビューの `passed` / `score` / `failedItems` |
| **不合格スライドの rootCause** | 不合格時、各スライドの原因分類（TEXT / LAYOUT 等）を表示 |
| `output/instagram/` | 投稿素材フォルダと slide01〜05.png の有無 |
| `logs/daily.log` | 実行ログがあるか |
| `.cache/gemini/` | Gemini キャッシュがあるか |

### 表示の見方

| 表示 | 意味 |
|------|------|
| **✅ 正常** | 問題なし |
| **⚠ 注意** | すぐに止まる原因ではない（初回実行前など） |
| **❌ 要対応** | 修正や再実行が必要 |

### おすすめコマンドの例

Doctor の最後に、状況に応じたコマンドが表示されます。

| 状態 | おすすめコマンド |
|------|------------------|
| リサーチがない | `npm run research-check` |
| 投稿素材がない | `npm run daily` |
| **画像レビュー不合格** | **`npm run smart-auto-fix`**（原因別改善計画を表示） |
| 画像レビュー不合格（バックアップ準備まで） | `npm run smart-auto-fix -- --apply` |
| 画像レビュー不合格（従来方式） | `npm run image-improve`（補足表示） |
| すべて OK | `npm run daily` を実行できます |

画像レビュー不合格時は、各スライドの **rootCause**（TEXT / LAYOUT / PROMPT / STYLE / OTHER）と **matchedKeywords** も表示されます。

**ポイント：** `doctor` も Error があっても最後まで実行し、終了コードは常に 0 です。

---

## `npm run smart-auto-fix` の使い方（v1.1.1）

画像レビュー不合格時に、**原因（rootCause）を自動判定** し、**何を直すべきか** を表示するコマンドです。

```bash
npm run smart-auto-fix
```

### 何をするか

| ステップ | 内容 |
|----------|------|
| 1 | `image_review.json` を読み込む |
| 2 | failedItems または 80 点未満のスライドを改善対象にする |
| 3 | 各スライドの rootCause（TEXT / LAYOUT / PROMPT / STYLE / OTHER）を判定 |
| 4 | 原因に応じた改善方針と修正予定ファイルを表示 |

### モード

| コマンド | 動作 |
|----------|------|
| `npm run smart-auto-fix` | **dry-run（標準）** … 計画表示のみ。ファイルは変更しない |
| `npm run smart-auto-fix -- --apply` | 対象ファイルをバックアップし、Smart Auto Fix 指示を Markdown 末尾に追記 |

### Smart Auto Fix Report

`npm run smart-auto-fix` を実行するたびに、実行結果が **レポートファイル** として保存されます。

| 項目 | 内容 |
|------|------|
| 保存場所 | `reports/smart-auto-fix/` |
| ファイル名 | `YYYY-MM-DD-HHmmss.md`（例：`2026-06-26-120530.md`） |
| 作成タイミング | dry-run / apply **どちらでも** 毎回作成 |
| Git 管理 | 対象外（`.gitignore` で除外） |

#### レポートで確認できること

- 実行日時・実行モード（dry-run / apply）
- 画像レビューの総合 score / passed / failedItems
- 改善対象スライドごとの score / rootCause / reason / matchedKeywords
- 修正予定ファイル・改善方針
- 実際に変更したファイル・バックアップしたファイル
- 実行結果（改善対象なし / dry-run完了 / apply完了 / 手動確認が必要）

#### dry-run と apply の違い（レポート上）

| モード | ファイル変更 | レポートの結果例 |
|--------|-------------|-----------------|
| **dry-run** | なし | `dry-run完了` または `改善対象なし` |
| **apply** | Smart Auto Fix 指示を追記 | `apply完了`（OTHER の場合は `手動確認が必要`） |

実行後、ターミナルにレポート保存先が表示されます。

```bash
【レポート保存】
→ reports/smart-auto-fix/2026-06-26-120530.md
   結果: 改善対象なし
```

### rootCause ごとの改善方針

| rootCause | 主な修正対象 |
|-----------|-------------|
| **TEXT** | `content/carousel/slideXX.md` + `generated-prompts/promptXX.md` |
| **LAYOUT** | プロンプトに余白・背景・文字エリア指定を追加 |
| **PROMPT** | プロンプトに EXACT text・文字サイズ・安全余白を追加 |
| **STYLE** | プロンプトにブランドカラー・統一感・アイコン指示を追加 |
| **OTHER** | 手動確認を促す |

### 関連コマンド

```bash
npm run root-cause-check   # rootCause 判定だけ確認
npm run smart-auto-fix     # 改善計画を表示（dry-run）
npm run doctor             # 全体診断 + 次のコマンド提案
```

---

## 基本的な使い方

### 毎日の投稿生成（おすすめ）

```bash
npm run daily
```

これ 1 つで、**リサーチ確認**から投稿生成、Instagram 投稿素材の出力まで、全部自動で実行されます。

実行には **5〜10 分程度** かかることがあります。完了すると、ターミナルに次のようなメッセージが表示されます。

```
Instagram投稿パッケージ:
/Users/あなたのユーザー名/AI-SNS-Automation/output/instagram/
```

### 実行ログの確認

実行ログは `logs/daily.log` に保存されます。エラーが出たときは、このファイルを開いて原因を確認してください。

---

## `npm run daily` の処理の流れ

`npm run daily` は、**リサーチ確認**のあと、次の 13 ステップを順番に実行します。

| # | ステップ | 内容 |
|---|----------|------|
| 0 | リサーチ確認 | Genspark リサーチファイルの状態を表示（失敗しても続行） |
| 1 | 投稿生成 | 下書き投稿を作成 |
| 2 | Geminiレビュー | 投稿文を改善 |
| 3 | カルーセル生成 | 5 枚分のスライド文言を作成 |
| 4 | カルーセルレビュー | テキスト品質を採点 |
| 5 | カルーセル改善 | 不合格の場合のみ改善 |
| 6 | カルーセル再レビュー | 改善後に再採点 |
| 7 | 画像プロンプト作成 | 画像生成用の指示文を作成 |
| 8 | 画像プロンプト整形 | プロンプトを OpenAI 用に整形 |
| 9 | 画像生成 | 5 枚の画像を生成 |
| 10 | 画像レビュー | 画像品質を採点 |
| 11 | 画像改善 | 不合格スライドのみ再生成 |
| 12 | 画像再レビュー | 改善後に再採点 |
| 13 | Instagramパッケージ出力 | 投稿素材をまとめる |

**途中でエラーが出た場合は、その時点で処理が止まります。**（リサーチ確認だけは例外で、失敗しても続行します）

最終的な画像レビューで不合格（`passed: false`）の場合も、`export-instagram` は実行されずに停止します。

---

## Genspark 連携（v1.1）

v1.1 では、投稿生成の前に **Genspark で調べたネタ** を使えるようになりました。

> **重要：** v1.1 は **半自動運用** です。Genspark での調査とファイル保存は **人間が行います**。Genspark API への自動連携は v1.1 では行いません。

### 全体の流れ（半自動）

```
【朝の作業（5〜10分・人間が行う）】
1. Genspark を開く
2. prompts/genspark/research_template.md のプロンプトを貼り付けて調査
3. 結果を content/research/ に 3 ファイル保存

【自動実行】
4. npm run daily
   → リサーチ確認 → 投稿生成（リサーチ結果を反映）→ 以降は v1.0 と同じ
```

### `prompts/genspark/research_template.md` の使い方

1. `prompts/genspark/research_template.md` を開く
2. 「Genspark に貼り付けるプロンプト」の部分を **すべてコピー** する
3. [Genspark](https://www.genspark.ai/) の入力欄に貼り付けて実行する
4. 返ってきた結果を **3 つのブロックに分けて** 保存する
   - Markdown ブロック → `content/research/latest.md`
   - JSON ブロック（latest）→ `content/research/latest.json`
   - JSON ブロック（metadata）→ `content/research/metadata.json`

コードブロックの ```markdown や ```json という行は **含めず**、中身だけを保存してください。

### `content/research/` の 3 ファイル

| ファイル | 誰が使う | 役割 |
|----------|----------|------|
| `latest.md` | 人間・AI | 調査結果の要約。人が読んで「今日のネタ」を確認する |
| `latest.json` | AI | 投稿案の構造化データ。`postValueScore` が最も高いテーマを最優先で使う |
| `metadata.json` | 人間 | 調査日時・キーワードなどのメタ情報（投稿生成には直接使わない） |

### 投稿生成でリサーチが使われる仕組み

`npm run generate`（投稿生成）は、次の優先順位でネタを決めます。

| 状態 | 動作 |
|------|------|
| `latest.json` あり（正常） | JSON の最優先テーマ + `latest.md` を参考に生成 |
| `latest.md` のみ | Markdown の推奨テーマを参考に生成 |
| 両方なし | 固定テーマ（`prompts/instagram/user.md`）で生成 |

**エラー時の動作：**

- `latest.json` が壊れている（JSON 形式が不正）→ **停止しません**。`latest.md` があれば Markdown のみで続行します
- `latest.md` も `latest.json` もない → 固定テーマにフォールバックします

### `npm run research-check` の使い方

リサーチファイルの状態を、投稿生成前に確認できます。

```bash
npm run research-check
```

表示される内容：

- `latest.md` / `latest.json` / `metadata.json` の有無
- `latest.json` の推奨テーマ・最優先 topic・スコアなど
- **投稿生成で実際に何が使われるか**

`npm run daily` 実行時も、最初に自動で `research-check` が走ります。失敗しても daily は止まりません。

### Genspark 連携の日常運用（まとめ）

```bash
# 1. 朝：Genspark で調査 → content/research/ に 3 ファイル保存

# 2. 確認（任意・daily でも自動実行される）
npm run research-check

# 3. 一括実行
npm run daily
```

---

## 生成される成果物

### テキスト

| ファイル | 内容 |
|----------|------|
| `content/research/latest.md` | Genspark 調査結果（人間向け） |
| `content/research/latest.json` | Genspark 調査結果（AI 向け・投稿ネタ） |
| `content/research/metadata.json` | 調査のメタ情報 |
| `content/draft/post.md` | AI が生成した下書き投稿 |
| `content/reviewed/post.md` | レビュー・改善済みの投稿文（キャプションの元） |
| `content/carousel/slide01.md` 〜 `slide05.md` | カルーセル各スライドの文言 |
| `content/carousel/review.json` / `review.md` | カルーセルテキストの品質レビュー結果 |

### 画像

| ファイル | 内容 |
|----------|------|
| `images/carousel/prompts/prompt01.md` 〜 `prompt05.md` | 画像生成用プロンプト（生） |
| `images/carousel/generated-prompts/prompt01.md` 〜 `prompt05.md` | 整形済みプロンプト |
| `images/carousel/output/slide01.png` 〜 `slide05.png` | 生成されたカルーセル画像 |
| `images/carousel/review/image_review.json` / `image_review.md` | 画像品質レビュー結果 |
| `images/carousel/backup/` | 画像改善前のバックアップ |
| `output/carousel/improved/` | Nano Banana 改善後画像・manifest（v1.2） |

### Nano Banana 改善レポート（v1.2・Git 管理外）

| ファイル | 内容 |
|----------|------|
| `reports/nano-banana-improve/review_result.json` | 改善後画像の再レビュー結果 |
| `reports/nano-banana-improve/report.md` | 改善前後サマリー（人間向け） |
| `reports/nano-banana-improve/report.json` | 改善前後サマリー（JSON） |

### 最終出力（Instagram 投稿用）

| ファイル | 内容 |
|----------|------|
| `output/instagram/` | **ここが投稿直前に使うフォルダ** |

---

## `output/instagram/` の中身

Instagram に投稿するときは、このフォルダの中身を使います。

```
output/instagram/
├── caption.txt          … 投稿キャプション（本文）。そのままコピーして使えます
├── review-summary.md    … 画像レビューの要約
├── package-info.json    … 出力日時・スコアなどのメタ情報
└── slides/
    ├── slide01.png      … カルーセル 1 枚目（表紙）
    ├── slide02.png      … 2 枚目（共感）
    ├── slide03.png      … 3 枚目（失敗例）
    ├── slide04.png      … 4 枚目（成功例）
    └── slide05.png      … 5 枚目（CTA）
```

### Instagram への投稿手順（イメージ）

1. `output/instagram/slides/` の画像 5 枚を、順番通りに Instagram のカルーセル投稿に追加する
2. `output/instagram/caption.txt` の内容をキャプション欄に貼り付ける
3. 内容を確認して投稿する

---

## `FORCE_AI=1` の使い方

通常、Gemini API の結果は `.cache/gemini/` にキャッシュ（保存）され、同じ入力なら API を呼ばずに前回の結果を再利用します。これにより API の使用回数を減らせます。

**キャッシュを無視して、必ず AI に再生成させたい場合** は、コマンドの前に `FORCE_AI=1` を付けます。

```bash
FORCE_AI=1 npm run gemini-review
```

```bash
FORCE_AI=1 npm run daily
```

入力ファイル（例：`content/draft/post.md`）を編集したあと、新しい結果が欲しいときに使ってください。

---

## Gemini API クォータ超過時の対処

Gemini API の無料プランには、**1 日に使える回数の上限** があります。上限に達すると、次のようなメッセージが表示されて処理が止まります。

```
Gemini APIクォータ上限に到達しました

停止したステップ: （止まったステップ名）
```

### 対処方法

1. **明日あらためて `npm run daily` を実行する**（最も簡単）
2. [Google AI Studio](https://aistudio.google.com/) で利用状況を確認する
3. キャッシュが効いているステップは API を消費しないため、同じ入力の再実行ならクォータを節約できる
4. 必要に応じて Gemini の有料プランを検討する

詳細は `logs/daily.log` に記録されます。

---

## 画像レビュー不合格時の対処

最終的な画像レビューで不合格（80 点未満のスライドがある）場合、パイプラインは **export-instagram の前で停止** します。

```
最終画像レビュー不合格
score: （総合点）
failedItems: ["slide02"] など
images/carousel/review/image_review.md を確認してください
```

### 対処方法

1. **`images/carousel/review/image_review.md` を開く** … どのスライドが何点で、何を改善すべきかが書いてあります
2. **改善対象スライドだけ再生成する**

   ```bash
   npm run image-improve
   ```

   不合格スライドの画像だけ AI で作り直します。改善前の画像は `images/carousel/backup/` に保存されます。

3. **再度レビューする**

   ```bash
   npm run image-review
   ```

4. 合格したら、投稿素材を出力する

   ```bash
   npm run export-instagram
   ```

   または、最初からやり直す場合は `npm run daily` を再実行します。

---

## 主な npm scripts 一覧

### まとめて実行

| コマンド | 説明 |
|----------|------|
| `npm run daily` | リサーチ確認〜Instagram 素材出力まで一括実行 |
| `npm run image-generate` | 画像プロンプト整形 + 画像生成 |

### 品質パイプライン（v1.3）

| コマンド | 説明 |
|----------|------|
| `npm run quality-pipeline` | 品質パイプライン（dry-run 標準） |
| `npm run quality-pipeline:dry-run` | 明示 dry-run |
| `npm run quality-pipeline:apply` | API 実行モード |
| `npm run quality-pipeline:report` | REPORT フェーズから実行 |
| `npm run quality-pipeline:export` | EXPORT フェーズから実行 |
| `npm run test:quality-pipeline` | 最小テスト（API 未使用） |

### 環境確認・Genspark 連携

| コマンド | 説明 |
|----------|------|
| `npm run health-check` | ファイル・フォルダ・API キーの設定状態を確認 |
| `npm run doctor` | リサーチ・画像・出力の現在状態を診断し、次のコマンドを提案 |
| `npm run root-cause-check` | 不合格スライドの rootCause 判定結果を表示 |
| `npm run smart-auto-fix` | rootCause に基づく改善計画を表示（dry-run） |
| `npm run research-check` | リサーチファイルの状態と投稿生成の優先テーマを確認 |

### テキスト生成・レビュー

| コマンド | 説明 |
|----------|------|
| `npm run generate` | 下書き投稿を生成 |
| `npm run gemini-review` | Gemini で投稿文をレビュー・改善 |
| `npm run carousel` | カルーセル 5 枚の文言を生成 |
| `npm run carousel-review` | カルーセル品質を採点 |
| `npm run carousel-improve` | カルーセルテキストを改善（不合格時） |

### 画像生成・レビュー

| コマンド | 説明 |
|----------|------|
| `npm run image-prompt` | 画像生成用プロンプトを作成 |
| `npm run generate-image` | プロンプトを OpenAI 用に整形 |
| `npm run openai-image` | OpenAI で画像 5 枚を生成 |
| `npm run image-review` | 生成画像を Gemini で採点 |
| `npm run image-improve` | 不合格スライドの画像を再生成 |

### Nano Banana 画像改善（v1.2・node 直接実行）

| コマンド | 説明 |
|----------|------|
| `node scripts/improve_with_nano_banana.js --review …` | 80 点未満スライドの改善計画（dry-run） |
| `node scripts/improve_with_nano_banana.js --apply --review …` | Nano Banana で改善画像を生成 |
| `node scripts/review_improved_images.js` | 改善後再レビューの対象確認（dry-run） |
| `node scripts/review_improved_images.js --apply` | 改善成功分を Gemini で再採点 |
| `node scripts/report_nano_banana_improvement.js` | manifest + review_result からレポート生成 |

### 出力

| コマンド | 説明 |
|----------|------|
| `npm run export-instagram` | `output/instagram/` に投稿素材を出力 |

---

## 開発メモ

### プロジェクト構成

```
AI-SNS-Automation/
├── content/
│   ├── research/     … Genspark リサーチ結果（latest.md / latest.json / metadata.json）
│   ├── draft/        … 投稿下書き
│   ├── reviewed/     … レビュー済み投稿
│   └── carousel/     … カルーセルスライド
├── images/           … 画像プロンプト・生成画像・レビュー結果
├── output/
│   ├── instagram/    … Instagram 投稿用の最終出力
│   └── carousel/improved/ … Nano Banana 改善画像（v1.2）
├── reports/          … 運用レポート（Git 管理外）
│   ├── smart-auto-fix/ … Smart Auto Fix レポート
│   ├── nano-banana-improve/ … v1.2 Nano Banana レポート
│   └── quality-pipeline/latest/ … v1.3+ 品質パイプライン state / metrics / report
├── src/              … Node.js スクリプト本体
│   └── lib/          … 品質パイプライン・Smart Auto Fix・Regeneration Engine 等
│       ├── smart_auto_fix.js      … SAF lib（v1.4）
│       ├── regeneration_engine.js … Regeneration Engine（v1.4）
│       └── regeneration/          … adapter（nano_banana 等）
├── scripts/          … シェルスクリプト（run_daily.sh など）
│   ├── run_quality_pipeline.js … v1.3 品質パイプライン CLI
│   └── test_quality_pipeline.sh … v1.3 最小テスト
├── prompts/
│   ├── instagram/    … 投稿生成用プロンプト
│   └── genspark/       … Genspark リサーチ用テンプレート
├── logs/             … 実行ログ
└── .cache/gemini/    … Gemini API キャッシュ（自動生成）
```

### キャッシュについて

次の 5 処理で Gemini キャッシュが使われます。

- 投稿レビュー（`gemini-review`）
- カルーセル生成（`carousel`）
- カルーセルレビュー（`carousel-review`）
- 画像プロンプト作成（`image-prompt`）
- 画像レビュー（`image-review`）

入力ファイルの内容からハッシュを作り、同じ内容なら API を呼ばずに前回結果を使います。キャッシュ利用時は `[Gemini] Geminiキャッシュを使用` と表示されます。

### 品質基準

| 種類 | 合格基準 |
|------|----------|
| カルーセルテキスト | 総合 90 点以上 + 各項目の最低点クリア |
| 画像レビュー | 各スライド 80 点以上（1 枚でも未満なら不合格） |
| Nano Banana 再レビュー | 80 点以上で合格、90 点以上で公開推奨（v1.2） |
| 品質パイプライン（v1.3） | targetScore 90 まで改善ループ、export / report 統合 |
| 品質パイプライン（v1.4） | TEXT rootCause → Smart Auto Fix チェーン接続 |

---

## 注意事項

- **API キーは他人に見せないでください。** `.env` ファイルは Git にコミットしないでください（`.gitignore` で除外済み）
- **API 利用には料金がかかる場合があります。** OpenAI・Gemini・Anthropic それぞれの料金体系を確認してください
- **生成内容は必ず人間が確認してから投稿してください。** AI の出力に誤りや不適切な表現が含まれる可能性があります
- **Gemini 無料枠には 1 日の上限があります。** 上限に達した日は、翌日以降に再実行するか、キャッシュを活用してください
- **`npm run daily` は途中で止まることがあります。** エラーメッセージと `logs/daily.log` を確認し、対処方法に従ってください
- **生成ファイルの多くは `.gitignore` で除外されています。** 別 PC に移す場合は、生成物ではなく `.env` とソースコードを共有してください
