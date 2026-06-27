import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { generateWithRetry } from "./lib/gemini.js";
import {
  SLIDE_TYPES,
  getCarouselOutputImageFileName,
  getCarouselPromptFileName,
  loadSlides,
} from "./lib/carousel.js";

// プロジェクトルートを取得（このスクリプトは src/ 配下にある前提）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// 入出力ファイルのパス
const CAROUSEL_CONTENT_DIR = path.join(PROJECT_ROOT, "content/carousel");
const CAROUSEL_GENERATED_DIR = path.join(
  PROJECT_ROOT,
  "images/carousel/generated-prompts",
);
const CAROUSEL_OUTPUT_DIR = path.join(PROJECT_ROOT, "images/carousel/output");
const BACKUP_DIR = path.join(PROJECT_ROOT, "images/carousel/backup");
const REVIEW_JSON_FILE = path.join(
  PROJECT_ROOT,
  "images/carousel/review/image_review.json",
);

// Gemini に与える画像プロンプト改善用の指示
const SYSTEM_PROMPT = `あなたはSNSビジュアルデザイナー兼Instagramクリエイターです。

画像レビュー結果をもとに、OpenAI Images API向けの画像生成プロンプトを改善してください。

【改善の条件】
- レビューの improvements を必ず反映する
- 元プロンプトの良い部分（基本デザイン、スライド文言、1:1正方形、Instagram向け）は維持する
- 飲食店オーナー・店長向けInstagramカルーセルとして適切なビジュアルにする
- 日本語テキストは画像内に大きく配置する前提を維持する
- 画像生成AIにそのまま渡せる英語プロンプトのみを出力する

【出力形式】
画像生成プロンプト本文のみを出力してください。説明文、Markdown、前置きは不要です。`;

/**
 * Markdownファイルから画像生成用プロンプト本文を抽出する
 * @param {string} content - generated-prompt ファイルの内容
 * @returns {string}
 */
function extractPromptFromMarkdown(content) {
  const match = content.match(/^## Prompt\s*\n([\s\S]*)$/m);
  if (match?.[1]?.trim()) {
    return match[1].trim();
  }

  return content.trim();
}

/**
 * 改善版プロンプトを generated-prompt 形式で組み立てる
 * @param {string} basePrompt - プロンプト本文
 * @param {string} slideType - スライド種別
 * @returns {string}
 */
function buildFinalPrompt(basePrompt, slideType) {
  return `# Image Generation Prompt

## Specifications

- Platform: Instagram
- Aspect ratio: 1:1 (square)
- Target audience: Restaurant managers and owners
- Style: Simple, clean, minimal text, AI-driven feel
- Design: Japanese-friendly aesthetic
- Slide type: ${slideType}

## Prompt

${basePrompt.trim()}
`;
}

/**
 * image_review.json を読み込む
 * @returns {Promise<object>}
 */
async function loadReviewJson() {
  let fileContent;
  try {
    fileContent = await fs.readFile(REVIEW_JSON_FILE, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "レビューファイルが見つかりません: images/carousel/review/image_review.json",
      );
    }
    throw new Error(
      `image_review.json の読み込みに失敗しました: ${error.message}`,
    );
  }

  try {
    return JSON.parse(fileContent);
  } catch {
    throw new Error("image_review.json の形式が不正です。");
  }
}

/**
 * failedItems のスライドキーから番号を取得する
 * @param {string} slideKey - 例: slide03
 * @returns {number}
 */
function parseSlideNumber(slideKey) {
  const match = slideKey.match(/^slide(\d{2})$/);
  if (!match) {
    throw new Error(`改善対象スライドの形式が不正です: ${slideKey}`);
  }

  const number = Number(match[1]);
  if (number < 1 || number > SLIDE_TYPES.length) {
    throw new Error(`改善対象スライドの番号が不正です: ${slideKey}`);
  }

  return number;
}

/**
 * Gemini に渡す改善用入力テキストを組み立てる
 * @param {object} options
 * @param {string} options.currentPrompt - 現在のプロンプト本文
 * @param {{ fileName: string, type: string, content: string }} options.slide
 * @param {{ score: number, strengths: string[], improvements: string[] }} options.slideReview
 * @param {string[]} options.globalImprovements - 全体の改善点
 * @returns {string}
 */
function buildImproveInput({
  currentPrompt,
  slide,
  slideReview,
  globalImprovements,
}) {
  const strengthsText =
    slideReview.strengths.length > 0
      ? slideReview.strengths.map((item) => `- ${item}`).join("\n")
      : "- なし";

  const improvementsText =
    slideReview.improvements.length > 0
      ? slideReview.improvements.map((item) => `- ${item}`).join("\n")
      : "- なし";

  const globalImprovementsText =
    globalImprovements.length > 0
      ? globalImprovements.map((item) => `- ${item}`).join("\n")
      : "- なし";

  return `【対象スライド】
- ファイル: ${slide.fileName}
- 種別: ${slide.type}
- スライド文言: ${slide.content}

【レビュー結果】
- 点数: ${slideReview.score} / 100点

【良い点】
${strengthsText}

【改善点】
${improvementsText}

【全体の改善点（参考）】
${globalImprovementsText}

【現在の画像生成プロンプト】
${currentPrompt}`;
}

/**
 * OpenAI Images API で画像を1枚生成する
 * @param {OpenAI} client - OpenAI クライアント
 * @param {string} prompt - 画像生成プロンプト
 * @returns {Promise<Buffer>}
 */
async function generateImageBuffer(client, prompt) {
  const response = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
  });

  const imageBase64 = response.data?.[0]?.b64_json;

  if (!imageBase64) {
    throw new Error("OpenAI API から有効な画像データが返されませんでした。");
  }

  return Buffer.from(imageBase64, "base64");
}

/**
 * 対象スライド1枚を改善・再生成する
 * @param {object} options
 * @param {OpenAI} options.client
 * @param {number} options.number
 * @param {Array<{ fileName: string, type: string, content: string }>} options.slides
 * @param {object} options.review
 * @returns {Promise<void>}
 */
async function improveSlide({ client, number, slides, review }) {
  const slideKey = `slide${String(number).padStart(2, "0")}`;
  const slide = slides[number - 1];
  const slideReview = review.slides?.find((item) => item.number === number);

  if (!slideReview) {
    throw new Error(`${slideKey} のレビュー情報が image_review.json にありません。`);
  }

  const promptFile = path.join(
    CAROUSEL_GENERATED_DIR,
    getCarouselPromptFileName(number),
  );
  const outputFile = path.join(
    CAROUSEL_OUTPUT_DIR,
    getCarouselOutputImageFileName(number),
  );
  const backupFile = path.join(BACKUP_DIR, `${slideKey}-before-improve.png`);

  let promptFileContent;
  try {
    promptFileContent = await fs.readFile(promptFile, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        `画像生成プロンプトが見つかりません: images/carousel/generated-prompts/${getCarouselPromptFileName(number)}`,
      );
    }
    throw new Error(
      `${getCarouselPromptFileName(number)} の読み込みに失敗しました: ${error.message}`,
    );
  }

  const currentPrompt = extractPromptFromMarkdown(promptFileContent);
  if (!currentPrompt) {
    throw new Error(
      `images/carousel/generated-prompts/${getCarouselPromptFileName(number)} からプロンプトを抽出できませんでした。`,
    );
  }

  const improveInput = buildImproveInput({
    currentPrompt,
    slide,
    slideReview,
    globalImprovements: review.improvements ?? [],
  });

  const improvedPromptText = await generateWithRetry({
    contents: improveInput,
    systemInstruction: SYSTEM_PROMPT,
  });

  const improvedPrompt = improvedPromptText.trim();
  if (!improvedPrompt) {
    throw new Error(`${slideKey} の改善版プロンプトが空です。`);
  }

  await fs.mkdir(CAROUSEL_GENERATED_DIR, { recursive: true });
  await fs.writeFile(
    promptFile,
    buildFinalPrompt(improvedPrompt, slide.type),
    "utf-8",
  );

  try {
    await fs.access(outputFile);
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    await fs.copyFile(outputFile, backupFile);
    console.log(`Backed up: images/carousel/backup/${slideKey}-before-improve.png`);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw new Error(`${slideKey} のバックアップに失敗しました: ${error.message}`);
    }
  }

  let imageBuffer;
  try {
    imageBuffer = await generateImageBuffer(client, improvedPrompt);
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new Error(
        `OpenAI API エラー (${error.status}) [${slideKey}]: ${error.message}`,
      );
    }
    throw error;
  }

  await fs.mkdir(CAROUSEL_OUTPUT_DIR, { recursive: true });
  await fs.writeFile(outputFile, imageBuffer);

  console.log(`Regenerated: images/carousel/output/${getCarouselOutputImageFileName(number)}`);
  console.log(`Updated prompt: images/carousel/generated-prompts/${getCarouselPromptFileName(number)}`);
}

/**
 * メイン処理
 */
async function main() {
  const review = await loadReviewJson();

  if (!Array.isArray(review.failedItems)) {
    throw new Error("image_review.json に failedItems が含まれていません。");
  }

  if (review.failedItems.length === 0) {
    console.log("改善対象なし");
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY が .env に設定されていません。");
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const slides = await loadSlides(CAROUSEL_CONTENT_DIR);

  for (const slideKey of review.failedItems) {
    const number = parseSlideNumber(slideKey);
    console.log(`Improving ${slideKey}...`);
    await improveSlide({ client, number, slides, review });
  }

  console.log("Image improvement completed:");
  console.log("images/carousel/output/");
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
