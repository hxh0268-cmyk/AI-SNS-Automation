import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateWithRetry } from "./lib/gemini.js";
import {
  parseCarouselJson,
  saveSlides,
  validateSlides,
} from "./lib/carousel.js";

// プロジェクトルートを取得（このスクリプトは src/ 配下にある前提）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// 入出力ファイルのパス
const REVIEWED_FILE = path.join(PROJECT_ROOT, "content/reviewed/post.md");
const CAROUSEL_DIR = path.join(PROJECT_ROOT, "content/carousel");

// Gemini に与えるカルーセル分解用の指示
const SYSTEM_PROMPT = `あなたはSNSマーケター兼Instagramクリエイターです。

レビュー済みのInstagram投稿を、保存・フォロー・商品販売につながるストーリー型カルーセル用テキストに分解してください。
Instagramカルーセル画像に載せる前提なので、1スライド1メッセージの短文構成を厳守してください。

【必須ルール】
1スライド = 1メッセージ

【カルーセル構成（固定）】

slide01：表紙
- 役割：興味を引くタイトル
- 文字数上限：20文字
- 例：SNSで集客できない店の共通ミス

slide02：共感
- 役割：読者の悩みを代弁する
- 文字数上限：30文字
- 例：毎日投稿してるのに予約が増えない…

slide03：失敗例
- 役割：よくある間違い
- 文字数上限：30文字
- 例：料理写真ばかり投稿していた

slide04：成功例
- 役割：改善後の変化
- 文字数上限：30文字
- 例：裏話投稿に変えたら予約3倍

slide05：CTA
- 役割：今日やる行動＋保存誘導
- 文字数上限：40文字
- 例：明日は料理の裏話を1つ投稿して保存！

【禁止事項】
- 長文
- Markdown記号
- ハッシュタグ
- 箇条書き
- 1枚に複数メッセージ
- 本文の丸写し

【優先事項】
- 感情が動く
- 保存したくなる
- 3秒で読める
- 飲食店オーナー・店長に刺さる
- 商品販売につながる

【ルール】
- 元投稿の要点をストーリーとして再構成し、画像用の短いコピーに書き換える
- 表紙→共感→失敗例→成功例→CTA の流れで自然につながる内容にする
- 例文は参考にし、元投稿の内容に合わせて新しい文案を作成する

【出力形式】
必ず5枚、以下のJSON形式のみで出力してください。説明文は不要です。

{
  "slides": [
    { "number": 1, "type": "表紙", "content": "..." },
    { "number": 2, "type": "共感", "content": "..." },
    { "number": 3, "type": "失敗例", "content": "..." },
    { "number": 4, "type": "成功例", "content": "..." },
    { "number": 5, "type": "CTA", "content": "..." }
  ]
}

各 content には、そのスライド画像に載せる1メッセージのみを記載してください。
改行は使わず、1行のプレーンテキストで出力してください。`;

/**
 * メイン処理
 */
async function main() {
  // レビュー済み投稿を読み込む
  let reviewedContent;
  try {
    reviewedContent = await fs.readFile(REVIEWED_FILE, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "レビュー済みファイルが見つかりません: content/reviewed/post.md",
      );
    }
    throw new Error(
      `レビュー済みファイルの読み込みに失敗しました: ${error.message}`,
    );
  }

  if (!reviewedContent.trim()) {
    throw new Error("レビュー済みファイルが空です。");
  }

  // Gemini でカルーセル用スライドに分解
  const responseText = await generateWithRetry({
    contents: reviewedContent,
    systemInstruction: SYSTEM_PROMPT,
    cacheKey: "carousel",
    cacheInputFiles: [REVIEWED_FILE],
  });

  const parsed = parseCarouselJson(responseText);
  const slides = validateSlides(parsed);

  // content/carousel/ が存在しなければ作成
  await fs.mkdir(CAROUSEL_DIR, { recursive: true });

  // 各スライドを保存
  await saveSlides(CAROUSEL_DIR, slides);

  console.log("Carousel created:");
  console.log("content/carousel/");
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
