import { spawn } from "node:child_process";
import path from "node:path";
import { HEALTH_CHECK_JSON_MARKER } from "../health_check.js";
import {
  applyImprovementPlaceholder,
  applyImprovementPlan,
  applyReReviewFromManifest,
  createImprovementPlan,
} from "./pipeline_improvement.js";
import {
  runInstagramPackageExport,
  selectExportImages,
} from "./pipeline_export.js";
import { generatePipelineReport } from "./pipeline_report.js";
import { getPhaseLabel, PIPELINE_PHASES } from "./phases.js";
import { readImageReviewScoreSummary } from "./pipeline_score.js";
import { PROJECT_ROOT } from "./pipeline_state.js";

/**
 * dry-run 用 planned result
 * @param {string} phase
 * @param {object} context
 * @param {object} [extraData]
 * @returns {{ phase: string, status: "planned", message: string, data: object }}
 */
function buildPlannedResult(phase, context, extraData = {}) {
  const label = getPhaseLabel(phase);
  const message = context.skipped
    ? `skipped:${phase}`
    : `planned:${phase}`;

  console.log(
    `[QualityPipeline] [dry-run] ${phase}: ${label} (${message})`,
  );

  return {
    phase,
    status: "planned",
    message,
    data: {
      mode: "dry-run",
      skipped: context.skipped ?? false,
      ...extraData,
    },
  };
}

/**
 * apply 用 placeholder result（未接続 Phase）
 * @param {string} phase
 * @param {object} context
 * @param {object} [extraData]
 * @returns {{ phase: string, status: "completed" | "skipped", message: string, data: object }}
 */
function buildPlaceholderResult(phase, context, extraData = {}) {
  const label = getPhaseLabel(phase);
  const message = context.skipped
    ? `skipped:${phase}`
    : `placeholder:${phase}`;

  console.log(`[QualityPipeline] [apply] ${phase}: ${label} (${message})`);

  return {
    phase,
    status: context.skipped ? "skipped" : "completed",
    message,
    data: {
      mode: "apply",
      placeholder: true,
      skipped: context.skipped ?? false,
      ...extraData,
    },
  };
}

/**
 * health check stdout から件数を regex 抽出する（JSON パース失敗時の fallback）
 * @param {string} output
 * @returns {{ okCount: number, warningCount: number, errorCount: number }}
 */
export function parseHealthCheckCountsFromStdout(output) {
  const errorMatch = output.match(/Error:\s*(\d+)\s*件/);
  const warningMatch = output.match(/Warning:\s*(\d+)\s*件/);
  const okMatch = output.match(/OK:\s*(\d+)\s*件/);

  return {
    okCount: okMatch ? Number(okMatch[1]) : 0,
    warningCount: warningMatch ? Number(warningMatch[1]) : 0,
    errorCount: errorMatch ? Number(errorMatch[1]) : 0,
  };
}

/**
 * health check stdout から JSON ブロックをパースする
 * @param {string} output
 * @returns {{ parsed: boolean, okCount: number, warningCount: number, errorCount: number, items: object[] }}
 */
export function parseHealthCheckStdout(output) {
  const markerIndex = output.lastIndexOf(HEALTH_CHECK_JSON_MARKER);
  if (markerIndex >= 0) {
    const jsonText = output.slice(markerIndex + HEALTH_CHECK_JSON_MARKER.length).trim();
    try {
      const payload = JSON.parse(jsonText);
      if (
        payload &&
        typeof payload.ok === "number" &&
        typeof payload.warning === "number" &&
        typeof payload.error === "number" &&
        Array.isArray(payload.items)
      ) {
        return {
          parsed: true,
          okCount: payload.ok,
          warningCount: payload.warning,
          errorCount: payload.error,
          items: payload.items,
        };
      }
    } catch {
      // fallback to regex below
    }
  }

  const counts = parseHealthCheckCountsFromStdout(output);
  return {
    parsed: false,
    ...counts,
    items: [],
  };
}

/**
 * health check 実行結果から metrics 用 summary を組み立てる
 * @param {ReturnType<typeof parseHealthCheckStdout>} parsed
 * @returns {object}
 */
export function buildHealthCheckSummaryData(parsed) {
  const items = parsed.items ?? [];
  const errors = items.filter((item) => item.status === "error");
  const okCount = parsed.okCount ?? 0;
  const warningCount = parsed.warningCount ?? 0;
  const errorCount = parsed.errorCount ?? 0;

  return {
    ok: errorCount === 0,
    okCount,
    warningCount,
    errorCount,
    items,
    errors,
    jsonParsed: parsed.parsed,
  };
}

/**
 * HEALTH_CHECK 失敗時に個別エラーをログ出力する
 * @param {object[]} errors
 */
function logHealthCheckErrors(errors) {
  for (const item of errors) {
    console.log(
      `[QualityPipeline] [apply] HEALTH_CHECK: ❌ ${item.label}: ${item.detail}`,
    );
  }
}

/**
 * health check を subprocess で実行する
 * @returns {Promise<{ ok: boolean, errorCount: number, warningCount: number, okCount: number, stdout: string, healthCheck: object }>}
 */
async function runHealthCheckSubprocess() {
  const scriptPath = path.join(PROJECT_ROOT, "src/health_check.js");

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, "--json"], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        HEALTH_CHECK_JSON: "1",
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);

    child.on("close", () => {
      const combined = stdout + stderr;
      const parsed = parseHealthCheckStdout(combined);
      const healthCheck = buildHealthCheckSummaryData(parsed);

      resolve({
        ok: healthCheck.errorCount === 0,
        errorCount: healthCheck.errorCount,
        warningCount: healthCheck.warningCount,
        okCount: healthCheck.okCount,
        stdout: combined,
        healthCheck,
      });
    });
  });
}

/**
 * HEALTH_CHECK Phase を実行する
 * @param {object} context
 * @returns {Promise<object>}
 */
async function runHealthCheckPhase(context) {
  console.log("[QualityPipeline] [apply] HEALTH_CHECK: Health Check を実行します");

  const result = await runHealthCheckSubprocess();
  const summary = result.healthCheck;

  if (!result.ok) {
    logHealthCheckErrors(summary.errors ?? []);
    return {
      phase: PIPELINE_PHASES.HEALTH_CHECK,
      status: "failed",
      message: `Health Check failed: Error ${result.errorCount} 件`,
      data: {
        healthCheck: summary,
      },
    };
  }

  return {
    phase: PIPELINE_PHASES.HEALTH_CHECK,
    status: "completed",
    message: `Health Check passed: OK ${result.okCount} 件, Warning ${result.warningCount} 件`,
    data: {
      healthCheck: summary,
    },
  };
}

/**
 * IMAGE_REVIEW Phase（dry-run: 既存 JSON から計画用 score を読む）
 * @param {object} context
 * @returns {Promise<object>}
 */
async function runImageReviewPhaseDryRun(context) {
  const reviewResult = await readImageReviewScoreSummary(context.config);

  if (reviewResult.found && reviewResult.summary) {
    console.log(
      `[QualityPipeline] [dry-run] IMAGE_REVIEW: 画像レビュー (planned, scores from ${reviewResult.path})`,
    );
    logScoreSummaryStatus(reviewResult.summary);

    return {
      phase: PIPELINE_PHASES.IMAGE_REVIEW,
      status: "planned",
      message: `planned:IMAGE_REVIEW (scores from ${reviewResult.path})`,
      data: {
        mode: "dry-run",
        scoreSummary: reviewResult.summary,
        scoreSummaryLoaded: reviewResult.summary.slides.length > 0,
        sourcePath: reviewResult.path,
        source: reviewResult.source,
      },
    };
  }

  return buildPlannedResult(PIPELINE_PHASES.IMAGE_REVIEW, context, {
    scoreSummaryLoaded: false,
  });
}

/**
 * IMAGE_REVIEW Phase を実行する（既存 JSON 読み込みのみ）
 * @param {object} context
 * @returns {Promise<object>}
 */
async function runImageReviewPhase(context) {
  console.log(
    "[QualityPipeline] [apply] IMAGE_REVIEW: 既存レビュー結果を読み込みます（API 未実行）",
  );

  const reviewResult = await readImageReviewScoreSummary(context.config);

  if (!reviewResult.found || !reviewResult.summary) {
    return {
      phase: PIPELINE_PHASES.IMAGE_REVIEW,
      status: "skipped",
      message: "画像レビュー結果ファイルが見つからないか、スコアを抽出できませんでした",
      data: {
        scoreSummary: null,
        scoreSummaryLoaded: false,
        sourcePath: null,
      },
    };
  }

  const { summary } = reviewResult;
  console.log(
    `[QualityPipeline] [apply] IMAGE_REVIEW: ${reviewResult.path} を読み込み (avg=${summary.averageScore}, min=${summary.minScore})`,
  );

  logScoreSummaryStatus(summary);

  return {
    phase: PIPELINE_PHASES.IMAGE_REVIEW,
    status: "completed",
    message: `画像レビュー結果を読み込み: ${reviewResult.path}`,
    data: {
      scoreSummary: summary,
      scoreSummaryLoaded: summary.slides.length > 0,
      sourcePath: reviewResult.path,
      source: reviewResult.source,
    },
  };
}

/**
 * scoreSummary の状態をログ出力する
 * @param {object} summary
 */
function logScoreSummaryStatus(summary) {
  if (summary.allSlidesPublishRecommended) {
    console.log("[QualityPipeline] 全スライドが targetScore 以上です");
  } else if (summary.allSlidesPassed) {
    console.log(
      "[QualityPipeline] 全スライドが passingScore 以上ですが、targetScore 未達のスライドがあります",
    );
  }
}

/**
 * IMPROVEMENT Phase を実行する
 * @param {object} context
 * @returns {Promise<object>}
 */
async function runImprovementPhase(context) {
  const plan =
    context.plan ??
    createImprovementPlan(context.state.scoreSummary, {
      ...context.config,
      round: context.round,
    });

  if (context.dryRun) {
    await applyImprovementPlaceholder(plan, context);
    return buildPlannedResult(PIPELINE_PHASES.IMPROVEMENT, context, {
      improvementPlan: plan,
    });
  }

  const applyResult = await applyImprovementPlan(plan, context);

  return {
    phase: PIPELINE_PHASES.IMPROVEMENT,
    status: applyResult.status === "failed" ? "completed" : "completed",
    message: `Improvement round ${plan.round}: improved=${applyResult.improvedCount}, failed=${applyResult.failedCount}, placeholder=${applyResult.placeholderCount}`,
    data: {
      improvementPlan: plan,
      improvementResult: applyResult.improvementResult,
      manifestPath: applyResult.manifestPath,
      metrics: applyResult.metrics,
      limitZeroDetected: applyResult.limitZeroDetected,
    },
  };
}

/**
 * RE_REVIEW Phase を実行する（既存 JSON の再評価のみ）
 * @param {object} context
 * @returns {Promise<object>}
 */
async function runReReviewPhase(context) {
  if (context.dryRun) {
    return buildPlannedResult(PIPELINE_PHASES.RE_REVIEW, context, {
      round: context.round,
    });
  }

  const manifestPath =
    context.state?.improvement?.lastManifestPath ?? "output/carousel/improved/manifest.json";

  const reReviewResult = await applyReReviewFromManifest(context, manifestPath);

  if (!reReviewResult.scoreSummary) {
    return {
      phase: PIPELINE_PHASES.RE_REVIEW,
      status: "skipped",
      message: reReviewResult.message,
      data: {
        scoreSummaryLoaded: false,
        round: context.round,
        metrics: reReviewResult.metrics,
      },
    };
  }

  return {
    phase: PIPELINE_PHASES.RE_REVIEW,
    status: "completed",
    message: reReviewResult.message,
    data: {
      scoreSummary: reReviewResult.scoreSummary,
      scoreSummaryLoaded: reReviewResult.scoreSummaryLoaded,
      reReview: true,
      round: context.round,
      reviewResultPath: reReviewResult.reviewResultPath,
      metrics: reReviewResult.metrics,
      limitZeroDetected: reReviewResult.limitZeroDetected,
    },
  };
}

/**
 * EXPORT Phase（dry-run: ファイル出力なし）
 * @param {object} context
 * @returns {Promise<object>}
 */
async function runExportPhaseDryRun(context) {
  const selections = await selectExportImages(context.state, context.config);
  const improvedAdoptedCount = selections.filter((item) => item.adoptedImproved).length;
  const allPublishRecommended =
    context.state.scoreSummary?.allSlidesPublishRecommended ?? false;
  const allPassed = context.state.scoreSummary?.allSlidesPassed ?? false;
  const wouldExport =
    allPublishRecommended ||
    (context.config.allowPartialExport && allPassed);

  console.log(
    `[QualityPipeline] [dry-run] EXPORT: planned (wouldExport=${wouldExport}, improved=${improvedAdoptedCount}/${selections.length})`,
  );

  return buildPlannedResult(PIPELINE_PHASES.EXPORT, context, {
    exportSelections: selections,
    exportWouldRun: wouldExport,
    improvedAdoptedCount,
  });
}

/**
 * EXPORT Phase を実行する
 * @param {object} context
 * @returns {Promise<object>}
 */
async function runExportPhase(context) {
  if (context.skipped) {
    return buildPlaceholderResult(PIPELINE_PHASES.EXPORT, context, {
      exportResult: {
        exportAllowed: false,
        exportCompleted: false,
        skipped: true,
        skipReason: "SKIP_EXPORT_FLAG",
      },
    });
  }

  const exportResult = await runInstagramPackageExport(
    context.state,
    context.config,
    {
      outputDir: context.outputDir,
    },
  );

  return {
    phase: PIPELINE_PHASES.EXPORT,
    status: exportResult.status === "completed" ? "completed" : "skipped",
    message: exportResult.message,
    data: {
      exportResult,
      exportPath: exportResult.exportPath ?? null,
      exportManifestPath: exportResult.manifestPath ?? null,
    },
  };
}

/**
 * REPORT Phase を実行する（dry-run / apply 共通）
 * @param {object} context
 * @returns {Promise<object>}
 */
async function runReportPhase(context) {
  const mode = context.dryRun ? "dry-run" : "apply";
  const reportResult = await generatePipelineReport(context);

  console.log(
    `[QualityPipeline] [${mode}] REPORT: ${reportResult.jsonPath}, ${reportResult.mdPath}`,
  );

  return {
    phase: PIPELINE_PHASES.REPORT,
    status: "completed",
    message: `Report generated: ${reportResult.jsonPath}, ${reportResult.mdPath}`,
    data: {
      reportResult,
    },
  };
}

/**
 * Phase ごとの処理を実行する
 * @param {string} phase
 * @param {object} context
 * @returns {Promise<{ phase: string, status: "planned" | "completed" | "skipped" | "failed", message: string, data: object }>}
 */
export async function runPipelinePhase(phase, context) {
  const dryRun = context.dryRun ?? context.config?.dryRun ?? true;

  if (context.skipped) {
    if (dryRun) {
      return buildPlannedResult(phase, context);
    }
    return buildPlaceholderResult(phase, context);
  }

  if (dryRun) {
    if (phase === PIPELINE_PHASES.IMAGE_REVIEW) {
      return runImageReviewPhaseDryRun(context);
    }
    if (phase === PIPELINE_PHASES.IMPROVEMENT) {
      return runImprovementPhase(context);
    }
    if (phase === PIPELINE_PHASES.RE_REVIEW) {
      return buildPlannedResult(phase, context, { round: context.round });
    }
    if (phase === PIPELINE_PHASES.EXPORT) {
      return runExportPhaseDryRun(context);
    }
    if (phase === PIPELINE_PHASES.REPORT) {
      return runReportPhase(context);
    }
    return buildPlannedResult(phase, context);
  }

  switch (phase) {
    case PIPELINE_PHASES.HEALTH_CHECK:
      return runHealthCheckPhase(context);
    case PIPELINE_PHASES.IMAGE_REVIEW:
      return runImageReviewPhase(context);
    case PIPELINE_PHASES.IMPROVEMENT:
      return runImprovementPhase(context);
    case PIPELINE_PHASES.RE_REVIEW:
      return runReReviewPhase(context);
    case PIPELINE_PHASES.EXPORT:
      return runExportPhase(context);
    case PIPELINE_PHASES.REPORT:
      return runReportPhase(context);
    default:
      return buildPlaceholderResult(phase, context);
  }
}
