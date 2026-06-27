# v1.1「Genspark連携」設計書

> **ステータス：v1.1 実装済み（半自動運用）**  
> 最終更新：2026-06-26

---

## 0. v1.1 実装サマリー

v1.1 では **Genspark API の自動連携は行いません**。人間が Genspark で調査し、結果をファイルに保存する **半自動運用** です。

### 実装済み機能

| 機能 | ファイル / コマンド |
|------|---------------------|
| リサーチテンプレート | `prompts/genspark/research_template.md` |
| 投稿生成へのリサーチ反映 | `src/generate_post.js`（`latest.md` + `latest.json`） |
| リサーチ状態確認 | `npm run research-check`（`src/check_research.js`） |
| daily 冒頭のリサーチ確認 | `scripts/run_daily.sh`（失敗しても続行） |

### 日常運用（3 ステップ）

```
1. Genspark で調査（人間・5〜10分）
2. content/research/ に 3 ファイル保存（人間）
3. npm run daily（自動）
```

## 1. v1.1 の目的

**v1.0** では、`npm run daily` を実行すると、あらかじめ決めたテーマリストからランダムに 1 つ選び、AI が Instagram 投稿を生成していました。

**v1.1** では、その前に **Genspark で「今日のネタ」を調査** し、調査結果をもとに投稿を生成できるようにします。

### v1.1 で達成したいこと

| 項目 | v1.0 | v1.1 |
|------|------|------|
| 投稿ネタの決め方 | 固定テーマからランダム選択 | Genspark の調査結果を反映 |
| 情報の新しさ | テーマは固定 | トレンド・競合・季節を反映 |
| 投稿の説得力 | AI の一般知識ベース | 調査結果に基づく具体性 |

**一言で言うと：**  
「なんとなく AI に書かせる」から、「今日の状況に合ったネタで AI に書かせる」へ進化させる。

---

## 2. Genspark の役割

Genspark は、**AI-SNS-Automation の「リサーチ入力エンジン」** として使います。

### Genspark が担当すること

- Web 上の情報を調べる（検索・要約）
- トレンドや競合の動向を整理する
- 「今日何を投稿すべきか」の候補を出す
- 調査結果を、人間が読みやすい形にまとめる

### Genspark が担当しないこと

- 投稿文の最終執筆（→ Claude Code が担当）
- カルーセル分解（→ Gemini が担当）
- 画像生成（→ OpenAI が担当）
- Instagram への自動投稿

### 役割分担のイメージ

```
Genspark  … 「今日、何について書くべきか」を調べる（リサーチ）
    ↓
Claude    … 調査結果をもとに投稿文を書く（執筆）
    ↓
Gemini    … テキスト・画像の品質チェック（レビュー）
    ↓
OpenAI    … カルーセル画像を生成（ビジュアル）
    ↓
export    … Instagram 投稿用ファイルを出力（仕上げ）
```

Genspark は **パイプラインの最初** に位置し、**「素材（ネタ）」を集める係** です。

---

## 3. 現在の AI-SNS-Automation との接続位置

### 現在の v1.1 フロー（実装済み）

```
npm run daily
  │
  ├─ 0. リサーチ確認（research-check）  ← 失敗しても続行
  ├─ 1. generate（投稿生成）            ← latest.json + latest.md を参照
  ├─ 2. gemini-review
  ├─ 3. carousel
  ├─ …（以降、カルーセル・画像・出力）
  └─ 13. export-instagram
```

`generate_post.js` は次のファイルを読みます。

| ファイル | 内容 | 優先度 |
|----------|------|--------|
| `content/research/latest.json` | 構造化データ。`postValueScore` 最高の topic を最優先 | 高 |
| `content/research/latest.md` | 人間向け要約・投稿案 | 中（JSON と併用） |
| `prompts/instagram/user.md` | 固定テーマリスト | フォールバック |

### v1.0 フロー（参考）

**接続ポイントは 1 箇所：** `generate`（投稿生成）の **直前** です。

Genspark の調査結果が `content/draft/post.md` を作る段階の **入力** になります。それ以降のカルーセル生成・画像生成・レビューは、v1.0 の仕組みをそのまま使います。

---

## 4. 毎日取得したい情報

Genspark で **毎日必ず調べる** 情報です。飲食店向け Instagram 集客に直結します。

| # | 情報 | 理由 |
|---|------|------|
| 1 | **今日の投稿ネタ候補（3〜5 個）** | 何を書くか決めるため。最も重要 |
| 2 | **飲食店 × Instagram のトレンド** | 今刺さる話題・形式を把握するため |
| 3 | **関連ハッシュタグの動向** | 投稿後のリーチに影響するため |
| 4 | **競合アカウントの最近の投稿テーマ** | 差別化と参考にするため |
| 5 | **今日の季節・イベント・曜日に合ったネタ** | タイムリーな投稿にするため |

### 出力イメージ（Genspark への指示例）

```
飲食店オーナー・店長向け Instagram 集客について、以下を調べてください。

1. 今日（2026年6月25日）投稿向けのネタ候補を5つ
2. 飲食店Instagramで今話題の投稿形式・テーマ
3. #飲食店SNS集客 など関連ハッシュタグの動向
4. 競合と思われる飲食店アカウント3件の最近の投稿傾向
5. 今日の季節・イベントに合った投稿アングル
```

---

## 5. あれば役立つ情報

毎日必須ではないが、**週 1 回やネタに困ったとき** に調べると効果的な情報です。

| # | 情報 | 使いどころ |
|---|------|-----------|
| 1 | バズっている飲食店投稿の構成パターン | カルーセル・リールの参考 |
| 2 | 業界ニュース（食材高騰、法改正など） | 共感を呼ぶ投稿ネタ |
| 3 | 地域のイベント・天候 | ローカル店舗向けネタ |
| 4 | 競合のエンゲージメント傾向（いいね・保存） | 何が刺さるかの参考 |
| 5 | Instagram アルゴリズム・機能の最新情報 | 運用方針の更新 |
| 6 | ターゲット（店長・オーナー）の悩みトピック | 共感スライドのネタ |

---

## 6. 取得しなくてよい情報

調査コストが高い割に、投稿生成に使いにくい情報です。**v1.1 では取得対象外** とします。

| # | 情報 | 除外理由 |
|---|------|----------|
| 1 | 飲食店業界と無関係な一般ニュース | 投稿ネタに直結しない |
| 2 | 競合の投稿全文のコピー | 著作権リスク。要約で十分 |
| 3 | 個人名・電話番号・住所など | プライバシー・法令上の問題 |
| 4 | 生の HTML・JSON・スクレイピング結果 | AI が読みにくい。要約が必要 |
| 5 | 詳細な財務データ・株価 | ターゲット層の関心外 |
| 6 | 海外のみのトレンド（日本向けに無関係） | ローカライズが必要で工数が増える |
| 7 | 広告単価・SEO 詳細データ | Instagram 投稿生成に不要 |

---

## 7. Genspark から Claude Code へ渡す情報

Genspark の調査結果は、**Claude Code（投稿生成）がそのまま読める Markdown** に整形して渡します。

### 渡す情報（必須項目）

```markdown
# 今日のリサーチ結果

## 調査日
2026-06-25

## 推奨投稿ネタ（1位）
- タイトル案：SNS投稿を変えたら予約が2倍になった話
- 切り口：「料理写真ばかり」から「裏話投稿」への転換
- ターゲットの悩み：毎日投稿しているのに予約が増えない
- 根拠：競合アカウントで裏話系投稿のエンゲージメントが高い傾向

## ネタ候補（2〜5位）
（箇条書き）

## トレンドメモ
- 今週の飲食店Instagramで多い形式：…
- 注目ハッシュタグ：…

## 競合メモ
- アカウントA：最近〇〇系の投稿が多い
- アカウントB：…

## 今日のタイムリー要素
- 季節：…
- イベント：…

## 参考URL
- https://…
```

### 渡し方（v1.1 想定）

| 方式 | 説明 | v1.1 での採用 |
|------|------|---------------|
| **ファイル経由** | 調査結果を Markdown ファイルに保存し、`generate` が読み込む | ✅ 採用（メイン） |
| プロンプト直接貼り付け | Genspark の結果を `user.md` に手動コピー | △ 簡易版として可 |
| API 自動連携 | Genspark API から自動取得 | ❌ v1.1 では見送り |

**v1.1 では「ファイル経由」を基本** とします。  
Genspark で調査 → 結果を所定フォルダに保存 → `npm run daily` がそのファイルを読んで投稿生成、という流れです。

---

## 8. 保存するファイル構成案

### フォルダ構成

```
content/
├── research/                    … Genspark リサーチ結果
│   ├── latest.md                … 人間向け（generate が参考情報として読む）
│   ├── latest.json              … AI 向け（generate が最優先テーマとして読む）
│   ├── metadata.json            … 調査メタ情報（research-check で表示）
│   └── archive/                 … 過去分の保存（任意）
│       └── YYYY-MM-DD/
├── draft/
│   └── post.md                  … 投稿下書き（出力）
├── reviewed/
│   └── post.md                  … レビュー済み投稿
└── carousel/
    └── …
```

### 各ファイルの役割

| ファイル | 誰が書く | 誰が読む | 内容 |
|----------|----------|----------|------|
| `content/research/latest.md` | 人間（Genspark 結果を保存） | 人間・`generate_post.js` | 調査要約・投稿案・参考 URL |
| `content/research/latest.json` | 人間（Genspark 結果を保存） | `generate_post.js` | 投稿テーマ・スコア・カルーセル案 |
| `content/research/metadata.json` | 人間（Genspark 結果を保存） | `check_research.js` | 調査日時・キーワード・件数 |

### `latest.json` の主要項目（実装済み）

```json
{
  "date": "2026-06-25",
  "recommendedTheme": "ChatGPTでInstagram投稿が10分で終わる方法",
  "topTopic": "ChatGPTを投稿文の下書きに使う…",
  "topics": [
    {
      "title": "…",
      "postValueScore": 92,
      "scoreBreakdown": {
        "novelty": 82,
        "savePotential": 95,
        "restaurantFit": 96,
        "beginnerFriendly": 93
      },
      "competitionGap": "…",
      "personalAngle": "…",
      "restaurantApplication": "…",
      "carouselIdea": { "slide01": "…", "slide02": "…", "…": "…" },
      "hashtags": ["#飲食店SNS集客"],
      "url": "https://…"
    }
  ]
}
```

### 投稿生成のフォールバック（実装済み）

| 状態 | 動作 |
|------|------|
| `latest.json` 正常 + `latest.md` あり | JSON 最優先テーマ + Markdown 参考 |
| `latest.json` 正常 + `latest.md` なし | JSON 最優先テーマのみ |
| `latest.json` 壊れている + `latest.md` あり | **停止しない**。Markdown のみで続行 |
| 両方なし | 固定テーマ（`user.md`）で生成 |

### 既存ファイルとの関係

- **`prompts/instagram/system.md`** … 変更なし（AI の役割・文体）
- **`prompts/instagram/user.md`** … v1.1 では「リサーチ結果がないときのフォールバック」として残す
- **`content/draft/post.md`** … 変更なし（出力先）

---

## 9. v1.1 実装範囲（完了）

v1.1 は **半自動運用** として実装済みです。

| # | 実装項目 | 状態 |
|---|----------|------|
| 1 | リサーチ用フォルダ | ✅ `content/research/` |
| 2 | リサーチテンプレート | ✅ `prompts/genspark/research_template.md` |
| 3 | `generate_post.js` 改修 | ✅ `latest.md` + `latest.json` 対応 |
| 4 | `npm run research-check` | ✅ `src/check_research.js` |
| 5 | `run_daily.sh` 更新 | ✅ 冒頭にリサーチ確認（失敗しても続行） |
| 6 | README / 設計書 | ✅ 本ドキュメント |
| 7 | テスト用サンプル | ✅ `content/research/` サンプルデータ |

### v1.1 の運用フロー（現行）

```
【朝の作業（5〜10分・人間）】
1. Genspark を開く
2. prompts/genspark/research_template.md をコピーして調査
3. 結果を 3 ファイルに保存
   - content/research/latest.md
   - content/research/latest.json
   - content/research/metadata.json
4. （任意）npm run research-check で確認

【自動実行】
5. npm run daily
   → リサーチ確認（自動）
   → 投稿生成（latest.json / latest.md を反映）
   → 以降は v1.0 と同じ
```

### `prompts/genspark/research_template.md` の使い方

1. ファイル内の「Genspark に貼り付けるプロンプト」をすべてコピー
2. Genspark に貼り付けて実行
3. 出力を **Markdown 1 つ + JSON 2 つ** に分けて保存
4. JSON はコードブロックの中身だけを保存（説明文を混ぜない）

### `npm run research-check` の使い方

```bash
npm run research-check
```

- 3 ファイルの有無を表示
- `latest.json` の最優先テーマ・スコアを表示
- **投稿生成で何が使われるか** を表示

`npm run daily` 実行時も自動で走ります。**失敗しても daily は止まりません。**

---

## 10. v1.1 では実装しない範囲

将来の v1.2 以降に回す項目です。

| # | 見送り項目 | 理由 |
|---|----------|------|
| 1 | Genspark API の自動呼び出し | API 仕様・認証の調査が必要 |
| 2 | 競合アカウントの自動スクレイピング | 法令・利用規約の確認が必要 |
| 3 | リサーチ結果の AI 自動要約（二重処理） | Genspark 自体が要約するため不要 |
| 4 | Instagram への自動投稿 | 別フェーズ（v2.0 候補） |
| 5 | 複数アカウント・複数業種対応 | まず飲食店 1 業種に集中 |
| 6 | リサーチ結果の DB 管理 | ファイルベースで十分 |
| 7 | Genspark 以外のリサーチツール連携 | Perplexity 等は v1.2 以降 |
| 8 | カルーセル・画像生成へのリサーチ直接反映 | v1.1 は投稿生成のみ |

---

## 11. 完成条件

v1.1 が「完成」と言える条件を以下に定めます。

### 必須条件（すべて達成）

- [x] Genspark 用リサーチプロンプトテンプレートが用意されている
- [x] `content/research/latest.md` に調査結果を保存できる
- [x] `content/research/latest.json` に構造化データを保存できる
- [x] `npm run daily` 実行時、リサーチ結果が投稿生成に反映される
- [x] リサーチファイルがない場合、固定テーマから生成できる（後方互換）
- [x] `latest.json` が壊れていても daily は停止しない
- [x] `npm run research-check` で状態確認できる
- [x] README に Genspark 連携の手順が記載されている

### 確認方法

1. Genspark でリサーチを実行し、`latest.md` に保存
2. `npm run daily` を実行
3. `content/draft/post.md` に、リサーチで指定したネタが反映されていることを確認
4. `output/instagram/` に投稿素材が出力されることを確認

### 成功の目安

| 観点 | 目安 |
|------|------|
| ネタの具体性 | 固定テーマより、今日のトレンドに沿った内容になっている |
| 運用負荷 | 毎朝 5〜10 分の Genspark 作業で回せる |
| 安定性 | リサーチファイルがなくても daily が動く |

---

## 12. 実装ステップ（完了状況）

| Step | 内容 | 状態 |
|------|------|------|
| Step 1 | 設計書作成 | ✅ 完了 |
| Step 2 | リサーチテンプレート（Markdown + JSON 形式） | ✅ 完了 |
| Step 3 | テスト用サンプル（latest.md / json / metadata） | ✅ 完了 |
| Step 4 | `generate_post.js` 改修（latest.md） | ✅ 完了 |
| Step 5 | `generate_post.js` 改修（latest.json 最優先テーマ） | ✅ 完了 |
| Step 6 | `npm run research-check` | ✅ 完了 |
| Step 7 | `run_daily.sh` 冒頭リサーチ確認 | ✅ 完了 |
| Step 8 | README / 設計書更新 | ✅ 完了 |

### v1.2 以降の検討

| バージョン | 候補機能 |
|------------|----------|
| v1.2 | Genspark API 自動連携 |
| v1.3 | 競合アカウント定期モニタリング |
| v2.0 | Instagram 自動投稿連携 |

---

## 付録：用語集

| 用語 | 意味 |
|------|------|
| **Genspark** | AI 検索・リサーチツール。Web 情報を調べて要約してくれる |
| **リサーチ入力エンジン** | 投稿生成の「前段階」で、ネタやトレンド情報を集める仕組み |
| **latest.json** | AI 向け構造化データ。`postValueScore` 最高の topic を最優先 |
| **metadata.json** | 調査のメタ情報（日時・キーワード） |
| **research-check** | リサーチファイルの状態確認コマンド |
| **半自動運用** | Genspark 調査は人間、以降は npm run daily が自動 |
| **フォールバック** | リサーチファイルがない／JSON が壊れているとき、固定テーマに戻る |
| **パイプライン** | `npm run daily` が順番に実行する一連の処理 |

---

## 付録：現在の v1.0 との比較図

```
【v1.0】
固定テーマ → Claude → Gemini → 画像 → 出力

【v1.1】
Genspark調査（人間）
  → latest.md + latest.json + metadata.json
  → research-check（daily 冒頭）
  → Claude（リサーチ反映）→ Gemini → 画像 → 出力
```

---

*この設計書は v1.1 実装済みの運用指針です。詳しい使い方は README.md を参照してください。*
