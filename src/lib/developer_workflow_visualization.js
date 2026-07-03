import fs from "node:fs";
import path from "node:path";
import {
  WORKFLOW_DASHBOARD_JSON_FILENAME,
  extractDashboardPublicContract,
  readWorkflowDashboard,
} from "./developer_workflow_dashboard.js";
import {
  WORKFLOW_HISTORY_ANALYTICS_JSON_FILENAME,
  WORKFLOW_HISTORY_ANALYTICS_REPORT_DIR,
  extractHistoricalPublicContract,
  readWorkflowHistoryAnalytics,
} from "./developer_workflow_history_analytics.js";
import {
  WORKFLOW_TREND_JSON_FILENAME,
  WORKFLOW_TREND_REPORT_DIR,
  extractTrendPublicContract,
  formatTrendDuration,
  formatTrendHealthLabel,
  formatTrendRatePercent,
  readWorkflowTrend,
} from "./developer_workflow_trend.js";

export const WORKFLOW_VISUALIZATION_SCHEMA =
  "developer-automation/workflow-visualization/1.0";
export const WORKFLOW_VISUALIZATION_REPORT_DIR =
  "reports/workflow-visualization/latest";
export const WORKFLOW_VISUALIZATION_JSON_FILENAME =
  "workflow-visualization.json";
export const WORKFLOW_VISUALIZATION_MD_FILENAME = "visualization-report.md";
export const WORKFLOW_DASHBOARD_REPORT_DIR =
  "reports/developer-workflow/latest";

/**
 * @param {object | null | undefined} dashboard
 * @param {object | null | undefined} trend
 * @param {object | null | undefined} historical
 * @returns {object}
 */
export function parseVisualizationInputs(dashboard, trend, historical) {
  return {
    dashboardContract: extractDashboardPublicContract(dashboard),
    trendContract: extractTrendPublicContract(trend),
    historicalContract: extractHistoricalPublicContract(historical),
  };
}

/**
 * @param {object | null | undefined} visualization
 * @returns {object}
 */
export function normalizeWorkflowVisualization(visualization) {
  if (!visualization || typeof visualization !== "object") {
    return buildWorkflowVisualization({});
  }

  return {
    schema: visualization.schema ?? WORKFLOW_VISUALIZATION_SCHEMA,
    generatedAt: visualization.generatedAt ?? new Date().toISOString(),
    dashboardSummary: {
      runCount: visualization.dashboardSummary?.runCount ?? 0,
      stepCount: visualization.dashboardSummary?.stepCount ?? 0,
      totalDurationMs: visualization.dashboardSummary?.totalDurationMs ?? 0,
      successfulRuns: visualization.dashboardSummary?.successfulRuns ?? 0,
      failedRuns: visualization.dashboardSummary?.failedRuns ?? 0,
      resumedRuns: visualization.dashboardSummary?.resumedRuns ?? 0,
      workflowHealth:
        visualization.dashboardSummary?.workflowHealth ?? "warning",
      generatedAt: visualization.dashboardSummary?.generatedAt ?? null,
    },
    trendSummary: {
      sampleCount: visualization.trendSummary?.sampleCount ?? 0,
      periodStart: visualization.trendSummary?.periodStart ?? null,
      periodEnd: visualization.trendSummary?.periodEnd ?? null,
      latest: {
        successRate: visualization.trendSummary?.latest?.successRate ?? 0,
        failureRate: visualization.trendSummary?.latest?.failureRate ?? 0,
        resumeRate: visualization.trendSummary?.latest?.resumeRate ?? 0,
        averageDurationMs:
          visualization.trendSummary?.latest?.averageDurationMs ?? 0,
        workflowHealth:
          visualization.trendSummary?.latest?.workflowHealth ?? "warning",
      },
      snapshotCount: visualization.trendSummary?.snapshotCount ?? 0,
    },
    historicalSummary: {
      period: {
        start: visualization.historicalSummary?.period?.start ?? null,
        end: visualization.historicalSummary?.period?.end ?? null,
      },
      coverage: {
        periodStart:
          visualization.historicalSummary?.coverage?.periodStart ?? null,
        periodEnd: visualization.historicalSummary?.coverage?.periodEnd ?? null,
        sampleCount: visualization.historicalSummary?.coverage?.sampleCount ?? 0,
        missingSnapshots:
          visualization.historicalSummary?.coverage?.missingSnapshots ?? 0,
      },
      summary: {
        totalRuns: visualization.historicalSummary?.summary?.totalRuns ?? 0,
        successCount:
          visualization.historicalSummary?.summary?.successCount ?? 0,
        failureCount:
          visualization.historicalSummary?.summary?.failureCount ?? 0,
        averageDurationMs:
          visualization.historicalSummary?.summary?.averageDurationMs ?? 0,
        resumeCount: visualization.historicalSummary?.summary?.resumeCount ?? 0,
        resumeRate: visualization.historicalSummary?.summary?.resumeRate ?? 0,
        successRate: visualization.historicalSummary?.summary?.successRate ?? 0,
      },
      workflowHealth: {
        healthy: visualization.historicalSummary?.workflowHealth?.healthy ?? 0,
        warning: visualization.historicalSummary?.workflowHealth?.warning ?? 0,
        critical: visualization.historicalSummary?.workflowHealth?.critical ?? 0,
      },
    },
    workflowHealthSummary: {
      dashboard: visualization.workflowHealthSummary?.dashboard ?? "warning",
      trendLatest:
        visualization.workflowHealthSummary?.trendLatest ?? "warning",
      historicalDistribution: {
        healthy:
          visualization.workflowHealthSummary?.historicalDistribution?.healthy ??
          0,
        warning:
          visualization.workflowHealthSummary?.historicalDistribution?.warning ??
          0,
        critical:
          visualization.workflowHealthSummary?.historicalDistribution
            ?.critical ?? 0,
      },
    },
    metadata: {
      sources: {
        dashboardSchema:
          visualization.metadata?.sources?.dashboardSchema ?? null,
        trendSchema: visualization.metadata?.sources?.trendSchema ?? null,
        historicalSchema:
          visualization.metadata?.sources?.historicalSchema ?? null,
      },
      dashboardGeneratedAt:
        visualization.metadata?.dashboardGeneratedAt ?? null,
      trendGeneratedAt: visualization.metadata?.trendGeneratedAt ?? null,
      historicalGeneratedAt:
        visualization.metadata?.historicalGeneratedAt ?? null,
    },
  };
}

/**
 * @param {object} inputs
 * @param {object} [options]
 * @param {string} [options.generatedAt]
 * @returns {object}
 */
export function buildWorkflowVisualization(inputs, options = {}) {
  const dashboardContract =
    inputs?.dashboardContract ?? extractDashboardPublicContract(null);
  const trendContract =
    inputs?.trendContract ?? extractTrendPublicContract(null);
  const historicalContract =
    inputs?.historicalContract ?? extractHistoricalPublicContract(null);

  return {
    schema: WORKFLOW_VISUALIZATION_SCHEMA,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    dashboardSummary: {
      runCount: dashboardContract.summary.runCount,
      stepCount: dashboardContract.summary.stepCount,
      totalDurationMs: dashboardContract.summary.totalDurationMs,
      successfulRuns: dashboardContract.metrics.successfulRuns,
      failedRuns: dashboardContract.metrics.failedRuns,
      resumedRuns: dashboardContract.metrics.resumedRuns,
      workflowHealth: dashboardContract.status.workflowHealth,
      generatedAt: dashboardContract.metadata.generatedAt,
    },
    trendSummary: {
      sampleCount: trendContract.sampleCount,
      periodStart: trendContract.periodStart,
      periodEnd: trendContract.periodEnd,
      latest: {
        successRate: trendContract.latest.successRate,
        failureRate: trendContract.latest.failureRate,
        resumeRate: trendContract.latest.resumeRate,
        averageDurationMs: trendContract.latest.averageDurationMs,
        workflowHealth: trendContract.latest.workflowHealth,
      },
      snapshotCount: trendContract.snapshots.length,
    },
    historicalSummary: {
      period: {
        start: historicalContract.period.start,
        end: historicalContract.period.end,
      },
      coverage: {
        periodStart: historicalContract.coverage.periodStart,
        periodEnd: historicalContract.coverage.periodEnd,
        sampleCount: historicalContract.coverage.sampleCount,
        missingSnapshots: historicalContract.coverage.missingSnapshots,
      },
      summary: {
        totalRuns: historicalContract.summary.totalRuns,
        successCount: historicalContract.summary.successCount,
        failureCount: historicalContract.summary.failureCount,
        averageDurationMs: historicalContract.summary.averageDurationMs,
        resumeCount: historicalContract.summary.resumeCount,
        resumeRate: historicalContract.summary.resumeRate,
        successRate: historicalContract.summary.successRate,
      },
      workflowHealth: {
        healthy: historicalContract.workflowHealth.healthy,
        warning: historicalContract.workflowHealth.warning,
        critical: historicalContract.workflowHealth.critical,
      },
    },
    workflowHealthSummary: {
      dashboard: dashboardContract.status.workflowHealth,
      trendLatest: trendContract.latest.workflowHealth,
      historicalDistribution: {
        healthy: historicalContract.workflowHealth.healthy,
        warning: historicalContract.workflowHealth.warning,
        critical: historicalContract.workflowHealth.critical,
      },
    },
    metadata: {
      sources: {
        dashboardSchema: dashboardContract.metadata.schema,
        trendSchema: trendContract.metadata.schema,
        historicalSchema: historicalContract.metadata.schema,
      },
      dashboardGeneratedAt: dashboardContract.metadata.generatedAt,
      trendGeneratedAt: trendContract.metadata.generatedAt,
      historicalGeneratedAt: historicalContract.metadata.generatedAt,
    },
  };
}

/**
 * @param {object | null | undefined} visualization
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateWorkflowVisualization(visualization) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!visualization || typeof visualization !== "object") {
    return {
      valid: false,
      errors: ["workflow visualization must be an object"],
      warnings: [],
    };
  }

  if (visualization.schema !== WORKFLOW_VISUALIZATION_SCHEMA) {
    warnings.push(
      `visualization schema ${visualization.schema ?? "missing"} treated as legacy`,
    );
  }

  if (!visualization.generatedAt) {
    errors.push("generatedAt is required");
  }

  for (const section of [
    "dashboardSummary",
    "trendSummary",
    "historicalSummary",
    "workflowHealthSummary",
    "metadata",
  ]) {
    if (!visualization[section] || typeof visualization[section] !== "object") {
      errors.push(`${section} is required`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * @param {object} visualization
 * @returns {string}
 */
export function renderVisualizationMarkdown(visualization) {
  const normalized = normalizeWorkflowVisualization(visualization);

  return [
    "# Workflow Visualization Report",
    "",
    "_Visualization organizes public contract data only. No analysis is performed._",
    "",
    "## Dashboard Summary",
    "",
    "| Field | Value |",
    "|---|---:|",
    `| Run Count | ${normalized.dashboardSummary.runCount} |`,
    `| Step Count | ${normalized.dashboardSummary.stepCount} |`,
    `| Total Duration | ${formatTrendDuration(normalized.dashboardSummary.totalDurationMs)} |`,
    `| Successful Runs | ${normalized.dashboardSummary.successfulRuns} |`,
    `| Failed Runs | ${normalized.dashboardSummary.failedRuns} |`,
    `| Resumed Runs | ${normalized.dashboardSummary.resumedRuns} |`,
    `| Workflow Health | ${formatTrendHealthLabel(normalized.dashboardSummary.workflowHealth)} |`,
    "",
    "## Trend Summary",
    "",
    "| Field | Value |",
    "|---|---:|",
    `| Sample Count | ${normalized.trendSummary.sampleCount} |`,
    `| Snapshot Count | ${normalized.trendSummary.snapshotCount} |`,
    `| Period Start | ${normalized.trendSummary.periodStart ?? "none"} |`,
    `| Period End | ${normalized.trendSummary.periodEnd ?? "none"} |`,
    `| Latest Success Rate | ${formatTrendRatePercent(normalized.trendSummary.latest.successRate)} |`,
    `| Latest Failure Rate | ${formatTrendRatePercent(normalized.trendSummary.latest.failureRate)} |`,
    `| Latest Resume Rate | ${formatTrendRatePercent(normalized.trendSummary.latest.resumeRate)} |`,
    `| Latest Duration | ${formatTrendDuration(normalized.trendSummary.latest.averageDurationMs)} |`,
    `| Latest Health | ${formatTrendHealthLabel(normalized.trendSummary.latest.workflowHealth)} |`,
    "",
    "## Historical Summary",
    "",
    "| Field | Value |",
    "|---|---:|",
    `| Total Runs | ${normalized.historicalSummary.summary.totalRuns} |`,
    `| Success Count | ${normalized.historicalSummary.summary.successCount} |`,
    `| Failure Count | ${normalized.historicalSummary.summary.failureCount} |`,
    `| Average Duration | ${formatTrendDuration(normalized.historicalSummary.summary.averageDurationMs)} |`,
    `| Resume Count | ${normalized.historicalSummary.summary.resumeCount} |`,
    `| Resume Rate | ${formatTrendRatePercent(normalized.historicalSummary.summary.resumeRate)} |`,
    `| Success Rate | ${formatTrendRatePercent(normalized.historicalSummary.summary.successRate)} |`,
    "",
    "### Historical Coverage",
    "",
    "| Field | Value |",
    "|---|---:|",
    `| Sample Count | ${normalized.historicalSummary.coverage.sampleCount} |`,
    `| Missing Snapshots | ${normalized.historicalSummary.coverage.missingSnapshots} |`,
    "",
    "## Workflow Health Summary",
    "",
    "| Source | Value |",
    "|---|---|",
    `| Dashboard | ${formatTrendHealthLabel(normalized.workflowHealthSummary.dashboard)} |`,
    `| Trend Latest | ${formatTrendHealthLabel(normalized.workflowHealthSummary.trendLatest)} |`,
    `| Historical Healthy | ${normalized.workflowHealthSummary.historicalDistribution.healthy} |`,
    `| Historical Warning | ${normalized.workflowHealthSummary.historicalDistribution.warning} |`,
    `| Historical Critical | ${normalized.workflowHealthSummary.historicalDistribution.critical} |`,
    "",
    "## Metadata",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Dashboard Schema | ${normalized.metadata.sources.dashboardSchema ?? "none"} |`,
    `| Trend Schema | ${normalized.metadata.sources.trendSchema ?? "none"} |`,
    `| Historical Schema | ${normalized.metadata.sources.historicalSchema ?? "none"} |`,
    `| Dashboard Generated At | ${normalized.metadata.dashboardGeneratedAt ?? "none"} |`,
    `| Trend Generated At | ${normalized.metadata.trendGeneratedAt ?? "none"} |`,
    `| Historical Generated At | ${normalized.metadata.historicalGeneratedAt ?? "none"} |`,
    "",
  ].join("\n");
}

/**
 * @param {object} visualization
 * @returns {string}
 */
export function renderVisualizationSummary(visualization) {
  const normalized = normalizeWorkflowVisualization(visualization);

  return [
    "Workflow Visualization Summary",
    `Dashboard Runs: ${normalized.dashboardSummary.runCount}`,
    `Trend Samples: ${normalized.trendSummary.sampleCount}`,
    `Historical Runs: ${normalized.historicalSummary.summary.totalRuns}`,
    `Dashboard Health: ${formatTrendHealthLabel(normalized.workflowHealthSummary.dashboard)}`,
    `Workflow Health: ${formatTrendHealthLabel(normalized.workflowHealthSummary.trendLatest)}`,
  ].join("\n");
}

/**
 * @param {object} visualization
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writeWorkflowVisualization(
  visualization,
  rootDir = process.cwd(),
) {
  const normalized = normalizeWorkflowVisualization(visualization);
  const validation = validateWorkflowVisualization(normalized);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const reportDir = path.join(rootDir, WORKFLOW_VISUALIZATION_REPORT_DIR);
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, WORKFLOW_VISUALIZATION_JSON_FILENAME);
  const markdownPath = path.join(
    reportDir,
    WORKFLOW_VISUALIZATION_MD_FILENAME,
  );

  const jsonPayload = {
    schema: normalized.schema,
    generatedAt: normalized.generatedAt,
    dashboardSummary: normalized.dashboardSummary,
    trendSummary: normalized.trendSummary,
    historicalSummary: normalized.historicalSummary,
    workflowHealthSummary: normalized.workflowHealthSummary,
    metadata: normalized.metadata,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(
    markdownPath,
    `${renderVisualizationMarkdown(normalized)}\n`,
  );

  return {
    json: `${WORKFLOW_VISUALIZATION_REPORT_DIR}/${WORKFLOW_VISUALIZATION_JSON_FILENAME}`,
    markdown: `${WORKFLOW_VISUALIZATION_REPORT_DIR}/${WORKFLOW_VISUALIZATION_MD_FILENAME}`,
  };
}

/**
 * @param {string | null | undefined} visualizationPath
 * @param {string} [rootDir]
 * @returns {object}
 */
export function readWorkflowVisualization(
  visualizationPath,
  rootDir = process.cwd(),
) {
  const relativePath =
    visualizationPath ??
    `${WORKFLOW_VISUALIZATION_REPORT_DIR}/${WORKFLOW_VISUALIZATION_JSON_FILENAME}`;
  const absolutePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(rootDir, relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`workflow visualization not found: ${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(raw);
}

/**
 * @param {object} [params]
 * @param {string | null} [params.dashboardPath]
 * @param {string | null} [params.trendPath]
 * @param {string | null} [params.historicalPath]
 * @param {string} [params.rootDir]
 * @param {string} [params.generatedAt]
 * @returns {{ visualization: object, outputs: { json: string, markdown: string } }}
 */
export function generateWorkflowVisualizationReport(params = {}) {
  const rootDir = params.rootDir ?? process.cwd();
  const dashboardPath =
    params.dashboardPath ??
    `${WORKFLOW_DASHBOARD_REPORT_DIR}/${WORKFLOW_DASHBOARD_JSON_FILENAME}`;
  const trendPath =
    params.trendPath ??
    `${WORKFLOW_TREND_REPORT_DIR}/${WORKFLOW_TREND_JSON_FILENAME}`;
  const historicalPath =
    params.historicalPath ??
    `${WORKFLOW_HISTORY_ANALYTICS_REPORT_DIR}/${WORKFLOW_HISTORY_ANALYTICS_JSON_FILENAME}`;

  const dashboard = readWorkflowDashboard(dashboardPath, rootDir);
  const trend = readWorkflowTrend(trendPath, rootDir);

  /** @type {object | null} */
  let historical = null;
  try {
    historical = readWorkflowHistoryAnalytics(historicalPath, rootDir);
  } catch {
    historical = null;
  }

  const inputs = parseVisualizationInputs(dashboard, trend, historical);
  const visualization = buildWorkflowVisualization(inputs, {
    generatedAt: params.generatedAt,
  });
  const outputs = writeWorkflowVisualization(visualization, rootDir);

  return { visualization, outputs };
}
