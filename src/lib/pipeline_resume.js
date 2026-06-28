import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { InputConfigurationError } from "./exit_codes.js";
import { getNextPhase, PIPELINE_PHASES } from "./phases.js";
import {
  DEFAULT_PIPELINE_STATE_DIR,
  PIPELINE_STATE_FILENAME,
  PROJECT_ROOT,
} from "./pipeline_state.js";
import { PIPELINE_METRICS_FILENAME } from "./pipeline_metrics.js";

/** resume checkpoint スキーマバージョン */
export const RESUME_STATE_SCHEMA_VERSION = "1.0";

/** resume checkpoint ツール識別子 */
export const RESUME_STATE_TOOL = "quality_pipeline_resume";

/** resume checkpoint ファイル名 */
export const RESUME_STATE_FILENAME = "state.json";

/**
 * resume checkpoint の status 値
 * @typedef {"resumable" | "completed" | "failed"} ResumeCheckpointStatus
 */

/**
 * @param {string} outputDir
 * @returns {string}
 */
function resolveOutputDir(outputDir) {
  return path.isAbsolute(outputDir)
    ? path.normalize(outputDir)
    : path.join(PROJECT_ROOT, outputDir);
}

/**
 * resume checkpoint の絶対パス
 * @param {string} [outputDir]
 * @returns {string}
 */
export function getResumeStateAbsolutePath(outputDir = DEFAULT_PIPELINE_STATE_DIR) {
  return path.join(resolveOutputDir(outputDir), RESUME_STATE_FILENAME);
}

/**
 * resume checkpoint のプロジェクト相対パス
 * @param {string} [outputDir]
 * @returns {string}
 */
export function getResumeStateRelativePath(outputDir = DEFAULT_PIPELINE_STATE_DIR) {
  return path
    .relative(PROJECT_ROOT, getResumeStateAbsolutePath(outputDir))
    .split(path.sep)
    .join("/");
}

/**
 * resume checkpoint が存在するか（同期）
 * @param {string} [outputDir]
 * @returns {boolean}
 */
export function resumeStateFileExists(outputDir = DEFAULT_PIPELINE_STATE_DIR) {
  return fs.existsSync(getResumeStateAbsolutePath(outputDir));
}

/**
 * 失敗または完了状態から次に実行する Phase を解決する
 * @param {object} pipelineState
 * @returns {string | null}
 */
export function resolveNextPhaseFromPipelineState(pipelineState) {
  if (pipelineState.status === "completed" || pipelineState.phase === PIPELINE_PHASES.COMPLETE) {
    return null;
  }

  const failedSteps = pipelineState.failedSteps ?? [];
  if (failedSteps.length > 0) {
    const lastFailed = failedSteps[failedSteps.length - 1];
    if (lastFailed?.phase && lastFailed.phase !== PIPELINE_PHASES.FAILED) {
      return lastFailed.phase;
    }
  }

  const completedSteps = pipelineState.completedSteps ?? [];
  if (completedSteps.length === 0) {
    return pipelineState.config?.fromPhase ?? PIPELINE_PHASES.INIT;
  }

  const lastCompleted = completedSteps[completedSteps.length - 1];
  if (lastCompleted === PIPELINE_PHASES.COMPLETE) {
    return null;
  }

  return getNextPhase(lastCompleted);
}

/**
 * resume checkpoint を組み立てる
 * @param {object} params
 * @param {object} params.pipelineState
 * @param {object} params.config
 * @param {"resumable" | "completed" | "failed"} [params.status]
 * @param {string} [params.outputDir]
 * @returns {object}
 */
export function buildResumeCheckpoint(params) {
  const {
    pipelineState,
    config,
    status = "resumable",
    outputDir = DEFAULT_PIPELINE_STATE_DIR,
  } = params;

  const completedSteps = [...(pipelineState.completedSteps ?? [])];
  const checkpointPhase =
    completedSteps.length > 0
      ? completedSteps[completedSteps.length - 1]
      : pipelineState.config?.fromPhase ?? PIPELINE_PHASES.INIT;

  const nextPhase =
    status === "completed"
      ? null
      : resolveNextPhaseFromPipelineState(pipelineState);

  const relativeDir = outputDir.split(path.sep).join("/");

  return {
    schemaVersion: RESUME_STATE_SCHEMA_VERSION,
    tool: RESUME_STATE_TOOL,
    updatedAt: new Date().toISOString(),
    dryRun: config.dryRun ?? pipelineState.config?.dryRun ?? true,
    status,
    config: {
      targetScore: config.targetScore ?? pipelineState.config?.targetScore,
      passingScore: config.passingScore ?? pipelineState.config?.passingScore,
      maxRounds: config.maxRounds ?? pipelineState.config?.maxRounds,
      maxApiCalls: config.maxApiCalls ?? pipelineState.config?.maxApiCalls ?? null,
      dryRun: config.dryRun ?? pipelineState.config?.dryRun ?? true,
      allowPartialExport:
        config.allowPartialExport ?? pipelineState.config?.allowPartialExport ?? false,
      skipContent: config.skipContent ?? pipelineState.config?.skipContent ?? false,
      skipExport: config.skipExport ?? pipelineState.config?.skipExport ?? false,
      regenerationAdapter:
        config.regenerationAdapter ?? pipelineState.config?.regenerationAdapter ?? "nano_banana",
      fromPhase: pipelineState.config?.fromPhase ?? PIPELINE_PHASES.INIT,
    },
    checkpointPhase,
    checkpointRound:
      pipelineState.improvement?.roundsExecuted ?? pipelineState.round ?? 0,
    nextPhase,
    completedSteps,
    pipelineStateFile: `${relativeDir}/${PIPELINE_STATE_FILENAME}`,
    metricsFile: `${relativeDir}/${PIPELINE_METRICS_FILENAME}`,
  };
}

/**
 * resume checkpoint を書き込む
 * @param {object} checkpoint
 * @param {string} [outputDir]
 * @returns {Promise<string>}
 */
export async function writeResumeState(checkpoint, outputDir = DEFAULT_PIPELINE_STATE_DIR) {
  const absolutePath = getResumeStateAbsolutePath(outputDir);
  await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true });
  await fsPromises.writeFile(absolutePath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf-8");
  return getResumeStateRelativePath(outputDir);
}

/**
 * pipeline 実行後に resume checkpoint を更新する
 * @param {object} params
 * @returns {Promise<string>}
 */
export async function persistResumeCheckpoint(params) {
  const { pipelineState, config, outputDir = DEFAULT_PIPELINE_STATE_DIR } = params;

  let status = "resumable";
  if (pipelineState.status === "completed" || pipelineState.phase === PIPELINE_PHASES.COMPLETE) {
    status = "completed";
  } else if (pipelineState.status === "failed") {
    status = "failed";
  }

  const checkpoint = buildResumeCheckpoint({
    pipelineState,
    config,
    status,
    outputDir,
  });

  return writeResumeState(checkpoint, outputDir);
}

/**
 * resume checkpoint を読み込む
 * @param {string} [outputDir]
 * @returns {Promise<object>}
 */
export async function readResumeState(outputDir = DEFAULT_PIPELINE_STATE_DIR) {
  const absolutePath = getResumeStateAbsolutePath(outputDir);
  const relativePath = getResumeStateRelativePath(outputDir);

  let raw;
  try {
    raw = await fsPromises.readFile(absolutePath, "utf-8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new InputConfigurationError(
        `--resume には ${relativePath} が必要です。先に pipeline を実行するか、checkpoint を復元してください。`,
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new InputConfigurationError(`${relativePath} の読み込みに失敗しました: ${message}`);
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed.tool !== RESUME_STATE_TOOL) {
      throw new InputConfigurationError(`${relativePath} の tool が不正です。`);
    }
    return parsed;
  } catch (error) {
    if (error instanceof InputConfigurationError) {
      throw error;
    }
    throw new InputConfigurationError(`${relativePath} の JSON 形式が不正です。`);
  }
}

/**
 * resume checkpoint を検証する
 * @param {object} checkpoint
 */
export function validateResumeCheckpoint(checkpoint) {
  if (checkpoint.status === "completed" || checkpoint.nextPhase === null) {
    throw new InputConfigurationError(
      "前回の pipeline 実行は既に完了しています。--resume は不要です。",
    );
  }

  if (!checkpoint.nextPhase) {
    throw new InputConfigurationError(
      "resume checkpoint に nextPhase がありません。state.json を確認してください。",
    );
  }
}
