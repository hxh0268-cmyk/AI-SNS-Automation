import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { InputConfigurationError } from "./exit_codes.js";
import { PIPELINE_PHASES } from "./phases.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** プロジェクトルート */
export const PROJECT_ROOT = path.resolve(__dirname, "../..");

/** pipeline_state スキーマバージョン */
export const PIPELINE_STATE_SCHEMA_VERSION = "1.0";

/** pipeline_state ツール識別子 */
export const PIPELINE_STATE_TOOL = "quality_pipeline_state";

/** デフォルト出力ディレクトリ（プロジェクト相対） */
export const DEFAULT_PIPELINE_STATE_DIR = "reports/quality-pipeline/latest";

/** デフォルト state ファイル名 */
export const PIPELINE_STATE_FILENAME = "pipeline_state.json";

/**
 * config から scoreSummary の初期値を生成する
 * @param {object} config
 * @returns {object}
 */
function createInitialScoreSummary(config) {
  return {
    targetScore: config.targetScore,
    passingScore: config.passingScore,
    averageScore: null,
    minScore: null,
    allSlidesPassed: false,
    allSlidesPublishRecommended: false,
    slides: [],
  };
}

/**
 * config から resume の初期値を生成する
 * @param {object} config
 * @returns {object}
 */
function createInitialResume(config) {
  return {
    enabled: false,
    checkpointPhase: config.fromPhase ?? PIPELINE_PHASES.INIT,
    checkpointRound: 0,
  };
}

/**
 * config から improvement の初期値を生成する
 * @param {object} config
 * @returns {object}
 */
function createInitialImprovement(config) {
  return {
    roundsExecuted: 0,
    maxRounds: config.maxRounds ?? 3,
    lastPlan: null,
    lastManifestPath: null,
    stopReason: null,
    history: [],
  };
}

/**
 * config から export の初期値を生成する
 * @returns {object}
 */
function createInitialExport() {
  return {
    completed: false,
    skipped: true,
    skipReason: null,
    mode: null,
    path: null,
    manifestPath: null,
    improvedAdoptedCount: 0,
    originalCount: 0,
  };
}

/**
 * report の初期値を生成する
 * @returns {object}
 */
function createInitialReport() {
  return {
    generated: false,
    jsonPath: null,
    mdPath: null,
    generatedAt: null,
  };
}

/**
 * 設定スナップショットを state 用に整形する
 * @param {object} config
 * @returns {object}
 */
function snapshotConfig(config) {
  return {
    targetScore: config.targetScore,
    passingScore: config.passingScore,
    maxRounds: config.maxRounds,
    maxApiCalls: config.maxApiCalls,
    dryRun: config.dryRun,
    allowPartialExport: config.allowPartialExport,
    skipContent: config.skipContent,
    skipExport: config.skipExport,
    cleanLatest: config.cleanLatest ?? false,
    fromPhase: config.fromPhase,
  };
}

/**
 * 初期 pipeline state を生成する
 * @param {object} config - PipelineConfig
 * @returns {object}
 */
export function createInitialPipelineState(config) {
  const now = new Date().toISOString();
  const startPhase = config.fromPhase ?? PIPELINE_PHASES.INIT;

  return {
    schemaVersion: PIPELINE_STATE_SCHEMA_VERSION,
    tool: PIPELINE_STATE_TOOL,
    status: "pending",
    phase: startPhase,
    round: 0,
    completedSteps: [],
    failedSteps: [],
    scoreSummary: createInitialScoreSummary(config),
    improvement: createInitialImprovement(config),
    export: createInitialExport(),
    report: createInitialReport(),
    config: snapshotConfig(config),
    resume: createInitialResume(config),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * pipeline state を部分更新する
 * @param {object} state
 * @param {object} patch
 * @returns {object}
 */
export function updatePipelineState(state, patch) {
  return {
    ...state,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 相対または絶対パスを絶対パスに変換する
 * @param {string} outputDir
 * @returns {string}
 */
function resolveOutputDir(outputDir) {
  return path.isAbsolute(outputDir)
    ? path.normalize(outputDir)
    : path.join(PROJECT_ROOT, outputDir);
}

/**
 * pipeline state をファイルに書き込む
 * @param {object} state
 * @param {string} [outputDir=DEFAULT_PIPELINE_STATE_DIR]
 * @returns {Promise<string>} 書き込んだファイルのプロジェクト相対パス
 */
export async function writePipelineState(
  state,
  outputDir = DEFAULT_PIPELINE_STATE_DIR,
) {
  const absoluteDir = resolveOutputDir(outputDir);
  const absolutePath = path.join(absoluteDir, PIPELINE_STATE_FILENAME);

  await fs.mkdir(absoluteDir, { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");

  return path.relative(PROJECT_ROOT, absolutePath).split(path.sep).join("/");
}

/**
 * pipeline state をファイルから読み込む
 * @param {string} [outputDir=DEFAULT_PIPELINE_STATE_DIR]
 * @returns {Promise<object>}
 */
export async function readPipelineState(outputDir = DEFAULT_PIPELINE_STATE_DIR) {
  const absolutePath = path.join(
    resolveOutputDir(outputDir),
    PIPELINE_STATE_FILENAME,
  );

  let raw;
  try {
    raw = await fs.readFile(absolutePath, "utf-8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new InputConfigurationError(
        `pipeline_state.json が見つかりません: ${path.relative(PROJECT_ROOT, absolutePath)}`,
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new InputConfigurationError(
      `pipeline_state.json の読み込みに失敗しました: ${message}`,
    );
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new InputConfigurationError("pipeline_state.json の JSON 形式が不正です。");
  }
}

/**
 * 完了 Phase を記録する
 * @param {object} state
 * @param {string} phase
 * @returns {object}
 */
export function appendCompletedStep(state, phase) {
  const completedSteps = state.completedSteps.includes(phase)
    ? [...state.completedSteps]
    : [...state.completedSteps, phase];

  return updatePipelineState(state, {
    completedSteps,
    phase,
  });
}

/**
 * 失敗 Phase を記録する
 * @param {object} state
 * @param {string} phase
 * @param {string} reason
 * @returns {object}
 */
export function appendFailedStep(state, phase, reason) {
  const failedSteps = [
    ...state.failedSteps,
    {
      phase,
      reason,
      at: new Date().toISOString(),
    },
  ];

  return updatePipelineState(state, {
    failedSteps,
    phase: PIPELINE_PHASES.FAILED,
    status: "failed",
    lastError: reason,
  });
}

/**
 * 改善ラウンド結果を state に記録する
 * @param {object} state
 * @param {object} entry
 * @returns {object}
 */
export function recordImprovementRound(state, entry) {
  const improvement = state.improvement ?? createInitialImprovement(state.config ?? {});

  const historyEntry = {
    round: entry.round,
    status: entry.status,
    totalTargets: entry.totalTargets,
    autoFixableTargets: entry.autoFixableTargets,
    manualReviewTargets: entry.manualReviewTargets,
    targets: entry.targets,
    manifestPath: entry.manifestPath ?? null,
    improvedCount: entry.improvedCount ?? null,
    failedCount: entry.failedCount ?? null,
    executedActions: entry.executedActions ?? null,
    successfulActions: entry.successfulActions ?? null,
    failedActions: entry.failedActions ?? null,
    skippedActions: entry.skippedActions ?? null,
    scoreBefore: entry.scoreBefore ?? null,
    scoreAfter: entry.scoreAfter ?? null,
    scoreDelta: entry.scoreDelta ?? null,
  };

  return updatePipelineState(state, {
    improvement: {
      ...improvement,
      roundsExecuted: entry.round,
      lastPlan: entry.plan ?? improvement.lastPlan,
      lastManifestPath: entry.manifestPath ?? improvement.lastManifestPath ?? null,
      history: [...improvement.history, historyEntry],
    },
  });
}

/**
 * 直近の改善ラウンド history エントリを更新する
 * @param {object} state
 * @param {object} roundStats
 * @returns {object}
 */
export function updateLastImprovementHistoryEntry(state, roundStats) {
  const improvement = state.improvement ?? createInitialImprovement(state.config ?? {});
  const history = [...(improvement.history ?? [])];

  if (history.length === 0) {
    return state;
  }

  history[history.length - 1] = {
    ...history[history.length - 1],
    ...roundStats,
  };

  return updatePipelineState(state, {
    improvement: {
      ...improvement,
      history,
    },
  });
}

/**
 * export 結果を state に記録する
 * @param {object} state
 * @param {object} exportResult
 * @returns {object}
 */
export function recordExportResult(state, exportResult) {
  return updatePipelineState(state, {
    export: {
      completed: exportResult.exportCompleted ?? false,
      skipped: exportResult.skipped ?? true,
      skipReason: exportResult.skipReason ?? null,
      mode: exportResult.mode ?? null,
      path: exportResult.exportPath ?? null,
      manifestPath: exportResult.manifestPath ?? null,
      improvedAdoptedCount: exportResult.improvedAdoptedCount ?? 0,
      originalCount: exportResult.originalCount ?? 0,
    },
  });
}

/**
 * report 結果を state に記録する
 * @param {object} state
 * @param {object} reportResult
 * @returns {object}
 */
export function recordReportResult(state, reportResult) {
  return updatePipelineState(state, {
    report: {
      generated: true,
      jsonPath: reportResult.jsonPath ?? null,
      mdPath: reportResult.mdPath ?? null,
      generatedAt: reportResult.report?.generatedAt ?? new Date().toISOString(),
    },
  });
}
