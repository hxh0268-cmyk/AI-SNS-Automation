# Genspark リサーチテンプレート

> **使い方**
> 1. 下の「Genspark に貼り付けるプロンプト」をすべてコピーする
> 2. Genspark の入力欄に貼り付けて実行する
> 3. 出力結果を **3 つのブロックに分けて** それぞれ保存する
>    - **Markdown ブロック** → `content/research/latest.md`
>    - **JSON ブロック（latest）** → `content/research/latest.json`
>    - **JSON ブロック（metadata）** → `content/research/metadata.json`
> 4. バックアップ用に `content/research/archive/YYYY-MM-DD/` にもコピーしておく

---

## 保存するファイル構成

```
content/research/
├── latest.md        … 人間が読む用（要約・投稿案・注意点）
├── latest.json      … AI が読む用（構造化データ・投稿生成に使う）
├── metadata.json    … 調査のメタ情報（日時・キーワード・件数など）
└── archive/
    └── YYYY-MM-DD/  … 過去分のバックアップ（任意）
```

| ファイル | 誰が使う | 用途 |
|----------|----------|------|
| `latest.md` | 人間 | 今日のネタを確認・選ぶ |
| `latest.json` | AI（Claude 等） | 投稿生成の入力データ |
| `metadata.json` | 人間・システム | 調査ログ・キャッシュ管理 |

---

## Genspark に貼り付けるプロンプト

以下からコピーしてください。

---

あなたは、飲食店向け SNS マーケティングのリサーチャーです。

**調査テーマ：**
「現役飲食店店長が実際に使う ChatGPT・AI 活用術」

**ターゲット読者：**
- 飲食店の店長・オーナー
- AI や ChatGPT は聞いたことがあるが、まだ本格的に使っていない人
- 毎日の店舗業務が忙しく、SNS や IT に詳しくない人

**調査してほしい内容：**

1. **今日または最近話題の AI ニュース**
   - 日本で話題になっている AI 関連のニュースを 2〜3 件
   - 飲食店・店舗運営と無関係なものは除外する

2. **ChatGPT / Gemini / Claude / Cursor / n8n などの実用ネタ**
   - 飲食店店長が「明日から試せる」レベルの活用例
   - 各ツールごとに 1 つ以上、具体的な使い方を挙げる
   - 専門用語は避け、平易な日本語で説明する

3. **Instagram で投稿化しやすい切り口**
   - 「Before / After」「よくある失敗 → 改善後」など、カルーセル向けの構成
   - 3 秒で内容が伝わる見出し案

4. **飲食店・店舗運営に応用できる AI 活用例**
   - シフト作成、メニュー説明文、クレーム返信、SNS 投稿、スタッフ教育など
   - 「現場で本当に使える」具体例を優先する

5. **初心者でも分かる投稿ネタ**
   - 「ChatGPT って何？」レベルから始められる内容
   - 専門知識がなくても共感できる悩み（時間がない、SNS が苦手、など）

6. **保存されやすいカルーセル投稿案**
   - 5 枚構成（表紙 → 共感 → 失敗例 → 成功例 → CTA）を想定
   - 各スライドに載せる短い文言案（20〜40 文字程度）

7. **注意点・誤解されやすい点**
   - AI に任せきりにしてはいけないこと
   - 個人情報・クレーム対応での注意
   - 「AI 導入＝すぐ売上 2 倍」のような誇大表現は避ける

8. **参考 URL**
   - 信頼できる情報源のみ（公式サイト、大手メディア、業界団体など）
   - URL は 3〜5 件

---

**出力ルール（重要）：**

- **日本語**で書く
- **PC 初心者**でも理解できる言葉を使う
- **怪しい副業・稼げる系・情報商材**のような表現は使わない
- **飲食店店長の日常業務**に自然につながる内容にする
- 投稿案（topics）は **3〜5 個** 出す
- **出力は 3 ブロックに分ける**（Markdown 1 つ + JSON 2 つ）
- **Markdown と JSON を混ぜない**（それぞれ独立したコードブロックで出力）
- JSON ブロックには **説明文・前置き・コメントを入れない**（ファイルにそのまま保存できる純粋な JSON のみ）
- JSON の数値スコアは **0〜100 の整数** で統一する
- `postValueScore` は `scoreBreakdown` の 4 項目の平均（四捨五入）と一致させる

---

**出力構成（この順番で、3 ブロックを出力してください）：**

---

### ブロック 1：`latest.md` 用（人間が読む Markdown）

見出し `## latest.md` を付けてから、Markdown コードブロックで出力してください。

```markdown
# Genspark Research

## 調査日
（YYYY-MM-DD）

## 調査テーマ
現役飲食店店長が実際に使うChatGPT・AI活用術

## 今日の要約
（3〜5 行。店長が「今日何を投稿すればいいか」が一目で分かる内容）

## 注目トピック
（最近の AI ニュースと実用ネタ。各項目に「なぜ飲食店店長に関係あるか」を 1 行添える）

## 飲食店・店舗運営への応用
（現場での AI 活用例を 3 件以上。Before / After が分かるとよい）

## Instagram投稿アイデア
（投稿化しやすい切り口、初心者向けネタ、カルーセル案）

### 投稿案 1
- **タイトル案：**
- **ターゲットの悩み：**
- **切り口：**
- **投稿価値スコア：** （0〜100）
- **カルーセル構成案：**
  - slide01（表紙）：
  - slide02（共感）：
  - slide03（失敗例）：
  - slide04（成功例）：
  - slide05（CTA）：

### 投稿案 2
（同様）

### 投稿案 3
（同様）

（必要に応じて投稿案 4、5 も追加）

## 注意点・よくある誤解
（AI 活用で注意すべき点を 3 件以上）

## 推奨する投稿テーマ
- **1位（今日の推奨）：** （タイトル + 選んだ理由 2〜3 行）
- **2位：**
- **3位：**
- **4位：**（任意）
- **5位：**（任意）

## 参考URL
- （URL）— （説明）
```

---

### ブロック 2：`latest.json` 用（AI が読む JSON）

見出し `## latest.json` を付けてから、JSON コードブロックで出力してください。

**必須フィールド：**

| フィールド | 型 | 説明 |
|------------|-----|------|
| `date` | string | 調査日（YYYY-MM-DD） |
| `recommendedTheme` | string | 今日一番おすすめの投稿テーマ |
| `topTopic` | string | 最も注目すべきトピック 1 行要約 |
| `topics` | array | 投稿案 3〜5 件 |

**topics 配列の各要素：**

| フィールド | 型 | 説明 |
|------------|-----|------|
| `title` | string | 投稿タイトル案 |
| `summary` | string | 1〜2 行の要約 |
| `importance` | string | `high` / `medium` / `low` |
| `postValueScore` | number | 投稿価値スコア（0〜100） |
| `scoreBreakdown` | object | 内訳スコア（各 0〜100） |
| `scoreBreakdown.novelty` | number | 新しさ |
| `scoreBreakdown.savePotential` | number | 保存されやすさ |
| `scoreBreakdown.restaurantFit` | number | 飲食店への適合度 |
| `scoreBreakdown.beginnerFriendly` | number | 初心者向け度 |
| `competitionGap` | string | 競合と差別化できる点 |
| `personalAngle` | string | 店長の実体験につなげる切り口 |
| `restaurantApplication` | string | 店舗運営への具体的応用 |
| `carouselIdea` | object | カルーセル 5 枚の文言案 |
| `carouselIdea.slide01` | string | 表紙 |
| `carouselIdea.slide02` | string | 共感 |
| `carouselIdea.slide03` | string | 失敗例 |
| `carouselIdea.slide04` | string | 成功例 |
| `carouselIdea.slide05` | string | CTA |
| `hashtags` | array | ハッシュタグ（# 付き、5〜10 個） |
| `url` | string | 参考 URL（最も関連する 1 件） |

```json
{
  "date": "2026-06-25",
  "recommendedTheme": "ChatGPTでInstagram投稿文を10分で作る方法",
  "topTopic": "ChatGPTを投稿文の下書きに使う方法が、忙しい店長にとって最も手軽な第一歩",
  "topics": [
    {
      "title": "ChatGPTでInstagram投稿文を10分で作る方法",
      "summary": "毎日30分かかっていた投稿作成が10分に短縮できる具体的手順",
      "importance": "high",
      "postValueScore": 88,
      "scoreBreakdown": {
        "novelty": 75,
        "savePotential": 92,
        "restaurantFit": 95,
        "beginnerFriendly": 90
      },
      "competitionGap": "「AI活用」ではなく「店長の1週間の変化」という実体験視点",
      "personalAngle": "「毎日投稿したいけど文章が浮かばない」店長の共感から入る",
      "restaurantApplication": "メニュー紹介・シフト連絡・スタッフ向け説明文にも応用可能",
      "carouselIdea": {
        "slide01": "AIで投稿10分",
        "slide02": "毎日30分かかってた…",
        "slide03": "ゼロから毎回書いてた",
        "slide04": "ChatGPTに下書き依頼",
        "slide05": "保存して明日試す"
      },
      "hashtags": [
        "#飲食店SNS集客",
        "#ChatGPT活用",
        "#店長の仕事術"
      ],
      "url": "https://openai.com/chatgpt"
    }
  ]
}
```

---

### ブロック 3：`metadata.json` 用（調査メタ情報）

見出し `## metadata.json` を付けてから、JSON コードブロックで出力してください。

**必須フィールド：**

| フィールド | 型 | 説明 |
|------------|-----|------|
| `createdAt` | string | 調査実行日時（ISO 8601 形式） |
| `source` | string | 固定値 `"genspark"` |
| `version` | string | テンプレートバージョン（`"1.1"`） |
| `language` | string | 固定値 `"ja"` |
| `topicCount` | number | topics の件数（3〜5） |
| `searchKeywords` | array | 調査に使ったキーワード |
| `cache` | object | キャッシュ関連情報 |
| `cache.inputHash` | string | 空文字 `""` で可（後でシステムが埋める） |
| `cache.cachedAt` | string | 空文字 `""` で可 |
| `cache.expiresAt` | string | 空文字 `""` で可 |
| `notes` | string | 調査時の補足メモ（任意。なければ空文字） |

```json
{
  "createdAt": "2026-06-25T09:00:00+09:00",
  "source": "genspark",
  "version": "1.1",
  "language": "ja",
  "topicCount": 3,
  "searchKeywords": [
    "飲食店 ChatGPT 活用",
    "店長 AI 業務効率化",
    "Instagram 飲食店 AI"
  ],
  "cache": {
    "inputHash": "",
    "cachedAt": "",
    "expiresAt": ""
  },
  "notes": ""
}
```

---

**禁止事項：**
- 「誰でも月収 100 万」「完全自動で稼げる」などの誇大・副業系表現
- 根拠のない数字や効果の断言
- 飲食店と無関係な AI 論争・開発者向けの深い技術話
- 著作権侵害につながる競合投稿の全文コピー
- JSON ブロックの前後に説明文を書くこと（見出し `## latest.json` 等は除く）

**文体：**
- 親しみやすく、実務的
- 店長が「自分の店でも試してみよう」と思えるトーン
- 上から目線にならない

---

## 保存手順（PC 初心者向け）

Genspark の出力を受け取ったら、次の手順で 3 ファイルに分けて保存します。

### 1. `latest.md` を保存

1. 出力の中から `## latest.md` の下にある **Markdown コードブロック** を探す
2. コードブロックの中身だけをコピーする（\`\`\`markdown と \`\`\` は含めない）
3. `content/research/latest.md` として保存する

### 2. `latest.json` を保存

1. 出力の中から `## latest.json` の下にある **JSON コードブロック** を探す
2. コードブロックの中身だけをコピーする（\`\`\`json と \`\`\` は含めない）
3. `content/research/latest.json` として保存する
4. JSON の `{` から `}` までがそのまま入っていることを確認する

### 3. `metadata.json` を保存

1. 出力の中から `## metadata.json` の下にある **JSON コードブロック** を探す
2. コードブロックの中身だけをコピーする
3. `content/research/metadata.json` として保存する

### 4. バックアップ（任意）

```
content/research/archive/2026-06-25/
├── latest.md
├── latest.json
└── metadata.json
```

---

## 出力イメージ（全体構成）

Genspark から返ってくる出力は、次のような **3 ブロック構成** になります。

```
## latest.md

```markdown
# Genspark Research
...
```

## latest.json

```json
{
  "date": "2026-06-25",
  ...
}
```

## metadata.json

```json
{
  "createdAt": "2026-06-25T09:00:00+09:00",
  ...
}
```
```

---

## 運用メモ

| 項目 | 内容 |
|------|------|
| 実行頻度 | 毎日 1 回（`npm run daily` の前） |
| 所要時間 | 5〜10 分程度 |
| 人間用 | `content/research/latest.md` |
| AI 用 | `content/research/latest.json` |
| メタ情報 | `content/research/metadata.json` |
| 次のステップ | `npm run daily` で投稿生成 |

`latest.json` の `recommendedTheme` または `latest.md` の「推奨する投稿テーマ 1 位」が、その日の投稿ネタになります。

---

## スコアの見方（参考）

| スコア | 意味 |
|--------|------|
| 80〜100 | 今日の投稿に最適 |
| 60〜79 | 使えるが優先度は中 |
| 0〜59 | 参考程度 |

| 内訳項目 | 意味 |
|----------|------|
| `novelty` | 新しさ・話題性 |
| `savePotential` | 保存されやすさ |
| `restaurantFit` | 飲食店・店長への適合度 |
| `beginnerFriendly` | 初心者向け度 |
