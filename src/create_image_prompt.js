import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

// プロジェクトルートを取得（このスクリプトは src/ 配下にある前提）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// 入出力ファイルのパス
const REVIEWED_FILE = path.join(PROJECT_ROOT, "content/reviewed/post.md");
const IMAGES_DIR = path.join(PROJECT_ROOT, "images");
const OUTPUT_FILE = path.join(IMAGES_DIR, "prompt.md");

// Gemini に与える画像プロンプト生成用の指示
const SYSTEM_PROMPT = `あなたはSNSビジュアルデザイナー兼Instagramクリエイターです。

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
 * メイン処理
 */
async function main() {
  // APIキーの存在確認
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY が .env に設定されていません。");
  }

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

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  // Gemini でInstagram画像生成用プロンプトを作成
  let imagePrompt;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: reviewedContent,
      config: {
        systemInstruction: SYSTEM_PROMPT,
      },
    });

    imagePrompt = response.text;

    if (!imagePrompt?.trim()) {
      throw new Error("Gemini API から有効なレスポンスが返されませんでした。");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini API エラー: ${message}`);
  }

  // images/ が存在しなければ作成
  await fs.mkdir(IMAGES_DIR, { recursive: true });

  // 画像プロンプトを保存
  try {
    await fs.writeFile(OUTPUT_FILE, imagePrompt, "utf-8");
  } catch (error) {
    throw new Error(`画像プロンプトの保存に失敗しました: ${error.message}`);
  }

  console.log("Image prompt created: images/prompt.md");
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
