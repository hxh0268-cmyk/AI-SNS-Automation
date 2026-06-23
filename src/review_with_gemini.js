import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, ApiError } from "@google/genai";

// プロジェクトルートを取得（このスクリプトは src/ 配下にある前提）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// 入出力ファイルのパス
const DRAFT_FILE = path.join(PROJECT_ROOT, "content/draft/post.md");
const REVIEWED_DIR = path.join(PROJECT_ROOT, "content/reviewed");
const REVIEWED_FILE = path.join(REVIEWED_DIR, "post.md");

// リトライ設定（最大3回試行、失敗後の待機秒数）
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS = [30, 60];

// Gemini に与えるレビュー用プロンプト
const SYSTEM_PROMPT = `あなたはSNSマーケター兼編集長です。

以下を改善してください。

- PREP法に沿って構成を整理
- 読みやすさを向上
- CTAを強化
- 保存率・コメント率・シェア率を高める
- ハッシュタグを最適化
- Markdown形式で出力`;

/**
 * 指定秒数待機する
 * @param {number} seconds - 待機秒数
 * @returns {Promise<void>}
 */
function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

/**
 * リトライ対象のエラーかどうかを判定する
 * @param {unknown} error - 発生したエラー
 * @returns {boolean}
 */
function isRetryableError(error) {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof ApiError && error.status === 503) {
    return true;
  }

  const retryablePatterns = ["503", "UNAVAILABLE", "RATE_LIMIT_EXCEEDED"];
  return retryablePatterns.some((pattern) => message.includes(pattern));
}

/**
 * Gemini API でレビュー・改善を実行する（503等のエラー時はリトライ）
 * @param {GoogleGenAI} ai - Gemini クライアント
 * @param {string} draftContent - 下書き投稿
 * @returns {Promise<string>}
 */
async function generateReviewWithRetry(ai, draftContent) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: draftContent,
        config: {
          systemInstruction: SYSTEM_PROMPT,
        },
      });

      const reviewedContent = response.text;

      if (!reviewedContent?.trim()) {
        throw new Error("Gemini API から有効なレスポンスが返されませんでした。");
      }

      return reviewedContent;
    } catch (error) {
      const isLastAttempt = attempt === MAX_ATTEMPTS;

      // リトライ対象外、または最大試行回数に達した場合はエラーを送出
      if (!isRetryableError(error) || isLastAttempt) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Gemini API エラー: ${message}`);
      }

      // 待機してからリトライ
      const delay = RETRY_DELAYS[attempt - 1];
      console.log(`Retry ${attempt}/${MAX_ATTEMPTS} in ${delay} seconds...`);
      await sleep(delay);
    }
  }

  throw new Error("Gemini API エラー: リトライ上限に達しました。");
}

/**
 * メイン処理
 */
async function main() {
  // APIキーの存在確認
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY が .env に設定されていません。");
  }

  // 下書き投稿を読み込む
  let draftContent;
  try {
    draftContent = await fs.readFile(DRAFT_FILE, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("下書きファイルが見つかりません: content/draft/post.md");
    }
    throw new Error(`下書きファイルの読み込みに失敗しました: ${error.message}`);
  }

  if (!draftContent.trim()) {
    throw new Error("下書きファイルが空です。");
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  // Gemini でレビュー・改善（503等のエラー時は最大3回までリトライ）
  const reviewedContent = await generateReviewWithRetry(ai, draftContent);

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
