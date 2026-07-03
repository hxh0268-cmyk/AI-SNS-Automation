import fs from "node:fs";
import path from "node:path";
import {
  WORKFLOW_DASHBOARD_JSON_FILENAME,
  extractDashboardPublicContract,
  readWorkflowDashboard,
} from "./developer_workflow_dashboard.js";
import {
  WORKFLOW_TREND_JSON_FILENAME,
  WORKFLOW_TREND_REPORT_DIR,
  extractTrendPublicContract,
  formatTrendDuration,
  formatTrendHealthLabel,
  formatTrendRatePercent,
  readTrendDashboardPublicContracts,
  readWorkflowTrend,
} from "./developer_workflow_trend.js";

export const WORKFLOW_HISTORY_ANALYTICS_SCHEMA =
  "developer-automation/workflow-history-analytics/1.0";
export const WORKFLOW_HISTORY_ANALYTICS_REPORT_DIR =
  "reports/workflow-history-analytics";
export const WORKFLOW_HISTORY_ANALYTICS_JSON_FILENAME =
  "workflow-history-analytics.json";
export const WORKFLOW_HISTORY_ANALYTICS_MD_FILENAME = "historical-report.md";
export const WORKFLOW_DASHBOARD_REPORT_DIR =
  "reports/developer-workflow/latest";

/**
 * @param {object | null | undefined} dashboard
 * @param {object | null | undefined} trend
 * @param {object[]} [snapshotContracts]
 * @returns {object}
 */
export function parseHistoricalInputs(dashboard, trend, snapshotContracts = []) {
  const dashboardContract = extractDashboardPublicContract(dashboard);
  const trendContract = extractTrendPublicContract(trend);
  const snapshots = Array.isArray(snapshotContracts)
    ? snapshotContracts.map((contract) => ({
        metadata: {
          schema: contract.metadata?.schema ?? null,
          generatedAt: contract.metadata?.generatedAt ?? null,
        },
        summary: {
          runCount: contract.summary?.runCount ?? 0,
          stepCount: contract.summary?.stepCount ?? 0,
          totalDurationMs: contract.summary?.totalDurationMs ?? 0,
        },
        metrics: {
          successfulRuns: contract.metrics?.successfulRuns ?? 0,
          failedRuns: contract.metrics?.failedRuns ?? 0,
          resumedRuns: contract.metrics?.resumedRuns ?? 0,
        },
        status: {
          workflowHealth: contract.status?.workflowHealth ?? "warning",
        },
      }))
    : [];

  const sortedSnapshots = [...snapshots].sort((left, right) => {
    const leftTime = Date.parse(left.metadata.generatedAt ?? "") || 0;
    const rightTime = Date.parse(right.metadata.generatedAt ?? "") || 0;
    return leftTime - rightTime;
  });

  return {
    dashboardContract,
    trendContract,
    snapshotContracts: sortedSnapshots,
  };
}

/**
 * @param {object} inputs
 * @param {object} [options]
 * @param {string} [options.generatedAt]
 * @returns {object}
 */
export function buildWorkflowHistoryAnalytics(inputs, options = {}) {
  const dashboardContract = inputs?.dashboardContract ?? extractDashboardPublicContract(null);
  const trendContract = inputs?.trendContract ?? extractTrendPublicContract(null);
  const snapshotContracts = Array.isArray(inputs?.snapshotContracts)
    ? inputs.snapshotContracts
    : [];

  const runCount = dashboardContract.summary.runCount ?? 0;
  const successCount = dashboardContract.metrics.successfulRuns ?? 0;
  const failureCount = dashboardContract.metrics.failedRuns ?? 0;
  const resumeCount = dashboardContract.metrics.resumedRuns ?? 0;
  const totalDurationMs = dashboardContract.summary.totalDurationMs ?? 0;
  const averageDurationMs =
    runCount > 0 ? Math.round(totalDurationMs / runCount) : 0;
  const resumeRate = runCount > 0 ? resumeCount / runCount : 0;
  const successRate = runCount > 0 ? successCount / runCount : 0;

  const periodStart =
    trendContract.periodStart ??
    dashboardContract.metadata.generatedAt ??
    null;
  const periodEnd =
    trendContract.periodEnd ??
    dashboardContract.metadata.generatedAt ??
    null;

  const sampleCount = trendContract.sampleCount ?? 0;
  const missingSnapshots = Math.max(0, sampleCount - snapshotContracts.length);

  /** @type {{ healthy: number, warning: number, critical: number }} */
  const workflowHealth = {
    healthy: 0,
    warning: 0,
    critical: 0,
  };

  const healthSources =
    trendContract.snapshots?.length > 0
      ? trendContract.snapshots
      : snapshotContracts.map((contract) => ({
          workflowHealth: contract.status.workflowHealth,
        }));

  for (const item of healthSources) {
    const health = item.workflowHealth ?? "warning";
    if (health in workflowHealth) {
      workflowHealth[health] += 1;
    } else {
      workflowHealth.warning += 1;
    }
  }

  return {
    schema: WORKFLOW_HISTORY_ANALYTICS_SCHEMA,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    period: {
      start: periodStart,
      end: periodEnd,
    },
    coverage: {
      periodStart,
      periodEnd,
      sampleCount,
      missingSnapshots,
    },
    summary: {
      totalRuns: runCount,
      successCount,
      failureCount,
      averageDurationMs,
      resumeCount,
      resumeRate,
      successRate,
    },
    workflowHealth,
  };
}

/**
 * @param {object | null | undefined} analytics
 * @returns {object}
 */
export function normalizeWorkflowHistoryAnalytics(analytics) {
  if (!analytics || typeof analytics !== "object") {
    return buildWorkflowHistoryAnalytics({
      dashboardContract: extractDashboardPublicContract(null),
      trendContract: extractTrendPublicContract(null),
      snapshotContracts: [],
    });
  }

  return {
    schema: analytics.schema ?? WORKFLOW_HISTORY_ANALYTICS_SCHEMA,
    generatedAt: analytics.generatedAt ?? new Date().toISOString(),
    period: {
      start: analytics.period?.start ?? null,
      end: analytics.period?.end ?? null,
    },
    coverage: {
      periodStart: analytics.coverage?.periodStart ?? null,
      periodEnd: analytics.coverage?.periodEnd ?? null,
      sampleCount: analytics.coverage?.sampleCount ?? 0,
      missingSnapshots: analytics.coverage?.missingSnapshots ?? 0,
    },
    summary: {
      totalRuns: analytics.summary?.totalRuns ?? 0,
      successCount: analytics.summary?.successCount ?? 0,
      failureCount: analytics.summary?.failureCount ?? 0,
      averageDurationMs: analytics.summary?.averageDurationMs ?? 0,
      resumeCount: analytics.summary?.resumeCount ?? 0,
      resumeRate: analytics.summary?.resumeRate ?? 0,
      successRate: analytics.summary?.successRate ?? 0,
    },
    workflowHealth: {
      healthy: analytics.workflowHealth?.healthy ?? 0,
      warning: analytics.workflowHealth?.warning ?? 0,
      critical: analytics.workflowHealth?.critical ?? 0,
    },
  };
}

/**
 * @param {object | null | undefined} analytics
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateWorkflowHistoryAnalytics(analytics) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!analytics || typeof analytics !== "object") {
    return {
      valid: false,
      errors: ["workflow history analytics must be an object"],
      warnings: [],
    };
  }

  if (analytics.schema !== WORKFLOW_HISTORY_ANALYTICS_SCHEMA) {
    warnings.push(
      `history analytics schema ${analytics.schema ?? "missing"} treated as legacy`,
    );
  }

  if (!analytics.generatedAt) {
    errors.push("generatedAt is required");
  }

  if (!analytics.period || typeof analytics.period !== "object") {
    errors.push("period is required");
  }

  if (!analytics.coverage || typeof analytics.coverage !== "object") {
    errors.push("coverage is required");
  } else {
    if (typeof analytics.coverage.sampleCount !== "number") {
      errors.push("coverage.sampleCount must be a number");
    }
    if (typeof analytics.coverage.missingSnapshots !== "number") {
      errors.push("coverage.missingSnapshots must be a number");
    }
  }

  if (!analytics.summary || typeof analytics.summary !== "object") {
    errors.push("summary is required");
  } else {
    for (const field of [
      "totalRuns",
      "successCount",
      "failureCount",
      "averageDurationMs",
      "resumeCount",
      "resumeRate",
      "successRate",
    ]) {
      if (typeof analytics.summary[field] !== "number") {
        errors.push(`summary.${field} must be a number`);
      }
    }
  }

  if (!analytics.workflowHealth || typeof analytics.workflowHealth !== "object") {
    errors.push("workflowHealth is required");
  } else {
    for (const field of ["healthy", "warning", "critical"]) {
      if (typeof analytics.workflowHealth[field] !== "number") {
        errors.push(`workflowHealth.${field} must be a number`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * @param {object} analytics
 * @returns {string}
 */
export function renderHistoricalReportMarkdown(analytics) {
  const normalized = normalizeWorkflowHistoryAnalytics(analytics);
  const latestHealth =
    normalized.workflowHealth.critical > 0
      ? "critical"
      : normalized.workflowHealth.warning > 0
        ? "warning"
        : normalized.workflowHealth.healthy > 0
          ? "healthy"
          : "unknown";

  return [
    "# Workflow Historical Analytics Report",
    "",
    "## Summary",
    "",
    "| Field | Value |",
    "|---|---:|",
    `| Total Runs | ${normalized.summary.totalRuns} |`,
    `| Success Count | ${normalized.summary.successCount} |`,
    `| Failure Count | ${normalized.summary.failureCount} |`,
    `| Average Duration | ${formatTrendDuration(normalized.summary.averageDurationMs)} |`,
    `| Resume Count | ${normalized.summary.resumeCount} |`,
    `| Resume Rate | ${formatTrendRatePercent(normalized.summary.resumeRate)} |`,
    `| Success Rate | ${formatTrendRatePercent(normalized.summary.successRate)} |`,
    "",
    "## Period Summary",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Start | ${normalized.period.start ?? "none"} |`,
    `| End | ${normalized.period.end ?? "none"} |`,
    "",
    "## Data Coverage",
    "",
    "| Field | Value |",
    "|---|---:|",
    `| Sample Count | ${normalized.coverage.sampleCount} |`,
    `| Missing Snapshots | ${normalized.coverage.missingSnapshots} |`,
    `| Period Start | ${normalized.coverage.periodStart ?? "none"} |`,
    `| Period End | ${normalized.coverage.periodEnd ?? "none"} |`,
    "",
    "## Workflow Health Distribution",
    "",
    "| Health | Count |",
    "|---|---:|",
    `| Healthy | ${normalized.workflowHealth.healthy} |`,
    `| Warning | ${normalized.workflowHealth.warning} |`,
    `| Critical | ${normalized.workflowHealth.critical} |`,
    "",
    `_Latest Health: ${formatTrendHealthLabel(latestHealth)}_`,
    "",
  ].join("\n");
}

/**
 * @param {object} analytics
 * @returns {string}
 */
export function buildWorkflowHistoryAnalyticsCliSummary(analytics) {
  const normalized = normalizeWorkflowHistoryAnalytics(analytics);
  const latestHealth =
    normalized.workflowHealth.critical > 0
      ? "critical"
      : normalized.workflowHealth.warning > 0
        ? "warning"
        : normalized.workflowHealth.healthy > 0
          ? "healthy"
          : "unknown";

  return [
    "Workflow Historical Analytics Summary",
    `Runs: ${normalized.summary.totalRuns}`,
    `Success Rate: ${formatTrendRatePercent(normalized.summary.successRate)}`,
    `Resume Rate: ${formatTrendRatePercent(normalized.summary.resumeRate)}`,
    `Average Duration: ${formatTrendDuration(normalized.summary.averageDurationMs)}`,
    `Workflow Health: ${formatTrendHealthLabel(latestHealth)}`,
  ].join("\n");
}

/**
 * @param {object} analytics
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writeWorkflowHistoryAnalyticsReport(
  analytics,
  rootDir = process.cwd(),
) {
  const normalized = normalizeWorkflowHistoryAnalytics(analytics);
  const validation = validateWorkflowHistoryAnalytics(normalized);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const reportDir = path.join(rootDir, WORKFLOW_HISTORY_ANALYTICS_REPORT_DIR);
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(
    reportDir,
    WORKFLOW_HISTORY_ANALYTICS_JSON_FILENAME,
  );
  const markdownPath = path.join(
    reportDir,
    WORKFLOW_HISTORY_ANALYTICS_MD_FILENAME,
  );

  const jsonPayload = {
    schema: normalized.schema,
    generatedAt: normalized.generatedAt,
    period: normalized.period,
    coverage: normalized.coverage,
    summary: normalized.summary,
    workflowHealth: normalized.workflowHealth,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(
    markdownPath,
    `${renderHistoricalReportMarkdown(normalized)}\n`,
  );

  return {
    json: `${WORKFLOW_HISTORY_ANALYTICS_REPORT_DIR}/${WORKFLOW_HISTORY_ANALYTICS_JSON_FILENAME}`,
    markdown: `${WORKFLOW_HISTORY_ANALYTICS_REPORT_DIR}/${WORKFLOW_HISTORY_ANALYTICS_MD_FILENAME}`,
  };
}

/**
 * @param {string | null | undefined} analyticsPath
 * @param {string} [rootDir]
 * @returns {object}
 */
export function readWorkflowHistoryAnalytics(analyticsPath, rootDir = process.cwd()) {
  const relativePath =
    analyticsPath ??
    `${WORKFLOW_HISTORY_ANALYTICS_REPORT_DIR}/${WORKFLOW_HISTORY_ANALYTICS_JSON_FILENAME}`;
  const absolutePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(rootDir, relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`workflow history analytics not found: ${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(raw);
}

/**
 * @param {object} [params]
 * @param {string | null} [params.dashboardPath]
 * @param {string | null} [params.trendPath]
 * @param {string} [params.rootDir]
 * @param {string} [params.generatedAt]
 * @returns {{ analytics: object, outputs: { json: string, markdown: string } }}
 */
export function buildWorkflowHistoryAnalyticsFromReports(params = {}) {
  const rootDir = params.rootDir ?? process.cwd();
  const dashboardPath =
    params.dashboardPath ??
    `${WORKFLOW_DASHBOARD_REPORT_DIR}/${WORKFLOW_DASHBOARD_JSON_FILENAME}`;
  const trendPath =
    params.trendPath ??
    `${WORKFLOW_TREND_REPORT_DIR}/${WORKFLOW_TREND_JSON_FILENAME}`;

  const dashboard = readWorkflowDashboard(dashboardPath, rootDir);
  const trend = readWorkflowTrend(trendPath, rootDir);
  const snapshotContracts = readTrendDashboardPublicContracts(rootDir);
  const inputs = parseHistoricalInputs(dashboard, trend, snapshotContracts);
  const analytics = buildWorkflowHistoryAnalytics(inputs, {
    generatedAt: params.generatedAt,
  });
  const outputs = writeWorkflowHistoryAnalyticsReport(analytics, rootDir);

  return { analytics, outputs };
}
