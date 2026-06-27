import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ApiError,
  GoogleGenAI,
  Modality,
  createPartFromBase64,
  createPartFromText,
} from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** プロジェクトルート（src/lib/ 配下の前提） */
export const PROJECT_ROOT = path.resolve(__dirname, "../..");

/** Nano Banana デフォルトモデル（Gemini 2.5 Flash Image） */
export const DEFAULT_NANO_BANANA_MODEL = "gemini-2.5-flash-image";

/** 改善画像の保存先（プロジェクトルートからの相対パス） */
export const IMPROVED_OUTPUT_DIR = "output/carousel/improved";

/** API 呼び出しのデフォルトタイムアウト（ミリ秒） */
export const DEFAULT_TIMEOUT_MS = 60_000;

/** 最大試行回数のデフォルト */
export const DEFAULT_RETRY = 3;

/** リトライ対象 HTTP ステータス */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/** limit:0 クォータエラー時の案内文 */
const QUOTA_LIMIT_ZERO_GUIDANCE =
  "Gemini API の課金設定または画像モデルのクォータを確認してください。";

/**
 * @typedef {object} NanoBananaApiResult
 * @property {boolean} success
 * @property {Buffer | null} [imageBuffer]
 * @property {string | null} [mimeType]
 * @property {string | null} [error]
 * @property {string | null} [model]
 * @property {number} [attempts]
 * @property {number} [timeoutMs]
 * @property {number} [retry]
 */

/**
 * @typedef {object} ImproveImageResult
 * @property {boolean} success
 * @property {boolean} dryRun
 * @property {string} sourceImagePath
 * @property {string} outputPath
 * @property {string} prompt
 * @property {string | null} [error]
 * @property {string | null} [plannedAction]
 * @property {string | null} [model]
 * @property {number} elapsedMs
 * @property {number} attempts
 * @property {number} timeoutMs
 * @property {number} retry
 */

/**
 * Nano Banana 共通ログを出力する
 * @param {string} message
 */
function logNanoBanana(message) {
  console.log(`[NanoBanana] ${message}`);
}

/**
 * 指定ミリ秒待機する
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * リトライ前の指数バックオフ待機時間を計算する
 * @param {number} attempt - 1 始まりの試行番号
 * @returns {number}
 */
function getRetryBackoffMs(attempt) {
  return 1000 * 2 ** (attempt - 2);
}

/**
 * API キーを取得する
 * @returns {{ ok: true, apiKey: string } | { ok: false, error: string }}
 */
export function resolveNanoBananaApiKey() {
  const apiKey =
    process.env.NANO_BANANA_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return {
      ok: false,
      error:
        "NANO_BANANA_API_KEY（または GEMINI_API_KEY）が .env に設定されていません。",
    };
  }

  return { ok: true, apiKey };
}

/**
 * 使用する Nano Banana モデル名を取得する
 * @returns {string}
 */
export function resolveNanoBananaModel() {
  return process.env.NANO_BANANA_MODEL?.trim() || DEFAULT_NANO_BANANA_MODEL;
}

/**
 * パスをプロジェクトルート基準で絶対パスに変換する
 * @param {string} targetPath
 * @returns {string}
 */
function toAbsolutePath(targetPath) {
  return path.isAbsolute(targetPath)
    ? path.normalize(targetPath)
    : path.join(PROJECT_ROOT, targetPath);
}

/**
 * 拡張子から MIME タイプを推定する
 * @param {string} filePath
 * @returns {string}
 */
function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }
  if (ext === ".webp") {
    return "image/webp";
  }
  return "image/png";
}

/**
 * 出力先が improved 配下かつ元画像と異なることを確認する
 * @param {string} sourceAbsolute
 * @param {string} outputAbsolute
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function validateOutputPath(sourceAbsolute, outputAbsolute) {
  if (sourceAbsolute === outputAbsolute) {
    return {
      ok: false,
      error: "出力先が元画像と同じです。元画像は上書きできません。",
    };
  }

  const improvedDir = path.join(PROJECT_ROOT, IMPROVED_OUTPUT_DIR);
  const relativeOutput = path.relative(improvedDir, outputAbsolute);

  if (
    relativeOutput.startsWith("..") ||
    path.isAbsolute(relativeOutput) ||
    relativeOutput === ""
  ) {
    return {
      ok: false,
      error: `outputPath は ${IMPROVED_OUTPUT_DIR}/ 配下である必要があります。`,
    };
  }

  return { ok: true };
}

/**
 * generateContent レスポンスから画像バイナリを取り出す
 * @param {object} response
 * @returns {{ imageBuffer: Buffer, mimeType: string } | null}
 */
function extractImageFromResponse(response) {
  const parts = response.candidates?.[0]?.content?.parts ?? [];

  for (const part of parts) {
    const inlineData = part.inlineData;
    if (!inlineData?.data) {
      continue;
    }

    return {
      imageBuffer: Buffer.from(inlineData.data, "base64"),
      mimeType: inlineData.mimeType ?? "image/png",
    };
  }

  return null;
}

/**
 * 429 で limit:0（クォータ未付与・課金未設定）の非リトライエラーか判定する
 * @param {unknown} error
 * @returns {boolean}
 */
function isQuotaLimitZeroError(error) {
  const message = toErrorMessage(error);
  const has429 =
    (error instanceof ApiError && error.status === 429) || message.includes("429");
  const hasLimitZero = /limit:\s*0\b/i.test(message);
  return has429 && hasLimitZero;
}

/**
 * limit:0 クォータエラーのユーザー向けメッセージを返す
 * @returns {string}
 */
function formatQuotaLimitZeroErrorMessage() {
  return `Gemini API クォータエラー（429 RESOURCE_EXHAUSTED, limit: 0）。${QUOTA_LIMIT_ZERO_GUIDANCE}`;
}

/**
 * タイムアウトエラーかどうかを判定する
 * @param {unknown} error
 * @returns {boolean}
 */
function isTimeoutError(error) {
  return error instanceof Error && error.name === "NanoBananaTimeoutError";
}

/**
 * リトライ対象のエラーかどうかを判定する
 * @param {unknown} error
 * @returns {boolean}
 */
function isRetryableError(error) {
  if (isQuotaLimitZeroError(error)) {
    return false;
  }

  if (isTimeoutError(error)) {
    return false;
  }

  if (error instanceof ApiError) {
    return RETRYABLE_STATUS_CODES.has(error.status);
  }

  const message = error instanceof Error ? error.message : String(error);
  return ["429", "500", "502", "503", "504"].some((code) =>
    message.includes(code),
  );
}

/**
 * エラーをメッセージ文字列に変換する
 * @param {unknown} error
 * @returns {string}
 */
function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Nano Banana クライアントを初期化する
 * @returns {{ ok: true, client: GoogleGenAI, model: string } | { ok: false, error: string }}
 */
export function createNanoBananaClient() {
  const apiKeyResult = resolveNanoBananaApiKey();
  if (!apiKeyResult.ok) {
    return apiKeyResult;
  }

  const model = resolveNanoBananaModel();

  logNanoBanana(`クライアントを初期化しました（model: ${model}）`);

  return {
    ok: true,
    client: new GoogleGenAI({ apiKey: apiKeyResult.apiKey }),
    model,
  };
}

/**
 * Nano Banana API を 1 回呼び出す（タイムアウト付き）
 * @param {object} options
 * @param {GoogleGenAI} options.client
 * @param {string} options.model
 * @param {string} options.sourceImagePath
 * @param {string} options.prompt
 * @param {number} options.timeoutMs
 * @returns {Promise<{ response: object } | { error: Error }>}
 */
async function invokeNanoBananaApiOnce({
  client,
  model,
  sourceImagePath,
  prompt,
  timeoutMs,
}) {
  let timeoutId;

  try {
    const imageBuffer = await fs.readFile(sourceImagePath);
    const mimeType = guessMimeType(sourceImagePath);
    const imageBase64 = imageBuffer.toString("base64");

    const apiPromise = client.models.generateContent({
      model,
      contents: [
        createPartFromText(prompt),
        createPartFromBase64(imageBase64, mimeType),
      ],
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const error = new Error(
          `Nano Banana API がタイムアウトしました（timeoutMs: ${timeoutMs}）`,
        );
        error.name = "NanoBananaTimeoutError";
        reject(error);
      }, timeoutMs);
    });

    const response = await Promise.race([apiPromise, timeoutPromise]);
    return { response };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Nano Banana API を呼び出して画像を改善する
 * @param {object} options
 * @param {GoogleGenAI} options.client
 * @param {string} options.model
 * @param {string} options.sourceImagePath - 元画像の絶対パス
 * @param {string} options.prompt - 改善プロンプト
 * @param {number} [options.timeoutMs=DEFAULT_TIMEOUT_MS]
 * @param {number} [options.retry=DEFAULT_RETRY]
 * @returns {Promise<NanoBananaApiResult>}
 */
export async function callNanoBananaApi({
  client,
  model,
  sourceImagePath,
  prompt,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retry = DEFAULT_RETRY,
}) {
  const maxAttempts = Math.max(1, retry);
  let lastError = "Nano Banana API が失敗しました。";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1) {
      const backoffMs = getRetryBackoffMs(attempt);
      logNanoBanana(
        `Retry ${attempt - 1}/${maxAttempts - 1} in ${backoffMs / 1000} seconds...`,
      );
      await sleepMs(backoffMs);
    }

    logNanoBanana(`画像改善 API を呼び出します（試行 ${attempt}/${maxAttempts}）`);

    const result = await invokeNanoBananaApiOnce({
      client,
      model,
      sourceImagePath,
      prompt,
      timeoutMs,
    });

    if ("error" in result) {
      lastError = toErrorMessage(result.error);

      if (isQuotaLimitZeroError(result.error)) {
        const quotaMessage = formatQuotaLimitZeroErrorMessage();
        logNanoBanana(quotaMessage);
        return {
          success: false,
          imageBuffer: null,
          mimeType: null,
          error: quotaMessage,
          model,
          attempts: 1,
          timeoutMs,
          retry: maxAttempts,
        };
      }

      if (attempt < maxAttempts && isRetryableError(result.error)) {
        logNanoBanana(`試行 ${attempt} 失敗: ${lastError}`);
        continue;
      }

      return {
        success: false,
        imageBuffer: null,
        mimeType: null,
        error: isTimeoutError(result.error)
          ? lastError
          : `Nano Banana API エラー: ${lastError}`,
        model,
        attempts: attempt,
        timeoutMs,
        retry: maxAttempts,
      };
    }

    const extracted = extractImageFromResponse(result.response);
    if (!extracted) {
      lastError = "Nano Banana API から画像データが返されませんでした。";

      if (attempt < maxAttempts) {
        logNanoBanana(`試行 ${attempt} 失敗: ${lastError}`);
        continue;
      }

      return {
        success: false,
        imageBuffer: null,
        mimeType: null,
        error: lastError,
        model,
        attempts: attempt,
        timeoutMs,
        retry: maxAttempts,
      };
    }

    logNanoBanana("画像改善 API が完了しました");

    return {
      success: true,
      imageBuffer: extracted.imageBuffer,
      mimeType: extracted.mimeType,
      error: null,
      model,
      attempts: attempt,
      timeoutMs,
      retry: maxAttempts,
    };
  }

  return {
    success: false,
    imageBuffer: null,
    mimeType: null,
    error: `Nano Banana API エラー: ${lastError}`,
    model,
    attempts: maxAttempts,
    timeoutMs,
    retry: maxAttempts,
  };
}

/**
 * improveImageWithNanoBanana の共通結果を組み立てる
 * @param {object} base
 * @param {number} startedAt
 * @param {number} timeoutMs
 * @param {number} retry
 * @returns {ImproveImageResult}
 */
function buildImproveResult(base, startedAt, timeoutMs, retry) {
  return {
    ...base,
    elapsedMs: Date.now() - startedAt,
    attempts: base.attempts ?? 0,
    timeoutMs,
    retry,
  };
}

/**
 * Nano Banana で画像を改善し、output/carousel/improved/ に保存する
 * @param {object} options
 * @param {string} options.sourceImagePath - 元画像パス
 * @param {string} options.prompt - 改善プロンプト
 * @param {string} options.outputPath - 出力先パス（improved 配下）
 * @param {boolean} [options.dryRun=false] - true の場合 API を呼ばない
 * @param {number} [options.timeoutMs=DEFAULT_TIMEOUT_MS]
 * @param {number} [options.retry=DEFAULT_RETRY]
 * @returns {Promise<ImproveImageResult>}
 */
export async function improveImageWithNanoBanana({
  sourceImagePath,
  prompt,
  outputPath,
  dryRun = false,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retry = DEFAULT_RETRY,
}) {
  const startedAt = Date.now();
  const maxAttempts = Math.max(1, retry);
  const sourceAbsolute = toAbsolutePath(sourceImagePath);
  const outputAbsolute = toAbsolutePath(outputPath);
  const model = resolveNanoBananaModel();

  const normalizedPrompt = prompt?.trim();
  if (!normalizedPrompt) {
    return buildImproveResult(
      {
        success: false,
        dryRun,
        sourceImagePath: sourceAbsolute,
        outputPath: outputAbsolute,
        prompt: prompt ?? "",
        error: "改善プロンプトが空です。",
        plannedAction: null,
        model,
        attempts: 0,
      },
      startedAt,
      timeoutMs,
      maxAttempts,
    );
  }

  try {
    await fs.access(sourceAbsolute);
  } catch {
    return buildImproveResult(
      {
        success: false,
        dryRun,
        sourceImagePath: sourceAbsolute,
        outputPath: outputAbsolute,
        prompt: normalizedPrompt,
        error: `元画像が見つかりません: ${sourceAbsolute}`,
        plannedAction: null,
        model,
        attempts: 0,
      },
      startedAt,
      timeoutMs,
      maxAttempts,
    );
  }

  const outputValidation = validateOutputPath(sourceAbsolute, outputAbsolute);
  if (!outputValidation.ok) {
    return buildImproveResult(
      {
        success: false,
        dryRun,
        sourceImagePath: sourceAbsolute,
        outputPath: outputAbsolute,
        prompt: normalizedPrompt,
        error: outputValidation.error,
        plannedAction: null,
        model,
        attempts: 0,
      },
      startedAt,
      timeoutMs,
      maxAttempts,
    );
  }

  if (dryRun) {
    return buildImproveResult(
      {
        success: true,
        dryRun: true,
        sourceImagePath: sourceAbsolute,
        outputPath: outputAbsolute,
        prompt: normalizedPrompt,
        error: null,
        plannedAction: `Nano Banana（${model}）で ${path.basename(sourceAbsolute)} を改善し、${path.relative(PROJECT_ROOT, outputAbsolute)} に保存予定（timeoutMs: ${timeoutMs}, retry: ${maxAttempts}）`,
        model,
        attempts: 0,
      },
      startedAt,
      timeoutMs,
      maxAttempts,
    );
  }

  const clientResult = createNanoBananaClient();
  if (!clientResult.ok) {
    return buildImproveResult(
      {
        success: false,
        dryRun: false,
        sourceImagePath: sourceAbsolute,
        outputPath: outputAbsolute,
        prompt: normalizedPrompt,
        error: clientResult.error,
        plannedAction: null,
        model,
        attempts: 0,
      },
      startedAt,
      timeoutMs,
      maxAttempts,
    );
  }

  const apiResult = await callNanoBananaApi({
    client: clientResult.client,
    model: clientResult.model,
    sourceImagePath: sourceAbsolute,
    prompt: normalizedPrompt,
    timeoutMs,
    retry: maxAttempts,
  });

  if (!apiResult.success || !apiResult.imageBuffer) {
    return buildImproveResult(
      {
        success: false,
        dryRun: false,
        sourceImagePath: sourceAbsolute,
        outputPath: outputAbsolute,
        prompt: normalizedPrompt,
        error: apiResult.error ?? "Nano Banana API が失敗しました。",
        plannedAction: null,
        model: apiResult.model ?? model,
        attempts: apiResult.attempts ?? maxAttempts,
      },
      startedAt,
      timeoutMs,
      maxAttempts,
    );
  }

  try {
    await fs.mkdir(path.dirname(outputAbsolute), { recursive: true });
    await fs.writeFile(outputAbsolute, apiResult.imageBuffer);
  } catch (error) {
    const message = toErrorMessage(error);
    return buildImproveResult(
      {
        success: false,
        dryRun: false,
        sourceImagePath: sourceAbsolute,
        outputPath: outputAbsolute,
        prompt: normalizedPrompt,
        error: `改善画像の保存に失敗しました: ${message}`,
        plannedAction: null,
        model: apiResult.model ?? model,
        attempts: apiResult.attempts ?? maxAttempts,
      },
      startedAt,
      timeoutMs,
      maxAttempts,
    );
  }

  logNanoBanana(
    `改善画像を保存しました: ${path.relative(PROJECT_ROOT, outputAbsolute)}`,
  );

  return buildImproveResult(
    {
      success: true,
      dryRun: false,
      sourceImagePath: sourceAbsolute,
      outputPath: outputAbsolute,
      prompt: normalizedPrompt,
      error: null,
      plannedAction: null,
      model: apiResult.model ?? model,
      attempts: apiResult.attempts ?? maxAttempts,
    },
    startedAt,
    timeoutMs,
    maxAttempts,
  );
}
