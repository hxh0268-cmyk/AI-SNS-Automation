import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// プロジェクトルートを取得（このスクリプトは src/ 配下にある前提）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// 入出力ファイルのパス
const IMAGES_DIR = path.join(PROJECT_ROOT, "images");
const INPUT_FILE = path.join(IMAGES_DIR, "prompt.md");
const OUTPUT_FILE = path.join(IMAGES_DIR, "generated-image-prompt.md");

/**
 * 画像プロンプトから最終的な生成用プロンプトを組み立てる
 * @param {string} basePrompt - images/prompt.md の内容
 * @returns {string}
 */
function buildFinalPrompt(basePrompt) {
  return `# Image Generation Prompt

## Specifications

- Platform: Instagram
- Aspect ratio: 1:1 (square)
- Target audience: Restaurant managers and owners
- Style: Simple, clean, minimal text, AI-driven feel
- Design: Japanese-friendly aesthetic

## Prompt

${basePrompt.trim()}
`;
}

/**
 * メイン処理
 */
async function main() {
  // 画像プロンプトを読み込む
  let promptContent;
  try {
    promptContent = await fs.readFile(INPUT_FILE, "utf-8");
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

  // 画像生成用の最終プロンプトを作成
  const finalPrompt = buildFinalPrompt(promptContent);

  // images/ が存在しなければ作成
  await fs.mkdir(IMAGES_DIR, { recursive: true });

  // 最終プロンプトを保存
  try {
    await fs.writeFile(OUTPUT_FILE, finalPrompt, "utf-8");
  } catch (error) {
    throw new Error(
      `最終プロンプトの保存に失敗しました: ${error.message}`,
    );
  }

  console.log("Image generation prompt saved:");
  console.log("images/generated-image-prompt.md");
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
