import { GoogleGenAI, ApiError } from "@google/genai";
import {
  buildCacheHash,
  isForceAi,
  readGeminiCache,
  writeGeminiCache,
} from "./gemini_cache.js";

// デフォルトモデル
export const DEFAULT_MODEL = "gemini-2.5-flash";

// クォータ超過エラーの識別子（run_daily.sh でも参照）
export const GEMINI_QUOTA_EXCEEDED_CODE = "GEMINI_QUOTA_EXCEEDED";

// リトライ設定（最大3回試行、失敗後の待機秒数）
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS = [30, 60];

/**
 * Gemini 共通ログを出力する
 * @param {string} message - ログメッセージ
 */
function logGemini(message) {
  console.log(`[Gemini] ${message}`);
}

/**
 * 指定秒数待機する
 * @param {number} seconds - 待機秒数
 * @returns {Promise<void>}
 */
function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

/**
 * クォータ超過エラーかどうかを判定する
 * @param {unknown} error - 発生したエラー
 * @returns {boolean}
 */
function isQuotaExceededError(error) {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof ApiError && error.status === 429) {
    return true;
  }

  const quotaPatterns = [
    "429",
    "quota exceeded",
    "RESOURCE_EXHAUSTED",
    "GenerateRequestsPerDay",
  ];
  return quotaPatterns.some((pattern) => message.includes(pattern));
}

/**
 * リトライ対象のエラーかどうかを判定する
 * @param {unknown} error - 発生したエラー
 * @returns {boolean}
 */
function isRetryableError(error) {
  if (isQuotaExceededError(error)) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof ApiError && error.status === 503) {
    return true;
  }

  const retryablePatterns = ["503", "UNAVAILABLE", "RATE_LIMIT_EXCEEDED"];
  return retryablePatterns.some((pattern) => message.includes(pattern));
}

/**
 * Gemini クライアントを初期化する
 * @returns {GoogleGenAI}
 */
export function createGeminiClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY が .env に設定されていません。");
  }

  logGemini("クライアントを初期化しました");

  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
}

/**
 * Gemini API でコンテンツを生成する（503等のエラー時はリトライ）
 * @param {object} options - 生成オプション
 * @param {string | import('@google/genai').Part[] | import('@google/genai').Content[]} options.contents - 入力（テキストまたはマルチモーダル）
 * @param {string} [options.systemInstruction] - システムプロンプト
 * @param {string} [options.model] - 使用モデル
 * @param {string} [options.cacheKey] - キャッシュ種別
 * @param {string[]} [options.cacheInputFiles] - キャッシュ用入力ファイルの絶対パス
 * @returns {Promise<string>}
 */
export async function generateWithRetry({
  contents,
  systemInstruction,
  model = DEFAULT_MODEL,
  cacheKey,
  cacheInputFiles,
}) {
  if (cacheKey && cacheInputFiles?.length && !isForceAi()) {
    const hash = await buildCacheHash({
      cacheKey,
      inputFiles: cacheInputFiles,
      systemInstruction,
      model,
    });
    const cached = await readGeminiCache(cacheKey, hash);

    if (cached) {
      logGemini("Geminiキャッシュを使用");
      return cached;
    }

    const response = await generateWithRetryInternal({
      contents,
      systemInstruction,
      model,
    });
    await writeGeminiCache(cacheKey, hash, response);
    return response;
  }

  return generateWithRetryInternal({
    contents,
    systemInstruction,
    model,
  });
}

/**
 * Gemini API を直接呼び出す（キャッシュなし）
 * @param {object} options - 生成オプション
 * @returns {Promise<string>}
 */
async function generateWithRetryInternal({
  contents,
  systemInstruction,
  model = DEFAULT_MODEL,
}) {
  const ai = createGeminiClient();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      logGemini(`生成を開始します（試行 ${attempt}/${MAX_ATTEMPTS}）`);

      const response = await ai.models.generateContent({
        model,
        contents,
        config: systemInstruction ? { systemInstruction } : {},
      });

      const text = response.text;

      if (!text?.trim()) {
        throw new Error("Gemini API から有効なレスポンスが返されませんでした。");
      }

      logGemini("生成が完了しました");
      return text;
    } catch (error) {
      if (isQuotaExceededError(error)) {
        logGemini("Gemini APIクォータ上限に到達しました");
        throw new Error(GEMINI_QUOTA_EXCEEDED_CODE);
      }

      const isLastAttempt = attempt === MAX_ATTEMPTS;

      // リトライ対象外、または最大試行回数に達した場合はエラーを送出
      if (!isRetryableError(error) || isLastAttempt) {
        const message = error instanceof Error ? error.message : String(error);
        logGemini(`エラー: ${message}`);
        throw new Error(`Gemini API エラー: ${message}`);
      }

      // 待機してからリトライ
      const delay = RETRY_DELAYS[attempt - 1];
      logGemini(`Retry ${attempt}/${MAX_ATTEMPTS} in ${delay} seconds...`);
      await sleep(delay);
    }
  }

  throw new Error("Gemini API エラー: リトライ上限に達しました。");
}
