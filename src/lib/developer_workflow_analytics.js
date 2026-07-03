import fs from "node:fs";
import path from "node:path";
import {
  WORKFLOW_DASHBOARD_JSON_FILENAME,
  WORKFLOW_DASHBOARD_SCHEMA,
  extractDashboardPublicContract,
  readWorkflowDashboard,
} from "./developer_workflow_dashboard.js";

export const WORKFLOW_DASHBOARD_REPORT_DIR =
  "reports/developer-workflow/latest";

export const WORKFLOW_ANALYTICS_SCHEMA =
  "developer-automation/workflow-analytics/1.0";
export const WORKFLOW_ANALYTICS_REPORT_DIR = "reports/workflow-analytics";
export const WORKFLOW_ANALYTICS_JSON_FILENAME = "workflow-analytics.json";
export const WORKFLOW_ANALYTICS_MD_FILENAME = "workflow-analytics.md";
export const ANALYTICS_GENERATOR = "developer_workflow_analytics/1.0";

export const ANALYTICS_HEALTH_STATUS = {
  HEALTHY: "healthy",
  WARNING: "warning",
  CRITICAL: "critical",
};

/**
 * @param {string | null | undefined} rootDir
 * @param {string | null | undefined} analyticsPath
 * @returns {string}
 */
function getWorkflowAnalyticsAbsolutePath(rootDir, analyticsPath) {
  const resolvedRootDir = rootDir ?? process.cwd();
  const relativePath =
    analyticsPath ??
    `${WORKFLOW_ANALYTICS_REPORT_DIR}/${WORKFLOW_ANALYTICS_JSON_FILENAME}`;

  return path.isAbsolute(relativePath)
    ? relativePath
    : path.join(resolvedRootDir, relativePath);
}

/**
 * @param {number} numerator
 * @param {number} denominator
 * @returns {number}
 */
export function computeAnalyticsRate(numerator, denominator) {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

/**
 * @param {object} contract
 * @returns {{ successRate: number, failureRate: number, resumeRate: number, averageDurationMs: number }}
 */
export function computeAnalyticsMetrics(contract) {
  const runCount = contract.summary.runCount;

  return {
    successRate: computeAnalyticsRate(contract.metrics.successfulRuns, runCount),
    failureRate: computeAnalyticsRate(contract.metrics.failedRuns, runCount),
    resumeRate: computeAnalyticsRate(contract.metrics.resumedRuns, runCount),
    averageDurationMs:
      runCount > 0
        ? Math.round(contract.summary.totalDurationMs / runCount)
        : 0,
  };
}

/**
 * @param {object} contract
 * @param {ReturnType<typeof computeAnalyticsMetrics>} metrics
 * @returns {string}
 */
export function resolveAnalyticsHealthStatus(contract, metrics) {
  const workflowHealth = contract.status.workflowHealth;

  if (contract.summary.runCount === 0) {
    return ANALYTICS_HEALTH_STATUS.WARNING;
  }

  if (
    workflowHealth === ANALYTICS_HEALTH_STATUS.CRITICAL ||
    metrics.failureRate >= 0.5
  ) {
    return ANALYTICS_HEALTH_STATUS.CRITICAL;
  }

  if (
    workflowHealth === ANALYTICS_HEALTH_STATUS.HEALTHY &&
    metrics.failureRate === 0
  ) {
    return ANALYTICS_HEALTH_STATUS.HEALTHY;
  }

  return ANALYTICS_HEALTH_STATUS.WARNING;
}

/**
 * @param {object} contract
 * @param {ReturnType<typeof computeAnalyticsMetrics>} metrics
 * @returns {string[]}
 */
export function buildAnalyticsWarningCodes(contract, metrics) {
  /** @type {string[]} */
  const codes = [];

  if (contract.summary.runCount === 0) {
    codes.push("RUN_COUNT_ZERO");
  }

  if (contract.metrics.failedRuns > 0) {
    codes.push("FAILURES_PRESENT");
  }

  if (contract.metrics.resumedRuns > 0) {
    codes.push("RESUMES_PRESENT");
  }

  if (metrics.failureRate >= 0.5) {
    codes.push("HIGH_FAILURE_RATE");
  }

  if (contract.status.workflowHealth === ANALYTICS_HEALTH_STATUS.WARNING) {
    codes.push("WORKFLOW_HEALTH_WARNING");
  }

  return codes;
}

/**
 * @param {object} contract
 * @param {ReturnType<typeof computeAnalyticsMetrics>} metrics
 * @returns {string[]}
 */
export function buildAnalyticsRecommendationCodes(contract, metrics) {
  /** @type {string[]} */
  const codes = [];

  if (contract.summary.runCount === 0) {
    codes.push("RUN_WORKFLOW");
  }

  if (contract.metrics.failedRuns > 0) {
    codes.push("REVIEW_FAILURES");
  }

  if (contract.metrics.resumedRuns > 0) {
    codes.push("MONITOR_RESUMES");
  }

  if (metrics.failureRate >= 0.5) {
    codes.push("ESCALATE_FAILURE_RATE");
  }

  return codes;
}

/**
 * @param {object | null | undefined} dashboard
 * @param {object} [options]
 * @param {string} [options.generatedAt]
 * @returns {object}
 */
export function buildWorkflowAnalytics(dashboard, options = {}) {
  const contract = extractDashboardPublicContract(dashboard);
  const metrics = computeAnalyticsMetrics(contract);
  const healthStatus = resolveAnalyticsHealthStatus(contract, metrics);

  return {
    schema: WORKFLOW_ANALYTICS_SCHEMA,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    metadata: {
      analyticsSchema: WORKFLOW_ANALYTICS_SCHEMA,
      dashboardSchema: contract.metadata.schema ?? WORKFLOW_DASHBOARD_SCHEMA,
      generator: ANALYTICS_GENERATOR,
      generatedAt: contract.metadata.generatedAt,
    },
    summary: {
      runCount: contract.summary.runCount,
      stepCount: contract.summary.stepCount,
      totalDurationMs: contract.summary.totalDurationMs,
    },
    metrics,
    health: {
      healthStatus,
      warningCodes: buildAnalyticsWarningCodes(contract, metrics),
      recommendationCodes: buildAnalyticsRecommendationCodes(contract, metrics),
    },
  };
}

/**
 * @param {string | null | undefined} analyticsPath
 * @param {string} [rootDir]
 * @returns {object}
 */
export function readWorkflowAnalytics(analyticsPath, rootDir = process.cwd()) {
  const absolutePath = getWorkflowAnalyticsAbsolutePath(rootDir, analyticsPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`workflow analytics not found: ${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(raw);
}

/**
 * @param {object | null | undefined} analytics
 * @returns {object}
 */
export function normalizeWorkflowAnalytics(analytics) {
  if (!analytics || typeof analytics !== "object") {
    return buildWorkflowAnalytics(null);
  }

  return {
    schema: analytics.schema ?? WORKFLOW_ANALYTICS_SCHEMA,
    generatedAt: analytics.generatedAt ?? new Date().toISOString(),
    metadata: {
      analyticsSchema:
        analytics.metadata?.analyticsSchema ?? WORKFLOW_ANALYTICS_SCHEMA,
      dashboardSchema:
        analytics.metadata?.dashboardSchema ?? WORKFLOW_DASHBOARD_SCHEMA,
      generator: analytics.metadata?.generator ?? ANALYTICS_GENERATOR,
      generatedAt: analytics.metadata?.generatedAt ?? null,
    },
    summary: {
      runCount: analytics.summary?.runCount ?? 0,
      stepCount: analytics.summary?.stepCount ?? 0,
      totalDurationMs: analytics.summary?.totalDurationMs ?? 0,
    },
    metrics: {
      successRate: analytics.metrics?.successRate ?? 0,
      failureRate: analytics.metrics?.failureRate ?? 0,
      resumeRate: analytics.metrics?.resumeRate ?? 0,
      averageDurationMs: analytics.metrics?.averageDurationMs ?? 0,
    },
    health: {
      healthStatus:
        analytics.health?.healthStatus ?? ANALYTICS_HEALTH_STATUS.WARNING,
      warningCodes: Array.isArray(analytics.health?.warningCodes)
        ? analytics.health.warningCodes
        : [],
      recommendationCodes: Array.isArray(analytics.health?.recommendationCodes)
        ? analytics.health.recommendationCodes
        : [],
    },
  };
}

/**
 * @param {object | null | undefined} analytics
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateWorkflowAnalytics(analytics) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!analytics || typeof analytics !== "object") {
    return {
      valid: false,
      errors: ["workflow analytics must be an object"],
      warnings: [],
    };
  }

  if (analytics.schema !== WORKFLOW_ANALYTICS_SCHEMA) {
    warnings.push(
      `analytics schema ${analytics.schema ?? "missing"} treated as legacy`,
    );
  }

  if (!analytics.generatedAt) {
    errors.push("generatedAt is required");
  }

  if (!analytics.metadata || typeof analytics.metadata !== "object") {
    errors.push("metadata is required");
  } else {
    if (!analytics.metadata.analyticsSchema) {
      warnings.push("metadata.analyticsSchema missing");
    }
    if (!analytics.metadata.dashboardSchema) {
      warnings.push("metadata.dashboardSchema missing");
    }
    if (!analytics.metadata.generator) {
      warnings.push("metadata.generator missing");
    }
  }

  if (!analytics.summary || typeof analytics.summary !== "object") {
    errors.push("summary is required");
  } else {
    for (const field of ["runCount", "stepCount", "totalDurationMs"]) {
      if (typeof analytics.summary[field] !== "number") {
        errors.push(`summary.${field} must be a number`);
      }
    }
  }

  if (!analytics.metrics || typeof analytics.metrics !== "object") {
    errors.push("metrics is required");
  } else {
    for (const field of [
      "successRate",
      "failureRate",
      "resumeRate",
      "averageDurationMs",
    ]) {
      if (typeof analytics.metrics[field] !== "number") {
        errors.push(`metrics.${field} must be a number`);
      }
    }
  }

  if (!analytics.health || typeof analytics.health !== "object") {
    errors.push("health is required");
  } else {
    const knownHealth = Object.values(ANALYTICS_HEALTH_STATUS);
    if (!knownHealth.includes(analytics.health.healthStatus)) {
      errors.push("health.healthStatus must be healthy, warning, or critical");
    }

    if (!Array.isArray(analytics.health.warningCodes)) {
      errors.push("health.warningCodes must be an array");
    }

    if (!Array.isArray(analytics.health.recommendationCodes)) {
      errors.push("health.recommendationCodes must be an array");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * @param {number} rate
 * @returns {string}
 */
export function formatAnalyticsRate(rate) {
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * @param {object} analytics
 * @returns {string}
 */
export function renderWorkflowAnalyticsMarkdown(analytics) {
  const normalized = normalizeWorkflowAnalytics(analytics);

  return [
    "# Developer Workflow Analytics",
    "",
    "| Field | Value |",
    "|---|---:|",
    `| Schema | ${normalized.schema} |`,
    `| Generated At | ${normalized.generatedAt} |`,
    "",
    "## Summary",
    "",
    "| Field | Value |",
    "|---|---:|",
    `| Runs | ${normalized.summary.runCount} |`,
    `| Steps | ${normalized.summary.stepCount} |`,
    `| Total Duration | ${normalized.summary.totalDurationMs}ms |`,
    "",
    "## Metrics",
    "",
    "| Field | Value |",
    "|---|---:|",
    `| Success Rate | ${formatAnalyticsRate(normalized.metrics.successRate)} |`,
    `| Failure Rate | ${formatAnalyticsRate(normalized.metrics.failureRate)} |`,
    `| Resume Rate | ${formatAnalyticsRate(normalized.metrics.resumeRate)} |`,
    `| Average Duration | ${normalized.metrics.averageDurationMs}ms |`,
    "",
    "## Health",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Health Status | ${normalized.health.healthStatus} |`,
    `| Warning Codes | ${normalized.health.warningCodes.join(", ") || "none"} |`,
    `| Recommendation Codes | ${normalized.health.recommendationCodes.join(", ") || "none"} |`,
    "",
  ].join("\n");
}

/**
 * @param {object} analytics
 * @returns {string}
 */
export function buildWorkflowAnalyticsCliSummary(analytics) {
  const normalized = normalizeWorkflowAnalytics(analytics);

  return [
    "Developer Analytics Summary",
    `Runs: ${normalized.summary.runCount}`,
    `Steps: ${normalized.summary.stepCount}`,
    `Success Rate: ${formatAnalyticsRate(normalized.metrics.successRate)}`,
    `Failure Rate: ${formatAnalyticsRate(normalized.metrics.failureRate)}`,
    `Resume Rate: ${formatAnalyticsRate(normalized.metrics.resumeRate)}`,
    `Average Duration: ${normalized.metrics.averageDurationMs}ms`,
    `Health: ${normalized.health.healthStatus}`,
  ].join("\n");
}

/**
 * @param {object} analytics
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writeWorkflowAnalyticsReport(analytics, rootDir = process.cwd()) {
  const normalized = normalizeWorkflowAnalytics(analytics);
  const validation = validateWorkflowAnalytics(normalized);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const reportDir = path.join(rootDir, WORKFLOW_ANALYTICS_REPORT_DIR);
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, WORKFLOW_ANALYTICS_JSON_FILENAME);
  const markdownPath = path.join(reportDir, WORKFLOW_ANALYTICS_MD_FILENAME);

  const jsonPayload = {
    schema: normalized.schema,
    generatedAt: normalized.generatedAt,
    metadata: normalized.metadata,
    summary: normalized.summary,
    metrics: normalized.metrics,
    health: normalized.health,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(
    markdownPath,
    `${renderWorkflowAnalyticsMarkdown(normalized)}\n`,
  );

  return {
    json: `${WORKFLOW_ANALYTICS_REPORT_DIR}/${WORKFLOW_ANALYTICS_JSON_FILENAME}`,
    markdown: `${WORKFLOW_ANALYTICS_REPORT_DIR}/${WORKFLOW_ANALYTICS_MD_FILENAME}`,
  };
}

/**
 * @param {object} [params]
 * @param {string | null} [params.dashboardPath]
 * @param {string} [params.rootDir]
 * @param {string} [params.generatedAt]
 * @returns {{ analytics: object, outputs: { json: string, markdown: string } }}
 */
export function buildWorkflowAnalyticsFromDashboard(params = {}) {
  const rootDir = params.rootDir ?? process.cwd();
  const dashboardPath =
    params.dashboardPath ??
    `${WORKFLOW_DASHBOARD_REPORT_DIR}/${WORKFLOW_DASHBOARD_JSON_FILENAME}`;
  const dashboard = readWorkflowDashboard(dashboardPath, rootDir);
  const analytics = buildWorkflowAnalytics(dashboard, {
    generatedAt: params.generatedAt,
  });
  const outputs = writeWorkflowAnalyticsReport(analytics, rootDir);

  return { analytics, outputs };
}
