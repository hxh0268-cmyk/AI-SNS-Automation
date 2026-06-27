import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPartFromBase64, createPartFromText } from "@google/genai";
import { generateWithRetry } from "./lib/gemini.js";
import { extractJsonFromText } from "./lib/json.js";
import {
  SLIDE_COUNT,
  SLIDE_FILES,
  SLIDE_TYPES,
  getCarouselOutputImageFileName,
  loadSlides,
} from "./lib/carousel.js";

// プロジェクトルートを取得（このスクリプトは src/ 配下にある前提）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// 入出力ファイルのパス
const CAROUSEL_CONTENT_DIR = path.join(PROJECT_ROOT, "content/carousel");
const IMAGE_OUTPUT_DIR = path.join(PROJECT_ROOT, "images/carousel/output");
const REVIEW_DIR = path.join(PROJECT_ROOT, "images/carousel/review");
const REVIEW_JSON_FILE = path.join(REVIEW_DIR, "image_review.json");
const REVIEW_MD_FILE = path.join(REVIEW_DIR, "image_review.md");

// 画像レビュー合格基準点
const PASSING_SCORE = 80;

// Gemini に与える画像レビュー用の指示
const SYSTEM_PROMPT = `あなたはSNSビジュアルデザイナー兼Instagram編集長です。

OpenAI Images APIで生成されたInstagramカルーセル画像5枚を、100点満点で採点・レビューしてください。

【レビュー項目】
- 誤字・脱字
- 日本語の自然さ
- テキストの見切れ
- 可読性
- 配色
- ブランドデザインの統一
- アイコンやイラストの適切さ
- CTAの視認性

【評価の観点】
- 飲食店オーナー・店長向けInstagramカルーセルとして適切か
- 1枚1メッセージが視覚的に伝わるか
- 5枚全体のデザイン統一感があるか
- スマホ画面で3秒で読めるか
- 保存したくなるビジュアルか

【採点基準】
- 各スライドを100点満点で採点
- 80点未満のスライドは改善対象

【出力形式】
必ず以下のJSON形式のみで出力してください。説明文は不要です。

{
  "score": 86,
  "slides": [
    {
      "number": 1,
      "fileName": "slide01.png",
      "type": "表紙",
      "score": 85,
      "strengths": ["良い点1"],
      "improvements": ["改善点1"]
    }
  ],
  "strengths": ["全体の良い点1"],
  "improvements": ["全体の改善点1"]
}`;

/**
 * 生成画像ファイルを読み込む
 * @returns {Promise<Array<{ number: number, fileName: string, type: string, base64: string }>>}
 */
async function loadGeneratedImages() {
  const images = [];

  for (let number = 1; number <= SLIDE_COUNT; number++) {
    const fileName = getCarouselOutputImageFileName(number);
    const filePath = path.join(IMAGE_OUTPUT_DIR, fileName);

    try {
      const buffer = await fs.readFile(filePath);
      images.push({
        number,
        fileName,
        type: SLIDE_TYPES[number - 1],
        base64: buffer.toString("base64"),
      });
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(
          `生成画像が見つかりません: images/carousel/output/${fileName}`,
        );
      }
      throw new Error(`${fileName} の読み込みに失敗しました: ${error.message}`);
    }
  }

  return images;
}

/**
 * Gemini に渡すレビュー入力を組み立てる
 * @param {Array<{ number: number, fileName: string, type: string, content: string }>} slides
 * @param {Array<{ number: number, fileName: string, type: string, base64: string }>} images
 * @returns {import('@google/genai').Part[]}
 */
function buildReviewInput(slides, images) {
  const parts = [
    createPartFromText(`以下の5枚のInstagramカルーセル画像をレビューしてください。

【各スライドの想定テキスト】
${slides
  .map(
    (slide) =>
      `- ${slide.fileName}（${slide.type}）: ${slide.content}`,
  )
  .join("\n")}

【添付画像】
${images.map((image) => `- 画像${image.number}: ${image.fileName}（${image.type}）`).join("\n")}
`),
  ];

  for (const image of images) {
    parts.push(
      createPartFromText(`--- ${image.fileName}（${image.type}）---`),
    );
    parts.push(createPartFromBase64(image.base64, "image/png"));
  }

  return parts;
}

/**
 * 画像レビュー JSON を正規化する
 * @param {unknown} data - パース済みJSON
 * @returns {object}
 */
function normalizeReviewData(data) {
  if (!Array.isArray(data?.slides) || data.slides.length !== SLIDE_COUNT) {
    throw new Error("image_review.json の slides が5枚分取得できませんでした。");
  }

  const slides = data.slides.map((slide, index) => {
    const expectedNumber = index + 1;
    const score = Number(slide?.score);

    if (Number.isNaN(score)) {
      throw new Error(`slide${String(expectedNumber).padStart(2, "0")} の score が不正です。`);
    }

    return {
      number: expectedNumber,
      fileName: slide.fileName ?? getCarouselOutputImageFileName(expectedNumber),
      type: slide.type ?? SLIDE_TYPES[index],
      score,
      strengths: Array.isArray(slide.strengths)
        ? slide.strengths.map(String)
        : [],
      improvements: Array.isArray(slide.improvements)
        ? slide.improvements.map(String)
        : [],
    };
  });

  const failedItems = slides
    .filter((slide) => slide.score < PASSING_SCORE)
    .map((slide) => slide.fileName.replace(".png", ""));

  const averageScore = Math.round(
    slides.reduce((sum, slide) => sum + slide.score, 0) / slides.length,
  );
  const passed = failedItems.length === 0;

  return {
    score: Number(data?.score) || averageScore,
    passed,
    slides,
    failedItems,
    strengths: Array.isArray(data?.strengths)
      ? data.strengths.map(String)
      : [],
    improvements: Array.isArray(data?.improvements)
      ? data.improvements.map(String)
      : [],
    status: passed ? "合格" : "改善が必要",
    passingScore: PASSING_SCORE,
  };
}

/**
 * image_review.json から image_review.md を生成する
 * @param {object} review - 正規化済みレビューデータ
 * @returns {string}
 */
function buildReviewMarkdown(review) {
  const slideLines = review.slides
    .map((slide) => {
      const status = slide.score >= PASSING_SCORE ? "合格" : "改善が必要";
      const strengths =
        slide.strengths.length > 0
          ? slide.strengths.map((item) => `  - ${item}`).join("\n")
          : "  - なし";
      const improvements =
        slide.improvements.length > 0
          ? slide.improvements.map((item) => `  - ${item}`).join("\n")
          : "  - なし";

      return `### ${slide.fileName}（${slide.type}）
- 点数：${slide.score} / 100点
- 判定：${status}
- 良い点：
${strengths}
- 改善点：
${improvements}`;
    })
    .join("\n\n");

  const failedItemsLines =
    review.failedItems.length > 0
      ? review.failedItems.map((item) => `- ${item}`).join("\n")
      : "- なし";

  const strengthsLines =
    review.strengths.length > 0
      ? review.strengths.map((item) => `- ${item}`).join("\n")
      : "- なし";

  const improvementsLines =
    review.improvements.length > 0
      ? review.improvements.map((item) => `- ${item}`).join("\n")
      : "- なし";

  return `# カルーセル画像レビュー

## 総合点
${review.score} / 100点

## 判定
${review.status}

## 改善対象（80点未満）
${failedItemsLines}

## 各スライドの採点
${slideLines}

## 全体の良い点
${strengthsLines}

## 全体の改善点
${improvementsLines}
`;
}

/**
 * メイン処理
 */
async function main() {
  const slides = await loadSlides(CAROUSEL_CONTENT_DIR);
  const images = await loadGeneratedImages();
  const reviewInput = buildReviewInput(slides, images);
  const cacheInputFiles = [
    ...SLIDE_FILES.map((fileName) =>
      path.join(CAROUSEL_CONTENT_DIR, fileName),
    ),
    ...Array.from({ length: SLIDE_COUNT }, (_, index) =>
      path.join(
        IMAGE_OUTPUT_DIR,
        getCarouselOutputImageFileName(index + 1),
      ),
    ),
  ];

  const responseText = await generateWithRetry({
    contents: reviewInput,
    systemInstruction: SYSTEM_PROMPT,
    cacheKey: "image-review",
    cacheInputFiles,
  });

  let parsed;
  try {
    parsed = extractJsonFromText(responseText);
  } catch {
    throw new Error("Gemini API のレスポンスをJSONとして解析できませんでした。");
  }

  const review = normalizeReviewData(parsed);

  await fs.mkdir(REVIEW_DIR, { recursive: true });

  try {
    await fs.writeFile(
      REVIEW_JSON_FILE,
      `${JSON.stringify(review, null, 2)}\n`,
      "utf-8",
    );
    await fs.writeFile(REVIEW_MD_FILE, `${buildReviewMarkdown(review)}\n`, "utf-8");
  } catch (error) {
    throw new Error(`レビュー結果の保存に失敗しました: ${error.message}`);
  }

  console.log("Image review completed:");
  console.log("images/carousel/review/image_review.json");
  console.log("images/carousel/review/image_review.md");
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
