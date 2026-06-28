import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  NANO_BANANA_ADAPTER_ID,
  nanoBananaRegenerationAdapter,
} from "./regeneration/nano_banana_adapter.js";
import {
  OPENAI_REGENERATION_ADAPTER_ID,
  openAiRegenerationAdapter,
} from "./regeneration/openai_regeneration_adapter.js";

/** 利用可能な regeneration adapter ID */
export const REGENERATION_ADAPTER_IDS = {
  NANO_BANANA: NANO_BANANA_ADAPTER_ID,
  OPENAI: OPENAI_REGENERATION_ADAPTER_ID,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** プロジェクトルート（src/lib 基準） */
export const PROJECT_ROOT = path.resolve(__dirname, "../..");

/** v1.4 デフォルト adapter ID */
export const DEFAULT_REGENERATION_ADAPTER_ID = NANO_BANANA_ADAPTER_ID;

/**
 * @typedef {object} RegenerationRequest
 * @property {string} slideId
 * @property {string} promptPath
 * @property {string} sourceImagePath
 * @property {string} outputPath
 * @property {string} [adapterId]
 * @property {boolean} [dryRun]
 * @property {string[]} [changedTextPaths]
 */

/**
 * @typedef {"planned" | "improved" | "failed"} RegenerationStatus
 */

/**
 * @typedef {object} RegenerationResult
 * @property {string} slideId
 * @property {string} adapterId
 * @property {RegenerationStatus} status
 * @property {string} promptPath
 * @property {string} sourceImagePath
 * @property {string} outputPath
 * @property {number} elapsedMs
 * @property {number} [attempts]
 * @property {string | null} error
 * @property {string} [model]
 * @property {boolean} [dryRun]
 * @property {object | null} [adapterPayload]
 */

/**
 * @typedef {object} RegenerationContext
 * @property {string} [projectRoot]
 * @property {number} [timeoutMs]
 * @property {number} [retry]
 * @property {string} [defaultAdapterId]
 */

/**
 * @typedef {object} RegenerationAdapter
 * @property {string} id
 * @property {string} label
 * @property {(request: RegenerationRequest, context: RegenerationContext) => Promise<RegenerationResult>} plan
 * @property {(request: RegenerationRequest, context: RegenerationContext) => Promise<RegenerationResult>} regenerate
 */

/** @type {Map<string, RegenerationAdapter>} */
const adapters = new Map();

/**
 * adapter を登録する
 * @param {string} adapterId
 * @param {RegenerationAdapter} adapter
 */
export function registerRegenerationAdapter(adapterId, adapter) {
  if (!adapterId || typeof adapterId !== "string") {
    throw new Error("adapterId が不正です。");
  }

  if (!adapter || typeof adapter.plan !== "function" || typeof adapter.regenerate !== "function") {
    throw new Error(`adapter ${adapterId} は plan / regenerate を実装する必要があります。`);
  }

  adapters.set(adapterId, adapter);
}

/**
 * 登録済み adapter を取得する
 * @param {string} adapterId
 * @returns {RegenerationAdapter | undefined}
 */
export function getRegenerationAdapter(adapterId) {
  return adapters.get(adapterId);
}

/**
 * 登録済み adapter ID 一覧
 * @returns {string[]}
 */
export function listRegenerationAdapterIds() {
  return [...adapters.keys()];
}

/**
 * @param {string} [projectRoot]
 * @returns {string}
 */
function resolveProjectRoot(projectRoot = PROJECT_ROOT) {
  return path.resolve(projectRoot);
}

/**
 * RegenerationRequest を検証・正規化する
 * @param {RegenerationRequest} request
 * @returns {RegenerationRequest}
 */
export function normalizeRegenerationRequest(request) {
  if (!request || typeof request !== "object") {
    throw new Error("RegenerationRequest が不正です。");
  }

  const slideId = request.slideId?.trim();
  const promptPath = request.promptPath?.trim();
  const sourceImagePath = request.sourceImagePath?.trim();
  const outputPath = request.outputPath?.trim();

  if (!slideId) {
    throw new Error("RegenerationRequest.slideId は必須です。");
  }
  if (!promptPath) {
    throw new Error("RegenerationRequest.promptPath は必須です。");
  }
  if (!sourceImagePath) {
    throw new Error("RegenerationRequest.sourceImagePath は必須です。");
  }
  if (!outputPath) {
    throw new Error("RegenerationRequest.outputPath は必須です。");
  }

  return {
    slideId,
    promptPath,
    sourceImagePath,
    outputPath,
    adapterId: request.adapterId?.trim() || undefined,
    dryRun: request.dryRun ?? false,
    changedTextPaths: Array.isArray(request.changedTextPaths)
      ? request.changedTextPaths.filter((item) => typeof item === "string")
      : undefined,
  };
}

/**
 * adapter 結果を engine 共通形式に正規化する
 * @param {RegenerationResult} result
 * @param {RegenerationRequest} request
 * @returns {RegenerationResult}
 */
export function normalizeRegenerationResult(result, request) {
  return {
    slideId: result.slideId ?? request.slideId,
    adapterId: result.adapterId,
    status: result.status,
    promptPath: result.promptPath ?? request.promptPath,
    sourceImagePath: result.sourceImagePath ?? request.sourceImagePath,
    outputPath: result.outputPath ?? request.outputPath,
    elapsedMs: typeof result.elapsedMs === "number" ? result.elapsedMs : 0,
    attempts: typeof result.attempts === "number" ? result.attempts : 0,
    error: result.error ?? null,
    model: result.model ?? null,
    dryRun: result.dryRun ?? request.dryRun ?? false,
    adapterPayload: result.adapterPayload ?? null,
  };
}

/**
 * @param {RegenerationRequest} request
 * @param {RegenerationContext} options
 * @returns {string}
 */
function resolveAdapterId(request, options) {
  return (
    request.adapterId ??
    options.defaultAdapterId ??
    DEFAULT_REGENERATION_ADAPTER_ID
  );
}

/**
 * @param {string} adapterId
 * @returns {RegenerationAdapter}
 */
function requireAdapter(adapterId) {
  const adapter = getRegenerationAdapter(adapterId);
  if (!adapter) {
    throw new Error(`Regeneration adapter が見つかりません: ${adapterId}`);
  }
  return adapter;
}

/**
 * @param {RegenerationRequest} request
 * @param {RegenerationContext} options
 * @returns {RegenerationContext}
 */
function buildContext(request, options = {}) {
  return {
    projectRoot: resolveProjectRoot(options.projectRoot),
    timeoutMs: options.timeoutMs,
    retry: options.retry,
    defaultAdapterId: options.defaultAdapterId,
  };
}

/**
 * dry-run 時の再生成計画を作成する
 * @param {RegenerationRequest} request
 * @param {RegenerationContext} [options]
 * @returns {Promise<RegenerationResult>}
 */
export async function planRegeneration(request, options = {}) {
  const normalizedRequest = normalizeRegenerationRequest({
    ...request,
    dryRun: true,
  });
  const adapterId = resolveAdapterId(normalizedRequest, options);
  const adapter = requireAdapter(adapterId);
  const context = buildContext(normalizedRequest, options);
  const result = await adapter.plan(normalizedRequest, context);

  return normalizeRegenerationResult(result, normalizedRequest);
}

/**
 * 画像再生成を実行する（dryRun 時は planRegeneration に委譲）
 * @param {RegenerationRequest} request
 * @param {RegenerationContext} [options]
 * @returns {Promise<RegenerationResult>}
 */
export async function regenerateImage(request, options = {}) {
  const normalizedRequest = normalizeRegenerationRequest(request);

  if (normalizedRequest.dryRun) {
    return planRegeneration(normalizedRequest, options);
  }

  const adapterId = resolveAdapterId(normalizedRequest, options);
  const adapter = requireAdapter(adapterId);
  const context = buildContext(normalizedRequest, options);
  const result = await adapter.regenerate(normalizedRequest, context);

  return normalizeRegenerationResult(result, normalizedRequest);
}

registerRegenerationAdapter(
  nanoBananaRegenerationAdapter.id,
  nanoBananaRegenerationAdapter,
);

registerRegenerationAdapter(
  openAiRegenerationAdapter.id,
  openAiRegenerationAdapter,
);
