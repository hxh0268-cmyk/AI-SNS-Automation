import fs from "node:fs/promises";
import path from "node:path";
import { InputConfigurationError } from "./exit_codes.js";
import { PROJECT_ROOT } from "./pipeline_state.js";

/** metrics スキーマバージョン */
export const PIPELINE_METRICS_SCHEMA_VERSION = "1.0";

/** metrics ツール識別子 */
export const PIPELINE_METRICS_TOOL = "quality_pipeline_metrics";

/** デフォルト出力ディレクトリ（プロジェクト相対） */
export const DEFAULT_PIPELINE_METRICS_DIR = "reports/quality-pipeline/latest";

/** デフォルト metrics ファイル名 */
export const PIPELINE_METRICS_FILENAME = "metrics.json";

/**
 * 空の pipeline metrics を生成する
 * @returns {object}
 */
export function createPipelineMetrics() {
  return {
    schemaVersion: PIPELINE_METRICS_SCHEMA_VERSION,
    tool: PIPELINE_METRICS_TOOL,
    startedAt: null,
    finishedAt: null,
    elapsedMs: null,
    totalApiCalls: 0,
    geminiCalls: 0,
    openaiCalls: 0,
    nanoBananaCalls: 0,
    failedCalls: 0,
    estimatedCostUsd: null,
    limitZeroDetected: false,
    byPhase: {},
    byRound: [],
    improvement: {
      roundsExecuted: 0,
      plannedActions: 0,
      autoFixableTargets: 0,
      manualReviewTargets: 0,
      executedNanoBanana: 0,
      executedGeminiReReview: 0,
      executedSmartAutoFix: 0,
      successfulSmartAutoFix: 0,
      failedSmartAutoFix: 0,
      executedRegeneration: 0,
      successfulRegeneration: 0,
      failedRegeneration: 0,
      limitZeroDetected: false,
      stopReason: null,
      lastRound: null,
    },
    export: {
      completed: false,
      skipped: true,
      skipReason: null,
      mode: null,
      path: null,
      improvedAdoptedCount: 0,
      originalCount: 0,
    },
    report: {
      generated: false,
      jsonPath: null,
      mdPath: null,
      generatedAt: null,
    },
  };
}

/**
 * metrics 計測を開始する
 * @param {object} metrics
 * @returns {object}
 */
export function startMetrics(metrics) {
  const startedAt = new Date().toISOString();
  return {
    ...metrics,
    startedAt,
    finishedAt: null,
    elapsedMs: null,
  };
}

/**
 * metrics 計測を終了する
 * @param {object} metrics
 * @returns {object}
 */
export function finishMetrics(metrics) {
  const finishedAt = new Date().toISOString();
  const elapsedMs =
    metrics.startedAt !== null
      ? Math.max(0, Date.parse(finishedAt) - Date.parse(metrics.startedAt))
      : null;

  return {
    ...metrics,
    finishedAt,
    elapsedMs,
  };
}

/**
 * Phase 別 metrics エントリを取得または初期化する
 * @param {object} metrics
 * @param {string} phase
 * @returns {object}
 */
function getPhaseMetrics(metrics, phase) {
  if (!metrics.byPhase[phase]) {
    metrics.byPhase[phase] = {
      geminiCalls: 0,
      openaiCalls: 0,
      nanoBananaCalls: 0,
      failedCalls: 0,
      elapsedMs: 0,
    };
  }

  return metrics.byPhase[phase];
}

/**
 * provider 名を metrics フィールドにマップする
 * @param {string} provider
 * @returns {"geminiCalls" | "openaiCalls" | "nanoBananaCalls" | null}
 */
function providerField(provider) {
  switch (provider) {
    case "gemini":
      return "geminiCalls";
    case "openai":
      return "openaiCalls";
    case "nano_banana":
      return "nanoBananaCalls";
    default:
      return null;
  }
}

/**
 * API 呼び出し成功を記録する
 * @param {object} metrics
 * @param {string} provider
 * @param {string} [phase]
 * @returns {object}
 */
export function incrementApiCall(metrics, provider, phase) {
  const field = providerField(provider);
  const next = {
    ...metrics,
    totalApiCalls: metrics.totalApiCalls + 1,
  };

  if (field) {
    next[field] = metrics[field] + 1;
  }

  if (phase) {
    const phaseMetrics = { ...getPhaseMetrics(next, phase) };
    if (field) {
      phaseMetrics[field] = phaseMetrics[field] + 1;
    }
    next.byPhase = {
      ...next.byPhase,
      [phase]: phaseMetrics,
    };
  }

  return next;
}

/**
 * API 呼び出し失敗を記録する
 * @param {object} metrics
 * @param {string} provider
 * @param {string} [phase]
 * @param {unknown} [error]
 * @returns {object}
 */
export function recordFailedCall(metrics, provider, phase, error) {
  let next = {
    ...metrics,
    failedCalls: metrics.failedCalls + 1,
  };

  if (phase) {
    const phaseMetrics = {
      ...getPhaseMetrics(next, phase),
      failedCalls: getPhaseMetrics(next, phase).failedCalls + 1,
    };
    next.byPhase = {
      ...next.byPhase,
      [phase]: phaseMetrics,
    };
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/limit:\s*0\b/i.test(message) && /429/.test(message)) {
    next.limitZeroDetected = true;
  }

  return next;
}

/**
 * Phase 実行時間を記録する
 * @param {object} metrics
 * @param {string} phase
 * @param {number} startedAt - epoch ms
 * @param {number} endedAt - epoch ms
 * @returns {object}
 */
export function recordPhaseTiming(metrics, phase, startedAt, endedAt) {
  const elapsedMs = Math.max(0, endedAt - startedAt);
  const phaseMetrics = {
    ...getPhaseMetrics(metrics, phase),
    elapsedMs: getPhaseMetrics(metrics, phase).elapsedMs + elapsedMs,
  };

  return {
    ...metrics,
    byPhase: {
      ...metrics.byPhase,
      [phase]: phaseMetrics,
    },
  };
}

/**
 * Phase 実行結果概要を metrics に記録する
 * @param {object} metrics
 * @param {string} phase
 * @param {object} summary
 * @returns {object}
 */
export function recordPhaseSummary(metrics, phase, summary) {
  const phaseMetrics = {
    ...getPhaseMetrics(metrics, phase),
    summary,
  };

  return {
    ...metrics,
    byPhase: {
      ...metrics.byPhase,
      [phase]: phaseMetrics,
    },
  };
}

/**
 * 改善 plan を metrics に記録する
 * @param {object} metrics
 * @param {object} plan
 * @returns {object}
 */
export function recordImprovementMetrics(metrics, plan) {
  const improvement = metrics.improvement ?? {
    roundsExecuted: 0,
    plannedActions: 0,
    autoFixableTargets: 0,
    manualReviewTargets: 0,
    executedNanoBanana: 0,
    executedGeminiReReview: 0,
  };

  return {
    ...metrics,
    improvement: {
      ...improvement,
      roundsExecuted: plan.round,
      plannedActions: improvement.plannedActions + plan.totalTargets,
      autoFixableTargets: improvement.autoFixableTargets + plan.autoFixableTargets,
      manualReviewTargets: improvement.manualReviewTargets + plan.manualReviewTargets,
    },
  };
}

/**
 * 改善実行結果を metrics に記録する
 * @param {object} metrics
 * @param {object} summary
 * @returns {object}
 */
export function recordImprovementExecutionMetrics(metrics, summary) {
  const improvement = metrics.improvement ?? {
    roundsExecuted: 0,
    plannedActions: 0,
    autoFixableTargets: 0,
    manualReviewTargets: 0,
    executedNanoBanana: 0,
    executedGeminiReReview: 0,
    executedSmartAutoFix: 0,
    successfulSmartAutoFix: 0,
    failedSmartAutoFix: 0,
    executedRegeneration: 0,
    successfulRegeneration: 0,
    failedRegeneration: 0,
    limitZeroDetected: false,
    stopReason: null,
    lastRound: null,
  };

  const limitZeroDetected =
    summary.limitZeroDetected ||
    metrics.limitZeroDetected ||
    improvement.limitZeroDetected;

  const previousLastRound = improvement.lastRound ?? {};
  const sameRound = previousLastRound.round === summary.round;
  const baseSuccessful = sameRound ? (previousLastRound.successfulActions ?? 0) : 0;
  const baseFailed = sameRound ? (previousLastRound.failedActions ?? 0) : 0;
  const baseSkipped = sameRound ? (previousLastRound.skippedActions ?? 0) : 0;
  const baseExecuted = sameRound ? (previousLastRound.executedActions ?? 0) : 0;

  const lastRound = {
    round: summary.round ?? previousLastRound.round ?? null,
    executedActions: baseExecuted + (summary.executedActions ?? 0),
    successfulActions: baseSuccessful + (summary.successfulActions ?? 0),
    failedActions: baseFailed + (summary.failedActions ?? 0),
    skippedActions: baseSkipped + (summary.skippedActions ?? 0),
    scoreBefore: summary.scoreBefore ?? previousLastRound.scoreBefore ?? null,
    scoreAfter: summary.scoreAfter ?? previousLastRound.scoreAfter ?? null,
    scoreDelta:
      summary.scoreDelta ??
      (summary.scoreBefore && summary.scoreAfter
        ? {
            averageScore:
              (summary.scoreAfter.averageScore ?? 0) -
              (summary.scoreBefore.averageScore ?? 0),
            minScore:
              (summary.scoreAfter.minScore ?? 0) - (summary.scoreBefore.minScore ?? 0),
          }
        : (previousLastRound.scoreDelta ?? { averageScore: 0, minScore: 0 })),
    improvedCount:
      summary.improvedCount !== undefined
        ? summary.improvedCount
        : sameRound
          ? (previousLastRound.improvedCount ?? 0)
          : 0,
    failedImproveCount:
      summary.failedImproveCount !== undefined
        ? summary.failedImproveCount
        : sameRound
          ? (previousLastRound.failedImproveCount ?? 0)
          : 0,
    reviewedCount:
      summary.reviewedCount !== undefined
        ? summary.reviewedCount
        : sameRound
          ? (previousLastRound.reviewedCount ?? 0)
          : 0,
    failedReviewCount:
      summary.failedReviewCount !== undefined
        ? summary.failedReviewCount
        : sameRound
          ? (previousLastRound.failedReviewCount ?? 0)
          : 0,
    manualReviewOnly:
      summary.manualReviewOnly ?? previousLastRound.manualReviewOnly ?? false,
    limitZeroDetected,
  };

  return {
    ...metrics,
    limitZeroDetected,
    improvement: {
      ...improvement,
      roundsExecuted: summary.round ?? improvement.roundsExecuted,
      executedNanoBanana:
        improvement.executedNanoBanana + (summary.nanoBananaExecuted ?? 0),
      executedGeminiReReview:
        improvement.executedGeminiReReview + (summary.geminiReReviewExecuted ?? 0),
      executedSmartAutoFix:
        improvement.executedSmartAutoFix + (summary.executedSmartAutoFix ?? 0),
      successfulSmartAutoFix:
        improvement.successfulSmartAutoFix + (summary.successfulSmartAutoFix ?? 0),
      failedSmartAutoFix:
        improvement.failedSmartAutoFix + (summary.failedSmartAutoFix ?? 0),
      executedRegeneration:
        improvement.executedRegeneration + (summary.executedRegeneration ?? 0),
      successfulRegeneration:
        improvement.successfulRegeneration + (summary.successfulRegeneration ?? 0),
      failedRegeneration:
        improvement.failedRegeneration + (summary.failedRegeneration ?? 0),
      limitZeroDetected,
      lastRound,
    },
  };
}

/**
 * 改善ラウンド結果を metrics に記録する
 * @param {object} metrics
 * @param {object} lastRoundResult
 * @param {string | null} [stopReason]
 * @returns {object}
 */
export function recordImprovementRoundResult(metrics, lastRoundResult, stopReason = null) {
  const improvement = metrics.improvement ?? {
    roundsExecuted: 0,
    plannedActions: 0,
    autoFixableTargets: 0,
    manualReviewTargets: 0,
    executedNanoBanana: 0,
    executedGeminiReReview: 0,
    executedSmartAutoFix: 0,
    successfulSmartAutoFix: 0,
    failedSmartAutoFix: 0,
    executedRegeneration: 0,
    successfulRegeneration: 0,
    failedRegeneration: 0,
    limitZeroDetected: false,
    stopReason: null,
    lastRound: null,
  };

  const limitZeroDetected =
    Boolean(lastRoundResult?.limitZeroDetected) ||
    metrics.limitZeroDetected ||
    improvement.limitZeroDetected;

  return {
    ...metrics,
    limitZeroDetected,
    improvement: {
      ...improvement,
      limitZeroDetected,
      stopReason: stopReason ?? improvement.stopReason,
      lastRound: lastRoundResult,
    },
  };
}

/**
 * report 結果を metrics に記録する
 * @param {object} metrics
 * @param {object} reportResult
 * @returns {object}
 */
export function recordReportMetrics(metrics, reportResult) {
  return {
    ...metrics,
    report: {
      generated: true,
      jsonPath: reportResult.jsonPath ?? null,
      mdPath: reportResult.mdPath ?? null,
      generatedAt: reportResult.report?.generatedAt ?? new Date().toISOString(),
    },
  };
}

/**
 * export 結果を metrics に記録する
 * @param {object} metrics
 * @param {object} exportResult
 * @returns {object}
 */
export function recordExportMetrics(metrics, exportResult) {
  return {
    ...metrics,
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
  };
}

/**
 * ラウンド別 metrics を追記する
 * @param {object} metrics
 * @param {object} roundMetrics
 * @returns {object}
 */
export function appendRoundMetrics(metrics, roundMetrics) {
  return {
    ...metrics,
    byRound: [...metrics.byRound, roundMetrics],
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
 * metrics をファイルに書き込む
 * @param {object} metrics
 * @param {string} [outputDir=DEFAULT_PIPELINE_METRICS_DIR]
 * @returns {Promise<string>}
 */
export async function writePipelineMetrics(
  metrics,
  outputDir = DEFAULT_PIPELINE_METRICS_DIR,
) {
  const absoluteDir = resolveOutputDir(outputDir);
  const absolutePath = path.join(absoluteDir, PIPELINE_METRICS_FILENAME);

  await fs.mkdir(absoluteDir, { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(metrics, null, 2)}\n`, "utf-8");

  return path.relative(PROJECT_ROOT, absolutePath).split(path.sep).join("/");
}

/**
 * metrics をファイルから読み込む
 * @param {string} [outputDir=DEFAULT_PIPELINE_METRICS_DIR]
 * @returns {Promise<object>}
 */
export async function readPipelineMetrics(outputDir = DEFAULT_PIPELINE_METRICS_DIR) {
  const absolutePath = path.join(
    resolveOutputDir(outputDir),
    PIPELINE_METRICS_FILENAME,
  );

  let raw;
  try {
    raw = await fs.readFile(absolutePath, "utf-8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new InputConfigurationError(
        `metrics.json が見つかりません: ${path.relative(PROJECT_ROOT, absolutePath)}`,
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new InputConfigurationError(`metrics.json の読み込みに失敗しました: ${message}`);
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new InputConfigurationError("metrics.json の JSON 形式が不正です。");
  }
}
