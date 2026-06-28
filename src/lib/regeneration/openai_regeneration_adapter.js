import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { buildRegenerationPromptFromPromptMd } from "./nano_banana_adapter.js";

/** adapter 識別子 */
export const OPENAI_REGENERATION_ADAPTER_ID = "openai";

/** OpenAI 画像モデル */
export const OPENAI_REGENERATION_MODEL = "gpt-image-1";

/** API キー未設定エラーコード */
export const OPENAI_API_KEY_MISSING_CODE = "OPENAI_API_KEY_MISSING";

/**
 * @param {string} targetPath
 * @param {string} projectRoot
 * @returns {string}
 */
function toAbsolutePath(targetPath, projectRoot) {
  return path.isAbsolute(targetPath)
    ? path.normalize(targetPath)
    : path.join(projectRoot, targetPath);
}

/**
 * @param {string} absolutePath
 * @param {string} projectRoot
 * @returns {string}
 */
function toRelativePath(absolutePath, projectRoot) {
  return path.relative(projectRoot, absolutePath).split(path.sep).join("/");
}

/**
 * @returns {boolean}
 */
export function hasOpenAiRegenerationApiKey() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * OpenAI adapter 共通ペイロード（report / テスト用）
 * @param {object} params
 * @returns {object}
 */
export function buildOpenAiAdapterPayload(params) {
  const {
    ok,
    dryRun = false,
    outputPath = null,
    reason = null,
    errorCode = null,
    message = null,
    retryable = false,
  } = params;

  const fileName = outputPath ? path.basename(outputPath) : null;

  if (ok) {
    return {
      ok: true,
      adapter: OPENAI_REGENERATION_ADAPTER_ID,
      model: OPENAI_REGENERATION_MODEL,
      dryRun,
      output: {
        imagePath: outputPath,
        fileName,
        mimeType: "image/png",
      },
      meta: {
        generatedAt: new Date().toISOString(),
        reason: reason ?? (dryRun ? "dry-run" : "generated"),
      },
    };
  }

  return {
    ok: false,
    adapter: OPENAI_REGENERATION_ADAPTER_ID,
    model: OPENAI_REGENERATION_MODEL,
    dryRun,
    error: {
      code: errorCode ?? "OPENAI_REGENERATION_FAILED",
      message: message ?? "OpenAI regeneration failed.",
      retryable,
    },
    meta: {
      generatedAt: new Date().toISOString(),
      reason: reason ?? "error",
    },
  };
}

/**
 * @param {object} params
 * @returns {object}
 */
function buildAdapterResult(params) {
  const {
    request,
    status,
    error = null,
    elapsedMs = 0,
    attempts = 0,
    dryRun = false,
    adapterPayload = null,
  } = params;

  return {
    slideId: request.slideId,
    adapterId: OPENAI_REGENERATION_ADAPTER_ID,
    status,
    promptPath: request.promptPath,
    sourceImagePath: request.sourceImagePath,
    outputPath: request.outputPath,
    elapsedMs,
    attempts,
    error,
    model: OPENAI_REGENERATION_MODEL,
    dryRun,
    adapterPayload,
  };
}

/**
 * @param {object} request
 * @param {string} projectRoot
 * @returns {Promise<{ ok: true, prompt: string } | { ok: false, error: string }>}
 */
async function loadRegenerationPrompt(request, projectRoot) {
  const promptAbsolute = toAbsolutePath(request.promptPath, projectRoot);

  let promptContent;
  try {
    promptContent = await fs.readFile(promptAbsolute, "utf-8");
  } catch {
    return {
      ok: false,
      error: `prompt ファイルが見つかりません: ${request.promptPath}`,
    };
  }

  const prompt = buildRegenerationPromptFromPromptMd(promptContent, request.slideId);
  if (!prompt) {
    return {
      ok: false,
      error: `prompt ファイルが空です: ${request.promptPath}`,
    };
  }

  return { ok: true, prompt };
}

/**
 * @param {OpenAI} client
 * @param {string} prompt
 * @returns {Promise<Buffer>}
 */
async function generateImageBuffer(client, prompt) {
  const response = await client.images.generate({
    model: OPENAI_REGENERATION_MODEL,
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
 * OpenAI regeneration adapter（v1.5）
 * @type {import("../regeneration_engine.js").RegenerationAdapter}
 */
export const openAiRegenerationAdapter = {
  id: OPENAI_REGENERATION_ADAPTER_ID,
  label: "OpenAI Images",

  async plan(request, context) {
    return planOpenAiRegeneration(request, context);
  },

  async regenerate(request, context) {
    const projectRoot = context.projectRoot;
    const startedAt = Date.now();

    if (!hasOpenAiRegenerationApiKey()) {
      const payload = buildOpenAiAdapterPayload({
        ok: false,
        dryRun: false,
        errorCode: OPENAI_API_KEY_MISSING_CODE,
        message: "OPENAI_API_KEY is required for OpenAI regeneration.",
        retryable: false,
        reason: "api_key_missing",
      });

      return buildAdapterResult({
        request,
        status: "failed",
        error: payload.error.message,
        elapsedMs: Date.now() - startedAt,
        attempts: 0,
        dryRun: false,
        adapterPayload: payload,
      });
    }

    const promptResult = await loadRegenerationPrompt(request, projectRoot);
    if (!promptResult.ok) {
      const payload = buildOpenAiAdapterPayload({
        ok: false,
        dryRun: false,
        message: promptResult.error,
        retryable: false,
        reason: "prompt_error",
      });

      return buildAdapterResult({
        request,
        status: "failed",
        error: promptResult.error,
        elapsedMs: Date.now() - startedAt,
        attempts: 0,
        dryRun: false,
        adapterPayload: payload,
      });
    }

    const outputAbsolute = toAbsolutePath(request.outputPath, projectRoot);

    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const imageBuffer = await generateImageBuffer(client, promptResult.prompt);
      await fs.mkdir(path.dirname(outputAbsolute), { recursive: true });
      await fs.writeFile(outputAbsolute, imageBuffer);

      const relativeOutput = toRelativePath(outputAbsolute, projectRoot);
      const payload = buildOpenAiAdapterPayload({
        ok: true,
        dryRun: false,
        outputPath: relativeOutput,
        reason: "generated",
      });

      return buildAdapterResult({
        request,
        status: "improved",
        error: null,
        elapsedMs: Date.now() - startedAt,
        attempts: 1,
        dryRun: false,
        adapterPayload: payload,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const payload = buildOpenAiAdapterPayload({
        ok: false,
        dryRun: false,
        message,
        retryable: true,
        reason: "api_error",
      });

      return buildAdapterResult({
        request,
        status: "failed",
        error: message,
        elapsedMs: Date.now() - startedAt,
        attempts: 1,
        dryRun: false,
        adapterPayload: payload,
      });
    }
  },
};

/**
 * dry-run 時の OpenAI 再生成計画
 * @param {import("../regeneration_engine.js").RegenerationRequest} request
 * @param {import("../regeneration_engine.js").RegenerationContext} context
 * @returns {Promise<import("../regeneration_engine.js").RegenerationResult>}
 */
export async function planOpenAiRegeneration(request, context) {
  const projectRoot = context.projectRoot;
  const startedAt = Date.now();

  if (!hasOpenAiRegenerationApiKey()) {
    const payload = buildOpenAiAdapterPayload({
      ok: true,
      dryRun: true,
      outputPath: request.outputPath,
      reason: "dry-run",
    });
    payload.meta.apiKeyGuidance = {
      code: OPENAI_API_KEY_MISSING_CODE,
      message: "OPENAI_API_KEY is required for OpenAI regeneration.",
      retryable: false,
    };

    return buildAdapterResult({
      request,
      status: "planned",
      error: "OPENAI_API_KEY is required for OpenAI regeneration (--apply).",
      elapsedMs: Date.now() - startedAt,
      attempts: 0,
      dryRun: true,
      adapterPayload: payload,
    });
  }

  const promptResult = await loadRegenerationPrompt(request, projectRoot);
  if (!promptResult.ok) {
    const payload = buildOpenAiAdapterPayload({
      ok: false,
      dryRun: true,
      message: promptResult.error,
      retryable: false,
      reason: "prompt_error",
    });

    return buildAdapterResult({
      request,
      status: "failed",
      error: promptResult.error,
      elapsedMs: Date.now() - startedAt,
      attempts: 0,
      dryRun: true,
      adapterPayload: payload,
    });
  }

  const payload = buildOpenAiAdapterPayload({
    ok: true,
    dryRun: true,
    outputPath: request.outputPath,
    reason: "dry-run",
  });

  return buildAdapterResult({
    request,
    status: "planned",
    error: null,
    elapsedMs: Date.now() - startedAt,
    attempts: 0,
    dryRun: true,
    adapterPayload: payload,
  });
}
