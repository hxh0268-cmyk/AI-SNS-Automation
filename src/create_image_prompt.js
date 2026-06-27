import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateWithRetry } from "./lib/gemini.js";
import { extractJsonFromText } from "./lib/json.js";
import {
  SLIDE_COUNT,
  SLIDE_FILES,
  SLIDE_TYPES,
  carouselSlidesExist,
  getCarouselPromptFileName,
  loadSlides,
} from "./lib/carousel.js";

// プロジェクトルートを取得（このスクリプトは src/ 配下にある前提）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// 入出力ファイルのパス
const REVIEWED_FILE = path.join(PROJECT_ROOT, "content/reviewed/post.md");
const CAROUSEL_CONTENT_DIR = path.join(PROJECT_ROOT, "content/carousel");
const IMAGES_DIR = path.join(PROJECT_ROOT, "images");
const LEGACY_PROMPT_FILE = path.join(IMAGES_DIR, "prompt.md");
const CAROUSEL_PROMPTS_DIR = path.join(
  IMAGES_DIR,
  "carousel/prompts",
);

// カルーセル用 Gemini 指示
const CAROUSEL_SYSTEM_PROMPT = `あなたはSNSビジュアルデザイナー兼Instagramクリエイターです。

5枚構成のInstagramカルーセル各スライド向けに、画像生成AI用プロンプトを1枚ずつ作成してください。

【画像プロンプトの条件】
- Instagramカルーセル投稿用
- 1:1正方形画像
- 飲食店店長・オーナー向け
- シンプルで清潔感がある
- スライドに載せる日本語テキストを画像内に大きく配置
- AI活用感のあるモダンなデザイン
- 日本語デザイン向け
- 各スライドの役割（表紙・共感・失敗例・成功例・CTA）に合ったビジュアル

【出力形式】
必ず以下のJSON形式のみで出力してください。説明文は不要です。

{
  "prompts": [
    { "number": 1, "type": "表紙", "content": "..." },
    { "number": 2, "type": "共感", "content": "..." },
    { "number": 3, "type": "失敗例", "content": "..." },
    { "number": 4, "type": "成功例", "content": "..." },
    { "number": 5, "type": "CTA", "content": "..." }
  ]
}

各 content は画像生成AIにそのまま渡せるプロンプト本文のみを記載してください。`;

// 単一画像用 Gemini 指示（レガシー互換）
const LEGACY_SYSTEM_PROMPT = `あなたはSNSビジュアルデザイナー兼Instagramクリエイターです。

レビュー済みのInstagram投稿をもとに、画像生成AI向けのプロンプトを1つ作成してください。

【画像プロンプトの条件】
- Instagram投稿用
- 1:1正方形画像
- 飲食店店長向け
- シンプル
- 文字は少なめ
- AI活用感がある
- 清潔感がある
- 日本語デザイン向け

【出力形式】
Markdown形式で、画像生成AIにそのまま渡せるプロンプト本文のみを出力してください。
説明文や前置きは不要です。`;

/**
 * Gemini に渡すカルーセル入力テキストを組み立てる
 * @param {Array<{ fileName: string, type: string, content: string }>} slides
 * @returns {string}
 */
function buildCarouselInput(slides) {
  return slides
    .map(
      (slide) =>
        `### ${slide.fileName}（${slide.type}）\nスライド文言: ${slide.content}`,
    )
    .join("\n\n");
}

/**
 * カルーセル用プロンプト JSON を検証する
 * @param {unknown} data - パース済みJSON
 * @returns {Array<{ number: number, type: string, content: string }>}
 */
function validateCarouselPrompts(data) {
  if (!Array.isArray(data?.prompts) || data.prompts.length !== SLIDE_COUNT) {
    throw new Error("画像プロンプトが5枚分取得できませんでした。");
  }

  return data.prompts.map((prompt, index) => {
    const expectedNumber = index + 1;
    const content = prompt?.content?.trim() ?? "";

    if (!content) {
      throw new Error(`prompt${String(expectedNumber).padStart(2, "0")} が空です。`);
    }

    return {
      number: expectedNumber,
      type: prompt.type ?? SLIDE_TYPES[index],
      content,
    };
  });
}

/**
 * カルーセル用画像プロンプトを生成する
 * @returns {Promise<void>}
 */
async function createCarouselImagePrompts() {
  const slides = await loadSlides(CAROUSEL_CONTENT_DIR);
  const cacheInputFiles = SLIDE_FILES.map((fileName) =>
    path.join(CAROUSEL_CONTENT_DIR, fileName),
  );
  const responseText = await generateWithRetry({
    contents: buildCarouselInput(slides),
    systemInstruction: CAROUSEL_SYSTEM_PROMPT,
    cacheKey: "image-prompt",
    cacheInputFiles,
  });

  let parsed;
  try {
    parsed = extractJsonFromText(responseText);
  } catch {
    throw new Error("Gemini API のレスポンスをJSONとして解析できませんでした。");
  }

  const prompts = validateCarouselPrompts(parsed);

  await fs.mkdir(CAROUSEL_PROMPTS_DIR, { recursive: true });

  for (const prompt of prompts) {
    const filePath = path.join(
      CAROUSEL_PROMPTS_DIR,
      getCarouselPromptFileName(prompt.number),
    );

    try {
      await fs.writeFile(filePath, `${prompt.content}\n`, "utf-8");
    } catch (error) {
      throw new Error(
        `images/carousel/prompts/${getCarouselPromptFileName(prompt.number)} の保存に失敗しました: ${error.message}`,
      );
    }
  }

  console.log("Carousel image prompts created:");
  console.log("images/carousel/prompts/");
}

/**
 * 単一画像用プロンプトを生成する（レガシー互換）
 * @returns {Promise<void>}
 */
async function createLegacyImagePrompt() {
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

  const imagePrompt = await generateWithRetry({
    contents: reviewedContent,
    systemInstruction: LEGACY_SYSTEM_PROMPT,
  });

  await fs.mkdir(IMAGES_DIR, { recursive: true });

  try {
    await fs.writeFile(LEGACY_PROMPT_FILE, imagePrompt, "utf-8");
  } catch (error) {
    throw new Error(`画像プロンプトの保存に失敗しました: ${error.message}`);
  }

  console.log("Image prompt created: images/prompt.md");
}

/**
 * メイン処理
 */
async function main() {
  const useCarousel = await carouselSlidesExist(CAROUSEL_CONTENT_DIR);

  if (useCarousel) {
    await createCarouselImagePrompts();
    return;
  }

  await createLegacyImagePrompt();
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
