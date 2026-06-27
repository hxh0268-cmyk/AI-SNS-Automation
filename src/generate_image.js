import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SLIDE_COUNT,
  carouselSlidesExist,
  getCarouselPromptFileName,
} from "./lib/carousel.js";

// プロジェクトルートを取得（このスクリプトは src/ 配下にある前提）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// 入出力ファイルのパス
const CAROUSEL_CONTENT_DIR = path.join(PROJECT_ROOT, "content/carousel");
const IMAGES_DIR = path.join(PROJECT_ROOT, "images");
const LEGACY_INPUT_FILE = path.join(IMAGES_DIR, "prompt.md");
const LEGACY_OUTPUT_FILE = path.join(IMAGES_DIR, "generated-image-prompt.md");
const CAROUSEL_PROMPTS_DIR = path.join(IMAGES_DIR, "carousel/prompts");
const CAROUSEL_GENERATED_DIR = path.join(
  IMAGES_DIR,
  "carousel/generated-prompts",
);

/**
 * 画像プロンプトから最終的な生成用プロンプトを組み立てる
 * @param {string} basePrompt - プロンプト本文
 * @param {string} [slideType] - スライド種別（カルーセル用）
 * @returns {string}
 */
function buildFinalPrompt(basePrompt, slideType) {
  const typeLine = slideType ? `- Slide type: ${slideType}\n` : "";

  return `# Image Generation Prompt

## Specifications

- Platform: Instagram
- Aspect ratio: 1:1 (square)
- Target audience: Restaurant managers and owners
- Style: Simple, clean, minimal text, AI-driven feel
- Design: Japanese-friendly aesthetic
${typeLine}
## Prompt

${basePrompt.trim()}
`;
}

/**
 * カルーセル用プロンプトを整形する
 * @returns {Promise<void>}
 */
async function generateCarouselPrompts() {
  await fs.mkdir(CAROUSEL_GENERATED_DIR, { recursive: true });

  for (let number = 1; number <= SLIDE_COUNT; number++) {
    const inputFile = path.join(
      CAROUSEL_PROMPTS_DIR,
      getCarouselPromptFileName(number),
    );
    const outputFile = path.join(
      CAROUSEL_GENERATED_DIR,
      getCarouselPromptFileName(number),
    );

    let promptContent;
    try {
      promptContent = await fs.readFile(inputFile, "utf-8");
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(
          `画像プロンプトが見つかりません: images/carousel/prompts/${getCarouselPromptFileName(number)}`,
        );
      }
      throw new Error(
        `${getCarouselPromptFileName(number)} の読み込みに失敗しました: ${error.message}`,
      );
    }

    if (!promptContent.trim()) {
      throw new Error(
        `images/carousel/prompts/${getCarouselPromptFileName(number)} が空です。`,
      );
    }

    try {
      await fs.writeFile(
        outputFile,
        buildFinalPrompt(promptContent),
        "utf-8",
      );
    } catch (error) {
      throw new Error(
        `images/carousel/generated-prompts/${getCarouselPromptFileName(number)} の保存に失敗しました: ${error.message}`,
      );
    }
  }

  console.log("Carousel image generation prompts saved:");
  console.log("images/carousel/generated-prompts/");
}

/**
 * 単一画像用プロンプトを整形する（レガシー互換）
 * @returns {Promise<void>}
 */
async function generateLegacyPrompt() {
  let promptContent;
  try {
    promptContent = await fs.readFile(LEGACY_INPUT_FILE, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("画像プロンプトが見つかりません: images/prompt.md");
    }
    throw new Error(
      `画像プロンプトの読み込みに失敗しました: ${error.message}`,
    );
  }

  if (!promptContent.trim()) {
    throw new Error("images/prompt.md が空です。");
  }

  await fs.mkdir(IMAGES_DIR, { recursive: true });

  try {
    await fs.writeFile(
      LEGACY_OUTPUT_FILE,
      buildFinalPrompt(promptContent),
      "utf-8",
    );
  } catch (error) {
    throw new Error(
      `最終プロンプトの保存に失敗しました: ${error.message}`,
    );
  }

  console.log("Image generation prompt saved:");
  console.log("images/generated-image-prompt.md");
}

/**
 * メイン処理
 */
async function main() {
  const useCarousel = await carouselSlidesExist(CAROUSEL_CONTENT_DIR);

  if (useCarousel) {
    await generateCarouselPrompts();
    return;
  }

  await generateLegacyPrompt();
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
