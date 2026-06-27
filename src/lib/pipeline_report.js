import fs from "node:fs/promises";
import path from "node:path";
import { SLIDE_COUNT } from "./carousel.js";
import { EXPORT_MANIFEST_FILENAME } from "./pipeline_export.js";
import { PIPELINE_METRICS_FILENAME } from "./pipeline_metrics.js";
import {
  DEFAULT_PIPELINE_STATE_DIR,
  PIPELINE_STATE_FILENAME,
  PROJECT_ROOT,
} from "./pipeline_state.js";

/** report.json スキーマ識別子（docs/REPORT_SCHEMA.md 参照） */
export const REPORT_SCHEMA_VERSION = "1.0";

/** quality pipeline report ツール識別子 */
export const REPORT_TOOL = "quality_pipeline_report";

/** レポート生成バージョン */
export const REPORT_VERSION = "v1.3.0";

/** report.json ファイル名 */
export const REPORT_JSON_FILENAME = "report.json";

/** report.md ファイル名 */
export const REPORT_MD_FILENAME = "report.md";

/**
 * export manifest を読み込む
 * @param {string} [outputDir]
 * @returns {Promise<object | null>}
 */
export async function readExportManifest(outputDir = DEFAULT_PIPELINE_STATE_DIR) {
  const manifestPath = path.join(outputDir, EXPORT_MANIFEST_FILENAME);
  const absolutePath = path.join(PROJECT_ROOT, manifestPath);

  try {
    const raw = await fs.readFile(absolutePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * improvement history から slide 別の改善情報を集約する
 * @param {object} state
 * @returns {Map<string, object>}
 */
function buildImprovementBySlideId(state) {
  /** @type {Map<string, object>} */
  const bySlideId = new Map();

  for (const roundEntry of state.improvement?.history ?? []) {
    for (const target of roundEntry.targets ?? []) {
      if (!target.slideId) {
        continue;
      }

      bySlideId.set(target.slideId, {
        round: roundEntry.round,
        tool: target.tool ?? null,
        improvementStatus: target.status ?? null,
        beforeScore: target.beforeScore ?? null,
        rootCause: target.rootCause ?? null,
        error: target.error ?? null,
        action: target.action ?? null,
      });
    }
  }

  return bySlideId;
}

/**
 * export manifest から slide 別の export 情報を集約する
 * @param {object | null | undefined} exportManifest
 * @returns {Map<string, object>}
 */
function buildExportSelectionBySlideId(exportManifest) {
  /** @type {Map<string, object>} */
  const bySlideId = new Map();

  for (const selection of exportManifest?.selections ?? []) {
    if (!selection.slideId) {
      continue;
    }
    bySlideId.set(selection.slideId, selection);
  }

  return bySlideId;
}

/**
 * recommendation を判定する
 * @param {object} params
 * @returns {string}
 */
function resolveRecommendation(params) {
  const {
    finalScore,
    targetScore,
    passingScore,
    improvementStatus,
    dryRun,
    wasImprovementTarget,
  } = params;

  if (improvementStatus === "failed") {
    return "improvement_failed";
  }

  if (typeof finalScore === "number") {
    if (finalScore >= targetScore) {
      return "publish_recommended";
    }
    if (finalScore >= passingScore) {
      return "passed";
    }
    return "needs_re_improvement";
  }

  if (dryRun && wasImprovementTarget) {
    return "review_pending";
  }

  return "review_pending";
}

/**
 * quality pipeline レポートを組み立てる
 * @param {object} params
 * @param {object} params.state
 * @param {object} params.metrics
 * @param {object | null} [params.exportManifest]
 * @param {object} params.config
 * @returns {object}
 */
export function buildPipelineReport({ state, metrics, exportManifest = null, config }) {
  const targetScore = config.targetScore ?? state.config?.targetScore ?? 90;
  const passingScore = config.passingScore ?? state.config?.passingScore ?? 80;
  const dryRun = config.dryRun ?? state.config?.dryRun ?? false;
  const scoreSummary = state.scoreSummary ?? { slides: [] };
  const improvementBySlideId = buildImprovementBySlideId(state);
  const exportBySlideId = buildExportSelectionBySlideId(exportManifest);
  const exportInfo = state.export ?? metrics.export ?? {};

  const items = (scoreSummary.slides ?? []).map((slide) => {
    const improvement = improvementBySlideId.get(slide.slideId) ?? null;
    const exportSelection = exportBySlideId.get(slide.slideId) ?? null;
    const beforeScore =
      improvement?.beforeScore ??
      exportSelection?.beforeScore ??
      slide.score ??
      null;
    const afterScore = slide.score ?? exportSelection?.score ?? null;
    const deltaScore =
      typeof beforeScore === "number" && typeof afterScore === "number"
        ? afterScore - beforeScore
        : null;

    const wasImprovementTarget = improvement !== null;

    return {
      slideId: slide.slideId,
      beforeScore,
      afterScore,
      deltaScore,
      rootCause: improvement?.rootCause ?? slide.rootCause ?? null,
      improvementTool: improvement?.tool ?? null,
      improvementStatus: improvement?.improvementStatus ?? null,
      reviewStatus:
        improvement?.improvementStatus === "improved"
          ? slide.source === "nano_banana_re_review"
            ? "reviewed"
            : "review_pending"
          : null,
      exportSource: exportSelection?.source ?? null,
      adoptedImproved: exportSelection?.adoptedImproved ?? false,
      publishRecommended: slide.publishRecommended ?? false,
      passed: slide.passed ?? false,
      source: slide.source ?? null,
      error: improvement?.error ?? null,
      recommendation: resolveRecommendation({
        finalScore: afterScore,
        targetScore,
        passingScore,
        improvementStatus: improvement?.improvementStatus ?? null,
        dryRun,
        wasImprovementTarget,
      }),
    };
  });

  const summary = {
    dryRun,
    targetScore,
    passingScore,
    finalAverageScore: scoreSummary.averageScore ?? null,
    finalMinScore: scoreSummary.minScore ?? null,
    allSlidesPassed: scoreSummary.allSlidesPassed ?? false,
    allSlidesPublishRecommended: scoreSummary.allSlidesPublishRecommended ?? false,
    totalSlides: scoreSummary.slides?.length ?? SLIDE_COUNT,
    roundsExecuted: state.improvement?.roundsExecuted ?? metrics.improvement?.roundsExecuted ?? 0,
    maxRounds: state.improvement?.maxRounds ?? config.maxRounds ?? 3,
    improvementStopReason:
      state.improvement?.stopReason ?? metrics.improvement?.stopReason ?? null,
    plannedActions: metrics.improvement?.plannedActions ?? 0,
    executedNanoBanana: metrics.improvement?.executedNanoBanana ?? 0,
    executedGeminiReReview: metrics.improvement?.executedGeminiReReview ?? 0,
    totalApiCalls: metrics.totalApiCalls ?? 0,
    failedCalls: metrics.failedCalls ?? 0,
    limitZeroDetected: metrics.limitZeroDetected ?? false,
    elapsedMs: metrics.elapsedMs ?? null,
    exportCompleted: exportInfo.completed ?? false,
    exportSkipped: exportInfo.skipped ?? true,
    exportSkipReason: exportInfo.skipReason ?? exportManifest?.skipReason ?? null,
    exportMode: exportInfo.mode ?? exportManifest?.mode ?? null,
    exportPath: exportInfo.path ?? exportManifest?.exportPath ?? null,
    allowPartialExport: config.allowPartialExport ?? state.config?.allowPartialExport ?? false,
    improvedAdoptedCount:
      exportInfo.improvedAdoptedCount ?? exportManifest?.improvedAdoptedCount ?? 0,
    publishRecommendedCount: items.filter(
      (item) => item.recommendation === "publish_recommended",
    ).length,
    passCount: items.filter((item) => item.recommendation === "passed").length,
    needsReImprovementCount: items.filter(
      (item) => item.recommendation === "needs_re_improvement",
    ).length,
    improvementFailedCount: items.filter(
      (item) => item.recommendation === "improvement_failed",
    ).length,
    reviewPendingCount: items.filter((item) => item.recommendation === "review_pending").length,
    pipelineStatus: state.status ?? null,
    completedSteps: state.completedSteps?.length ?? 0,
    failedSteps: state.failedSteps?.length ?? 0,
  };

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    tool: REPORT_TOOL,
    version: REPORT_VERSION,
    generatedAt: new Date().toISOString(),
    pipelineStateFile: `${DEFAULT_PIPELINE_STATE_DIR}/${PIPELINE_STATE_FILENAME}`,
    metricsFile: `${DEFAULT_PIPELINE_STATE_DIR}/${PIPELINE_METRICS_FILENAME}`,
    exportManifestFile: exportManifest
      ? `${DEFAULT_PIPELINE_STATE_DIR}/${EXPORT_MANIFEST_FILENAME}`
      : null,
    summary,
    items,
  };
}

/**
 * recommendation の日本語ラベル
 * @param {string} recommendation
 * @returns {string}
 */
function recommendationLabel(recommendation) {
  const labels = {
    publish_recommended: "公開推奨",
    passed: "合格",
    needs_re_improvement: "再改善候補",
    improvement_failed: "改善失敗",
    review_pending: "レビュー未実施",
  };
  return labels[recommendation] ?? recommendation;
}

/**
 * score を表示用に整形する
 * @param {number | null | undefined} score
 * @returns {string}
 */
function formatScore(score) {
  return typeof score === "number" ? String(score) : "—";
}

/**
 * delta を表示用に整形する
 * @param {number | null | undefined} delta
 * @returns {string}
 */
function formatDelta(delta) {
  if (typeof delta !== "number") {
    return "—";
  }
  return delta >= 0 ? `+${delta}` : String(delta);
}

/**
 * report.md 本文を生成する
 * @param {object} report
 * @returns {string}
 */
export function buildPipelineReportMarkdown(report) {
  const { summary, items } = report;

  const summaryRows = [
    ["モード", summary.dryRun ? "dry-run" : "apply"],
    ["パイプライン status", summary.pipelineStatus ?? "—"],
    ["targetScore", summary.targetScore],
    ["passingScore", summary.passingScore],
    ["最終平均 score", summary.finalAverageScore ?? "—"],
    ["最終最低 score", summary.finalMinScore ?? "—"],
    ["全スライド合格", summary.allSlidesPassed ? "はい" : "いいえ"],
    ["全スライド公開推奨", summary.allSlidesPublishRecommended ? "はい" : "いいえ"],
    ["改善ラウンド", `${summary.roundsExecuted}/${summary.maxRounds}`],
    ["改善停止理由", summary.improvementStopReason ?? "—"],
    ["API 呼び出し", summary.totalApiCalls],
    ["API 失敗", summary.failedCalls],
    ["limit:0 検出", summary.limitZeroDetected ? "はい" : "いいえ"],
    ["Export 完了", summary.exportCompleted ? "はい" : "いいえ"],
    ["Export モード", summary.exportMode ?? "—"],
    ["Export スキップ理由", summary.exportSkipReason ?? "—"],
    ["improved 採用数", summary.improvedAdoptedCount],
    ["公開推奨", summary.publishRecommendedCount],
    ["合格", summary.passCount],
    ["再改善候補", summary.needsReImprovementCount],
    ["改善失敗", summary.improvementFailedCount],
    ["経過時間 (ms)", summary.elapsedMs ?? "—"],
  ];

  const summaryTable = [
    "| 項目 | 値 |",
    "|------|-----|",
    ...summaryRows.map(([label, value]) => `| ${label} | ${value} |`),
  ].join("\n");

  const slideTable = [
    "| スライド | 改善前 | 改善後 | 差分 | rootCause | tool | export | 推奨 |",
    "|----------|--------|--------|------|-----------|------|--------|------|",
    ...items.map((item) => {
      const exportLabel = item.adoptedImproved
        ? "improved"
        : item.exportSource ?? "—";
      return `| ${item.slideId} | ${formatScore(item.beforeScore)} | ${formatScore(item.afterScore)} | ${formatDelta(item.deltaScore)} | ${item.rootCause ?? "—"} | ${item.improvementTool ?? "—"} | ${exportLabel} | ${recommendationLabel(item.recommendation)} |`;
    }),
  ].join("\n");

  const warnings = [];
  if (!summary.allSlidesPublishRecommended && !summary.dryRun) {
    warnings.push("- 全スライドが targetScore 未達です。");
  }
  if (summary.allowPartialExport && summary.exportCompleted && summary.exportMode === "partial") {
    warnings.push("- allowPartialExport により 90 点未達でも export されています。");
  }
  if (summary.improvementFailedCount > 0) {
    warnings.push(`- 改善失敗スライド: ${summary.improvementFailedCount} 件`);
  }
  if (summary.limitZeroDetected) {
    warnings.push("- API quota limit:0 が検出されました。");
  }

  const warningsSection =
    warnings.length > 0
      ? `## 警告\n\n${warnings.join("\n")}\n`
      : "## 警告\n\n- なし\n";

  return `# Quality Pipeline レポート

生成日時: ${report.generatedAt}
tool: ${report.tool}
version: ${report.version}

## サマリー

${summaryTable}

${warningsSection}

## スライド別

${slideTable}

## 参照ファイル

- pipeline state: \`${report.pipelineStateFile}\`
- metrics: \`${report.metricsFile}\`
${report.exportManifestFile ? `- export manifest: \`${report.exportManifestFile}\`` : "- export manifest: （なし）"}
`;
}

/**
 * report.json を書き込む
 * @param {object} report
 * @param {string} [outputDir]
 * @returns {Promise<string>}
 */
export async function writePipelineReport(report, outputDir = DEFAULT_PIPELINE_STATE_DIR) {
  const relativePath = path.join(outputDir, REPORT_JSON_FILENAME);
  const absolutePath = path.join(PROJECT_ROOT, relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  return relativePath;
}

/**
 * report.md を書き込む
 * @param {object} report
 * @param {string} [outputDir]
 * @returns {Promise<string>}
 */
export async function writePipelineMarkdownReport(
  report,
  outputDir = DEFAULT_PIPELINE_STATE_DIR,
) {
  const relativePath = path.join(outputDir, REPORT_MD_FILENAME);
  const absolutePath = path.join(PROJECT_ROOT, relativePath);
  const markdown = buildPipelineReportMarkdown(report);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, markdown, "utf-8");

  return relativePath;
}

/**
 * レポートを生成して書き込む
 * @param {object} context
 * @returns {Promise<object>}
 */
export async function generatePipelineReport(context) {
  const outputDir = context.outputDir ?? DEFAULT_PIPELINE_STATE_DIR;
  const exportManifest = await readExportManifest(outputDir);
  const report = buildPipelineReport({
    state: context.state,
    metrics: context.metrics,
    exportManifest,
    config: context.config,
  });

  const jsonPath = await writePipelineReport(report, outputDir);
  const mdPath = await writePipelineMarkdownReport(report, outputDir);

  return {
    report,
    jsonPath,
    mdPath,
  };
}
