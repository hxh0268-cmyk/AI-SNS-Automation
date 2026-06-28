import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_RETRY,
  DEFAULT_TIMEOUT_MS,
  improveImageWithNanoBanana,
} from "../nano_banana.js";

/** adapter 識別子 */
export const NANO_BANANA_ADAPTER_ID = "nano_banana";

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
 * prompt.md の内容から Nano Banana 用プロンプトを組み立てる
 * @param {string} promptContent
 * @param {string} slideId
 * @returns {string}
 */
export function buildRegenerationPromptFromPromptMd(promptContent, slideId) {
  const trimmed = promptContent.trim();
  if (!trimmed) {
    return "";
  }

  return [
    `Regenerate Instagram carousel slide image (${slideId}) using the updated generation prompt below.`,
    "",
    "STRICT PROHEBITIONS:",
    "- Do NOT change the post theme or core meaning.",
    "- Do NOT alter, translate, or rewrite any Japanese text in the image.",
    "- Do NOT change aspect ratio (keep 1:1 square).",
    "",
    "--- Updated generation prompt ---",
    trimmed,
    "",
    "Priority: text legibility, safe margins, balanced composition, and mobile visibility.",
  ].join("\n");
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
  } = params;

  return {
    slideId: request.slideId,
    adapterId: NANO_BANANA_ADAPTER_ID,
    status,
    promptPath: request.promptPath,
    sourceImagePath: request.sourceImagePath,
    outputPath: request.outputPath,
    elapsedMs,
    attempts,
    error,
  };
}

/**
 * Nano Banana regeneration adapter（v1.4 暫定）
 * @type {import("../regeneration_engine.js").RegenerationAdapter}
 */
export const nanoBananaRegenerationAdapter = {
  id: NANO_BANANA_ADAPTER_ID,
  label: "Nano Banana",

  /**
   * dry-run 用の再生成計画
   * @param {import("../regeneration_engine.js").RegenerationRequest} request
   * @param {import("../regeneration_engine.js").RegenerationContext} context
   * @returns {Promise<import("../regeneration_engine.js").RegenerationResult>}
   */
  async plan(request, context) {
    return planNanoBananaRegeneration(request, context);
  },

  /**
   * apply 時の画像再生成
   * @param {import("../regeneration_engine.js").RegenerationRequest} request
   * @param {import("../regeneration_engine.js").RegenerationContext} context
   * @returns {Promise<import("../regeneration_engine.js").RegenerationResult>}
   */
  async regenerate(request, context) {
    const projectRoot = context.projectRoot;
    const timeoutMs = context.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const retry = context.retry ?? DEFAULT_RETRY;

    const promptResult = await loadRegenerationPrompt(request, projectRoot);
    if (!promptResult.ok) {
      return buildAdapterResult({
        request,
        status: "failed",
        error: promptResult.error,
      });
    }

    const sourceAbsolute = toAbsolutePath(request.sourceImagePath, projectRoot);
    const outputAbsolute = toAbsolutePath(request.outputPath, projectRoot);

    const result = await improveImageWithNanoBanana({
      sourceImagePath: sourceAbsolute,
      prompt: promptResult.prompt,
      outputPath: outputAbsolute,
      dryRun: false,
      timeoutMs,
      retry,
    });

    if (!result.success) {
      return buildAdapterResult({
        request,
        status: "failed",
        error: result.error ?? "Nano Banana による画像再生成に失敗しました。",
        elapsedMs: result.elapsedMs,
        attempts: result.attempts,
      });
    }

    return buildAdapterResult({
      request,
      status: "improved",
      error: null,
      elapsedMs: result.elapsedMs,
      attempts: result.attempts,
    });
  },
};

/**
 * dry-run 時に improveImageWithNanoBanana を使った計画詳細を取得する
 * @param {import("../regeneration_engine.js").RegenerationRequest} request
 * @param {import("../regeneration_engine.js").RegenerationContext} context
 * @returns {Promise<import("../regeneration_engine.js").RegenerationResult>}
 */
export async function planNanoBananaRegeneration(request, context) {
  const projectRoot = context.projectRoot;
  const timeoutMs = context.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retry = context.retry ?? DEFAULT_RETRY;

  const promptResult = await loadRegenerationPrompt(request, projectRoot);
  if (!promptResult.ok) {
    return buildAdapterResult({
      request,
      status: "failed",
      error: promptResult.error,
    });
  }

  const sourceAbsolute = toAbsolutePath(request.sourceImagePath, projectRoot);
  const outputAbsolute = toAbsolutePath(request.outputPath, projectRoot);

  const result = await improveImageWithNanoBanana({
    sourceImagePath: sourceAbsolute,
    prompt: promptResult.prompt,
    outputPath: outputAbsolute,
    dryRun: true,
    timeoutMs,
    retry,
  });

  if (!result.success) {
    return buildAdapterResult({
      request,
      status: "failed",
      error: result.error ?? "再生成計画の作成に失敗しました。",
      elapsedMs: result.elapsedMs,
      attempts: result.attempts,
    });
  }

  return buildAdapterResult({
    request,
    status: "planned",
    error: null,
    elapsedMs: result.elapsedMs,
    attempts: result.attempts,
  });
}

export { toAbsolutePath as resolveRegenerationAbsolutePath, toRelativePath as toProjectRelativePath };
