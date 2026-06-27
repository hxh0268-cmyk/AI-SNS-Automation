import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import {
  SLIDE_COUNT,
  carouselSlidesExist,
  getCarouselOutputImageFileName,
  getCarouselPromptFileName,
} from "./lib/carousel.js";

// プロジェクトルートを取得（このスクリプトは src/ 配下にある前提）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// 入出力ファイルのパス
const CAROUSEL_CONTENT_DIR = path.join(PROJECT_ROOT, "content/carousel");
const IMAGES_DIR = path.join(PROJECT_ROOT, "images");
const LEGACY_INPUT_FILE = path.join(IMAGES_DIR, "generated-image-prompt.md");
const LEGACY_OUTPUT_FILE = path.join(IMAGES_DIR, "post.png");
const CAROUSEL_GENERATED_DIR = path.join(
  IMAGES_DIR,
  "carousel/generated-prompts",
);
const CAROUSEL_OUTPUT_DIR = path.join(IMAGES_DIR, "carousel/output");

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
 * カルーセル用画像を5枚生成する
 * @param {OpenAI} client - OpenAI クライアント
 * @returns {Promise<void>}
 */
async function generateCarouselImages(client) {
  await fs.mkdir(CAROUSEL_OUTPUT_DIR, { recursive: true });

  for (let number = 1; number <= SLIDE_COUNT; number++) {
    const inputFile = path.join(
      CAROUSEL_GENERATED_DIR,
      getCarouselPromptFileName(number),
    );
    const outputFile = path.join(
      CAROUSEL_OUTPUT_DIR,
      getCarouselOutputImageFileName(number),
    );

    let promptFileContent;
    try {
      promptFileContent = await fs.readFile(inputFile, "utf-8");
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

    const prompt = extractPromptFromMarkdown(promptFileContent);

    if (!prompt) {
      throw new Error(
        `images/carousel/generated-prompts/${getCarouselPromptFileName(number)} からプロンプトを抽出できませんでした。`,
      );
    }

    try {
      const imageBuffer = await generateImageBuffer(client, prompt);
      await fs.writeFile(outputFile, imageBuffer);
      console.log(
        `Generated: images/carousel/output/${getCarouselOutputImageFileName(number)}`,
      );
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(
          `OpenAI API エラー (${error.status}) [slide${String(number).padStart(2, "0")}]: ${error.message}`,
        );
      }
      throw new Error(
        `images/carousel/output/${getCarouselOutputImageFileName(number)} の保存に失敗しました: ${error.message}`,
      );
    }
  }

  console.log("Carousel images generated:");
  console.log("images/carousel/output/");
}

/**
 * 単一画像を生成する（レガシー互換）
 * @param {OpenAI} client - OpenAI クライアント
 * @returns {Promise<void>}
 */
async function generateLegacyImage(client) {
  let promptFileContent;
  try {
    promptFileContent = await fs.readFile(LEGACY_INPUT_FILE, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "画像生成プロンプトが見つかりません: images/generated-image-prompt.md",
      );
    }
    throw new Error(
      `画像生成プロンプトの読み込みに失敗しました: ${error.message}`,
    );
  }

  const prompt = extractPromptFromMarkdown(promptFileContent);

  if (!prompt) {
    throw new Error("画像生成用プロンプト本文を抽出できませんでした。");
  }

  try {
    const imageBuffer = await generateImageBuffer(client, prompt);
    await fs.mkdir(IMAGES_DIR, { recursive: true });
    await fs.writeFile(LEGACY_OUTPUT_FILE, imageBuffer);
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new Error(`OpenAI API エラー (${error.status}): ${error.message}`);
    }
    throw error;
  }

  console.log("Image generated: images/post.png");
}

/**
 * メイン処理
 */
async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY が .env に設定されていません。");
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const useCarousel = await carouselSlidesExist(CAROUSEL_CONTENT_DIR);

  if (useCarousel) {
    await generateCarouselImages(client);
    return;
  }

  await generateLegacyImage(client);
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
