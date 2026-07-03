# AI-SNS-Automation

飲食店向け Instagram 投稿を、AI で自動生成するツールです。

投稿文の作成から、カルーセル（5枚の画像付き投稿）の生成、画像の品質チェック、Instagram に投稿する直前の素材まとめまでを、1 本のコマンドで実行できます。

## Architecture Documentation

Developer Automation のアーキテクチャ原則・レイヤーモデル・開発フローは **[docs/architecture/](docs/architecture/README.md)** を参照してください。

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
| **TEXT**（誤字・文字崩れ） | **Smart Auto Fix** → Regeneration Engine → adapter（`nano_banana` または `openai`、v1.5 で切替可能） |
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

**v1.4 以降（品質パイプライン）：** TEXT rootCause は `npm run quality-pipeline:apply` 実行時に **Smart Auto Fix チェーン** で自動改善されます（slide / プロンプト追記 → Regeneration Engine → adapter → Gemini ReReview）。adapter は v1.5 から `--regeneration-adapter` で切り替え可能（デフォルト `nano_banana`）。

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
npm run quality-pipeline:dry-run -- --regeneration-adapter openai --from-phase image-review
```

追加オプション（v1.3.1 / v1.5 / v1.6 / v1.7）:

| オプション | 説明 |
|------------|------|
| `--clean-latest` | 実行前に `reports/quality-pipeline/latest` を削除してから開始（`--resume` 不可） |
| （デフォルト） | 既存 `latest` がある場合、上書き前に `reports/quality-pipeline/archive/YYYY-MM-DD-HHmmss/` へ退避 |
| `--regeneration-adapter <nano_banana\|openai>` | TEXT チェーンの Regeneration adapter を選択（**デフォルト: `nano_banana`**） |
| `--resume` | `state.json` checkpoint から途中再開（`latest` を archive しない） |
| `--stop-before-phase <phase>` | 指定 Phase の直前で意図的中断（`state.json` に `stopReason: before-phase` を保存） |

### npm scripts

| コマンド | 説明 |
|----------|------|
| `npm run quality-pipeline` | デフォルト（dry-run）で実行 |
| `npm run quality-pipeline:dry-run` | 明示 dry-run |
| `npm run quality-pipeline:apply` | API 実行モード |
| `npm run quality-pipeline:report` | REPORT フェーズから実行 |
| `npm run quality-pipeline:export` | EXPORT フェーズから実行 |
| `npm run test:quality-pipeline` | 最小テスト（API 未使用） |
| `npm test` | 上記と同じ（CI エイリアス） |

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
| `reports/quality-pipeline/latest/state.json` | 途中再開用 checkpoint（v1.6 `--resume` / v1.7 `stopReason`） |
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
- [ ] `--regeneration-adapter openai` を使う場合は `OPENAI_API_KEY` も設定済み（`--apply` 時必須）
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
- GitHub Actions 連携は v1.7（dry-run CI）/ v1.8（Nightly Apply）で実装済み

設計詳細: [docs/V1.3_QUALITY_PIPELINE_DESIGN.md](docs/V1.3_QUALITY_PIPELINE_DESIGN.md)

---

## Smart Auto Fix 統合（v1.4）

v1.4 では、品質パイプラインにおいて **TEXT rootCause**（誤字・文字崩れ等）が **Smart Auto Fix チェーン** に接続されました。v1.3 まで placeholder だった `smart_auto_fix` ルートが、apply 時に実改善から quality loop まで一気通貫で動きます。

### 概要

| 項目 | 内容 |
|------|------|
| 対象 rootCause | **TEXT**（誤字・日本語崩れ・文字欠け等） |
| 改善手段 | Smart Auto Fix → Regeneration Engine → adapter（デフォルト Nano Banana） |
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

# テスト（34 件・API 未使用）
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
| GitHub Actions（dry-run CI） | v1.7 `.github/workflows/quality-pipeline-ci.yml` |
| GitHub Actions（Nightly Apply） | v1.8 `.github/workflows/nightly-apply.yml` |
| `run_daily.sh` | **変更なし**（v1.0〜v1.4 維持） |

設計詳細: [docs/V1.4_SMART_AUTO_FIX_INTEGRATION_DESIGN.md](docs/V1.4_SMART_AUTO_FIX_INTEGRATION_DESIGN.md)

---

## OpenAI Regeneration Adapter（v1.5）

v1.5 では、Regeneration Engine に **OpenAI Adapter** が追加され、TEXT チェーンの画像再生成を **Nano Banana と切り替え可能** にしました。Smart Auto Fix 側の設計は変更せず、pipeline の CLI / config から adapter を選びます。

### 概要

| 項目 | 内容 |
|------|------|
| 対象 | TEXT rootCause の **Smart Auto Fix チェーン** 内 Regeneration のみ |
| adapter | `nano_banana`（デフォルト） / `openai` |
| OpenAI モデル | `gpt-image-1`（OpenAI Images API） |
| 出力先 | 従来どおり `output/carousel/improved/slideXX.png` |
| LAYOUT / STYLE / BOOST | 従来どおり **Nano Banana 直呼び**（adapter 切替の対象外） |
| dry-run 標準 | **維持** — adapter 選択時も API 未呼び出し |

### アーキテクチャ

```
Smart Auto Fix（v1.4 維持・変更なし）
        ↓
Regeneration Engine
  ├─ Nano Banana Adapter（デフォルト）
  └─ OpenAI Adapter（v1.5 追加）
        ↓
output/carousel/improved/slideXX.png
        ↓
Gemini ReReview → scoreSummary → export / report / metrics
```

### adapter 切替方法

**デフォルトは `nano_banana`** です（v1.4 互換）。OpenAI を使う場合は `--regeneration-adapter openai` を指定します。

```bash
# dry-run（API 未呼び出し・計画と report 確認）
npm run quality-pipeline:dry-run -- --regeneration-adapter openai

# 画像レビュー済みから、OpenAI adapter で計画確認
npm run quality-pipeline:dry-run -- --regeneration-adapter openai --from-phase image-review --max-rounds 3

# 本番実行（TEXT チェーンで OpenAI 画像再生成）
npm run quality-pipeline:apply -- --regeneration-adapter openai --from-phase image-review --max-rounds 3
```

### dry-run と `--apply` の違い（OpenAI adapter）

| モード | API 呼び出し | 必要なキー | 挙動 |
|--------|-------------|-----------|------|
| **dry-run**（デフォルト） | **なし** | 不要 | placeholder 結果を返し、report に adapter / model / dryRun を記録 |
| **`--apply`** | **あり**（OpenAI Images） | **`OPENAI_API_KEY` 必須** | プロンプトから PNG を生成して `output/carousel/improved/` に保存 |

**ポイント：**

- dry-run では `OPENAI_API_KEY` が未設定でも **失敗扱いにせず**、report / CLI Summary に **設定案内** を出します
- `--apply` で OpenAI adapter を使う場合のみ `OPENAI_API_KEY` が必須です
- Nano Banana adapter（デフォルト）を使う場合は、従来どおり `GEMINI_API_KEY` または `NANO_BANANA_API_KEY` が Regeneration に必要です

### API キー

| adapter | 環境変数 | 用途 |
|---------|----------|------|
| `nano_banana`（デフォルト） | `NANO_BANANA_API_KEY` または `GEMINI_API_KEY` | TEXT チェーンの画像再生成 |
| `openai` | `OPENAI_API_KEY` | TEXT チェーンの画像再生成（`gpt-image-1`） |
| 共通 | `GEMINI_API_KEY` | Gemini ReReview（apply 時） |

### report / metrics / CLI Summary

`report.json` / `report.md` / `metrics.json` に adapter 情報が出力されます。

| 出力先 | 追加項目（v1.5） |
|--------|-----------------|
| `report.json` `summary` | `regenerationAdapter`、`regenerationByAdapter` |
| `report.md` サマリー | `Regeneration adapter`（例: `openai (OpenAI Adapter)`）、adapter 別実行数 |
| `report.md` TEXT チェーン表 | `adapter` / `model` / `dryRun` 列 |
| `metrics.json` | `regenerationByAdapter: { nano_banana, openai }` |
| CLI Summary | `regeneration adapter: ...`、`regeneration by adapter: ...` |

dry-run 後は `reports/quality-pipeline/latest/report.md` で adapter 選択と API キー案内を確認してから `--apply` してください。

### テスト

```bash
npm run test:quality-pipeline   # 39 PASS
npm test                        # 同上（CI エイリアス）
```

---

## Resume Execution（v1.6）

v1.6 では、Quality Pipeline が **途中で停止した場合** でも、`--resume` によって **最後に成功したフェーズ以降** から安全に再開できるようになりました。

### 概要

| 項目 | 内容 |
|------|------|
| checkpoint ファイル | `reports/quality-pipeline/latest/state.json` |
| 関連ファイル | `pipeline_state.json` / `metrics.json`（実行状態の復元に使用） |
| 再開単位 | 最後に成功した Phase（改善ループは `checkpointRound` から継続） |
| dry-run 標準 | **維持** — `--resume` でも dry-run / apply は CLI 指定どおり |
| archive 退避 | **`--resume` 時は行わない**（`latest` をそのまま利用） |

各 Phase 成功時に `state.json` が更新されます。`checkpointPhase`・`nextPhase`・`completedSteps`・`checkpointRound` などが記録され、`--resume` 実行時に読み込まれます。

### いつ使うか

- API quota 超過・ネットワークエラー等で pipeline が **途中停止** したとき
- `--max-api-calls` 到達などで **部分実行** したあと、続きから再開したいとき
- 前回の `pipeline_state.json` / `metrics.json` を活かし、**最初からやり直さず** EXPORT / REPORT 以降だけ実行したいとき

### 使用例

```bash
# dry-run で checkpoint から計画確認・再開
npm run quality-pipeline:dry-run -- --resume

# 本番実行で checkpoint から再開（API 呼び出し・output 変更あり）
npm run quality-pipeline:apply -- --resume
```

### 制約・注意

| 項目 | 内容 |
|------|------|
| `--resume` 必須ファイル | `reports/quality-pipeline/latest/state.json` が存在すること |
| `--resume` + `--clean-latest` | **併用不可**（エラー） |
| `--resume` + `--stop-before-phase` | **併用不可**（エラー） |
| 完了済み実行 | `state.json` の `status: completed` の場合、`--resume` は不要（エラー） |
| 初回実行 | 通常どおり `npm run quality-pipeline:dry-run` 等を実行すると `state.json` が自動生成される |

**推奨フロー：**

```bash
# 1. 通常実行（途中停止または計画確認）
npm run quality-pipeline:dry-run -- --from-phase image-review --max-rounds 3

# 2. checkpoint 確認
cat reports/quality-pipeline/latest/state.json

# 3. 途中から再開
npm run quality-pipeline:dry-run -- --resume
# 問題なければ apply
npm run quality-pipeline:apply -- --resume
```

CLI Summary では `resume: enabled` と `workspace: --resume（latest を archive せず再開）` が表示されます。

### テスト

```bash
npm run test:quality-pipeline   # 39 PASS
npm test                        # 同上
```

### `--stop-before-phase`（v1.7）

指定 Phase の **直前** で pipeline を意図的に中断し、`state.json` に resumable checkpoint を保存します。

```bash
# EXPORT 完了後、REPORT 前で停止
npm run quality-pipeline:dry-run -- \
  --from-phase image-review \
  --max-rounds 1 \
  --clean-latest \
  --stop-before-phase report

# 続きから再開
npm run quality-pipeline:dry-run -- --resume
```

中断時の `state.json`:

| フィールド | 値 |
|------------|-----|
| `status` | `resumable` |
| `stopReason` | `before-phase` |
| `stopBeforePhase` | `REPORT` |
| `checkpointPhase` | `EXPORT` |
| `nextPhase` | `REPORT` |

Resume 完了後は `status: completed`、`stopReason: null`、`stopBeforePhase: null`、`nextPhase: null` になります。

---

## GitHub Actions（v1.7 / v1.8）

Quality Pipeline 向け GitHub Actions は **2 つの workflow** に役割分離されています。

**Actions runtime maintenance（v1.10.0–v1.24.0）:** GitHub Actions の保守性向上のため、workflow 内の Actions を更新しています。**v1.24.0** 本番 workflow では `actions/checkout@v5` / `actions/setup-node@v5` / `actions/upload-artifact@v6`（Node24-ready）を使用します。`upload-artifact@v7` は今回見送り、`FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` は使用しません。Quality Pipeline の挙動、終了コード、Nightly Apply、Step Summary の仕様は変更ありません。

**npm cache 最適化（v1.13.0）:** 両 workflow の `actions/setup-node@v6` で GitHub 公式の **npm cache** を有効化しています（`cache: npm`）。`cache-dependency-path` には **`package-lock.json`** を指定し、lockfile の内容に基づいて cache key が決まります。`package-lock.json` が変更されると cache key が切り替わり、新しい依存関係セット用の cache が使われます。**`node_modules` はキャッシュしません** — 依存関係のインストールは従来どおり **`npm ci`** です。`actions/cache` の直接利用は行っていません。

| 項目 | 内容 |
|------|------|
| キャッシュ対象 | npm パッケージキャッシュ（setup-node 組み込み） |
| cache key 根拠 | `package-lock.json`（`cache-dependency-path`） |
| Dependabot PR 初回 | cache miss は正常（新 lockfile では未キャッシュ） |
| cache 破損時 | GitHub リポジトリ **Settings → Actions → Caches** から該当 cache を削除し、workflow を再実行 |

**CI 可観測性（v1.14.0 / v1.15.0 / v1.16.0）:** 両 workflow に **GitHub Actions Step Summary**（`GITHUB_STEP_SUMMARY`）を追加しました。v1.16.0 では Summary の内容を **machine-readable** な `performance-observation.json` として artifact にも保存します。

| 項目 | 内容 |
|------|------|
| Summary（人間向け） | workflow Run 詳細 → **Summary** タブ → **Performance / Cache Observation**（v1.15.0 維持） |
| Artifact JSON（比較用） | `reports/quality-pipeline/latest/performance-observation.json` — 過去 run との **手動比較** 用 |
| 比較方法（v1.16.0） | 各 run の artifact から JSON を DL し、同一 `cache.packageLockHash` の run 間で `durations.npmCiSeconds` 等を比較 |
| 自動集計（v1.17.0） | **gh CLI ローカル分析** — `node scripts/gha_analyze_performance_trend.js` |
| 自動集計（v1.19.0） | **GitHub Actions workflow** — `.github/workflows/performance-trend.yml`（`workflow_dispatch`） |
| Trend 出力 | `reports/performance-trend/latest/trend-report.md`（人間向け） / `trend-data.json`（machine-readable） |
| gh CLI フロー | `gh auth status` → `gh run list --json` → `gh run download` → `performance-observation.json` 解析 |
| テスト | fixture モード（`--fixture-dir`）— **gh 実通信なし** |
| 実行時間 | **Step timings** 表 + JSON `durations` / `stepTimings` |
| cache 効果の読み方 | 同一 **package-lock hash**（生 SHA-256）の run 間で `npmCiSeconds` を比較。**cache-hit 厳密取得は未実装** |
| node_modules | **setup-node cache は npm パッケージキャッシュのみ** — `node_modules` はキャッシュしない（毎回 `npm ci`） |
| lockfile 変更 | `package-lock.json` 変更で cache key が変わり、初回 run は **cache miss 相当** で `npm ci` が遅くなることがある |
| Dependabot 後 | lockfile 更新 PR では **初回 CI で npm ci が遅い** ことがある（正常） |
| 失敗時 artifact | CI upload を **`if: always()`** に変更 — 失敗 run でも `performance-observation.json` を確認可能 |
| 品質判定（Nightly） | Summary + JSON の `workflow.pipelineExitCode`（`number \| null`）/ `qualityStatus` |

### Performance Trend Analysis（v1.17.0）

v1.16.0 の `performance-observation.json` を **gh CLI** で収集し、ローカルで trend レポートを生成します。Workflow YAML は変更しません。

```bash
# 本番（gh CLI — 要 gh auth login）
node scripts/gha_analyze_performance_trend.js

# テスト / オフライン（fixture — gh 実通信なし）
node scripts/gha_analyze_performance_trend.js --fixture-dir path/to/fixtures
```

| 項目 | 内容 |
|------|------|
| 認証 | `gh auth status` で確認（未認証時はエラー終了） |
| Run 取得 | `gh run list --json databaseId,...` |
| Artifact | `gh run download <run-id>` → `performance-observation.json` |
| 出力 | `reports/performance-trend/latest/trend-report.md` / `trend-data.json` |
| 欠落 Run | warning として skip — 1 件以上有効 observation があれば report 生成 |
| 0 件 | 明確なエラーで終了 |
| REST API | **v1.18.0** — artifact metadata は `gh api --paginate` を使用 |
| GitHub Actions 自動実行 | **v1.19.0** — `performance-trend.yml`（`workflow_dispatch`） |
| 定期実行（v1.20.0） | **週1回 schedule** — 月曜 20:23 UTC（火曜 05:23 JST） |

### Scheduled Performance Trend Collection（v1.20.0）

v1.19.0 の Performance Trend workflow に **安全な低頻度 schedule** を追加しました。`workflow_dispatch` による手動実行は維持します。

```yaml
# performance-trend.yml
on:
  workflow_dispatch:
  schedule:
    - cron: "23 20 * * 1"   # 毎週月曜 20:23 UTC = 火曜 05:23 JST
```

| 項目 | 内容 |
|------|------|
| 手動実行 | `workflow_dispatch` **維持**（Actions UI / `gh workflow run`） |
| 定期実行 | 週1回 — `23 20 * * 1`（**UTC 基準**） |
| 日本時間 | 毎週**火曜 05:23 JST**（月曜 20:23 UTC + 9h） |
| 毎時ちょうどを避ける理由 | GitHub Actions は毎時 `:00` に schedule が集中しやすく、**遅延・drop** の可能性があるため分を `23` にずらす |
| workflow_run | **今回未導入** — 後続 workflow が secrets / write token に触れる **privilege escalation / cache poisoning** リスクのため設計候補として保留 |
| permissions | `contents: read` / `actions: read`（**最小権限維持**） |
| concurrency | `performance-trend-${{ github.workflow }}` — 同一 workflow の**重複実行を防止**（`cancel-in-progress: false`） |
| schema | **1.2 維持** — `collection.trigger` は `workflow_dispatch` または `schedule` |
| artifact / cache | v1.19.0 方針維持 — setup-node cache は npm 用、入力は quality-pipeline-reports、出力は performance-trend |

### workflow_run Opt-in Design Review（v1.21.0）

v1.21.0 では **`workflow_run` を本番導入しません**。`performance-trend.yml` は v1.20.0 のまま（`workflow_dispatch` + `schedule` + concurrency）を継続します。本リリースは **設計レビューとセキュリティ方針の明文化** が目的です。

| 項目 | v1.21.0 方針 |
|------|----------------|
| workflow_run 本番導入 | **しない** |
| schedule / workflow_dispatch | **継続** |
| schema | **1.2 維持**（既存挙動変更なし） |
| permissions | `contents: read` / `actions: read`（最小権限維持） |

#### 将来の experimental workflow としての opt-in 検討

`workflow_run` は CI/Nightly 完了直後に trend を走らせられるが、**信頼境界をまたぐ**ため別 workflow（opt-in / disabled-by-default）として段階導入を検討します。

| トピック | 設計方針 |
|---------|----------|
| activity types | `completed` / `requested` / `in_progress` 等 — **本番導入時は `types: [completed]` 必須** |
| conclusion filter | **`conclusion: success`（または同等 filter）必須** — 失敗 run からの連鎖を避ける |
| default branch | workflow 定義は **default branch 上** に存在する必要あり |
| chain depth | GitHub Actions の **workflow_run 連鎖深度制限** を考慮（無限連鎖を設計しない） |
| artifact 取得 | artifact は信頼境界をまたぐ — **workspace 直下で直接実行・展開しない** |
| 隔離領域 | `$RUNNER_TEMP` 等の **隔離領域** へ download / 展開してから解析 |
| cache | **workflow_run 経由の cache は信頼しない** — cache poisoning 対策 |
| secrets / write | **secrets 不使用** / **write permission 不使用** — privilege escalation 防止 |
| API / gh CLI | **read-only** metadata / artifact retrieval に限定 |
| 再検討条件 | **schedule 実績**（週次 run の安定性・artifact 品質）を確認してから workflow_run を再評価 |

> **opt-in:** 本番 `performance-trend.yml` には `workflow_run` を追加せず、v1.22.0 で **experimental workflow**（`workflow_dispatch` 限定）として試験する方針です。

### Performance Trend Experimental（v1.22.0）

`workflow_run` を**本番導入せず**、手動 opt-in で安全に評価する **experimental workflow** を追加しました。本番 `performance-trend.yml` は**変更しません**。

| 項目 | 内容 |
|------|------|
| Workflow | `.github/workflows/performance-trend-experimental.yml`（**新規**） |
| 本番 workflow | `performance-trend.yml` — **非変更**（schedule + workflow_dispatch 維持） |
| トリガー | **`workflow_dispatch` のみ** — `workflow_run` は使わない |
| inputs | `source_run_id` / `source_conclusion`（将来の source run 評価用メタデータ） |
| env | `SOURCE_WORKFLOW_RUN_ID` / `SOURCE_WORKFLOW_CONCLUSION` / `PERFORMANCE_TREND_EXPERIMENTAL=true` |
| permissions | `contents: read` / `actions: read` |
| secrets | **不使用** |
| cache | **不使用**（setup-node に npm cache なし — cache poisoning 回避） |
| concurrency | `performance-trend-experimental-${{ github.workflow }}` |
| artifact | `performance-trend-experimental-<run_id>`（**retention 7 日**、`upload-artifact@v6` — v1.23.0） |
| schema | **1.2 維持** — `gha_analyze_performance_trend.js` は今回非変更 |

```bash
# 手動実行（source run を記録したい場合）
gh workflow run performance-trend-experimental.yml \
  -f source_run_id=123456789 \
  -f source_conclusion=success
```

#### workflow_run を本番未採用にした理由（継続方針）

| リスク | 対策 |
|--------|------|
| **Privilege escalation** | 後続 workflow が upstream コンテキスト経由で secrets / write に触れる可能性 — 本番 `performance-trend.yml` には `workflow_run` を追加しない |
| **Cache poisoning** | workflow 連鎖経由の cache を信頼しない — experimental は **cache 無効** |
| **Artifact 信頼境界** | 他 workflow の artifact を workspace 直下で展開しない方針（v1.21.0 設計レビュー） |
| **段階導入** | experimental は **手動 dispatch のみ** — schedule 実績と並行して評価 |

> v1.24.0 で本番 Node24-ready を完了。Experimental workflow は v1.23.0 構成を維持します。

### Node24 Migration Readiness（v1.23.0）

GitHub Actions **Node.js 24 runtime** への移行準備として、**experimental workflow のみ** `upload-artifact@v6` を先行適用します。本番 workflow は安定性優先で現行バージョンを維持します。

| 項目 | 内容 |
|------|------|
| 更新対象 | `.github/workflows/performance-trend-experimental.yml` のみ |
| upload-artifact@v6 | **Node24 runtime** 対応 Actions |
| runner 要件 | **v2.327.1 以上**（Node24 Actions 実行に必要） |
| 本番 workflow | v1.23.0 時点では非変更 — **v1.24.0 で Node24-ready に更新** |
| FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 | **未使用** |
| schema | **1.2 維持** |

### GitHub Actions Node24 Production Readiness（v1.24.0）

本番 workflow（Quality Pipeline CI / Nightly Apply / Performance Trend Analysis）を **Node24-ready** に更新し、GitHub Actions 基盤を一区切りの安定版としました。**Experimental workflow は変更しません**。

| 項目 | 内容 |
|------|------|
| 対象 | `quality-pipeline-ci.yml` / `nightly-apply.yml` / `performance-trend.yml` |
| checkout | **`actions/checkout@v5`** |
| setup-node | **`actions/setup-node@v5`** + `cache: npm` / `cache-dependency-path: package-lock.json` |
| upload-artifact | **`actions/upload-artifact@v6`**（Node24 runtime） |
| upload-artifact@v7 | **今回見送り** — v6 で Node24-ready を優先 |
| runner 要件 | **v2.327.1 以上** |
| Experimental | `performance-trend-experimental.yml` — **非変更**（v1.23.0 構成維持） |
| schema / permissions / workflow_run | **既存維持** — trend schema 1.2、最小 permissions、workflow_run 未導入 |

#### setup-node@v5 cache 注意点

- **npm パッケージキャッシュのみ** — `node_modules` はキャッシュしない（毎回 `npm ci`）
- **cache key** は `package-lock.json` 内容に依存 — lockfile 更新後の初回 run は miss 相当になりうる
- **workflow_run 経由の cache は信頼しない** 方針は v1.21.0 以降も継続

### Developer Automation Foundation（v1.26.0）

Git Tag / VERSION.md / CHANGELOG.md の **3-way Version Consistency** を dry-run で検証する基盤です。

```bash
npm run dev:next -- --dry-run
```

| 項目 | 内容 |
|------|------|
| ライブラリ | `src/lib/developer_automation.js` |
| CLI | `scripts/run_dev_next.js` |
| JSON report | `reports/developer-automation/latest/version-consistency.json` |
| Markdown report | `reports/developer-automation/latest/version-consistency.md` |
| CLI 出力 | `Version Check OK` / `Version Check WARNING` |
| git commit/tag/push | **未実装**（Human Approval Gate 維持） |

### Release Readiness Foundation（v1.27.0）

Release 自動実行ではなく、**Release 可能かどうかを自動判定する MVP** です。JSON / Markdown / CLI は同一の判定結果オブジェクトから生成されます。

```bash
# npm test 再帰を避けるため --skip-npm-test を推奨（テストスイート内実行時）
npm run release:readiness -- --skip-npm-test

# 本番判定（npm test 含む）
npm run release:readiness
```

| 項目 | 内容 |
|------|------|
| ライブラリ | `src/lib/release_readiness.js` |
| CLI | `scripts/run_release_readiness.js` |
| schema | `developer-automation/release-readiness/1.0` |
| 判定 | Working Tree clean / Version Consistency / 必須レポート / npm test |
| 必須レポート | `version-consistency.json` / `version-consistency.md` |
| JSON report | `reports/developer-automation/latest/release-readiness.json` |
| Markdown report | `reports/developer-automation/latest/release-readiness.md` |
| 全体 status | `ready` / `not-ready` |
| 各 check | `pass` / `fail` |
| git commit/tag/push | **未実装** |

#### CLI 出力例

成功時:

```text
Release Readiness

✔ Working Tree
✔ Version Consistency
✔ Required Reports
✔ npm test

Status: READY
```

### Release Plan Foundation（v1.28.0）

Release 実行ではなく、**Release に必要な作業を機械的に計画・可視化する MVP** です。`release-readiness.json` を前提条件として読み取り、JSON / Markdown / CLI は同一の Plan オブジェクトから生成されます。

```bash
npm run release:plan
```

| 項目 | 内容 |
|------|------|
| ライブラリ | `src/lib/release_plan.js` |
| CLI | `scripts/run_release_plan.js` |
| schema | `developer-automation/release-plan/1.0` |
| 前提 | `reports/developer-automation/latest/release-readiness.json` |
| steps | git-commit / git-tag / git-push / github-release / publish |
| JSON report | `reports/developer-automation/latest/release-plan.json` |
| Markdown report | `reports/developer-automation/latest/release-plan.md` |
| 全体 status | `ready` / `not-ready`（Release Readiness に連動） |
| git commit/tag/push | **未実装** |

#### CLI 出力例

```text
Release Plan

Status: READY

Planned Steps

○ git commit — Pending human approval
○ git tag — Pending human approval
○ git push — Pending human approval
○ GitHub Release — Out of MVP scope
○ Publish — Out of MVP scope
```

### Developer Automation Workflow Foundation（v1.29.0）

Developer Automation を **Context ベース Workflow** として統合する MVP です。Step Registry から version-consistency / release-readiness / release-plan を順次実行し、JSON / Markdown / CLI は同一 Context から生成されます。

```bash
# npm test 再帰を避けるため --skip-npm-test を推奨（テストスイート内実行時）
npm run developer:workflow -- --skip-npm-test

# 本番実行（npm test 含む）
npm run developer:workflow
```

| 項目 | 内容 |
|------|------|
| ライブラリ | `src/lib/developer_workflow.js` |
| CLI | `scripts/run_developer_workflow.js` |
| schema | `developer-automation/workflow/1.1` |
| Context | 唯一の状態管理（`context.results[]` に Step Result 蓄積） |
| Step Registry | version-consistency → release-readiness → release-plan |
| Step Status | `STEP_STATUS` — PASS / FAIL / SKIPPED / STOPPED |
| Workflow Status | `WORKFLOW_STATUS` — SUCCESS / FAILURE / STOPPED |
| JSON report | `reports/developer-automation/latest/developer-automation-report.json` |
| Markdown report | `reports/developer-automation/latest/developer-automation-report.md` |
| git commit/tag/push | **未実装** |

#### CLI 出力例

```text
Developer Automation Workflow

Options

Dry Run
YES

Fail Fast
NO

Stop Before
none

Skip Steps
none

Workflow Status
SUCCESS

Guard Summary

Executed
3

Skipped
0

Stopped
0

Step Results

Version Consistency
PASS

Release Readiness
PASS

Release Plan
PASS
```

### Developer Workflow Guard Foundation（v1.30.0）

Workflow Engine に **安全制御（Guard）** を追加した MVP です。Workflow Options を Context に保持し、Guard 関数で Fail Fast / Stop Before Step / Skip Step を制御します。JSON / Markdown / CLI は同一 Context から生成されます。

```bash
# 基本実行
npm run developer:workflow -- --skip-npm-test

# Guard オプション例
npm run developer:workflow -- --skip-npm-test --fail-fast
npm run developer:workflow -- --skip-npm-test --stop-before-step release-plan
npm run developer:workflow -- --skip-npm-test --skip-step release-plan
```

| 項目 | 内容 |
|------|------|
| Options | dryRun（default: true）/ failFast / stopBeforeStep / skipSteps |
| Guard 関数 | shouldSkipStep / shouldStopBeforeStep / shouldExecuteStep（純粋関数） |
| Guard Reason | NONE / SKIP_STEP / STOP_BEFORE_STEP / FAIL_FAST |
| Step Status | PASS / FAIL / SKIPPED / STOPPED |
| Workflow Status | SUCCESS / FAILURE / STOPPED |
| Guard Decision | 各 Step Result に guard（shouldExecute / reason） |
| guardHooks | 将来拡張用（空配列） |
| JSON report | `developer-automation-report.json`（Options / Guard / Status） |
| git commit/tag/push | **未実装** |

#### CLI 出力例

```text
Developer Automation Workflow

Options

Dry Run
YES

Fail Fast
NO

Stop Before
release-plan

Skip Steps
none

Workflow Status
STOPPED

Step Results

Version Consistency
PASS

Release Readiness
PASS

Release Plan
STOPPED
```

Release Plan
STOPPED
```

### Developer Workflow Resume Foundation（v1.32.0）

Workflow Guard で **STOPPED** になった状態を保存し、`--resume` で安全に再開します。

```bash
# STOPPED 後に workflow-state.json が生成される
npm run developer:workflow -- --skip-npm-test --stop-before-step release-plan

# 停止位置から再開
npm run developer:workflow -- --resume --skip-npm-test

# 状態ファイルを明示指定
npm run developer:workflow -- --resume \
  --resume-state reports/developer-workflow/latest/workflow-state.json
```

| 項目 | 内容 |
|------|------|
| workflow-state schema | `developer-automation/workflow-state/1.0` |
| workflow-resume schema | `developer-automation/workflow-resume/1.0` |
| State report | `reports/developer-workflow/latest/workflow-state.json` |
| Resume JSON report | `reports/developer-workflow/latest/workflow-resume.json` |
| Resume Markdown report | `reports/developer-workflow/latest/workflow-resume.md` |
| Resume CLI | `--resume` / `--resume-state` |
| git commit/tag/push | **未実装** |

#### CLI 出力例（Resume）

```text
Workflow Resume

Status
resumed

Resume From
release-plan

Completed Steps
version-consistency, release-readiness

Workflow Status
SUCCESS
```

Workflow Status
SUCCESS
```

### Workflow Checkpoint Foundation（v1.33.0）

Resume Foundation の実行能力を維持したまま、**Checkpoint Foundation** で workflow-state の現在位置・互換性・resume 安全性を検証します。

| 項目 | 内容 |
|------|------|
| workflow-state schema | `developer-automation/workflow-state/1.2` |
| checkpoint schema | `developer-automation/workflow-checkpoint/1.0` |
| Checkpoint JSON | `reports/developer-workflow/latest/workflow-checkpoint.json` |
| Checkpoint Markdown | `reports/developer-workflow/latest/workflow-checkpoint.md` |
| 新フィールド | currentStepId / resumeSupported / stepRegistryHash / workflowSchemaVersion |
| legacy 1.0 互換 | warning 付きで resume 可能 |
| git commit/tag/push | **未実装** |

#### CLI 出力例（Checkpoint）

```text
Workflow Checkpoint

Valid
true

Resume Supported
true

Current Step
release-plan

Step Registry Hash Matched
true

Workflow Schema Version
1.2
```

Workflow Schema Version
1.2
```

### Developer Workflow History Foundation（v1.34.0）

Checkpoint Foundation の上に、**Developer Workflow History Foundation** を追加しました。過去の workflow 実行 run と step 結果を時系列で記録します。

| 項目 | 内容 |
|------|------|
| history schema | `developer-automation/workflow-history/1.0` |
| History JSON | `reports/developer-workflow/latest/workflow-history.json` |
| History Markdown | `reports/developer-workflow/latest/workflow-history.md` |
| 責務 | 過去実行履歴 / 時系列管理（Checkpoint とは分離） |
| git commit/tag/push | **未実装** |

#### CLI 出力例（History）

```text
Workflow History

Run Count
1

Latest Run Status
stopped

Latest Run Step Count
3

Latest Current Step
release-plan
```

### Analytics Foundation（v1.46.0）

**Analytics Foundation** を Application Layer に追加しました。v1.45.0 の **Publishing Public Contract**（`extractPublishingPublicContract()`）のみを入力とし、**pre-publish Analytics Report** を生成します。

外部 Metrics API / Instagram API / Database / 実投稿データ収集は実装しません。

| 項目 | 内容 |
|------|------|
| schema | `analytics/1.0` |
| JSON | `output/analytics/analytics.json` |
| Markdown | `output/analytics/analytics.md` |
| CLI | `npm run analytics` |
| Public Contract | `extractAnalyticsPublicContract()` |

#### Architecture（Application Layer）

```text
Publishing (v1.45.0)
        ↓
Analytics (v1.46.0) ← 今回（pre-publish 分析）
        ↓
Continuous Improvement（未着手）
```

#### MVP Scope

Readiness / Quality / Checklist Score / Recommendation（ready / review / needs-work）/ JSON / Markdown / CLI Summary / Public Contract

#### 非対象

Instagram API / OAuth / Scheduler / Upload / Retry / Queue / Database / 外部 Metrics API / 実投稿データ収集

#### CLI 出力例

```text
Analytics Summary
Reports: 5
Ready: 5
Review: 0
Needs Work: 0
Average Readiness: 1
```

#### gitignore

`output/analytics/` は `.gitignore` 対象です。

### Publishing Foundation（v1.45.0）

**Publishing Foundation** を Application Layer に追加しました。v1.44.0 の **Image Generation Public Contract**（`extractImageGenerationPublicContract()`）のみを入力とし、Instagram 投稿用 **Publishing Package** を生成します。

Instagram API / Scheduler / OAuth / Upload / Retry / Queue は実装しません。

| 項目 | 内容 |
|------|------|
| schema | `publishing/1.0` |
| JSON | `output/publishing/publishing.json` |
| Markdown | `output/publishing/publishing.md` |
| CLI | `npm run publishing` |
| Public Contract | `extractPublishingPublicContract()` |

#### Architecture（Application Layer）

```text
Image Generation (v1.44.0)
        ↓
Publishing (v1.45.0) ← 今回
        ↓
Analytics → Continuous Improvement
```

#### MVP Scope

Publishing Package Builder / Normalizer / Validator / JSON / Markdown / CLI Summary / Public Contract

#### 非対象

Instagram API / X API / Facebook API / Threads API / Scheduler / OAuth / Upload / Retry / Queue / Analytics

#### CLI 出力例

```text
Publishing Summary

Packages : 5
Platform : instagram
Ready    : 5
Draft    : 5
Output   : output/publishing/
```

#### gitignore

`output/publishing/` は `.gitignore` 対象です。

### Image Generation Foundation（v1.44.0）

**Image Generation Foundation** を Application Layer に追加しました。v1.43.0 の **Content Generation Public Contract**（`extractContentGenerationPublicContract()`）のみを入力とし、Instagram 投稿用の **画像生成 Prompt** を deterministic に生成します。

画像そのものは生成しません。外部画像生成 API も使用しません。

| 項目 | 内容 |
|------|------|
| schema | `image-generation/1.0` |
| JSON | `output/image-generation/image-generation.json` |
| Markdown | `output/image-generation/image-generation.md` |
| CLI | `npm run image:generation` |
| Public Contract | `extractImageGenerationPublicContract()` |

#### Architecture（Application Layer）

```text
Content Generation (v1.43.0)
        ↓
Image Generation (v1.44.0) ← 今回（Prompt のみ）
        ↓
Publishing → Analytics → Improvement
```

#### MVP Scope

Image Prompt Generator / Normalizer / Validator / JSON / Markdown / CLI Summary / Public Contract

#### 非対象

画像生成 / OpenAI Images / DALL·E / Stable Diffusion / Instagram API / Publishing / Scheduler / Analytics

#### CLI 出力例

```text
Image Generation Summary
Prompts: 5
Style: photorealistic
Aspect Ratio: 1:1
```

#### gitignore

`output/image-generation/` は `.gitignore` 対象です。

### Content Generation Foundation（v1.43.0）

**Content Generation Foundation** を Application Layer に追加しました。v1.42.0 の **AI Idea Public Contract**（`extractAIIdeaPublicContract()`）のみを入力とし、投稿本文候補（Content Draft）を生成します。

外部 API には接続しません。Provider は将来差し替え可能な Interface に閉じ込めています。

| 項目 | 内容 |
|------|------|
| schema | `content-generation/2.0` |
| JSON | `output/content-generation/content-generation.json` |
| Markdown | `output/content-generation/content-generation.md` |
| CLI | `npm run content:generate` |
| Public Contract | `extractContentGenerationPublicContract()` |

#### Architecture（Application Layer）

```text
Idea Generation (v1.41.0)
        ↓
AI Idea Generation (v1.42.0)
        ↓
Content Generation (v1.43.0) ← 今回
        ↓
Image → Publishing → Analytics → Improvement
```

#### MVP Scope

Content Generator（mock）/ Draft Normalizer / Validator / JSON / Markdown / CLI Summary / Public Contract

#### 非対象

画像生成 / カルーセル生成 / ハッシュタグ / Instagram API / Publishing / Scheduler / Analytics

#### CLI 出力例

```text
Content Generation Summary
Drafts: 5
Average Word Count: 42
Top Quality Score: 0.875
```

#### Legacy 後方互換

v1.25 の `content-generation/1.0` dry-run（`output/content-ideas/latest/`）は `content_generation_legacy.js` / `run_content_generation_legacy.js` で維持。

#### gitignore

`output/content-generation/` は `.gitignore` 対象です。

### AI Idea Generation Foundation（v1.42.0）

**AI Idea Generation Foundation** を Application Layer に追加しました。Mock / deterministic AI Generator により投稿アイデア候補を生成し、Deduplicator / Ranking で整理します。

外部 API（OpenAI / Claude / Gemini）には接続しません。Provider は将来差し替え可能な Interface に閉じ込めています。

| 項目 | 内容 |
|------|------|
| schema | `content-ai-ideas/1.0` |
| JSON | `output/content-ideas/content-ai-ideas.json` |
| Markdown | `output/content-ideas/content-ai-ideas.md` |
| CLI | `npm run content:ai-ideas` |
| Public Contract | `extractAIIdeaPublicContract()` |

#### Architecture（Application Layer）

```text
Idea Generation (v1.41.0)
        ↓
AI Idea Generation (v1.42.0) ← 今回
        ↓
Content → Image → Publishing → Analytics → Improvement
```

#### MVP Scope

AI Generator（mock）/ Input Parser / Deduplicator / Ranking / JSON / Markdown / CLI Summary / Public Contract

#### 非対象

投稿本文 / 画像 / ハッシュタグ / 投稿処理 / スケジューラー / 分析 / 外部 LLM 接続

#### CLI 出力例

```text
AI Idea Summary
Ideas: 5
Top Score: 0.875
Average Score: 0.812
Provider: mock
```

#### gitignore

`output/content-ideas/` は `.gitignore` 対象です。生成物はリポジトリに含まれません。

#### 後方互換

v1.41.0 の `npm run content:ideas`（`content-ideas/1.0`）は変更なく動作します。

### Idea Generation Foundation（v1.41.0）

AI-SNS-Automation 本体の **Application Layer** 第一弾として **Idea Generation Foundation** を追加しました。LLM 非依存の Idea Builder / Validator / Public Contract MVP です。

Developer Automation Platform（v1.40.0）は **Completed** — 保守のみ、新レイヤー追加なし。

| 項目 | 内容 |
|------|------|
| schema | `content-ideas/1.0` |
| JSON | `output/content-ideas/content-ideas.json` |
| Markdown | `output/content-ideas/content-ideas.md` |
| CLI | `npm run content:ideas` |
| Public Contract | `extractContentIdeaPublicContract()` |

#### Architecture（Application Layer）

```text
Idea Generation → Content Generation → Image Generation → Publishing → Analytics → Improvement
     ↑ v1.41.0 MVP
```

#### MVP Scope

Idea Builder / Idea Validator / Machine Readable JSON / Markdown View / CLI Summary / Public Contract

#### 非対象

AI generation / LLM integration / Prompt optimization / Image generation / Content generation / Hashtag optimization / Publishing / Scheduling / SNS APIs

#### CLI 出力例

```text
Content Idea Summary
Ideas: 3
Categories: 3
Candidates: 2
Archived: 1
```

#### 後方互換

既存 `content-generation/1.0`（`output/content-ideas/latest/`）は維持。v1.41.0 の新出力は `output/content-ideas/content-ideas.json` です。

### Visualization Foundation（v1.40.0）— Developer Automation Platform Completed

Developer Automation Platform の **最終レイヤー** として **Visualization Foundation** を追加しました。Dashboard / Trend / Historical Public Contract（`extractDashboardPublicContract()` / `extractTrendPublicContract()` / `extractHistoricalPublicContract()`）のみを入力とします。

**Visualization は分析を行いません。** Public Contract の情報を整理し、JSON / Markdown / CLI Summary を生成するだけです。

Timeline / History / Checkpoint / Workflow State / Internal Structure は直接参照しません。Chart / Graph / Forecast / HTML / SVG / PNG / Interactive UI は実装していません。

| 項目 | 内容 |
|------|------|
| schema | `developer-automation/workflow-visualization/1.0` |
| 入力 | Dashboard + Trend + Historical Public Contract |
| JSON | `reports/workflow-visualization/latest/workflow-visualization.json` |
| Markdown | `reports/workflow-visualization/latest/visualization-report.md` |
| CLI | `npm run developer:visualization` |

#### Architecture（Platform Completed）

```text
Workflow → State → Checkpoint → History → Timeline → Dashboard → Analytics → Visualization
                                                                                    ↑ Completed
```

#### MVP Scope

Dashboard Summary / Trend Summary / Historical Summary / Workflow Health Summary / Metadata（Public Contract 整理のみ）

#### 非対象

分析 / Forecast / Prediction / Chart / Graph / HTML / SVG / PNG / Interactive UI

#### v1.41.0 以降

Developer Automation Platform は **Completed**。以降は AI-SNS-Automation 本体開発（Idea Generation → Content → Image → Publishing → Analytics → Continuous Improvement）を最優先とします。

#### CLI 出力例

```text
Workflow Visualization Summary
Dashboard Runs: 2
Trend Samples: 1
Historical Runs: 2
Dashboard Health: Healthy
Workflow Health: Healthy
```

### Historical Analytics Foundation（v1.39.0）

Analytics Layer の兄弟として、**Historical Analytics Foundation** を追加しました。Dashboard Public Contract と Trend Public Contract（`extractTrendPublicContract()`）のみを入力とします。

Timeline / History / Checkpoint / Workflow State / Dashboard Internal / Trend Internal は直接参照しません。Forecast / Prediction / AI Analysis / Visualization は実装していません。

| 項目 | 内容 |
|------|------|
| schema | `developer-automation/workflow-history-analytics/1.0` |
| 入力 | Dashboard Public Contract + Trend Public Contract |
| JSON | `reports/workflow-history-analytics/workflow-history-analytics.json` |
| Markdown | `reports/workflow-history-analytics/historical-report.md` |
| CLI | `npm run developer:history-analytics` |

#### Architecture（Analytics 兄弟レイヤー）

```text
Analytics
├── Trend Analytics
└── Historical Analytics
```

#### MVP Scope

Total Runs / Success Count / Failure Count / Average Duration / Resume Count / Resume Rate / Workflow Health Distribution / Period Summary / Data Coverage

#### 非対象

Forecast / Prediction / AI Analysis / Root Cause / Correlation / Anomaly Detection / Automatic Recommendation / Visualization

#### CLI 出力例

```text
Workflow Historical Analytics Summary
Runs: 4
Success Rate: 75%
Resume Rate: 50%
Average Duration: 2 sec
Workflow Health: Warning
```

### Trend Analytics Foundation（v1.38.0）

Dashboard Public Contract を入力として、**Trend Analytics Foundation** を追加しました。Workflow の Success / Failure / Resume Rate / Duration / Health の時系列 Trend を生成します。

Timeline / History / Checkpoint / Workflow State / Dashboard Internal は直接参照しません。Forecast / Prediction / Anomaly Detection / ML は実装していません。

| 項目 | 内容 |
|------|------|
| trend schema | `developer-automation/workflow-trend/1.0` |
| 入力 | Dashboard Public Contract（`workflow-dashboard.json` から抽出） |
| Trend JSON | `reports/workflow-trend/workflow-trend.json` |
| Trend Markdown | `reports/workflow-trend/trend-report.md` |
| CLI | `npm run developer:trend` |

#### CLI 出力例（Trend）

```text
Workflow Trend Summary
Snapshots: 10
Latest Success Rate: 98%
Latest Failure Rate: 2%
Latest Resume Rate: 14%
Latest Duration: 12 sec
Latest Health: Healthy
```

### Developer Analytics Foundation（v1.37.0）

Dashboard Foundation の上に、**Developer Analytics Foundation** を追加しました。workflow-dashboard.json の **Dashboard Public Contract** のみを入力として KPI・Health を生成します。

Analytics は Dashboard のみを入力とする集計基盤です。Timeline / History / Checkpoint / Workflow State は直接参照しません。Dashboard Internal（runs / warnings / source 等）は参照しません。JSON Source / Markdown View / CLI Summary の原則を維持します。

| 項目 | 内容 |
|------|------|
| analytics schema | `developer-automation/workflow-analytics/1.0` |
| 入力 | `reports/developer-workflow/latest/workflow-dashboard.json`（**Public Contract のみ**） |
| Analytics JSON | `reports/workflow-analytics/workflow-analytics.json` |
| Analytics Markdown | `reports/workflow-analytics/workflow-analytics.md` |
| ADR | `docs/adr/ADR-0007-*` / `docs/adr/ADR-0008-*` |
| 非参照 | Timeline / History / Checkpoint / Workflow State / Dashboard Internal |

#### CLI 出力例（Analytics）

```text
Developer Analytics Summary
Runs: 4
Steps: 10
Success Rate: 75.0%
Failure Rate: 25.0%
Resume Rate: 25.0%
Average Duration: 1000ms
Health: warning
```

### Developer Dashboard Foundation（v1.36.0）

Timeline Foundation の上に、**Developer Dashboard Foundation** を追加しました。workflow-timeline.json を唯一の入力として集計・表示用データを生成します。

Developer Dashboard は Timeline を唯一の入力とする集計基盤です。History / Checkpoint / Workflow State は直接参照しません。Timeline Schema 1.0 の構造は変更しません。JSON Source / Markdown View / CLI Summary の原則を維持します。

| 項目 | 内容 |
|------|------|
| dashboard schema | `developer-automation/workflow-dashboard/1.0` |
| 入力 | `reports/developer-workflow/latest/workflow-timeline.json`（**Timeline のみ**） |
| Dashboard JSON | `reports/developer-workflow/latest/workflow-dashboard.json` |
| Dashboard Markdown | `reports/developer-workflow/latest/workflow-dashboard.md` |
| 責務 | Timeline の集計レイヤー（Aggregation Layer） |
| 非参照 | History / Checkpoint / Workflow State |

#### CLI 出力例（Dashboard）

```text
Developer Workflow Dashboard
Runs: 3
Steps: 18
Success: 17
Failed: 1
Resume: 1
Total Duration: 12345ms
Average Duration: 686ms
Status: mixed
```

### Developer Workflow Timeline Foundation（v1.35.0）

History Foundation の上に、**Developer Workflow Timeline Foundation** を追加しました。workflow-history.json から時系列表示 Source を生成します。

| 項目 | 内容 |
|------|------|
| timeline schema | `developer-automation/workflow-timeline/1.0` |
| 入力 | `reports/developer-workflow/latest/workflow-history.json` |
| Timeline JSON | `reports/developer-workflow/latest/workflow-timeline.json` |
| Timeline Markdown | `reports/developer-workflow/latest/workflow-timeline.md`（Summary / Run / Step は table 形式） |
| 責務 | History の時系列表示（Checkpoint / History 保存とは分離） |
| git commit/tag/push | **未実装** |

#### CLI 出力例（Timeline）

```text
Workflow timeline: generated
Timeline runs: 3
Timeline steps: 12
Timeline report:
reports/developer-workflow/latest/workflow-timeline.md
```

### Developer Handoff Prompt Foundation（v1.31.0）

ChatGPT 設計レビュー / 実装指示を Claude Code に渡すための **標準化引き継ぎプロンプト** を生成します。

```bash
npm run developer:handoff
```

| 項目 | 内容 |
|------|------|
| schema | `developer-automation/handoff/1.0` |
| JSON report | `reports/developer-automation/latest/developer-handoff.json` |
| Markdown report | `reports/developer-automation/latest/developer-handoff.md` |
| currentVersion | `docs/VERSION.md` から読み取り |
| nextVersion | currentVersion の minor を +1 して自動算出（例: v1.31.0 → v1.32.0） |
| nextVersion override | `npm run developer:handoff -- --next-version v1.40.0` |
| git commit/tag/push | **未実装** |

#### CLI 出力例

```text
Developer Handoff

Project: AI-SNS-Automation
Current Version: v1.31.0
Next Version: v1.32.0
Release: Developer Handoff Prompt Foundation

Outputs:
- reports/developer-automation/latest/developer-handoff.json
- reports/developer-automation/latest/developer-handoff.md
```

`--next-version` 指定時は自動算出より引数を優先します（`vX.Y.Z` 形式のみ許可）。

### GitHub Actions Automated Performance Trend Collection（v1.19.0）

GitHub Actions 上で Performance Trend Analysis を **手動トリガー**（`workflow_dispatch`）実行できる最小基盤を追加しました。ローカル解析（gh CLI / fixture）とは共存します。

```bash
# GitHub UI: Actions → Performance Trend Analysis → Run workflow
# または gh CLI:
gh workflow run performance-trend.yml
```

| 項目 | 内容 |
|------|------|
| Workflow | `.github/workflows/performance-trend.yml`（**新規** — 既存 workflow は未変更） |
| トリガー | `workflow_dispatch` + **schedule**（v1.20.0 — 週1回） |
| permissions | `contents: read` / `actions: read`（最小権限） |
| 認証 | `GH_TOKEN: ${{ github.token }}` を trend 解析に渡す |
| 実行内容 | `npm test` → quality pipeline tests → trend 解析 → artifact upload |
| 出力 artifact | `performance-trend-<run_id>`（`trend-report.md` / `trend-data.json`） |
| Step Summary | `GITHUB_STEP_SUMMARY` に概要（runs analyzed / warnings 等） |
| schema | GitHub Actions 実行時は **trend-data.json schema 1.2**（`collection.*` 付与） |

#### ローカル解析との違い

| | ローカル（v1.17–1.18） | GitHub Actions（v1.19.0） |
|--|------------------------|---------------------------|
| 実行場所 | 開発者マシン | GitHub Actions runner |
| 認証 | `gh auth login` | `GH_TOKEN`（`github.token`） |
| schema | 1.1（`collection` なし） | 1.2（`collection.mode` 等） |
| 出力保存 | `reports/performance-trend/latest/` | 同上 + workflow artifact |
| 用途 | 開発・デバッグ | 定期/手動の CI 上トレンド収集 |

#### artifact と cache の役割分離

| 種別 | 役割 |
|------|------|
| **setup-node cache** | `npm ci` 高速化（npm パッケージキャッシュのみ — trend workflow でも使用） |
| **quality-pipeline-reports-\*** | 各 CI/Nightly run の `performance-observation.json` 等（**入力データ**） |
| **performance-trend-\*** | trend 解析結果（**出力レポート** — retention 30 日） |

> **注意:** private repo では `actions: read` が必要です。`gh run download` だけでは artifact retention metadata が足りないため、v1.18.0 以降は `gh api --paginate` も併用します。

### Artifact Metadata / Retention Awareness（v1.18.0）

`gha_analyze_performance_trend.js` に **GitHub Actions artifact metadata** 取得を追加しました。`gh run download` だけでは得られない `expires_at` / `expired` / `digest` / `size_in_bytes` を trend レポートに反映します。

```bash
# gh api で artifact metadata を取得（要 Actions read permission on private repo）
gh api repos/{owner}/{repo}/actions/runs/{run_id}/artifacts --paginate
```

| 項目 | 内容 |
|------|------|
| metadata 取得 | `gh api repos/{owner}/{repo}/actions/runs/{run_id}/artifacts --paginate` |
| download との関係 | `gh run download` はファイル取得のみ — retention metadata は **gh api 必須** |
| token 権限 | private repo では **Actions read** が必要 |
| `expired: true` | warning + skip（observation 取得しない） |
| `expires_at` 欠落 | metadata warning — trend analysis は継続 |
| metadata 取得失敗 | warning — 可能な限り `gh run download` で継続 |
| 出力追加 | trend-report **Artifact Metadata** セクション / trend-data `metadataWarnings` |
| fixture | `run-*/artifacts.json` で metadata をテスト（gh 実通信なし） |

| Workflow | ファイル | 目的 | API キー |
|----------|----------|------|----------|
| **Performance Trend Analysis**（v1.19.0） | `.github/workflows/performance-trend.yml` | trend 自動収集（手動 dispatch） | **不要**（`github.token`） |
| **Quality Pipeline CI**（v1.7） | `.github/workflows/quality-pipeline-ci.yml` | dry-run 品質ゲート（test / stop / resume） | **不要** |
| **Nightly Apply Workflow**（v1.8） | `.github/workflows/nightly-apply.yml` | 本番 apply（定期 / 手動） | **必須** |

### Quality Pipeline CI（v1.7）

**API キー不要**（dry-run のみ）で Green になる PR / push 向け CI です。

| 項目 | 内容 |
|------|------|
| トリガー | `push` / `pull_request`（main）/ `workflow_dispatch` / `schedule` |
| Node.js | 20.x |
| Secrets | **不要** |

CI 実行内容:

1. `npm test`（39 PASS）
2. `quality-pipeline:dry-run -- --stop-before-phase report`
3. `quality-pipeline:dry-run -- --resume`
4. Artifacts として `reports/quality-pipeline/latest/` を保存

GitHub Actions の Run 詳細 → **Artifacts** → `quality-pipeline-reports-<run_id>` から成果物をダウンロードできます。

### Nightly Apply Workflow（v1.8）

**apply 専用**の nightly workflow です。dry-run CI とは独立しており、Repository Secrets が設定されている環境でのみ apply を実行します。

| 項目 | 内容 |
|------|------|
| ファイル | `.github/workflows/nightly-apply.yml` |
| トリガー | `workflow_dispatch` / `schedule` |
| スケジュール | **JST 03:00**（cron: `0 18 * * *` UTC） |
| Node.js | 20.x |
| 対象ブランチ | **main のみ**（job 条件 `if: github.ref == 'refs/heads/main'` + `Verify main branch` ステップ） |

#### GitHub Secrets（Nightly Apply）

Repository Settings → Secrets and variables → Actions に以下を登録してください。

| 区分 | Secret | 用途 |
|------|--------|------|
| **必須** | `OPENAI_API_KEY` | OpenAI API（画像再生成等） |
| **いずれか必須** | `GEMINI_API_KEY` | Gemini API（再レビュー・Nano Banana 代替キー） |
| **いずれか必須** | `NANO_BANANA_API_KEY` | Nano Banana API（デフォルト adapter の画像改善） |

nano_banana adapter（デフォルト）は **`NANO_BANANA_API_KEY` または `GEMINI_API_KEY` のどちらか一方** があれば動作します。apply 実行前に workflow 内で **Secret 名のみ** を検証し、不足時は apply を実行せず失敗します（Secret 値はログに出力しません）。

#### 実行モード

| モード | 条件 | コマンド |
|--------|------|----------|
| **通常 apply** | schedule / `workflow_dispatch`（resume=false） | `npm run quality-pipeline -- --apply --clean-latest` |
| **Resume apply** | `workflow_dispatch`（resume=true） | `npm run quality-pipeline -- --apply --resume` |

`workflow_dispatch` input:

| Input | 型 | デフォルト | 説明 |
|-------|-----|-----------|------|
| `resume` | boolean | `false` | `Resume from previous state.json` |

**`--resume` と `--clean-latest` は併用しません。** resume 時は既存 `state.json` を保持するため `--clean-latest` を付けません（pipeline CLI でも併用不可）。

schedule 実行時は常に `resume=false`（通常 apply）です。

#### 安全設計

| ガード | 内容 |
|--------|------|
| **main branch guard** | job 条件 `github.ref == 'refs/heads/main'` + `Verify main branch` ステップ |
| **Secrets check** | `OPENAI_API_KEY` 必須、`GEMINI_API_KEY` または `NANO_BANANA_API_KEY` のいずれか必須 |
| **failure summary** | 失敗時 `reports/quality-pipeline/latest/failure-summary.md` を生成（`if: failure()`）。HEALTH_CHECK 失敗時は `metrics.json` の個別エラーを **Health Check Errors** 節に列挙（v1.9） |
| **Health Check 可視化**（v1.9） | apply 失敗時、workflow ログ・Summary・`metrics.json` artifact から Health Check 個別エラーを確認可能 |
| **artifact upload** | `if: always()` — 成功・失敗問わず調査用成果物を保存 |

#### Artifacts 保存対象

Artifact 名: `nightly-apply-<run_id>`（保持 14 日、`if-no-files-found: warn`）

| パス | 内容 |
|------|------|
| `reports/quality-pipeline/latest/report.md` | 人間向けレポート |
| `reports/quality-pipeline/latest/report.json` | 構造化レポート |
| `reports/quality-pipeline/latest/metrics.json` | metrics |
| `reports/quality-pipeline/latest/state.json` | resume checkpoint |
| `reports/quality-pipeline/latest/export/` | export 成果物 |
| `reports/quality-pipeline/latest/failure-summary.md` | 失敗時サマリー（失敗時のみ生成） |

失敗後の再開は **workflow_dispatch** で `resume=true` を ON にして手動実行してください。

**HEALTH_CHECK 失敗時（v1.9）:** workflow ログに `[QualityPipeline] [apply] HEALTH_CHECK: ❌ <label>: <detail>` が出力されます。Summary 末尾の `health check errors:` 節、`metrics.json` の `byPhase.HEALTH_CHECK.summary.healthCheck.errors`、および artifact の `failure-summary.md`（**Health Check Errors** 節）でも同じ個別項目を確認できます。

**apply 成功判定（v1.9.3）:** 全スライド公開推奨（`ALL_SLIDES_PUBLISH_RECOMMENDED`）かつ API 失敗なしの場合、Summary は `status: completed` / `final phase: COMPLETE` / `failed steps: 0` / `outcome: success` / **終了コード 0** となり、GitHub Actions workflow も Success で終了します。以前の HEALTH_CHECK 失敗で残った stale `failedSteps` は成功時に自動クリアされます。

**Workflow 成否と品質判定（v1.9.4）:** GitHub Actions の **Success** は「Workflow が正常に完了した」という意味です。品質不足（`publishRecommended=false`）で pipeline が **終了コード 3**（品質改善推奨）を返した場合でも、**Workflow は Success** で終了します（システムエラーではありません）。公開可否は Step Summary / ログの **Quality status** と **publishRecommended** を確認してください。

| Pipeline 終了コード | 意味 | Nightly Apply Workflow |
|---------------------|------|------------------------|
| **0** | 公開推奨 | Success |
| **3** | 品質改善推奨（publish 未達） | Success |
| **1** | Health Check / 設定エラー | Failure |
| **4** | 内部エラー | Failure |
| その他 | 想定外 | Failure |

終了コード 3 時の Summary には `Workflow result: Success` / `Quality status: Improvement Recommended` / `publishRecommended=false` / `exit code 3` が表示されます。

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
| `.env` | API キー設定ファイルがあるか（GitHub Actions では Secrets 注入時は未作成でも可 — v1.9.2） |
| `OPENAI_API_KEY` | 画像生成用のキーが設定されているか（**必須**） |
| `GEMINI_API_KEY` | レビュー・カルーセル用のキー（`NANO_BANANA_API_KEY` との **いずれか必須** — v1.8.2 / v1.9.2） |
| `NANO_BANANA_API_KEY` | Nano Banana 画像改善用のキー（`GEMINI_API_KEY` との **いずれか必須** — v1.9.2） |
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
- **GitHub Actions（v1.9.2）:** `GITHUB_ACTIONS=true` のときは `.env` がなくても Error にしません。Secrets から `OPENAI_API_KEY`（必須）と `GEMINI_API_KEY` または `NANO_BANANA_API_KEY`（いずれか必須）が `process.env` にあれば通過します

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
| `npm test` | 上記と同じ（CI エイリアス） |

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
│       ├── pipeline_resume.js     … Resume checkpoint / state.json（v1.6）
│       └── regeneration/          … adapter（nano_banana / openai）
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
| 品質パイプライン（v1.5） | Regeneration adapter 切替（`nano_banana` / `openai`） |
| 品質パイプライン（v1.6） | `--resume` による途中再開（`state.json` checkpoint） |
| 品質パイプライン（v1.7） | `--stop-before-phase`、GitHub Actions dry-run CI、Artifacts |
| 品質パイプライン（v1.8） | Nightly Apply Workflow、Secrets チェック、failure summary |

---

## 注意事項

- **API キーは他人に見せないでください。** `.env` ファイルは Git にコミットしないでください（`.gitignore` で除外済み）
- **API 利用には料金がかかる場合があります。** OpenAI・Gemini・Anthropic それぞれの料金体系を確認してください
- **生成内容は必ず人間が確認してから投稿してください。** AI の出力に誤りや不適切な表現が含まれる可能性があります
- **Gemini 無料枠には 1 日の上限があります。** 上限に達した日は、翌日以降に再実行するか、キャッシュを活用してください
- **`npm run daily` は途中で止まることがあります。** エラーメッセージと `logs/daily.log` を確認し、対処方法に従ってください
- **生成ファイルの多くは `.gitignore` で除外されています。** 別 PC に移す場合は、生成物ではなく `.env` とソースコードを共有してください

## Dependabot

このリポジトリでは Dependabot により依存関係の更新を自動検知します（設定: `.github/dependabot.yml` — v1.12.0 導入）。

対象 ecosystem:

- GitHub Actions
- npm

毎週月曜日の午前中（Asia/Tokyo）に更新を確認します。

### CI との関係（v1.12.1）

- **Dependabot PR は GitHub Actions CI の対象**になります。Quality Pipeline CI（`.github/workflows/quality-pipeline-ci.yml`）が PR 上で実行され、`npm test` および dry-run 検証が走ります。
- **Dependabot 起点の workflow では `GITHUB_TOKEN` は read-only 前提**です（[GitHub 公式仕様](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/automating-dependabot-with-github-actions)）。write 権限が必要なステップは Dependabot PR では失敗する可能性があります。
- **GitHub Actions secrets は Dependabot PR では利用できません。** API キー等が必要な workflow ステップを Dependabot PR で動かす場合は、別途 **Dependabot secrets** の設定が必要です（今回未導入）。
- **現在の CI は secrets 不使用前提**（dry-run のみ、API キー不要）のため、現状の Dependabot PR 運用では大きな問題はありません。Nightly Apply（secrets 必須）は Dependabot PR では通常トリガーされません。

### CI が失敗した場合の確認順

1. **更新種別を確認** — npm dependency update か GitHub Actions update か
2. **差分を確認** — `package-lock.json` / workflow file（`.github/workflows/*.yml`）の変更内容
3. **失敗原因を切り分け** — CI failure が breaking change 由来か、権限 / secrets 由来か
4. **問題がなければ merge** — 手動レビューと CI 成功を確認してマージ
5. **繰り返し失敗する依存関係** — 次回以降 `.github/dependabot.yml` への **ignore** 導入を検討

### 将来導入候補（v1.12.1 時点では未導入）

| 機能 | 導入タイミング |
|------|----------------|
| **Grouped Updates** | PR 数が増えてレビュー負荷が高くなったら |
| **ignore** | 特定依存関係で継続的な失敗・非互換が出たら |
| **reviewers / assignees** | 複数人運用になったら |
| **Auto Merge** | CI 安定・レビュー基準・権限設計が固まってから |
| **Dependabot secrets** | Dependabot PR 上で secrets 必須の CI を走らせる必要が出たら |

v1.12.0 時点と同様、**Auto Merge / Grouped Updates / reviewers / assignees / ignore / Dependabot secrets は未導入**です。Dependabot PR は手動レビューと CI 確認後にマージする運用とします。
