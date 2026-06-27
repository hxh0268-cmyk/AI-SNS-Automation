import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateWithRetry } from "./lib/gemini.js";
import {
  loadSlides,
  parseCarouselJson,
  saveSlides,
  validateSlides,
} from "./lib/carousel.js";

// プロジェクトルートを取得（このスクリプトは src/ 配下にある前提）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// 入出力ファイルのパス
const CAROUSEL_DIR = path.join(PROJECT_ROOT, "content/carousel");
const REVIEW_JSON_FILE = path.join(CAROUSEL_DIR, "review.json");

// Gemini に与えるカルーセル改善用の指示
const SYSTEM_PROMPT = `あなたはSNSマーケター兼Instagramクリエイターです。

レビュー結果をもとに、5枚構成のInstagramストーリー型カルーセルを改善してください。
Instagramカルーセル画像に載せる前提なので、1スライド1メッセージの短文構成を厳守してください。

【必須ルール】
1スライド = 1メッセージ

【カルーセル構成（固定）】
slide01：表紙（20文字以内）- 強い表紙タイトル
slide02：共感（30文字以内）- 読者の悩みを一言で刺す
slide03：失敗例（30文字以内）- よくある間違い
slide04：成功例（30文字以内）- 改善後の変化
slide05：CTA（40文字以内）- 今日やる行動＋保存誘導

【禁止事項】
- 長文
- Markdown記号
- ハッシュタグ
- 箇条書き
- 1枚に複数メッセージ
- 説明文っぽい文章

【優先事項】
- 改善点 improvements を必ず反映する
- 保存されやすい表現にする
- 感情が動く
- 3秒で読める
- 飲食店オーナー・店長に刺さる
- 表紙→共感→失敗例→成功例→CTA の流れを維持する

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
 * review.json を読み込む
 * @returns {Promise<object>}
 */
async function loadReviewJson() {
  let fileContent;
  try {
    fileContent = await fs.readFile(REVIEW_JSON_FILE, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "レビューファイルが見つかりません: content/carousel/review.json",
      );
    }
    throw new Error(
      `review.json の読み込みに失敗しました: ${error.message}`,
    );
  }

  try {
    return JSON.parse(fileContent);
  } catch {
    throw new Error("review.json の形式が不正です。");
  }
}

/**
 * Gemini に渡す改善用入力テキストを組み立てる
 * @param {Array<{ fileName: string, type: string, content: string }>} slides
 * @param {object} review - review.json の内容
 * @returns {string}
 */
function buildImproveInput(slides, review) {
  const slideText = slides
    .map(
      (slide) => `### ${slide.fileName}（${slide.type}）\n${slide.content}`,
    )
    .join("\n\n");

  const improvementsText =
    review.improvements?.length > 0
      ? review.improvements.map((item) => `- ${item}`).join("\n")
      : "- なし";

  const strengthsText =
    review.strengths?.length > 0
      ? review.strengths.map((item) => `- ${item}`).join("\n")
      : "- なし";

  return `【現在のスライド】
${slideText}

【レビュー結果】
- 総合点: ${review.score} / 100点
- 判定: ${review.status}

【良い点】
${strengthsText}

【改善点】
${improvementsText}`;
}

/**
 * メイン処理
 */
async function main() {
  // review.json を読み込む
  const review = await loadReviewJson();

  if (typeof review.passed !== "boolean") {
    throw new Error("review.json に passed が含まれていません。");
  }

  // 合格済みの場合は改善せず終了
  if (review.passed) {
    console.log("Carousel already passed. No improvement needed.");
    return;
  }

  // スライドファイルを読み込む
  const slides = await loadSlides(CAROUSEL_DIR);
  const improveInput = buildImproveInput(slides, review);

  // Gemini でカルーセルを改善
  const responseText = await generateWithRetry({
    contents: improveInput,
    systemInstruction: SYSTEM_PROMPT,
  });

  const parsed = parseCarouselJson(responseText);
  const improvedSlides = validateSlides(parsed);

  // 改善したスライドを上書き保存
  await saveSlides(CAROUSEL_DIR, improvedSlides);

  console.log("Carousel improved:");
  console.log("content/carousel/");
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
