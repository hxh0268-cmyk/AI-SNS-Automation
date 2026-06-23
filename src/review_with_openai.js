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
const DRAFT_FILE = path.join(PROJECT_ROOT, "content/draft/post.md");
const REVIEWED_DIR = path.join(PROJECT_ROOT, "content/reviewed");
const REVIEWED_FILE = path.join(REVIEWED_DIR, "post.md");

// ChatGPT に与えるレビュー用プロンプト
const SYSTEM_PROMPT = `あなたはSNSマーケター兼編集長です。
文章を読みやすく改善し、
PREP法・CTA・保存率が上がる構成に修正してください。
Markdown形式で出力してください。`;

/**
 * メイン処理
 */
async function main() {
  // APIキーの存在確認
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY が .env に設定されていません。");
  }

  // 下書き投稿を読み込む
  let draftContent;
  try {
    draftContent = await fs.readFile(DRAFT_FILE, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`下書きファイルが見つかりません: content/draft/post.md`);
    }
    throw new Error(`下書きファイルの読み込みに失敗しました: ${error.message}`);
  }

  if (!draftContent.trim()) {
    throw new Error("下書きファイルが空です。");
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // ChatGPT でレビュー・改善
  let reviewedContent;
  try {
    const response = await client.responses.create({
      model: "gpt-4o",
      instructions: SYSTEM_PROMPT,
      input: draftContent,
    });

    reviewedContent = response.output_text;

    if (!reviewedContent?.trim()) {
      throw new Error("OpenAI API から有効なレスポンスが返されませんでした。");
    }
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new Error(`OpenAI API エラー (${error.status}): ${error.message}`);
    }
    throw error;
  }

  // 出力先ディレクトリが存在しなければ作成
  await fs.mkdir(REVIEWED_DIR, { recursive: true });

  // レビュー結果を保存
  try {
    await fs.writeFile(REVIEWED_FILE, reviewedContent, "utf-8");
  } catch (error) {
    throw new Error(`レビュー結果の保存に失敗しました: ${error.message}`);
  }

  console.log("Review completed: content/reviewed/post.md");
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
