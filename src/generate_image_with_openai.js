import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

// プロジェクトルートを取得（このスクリプトは src/ 配下にある前提）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// 入出力ファイルのパス
const IMAGES_DIR = path.join(PROJECT_ROOT, "images");
const INPUT_FILE = path.join(IMAGES_DIR, "generated-image-prompt.md");
const OUTPUT_FILE = path.join(IMAGES_DIR, "post.png");

/**
 * Markdownファイルから画像生成用プロンプト本文を抽出する
 * @param {string} content - generated-image-prompt.md の内容
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
 * メイン処理
 */
async function main() {
  // APIキーの存在確認
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY が .env に設定されていません。");
  }

  // 画像生成用プロンプトを読み込む
  let promptFileContent;
  try {
    promptFileContent = await fs.readFile(INPUT_FILE, "utf-8");
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

  if (!promptFileContent.trim()) {
    throw new Error("images/generated-image-prompt.md が空です。");
  }

  const prompt = extractPromptFromMarkdown(promptFileContent);

  if (!prompt) {
    throw new Error("画像生成用プロンプト本文を抽出できませんでした。");
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // OpenAI Images API で画像を生成
  let imageBase64;
  try {
    const response = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    });

    imageBase64 = response.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error("OpenAI API から有効な画像データが返されませんでした。");
    }
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new Error(`OpenAI API エラー (${error.status}): ${error.message}`);
    }
    throw error;
  }

  // images/ が存在しなければ作成
  await fs.mkdir(IMAGES_DIR, { recursive: true });

  // 生成画像を保存
  try {
    await fs.writeFile(OUTPUT_FILE, Buffer.from(imageBase64, "base64"));
  } catch (error) {
    throw new Error(`画像の保存に失敗しました: ${error.message}`);
  }

  console.log("Image generated: images/post.png");
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
