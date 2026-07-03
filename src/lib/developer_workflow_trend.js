import fs from "node:fs";
import path from "node:path";
import {
  WORKFLOW_DASHBOARD_JSON_FILENAME,
  WORKFLOW_DASHBOARD_SCHEMA,
  extractDashboardPublicContract,
  readWorkflowDashboard,
} from "./developer_workflow_dashboard.js";

export const WORKFLOW_TREND_SCHEMA = "developer-automation/workflow-trend/1.0";
export const WORKFLOW_TREND_REPORT_DIR = "reports/workflow-trend";
export const WORKFLOW_TREND_JSON_FILENAME = "workflow-trend.json";
export const WORKFLOW_TREND_MD_FILENAME = "trend-report.md";
export const WORKFLOW_TREND_SNAPSHOTS_FILENAME = "dashboard-snapshots.json";
export const WORKFLOW_DASHBOARD_REPORT_DIR =
  "reports/developer-workflow/latest";

/**
 * @param {string | null | undefined} rootDir
 * @param {string | null | undefined} relativePath
 * @returns {string}
 */
function getWorkflowTrendAbsolutePath(rootDir, relativePath) {
  const resolvedRootDir = rootDir ?? process.cwd();
  const targetPath = relativePath ?? WORKFLOW_TREND_REPORT_DIR;

  return path.isAbsolute(targetPath)
    ? targetPath
    : path.join(resolvedRootDir, targetPath);
}

/**
 * @param {object} contract
 * @returns {object}
 */
export function normalizeTrendPublicContract(contract) {
  if (!contract || typeof contract !== "object") {
    return extractDashboardPublicContract(null);
  }

  return {
    metadata: {
      schema: contract.metadata?.schema ?? WORKFLOW_DASHBOARD_SCHEMA,
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
  };
}

/**
 * @param {object} contract
 * @returns {{ successRate: number, failureRate: number, resumeRate: number, averageDurationMs: number }}
 */
export function computeTrendSnapshotMetrics(contract) {
  const normalized = normalizeTrendPublicContract(contract);
  const runCount = normalized.summary.runCount;

  if (runCount <= 0) {
    return {
      successRate: 0,
      failureRate: 0,
      resumeRate: 0,
      averageDurationMs: 0,
    };
  }

  return {
    successRate: normalized.metrics.successfulRuns / runCount,
    failureRate: normalized.metrics.failedRuns / runCount,
    resumeRate: normalized.metrics.resumedRuns / runCount,
    averageDurationMs: Math.round(normalized.summary.totalDurationMs / runCount),
  };
}

/**
 * @param {unknown} dashboards
 * @returns {object[]}
 */
export function parseTrendInputs(dashboards) {
  const items = Array.isArray(dashboards) ? dashboards : [];

  return parseTrendContracts(
    items.map((dashboard) => extractDashboardPublicContract(dashboard)),
  );
}

/**
 * @param {unknown} contracts
 * @returns {object[]}
 */
export function parseTrendContracts(contracts) {
  const items = Array.isArray(contracts) ? contracts : [];

  const parsed = items.map((contract, index) => {
    const normalized = normalizeTrendPublicContract(contract);

    return {
      contract: normalized,
      index,
      snapshot: computeTrendSnapshotMetrics(normalized),
    };
  });

  parsed.sort((left, right) => {
    const leftTime = Date.parse(left.contract.metadata.generatedAt ?? "") || 0;
    const rightTime = Date.parse(right.contract.metadata.generatedAt ?? "") || 0;

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return left.index - right.index;
  });

  return parsed;
}

/**
 * @param {object[]} parsedInputs
 * @param {object} [options]
 * @param {string} [options.generatedAt]
 * @returns {object}
 */
export function buildWorkflowTrend(parsedInputs, options = {}) {
  const samples = Array.isArray(parsedInputs) ? parsedInputs : [];

  /** @type {object} */
  const trends = {
    successRate: [],
    failureRate: [],
    resumeRate: [],
    duration: [],
    workflowHealth: [],
  };

  for (const sample of samples) {
    const generatedAt =
      sample.contract.metadata.generatedAt ??
      options.generatedAt ??
      new Date().toISOString();

    trends.successRate.push({
      generatedAt,
      value: sample.snapshot.successRate,
    });
    trends.failureRate.push({
      generatedAt,
      value: sample.snapshot.failureRate,
    });
    trends.resumeRate.push({
      generatedAt,
      value: sample.snapshot.resumeRate,
    });
    trends.duration.push({
      generatedAt,
      value: sample.snapshot.averageDurationMs,
    });
    trends.workflowHealth.push({
      generatedAt,
      value: sample.contract.status.workflowHealth,
    });
  }

  return {
    schema: WORKFLOW_TREND_SCHEMA,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    sampleCount: samples.length,
    trends,
  };
}

/**
 * @param {object | null | undefined} trend
 * @returns {object}
 */
export function normalizeWorkflowTrend(trend) {
  if (!trend || typeof trend !== "object") {
    return buildWorkflowTrend([]);
  }

  const trends = trend.trends ?? {};

  return {
    schema: trend.schema ?? WORKFLOW_TREND_SCHEMA,
    generatedAt: trend.generatedAt ?? new Date().toISOString(),
    sampleCount: trend.sampleCount ?? 0,
    trends: {
      successRate: Array.isArray(trends.successRate) ? trends.successRate : [],
      failureRate: Array.isArray(trends.failureRate) ? trends.failureRate : [],
      resumeRate: Array.isArray(trends.resumeRate) ? trends.resumeRate : [],
      duration: Array.isArray(trends.duration) ? trends.duration : [],
      workflowHealth: Array.isArray(trends.workflowHealth)
        ? trends.workflowHealth
        : [],
    },
  };
}

/**
 * @param {object | null | undefined} trend
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateWorkflowTrend(trend) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!trend || typeof trend !== "object") {
    return {
      valid: false,
      errors: ["workflow trend must be an object"],
      warnings: [],
    };
  }

  if (trend.schema !== WORKFLOW_TREND_SCHEMA) {
    warnings.push(
      `trend schema ${trend.schema ?? "missing"} treated as legacy`,
    );
  }

  if (!trend.generatedAt) {
    errors.push("generatedAt is required");
  }

  if (typeof trend.sampleCount !== "number") {
    errors.push("sampleCount must be a number");
  }

  if (!trend.trends || typeof trend.trends !== "object") {
    errors.push("trends is required");
    return { valid: errors.length === 0, errors, warnings };
  }

  for (const key of [
    "successRate",
    "failureRate",
    "resumeRate",
    "duration",
    "workflowHealth",
  ]) {
    if (!Array.isArray(trend.trends[key])) {
      errors.push(`trends.${key} must be an array`);
    }
  }

  if (
    typeof trend.sampleCount === "number" &&
    Array.isArray(trend.trends.successRate) &&
    trend.sampleCount !== trend.trends.successRate.length
  ) {
    warnings.push("sampleCount does not match trend series length");
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
export function formatTrendRatePercent(rate) {
  return `${(rate * 100).toFixed(0)}%`;
}

/**
 * @param {number} durationMs
 * @returns {string}
 */
export function formatTrendDuration(durationMs) {
  if (durationMs >= 1000) {
    return `${Math.round(durationMs / 1000)} sec`;
  }

  return `${durationMs} ms`;
}

/**
 * @param {string} health
 * @returns {string}
 */
export function formatTrendHealthLabel(health) {
  if (!health) {
    return "Unknown";
  }

  return health.charAt(0).toUpperCase() + health.slice(1);
}

/**
 * @param {object} trend
 * @returns {string}
 */
export function renderWorkflowTrendMarkdown(trend) {
  const normalized = normalizeWorkflowTrend(trend);
  const latestSuccess = normalized.trends.successRate.at(-1);
  const latestFailure = normalized.trends.failureRate.at(-1);
  const latestResume = normalized.trends.resumeRate.at(-1);
  const latestDuration = normalized.trends.duration.at(-1);
  const latestHealth = normalized.trends.workflowHealth.at(-1);

  const lines = [
    "# Workflow Trend Report",
    "",
    "## Summary",
    "",
    "| Field | Value |",
    "|---|---:|",
    `| Schema | ${normalized.schema} |`,
    `| Generated At | ${normalized.generatedAt} |`,
    `| Snapshots | ${normalized.sampleCount} |`,
    "",
  ];

  const sections = [
    ["Success Rate Trend", normalized.trends.successRate, (point) =>
      `${formatTrendRatePercent(point.value)}`],
    ["Failure Rate Trend", normalized.trends.failureRate, (point) =>
      `${formatTrendRatePercent(point.value)}`],
    ["Resume Rate Trend", normalized.trends.resumeRate, (point) =>
      `${formatTrendRatePercent(point.value)}`],
    ["Duration Trend", normalized.trends.duration, (point) =>
      formatTrendDuration(point.value)],
    ["Workflow Health Trend", normalized.trends.workflowHealth, (point) =>
      formatTrendHealthLabel(point.value)],
  ];

  for (const [title, series, formatter] of sections) {
    lines.push(`## ${title}`, "");

    if (series.length === 0) {
      lines.push("No samples recorded.", "");
      continue;
    }

    lines.push("| Generated At | Value |");
    lines.push("|---|---:|");
    for (const point of series) {
      lines.push(`| ${point.generatedAt} | ${formatter(point)} |`);
    }
    lines.push("");
  }

  if (latestSuccess) {
    lines.push(
      `_Latest Success Rate: ${formatTrendRatePercent(latestSuccess.value)}_`,
      "",
    );
  }
  if (latestFailure) {
    lines.push(
      `_Latest Failure Rate: ${formatTrendRatePercent(latestFailure.value)}_`,
      "",
    );
  }
  if (latestResume) {
    lines.push(
      `_Latest Resume Rate: ${formatTrendRatePercent(latestResume.value)}_`,
      "",
    );
  }
  if (latestDuration) {
    lines.push(
      `_Latest Duration: ${formatTrendDuration(latestDuration.value)}_`,
      "",
    );
  }
  if (latestHealth) {
    lines.push(
      `_Latest Health: ${formatTrendHealthLabel(latestHealth.value)}_`,
      "",
    );
  }

  return lines.join("\n");
}

/**
 * @param {object} trend
 * @returns {string}
 */
export function buildWorkflowTrendCliSummary(trend) {
  return printWorkflowTrendSummary(trend);
}

/**
 * @param {object} trend
 * @returns {string}
 */
export function printWorkflowTrendSummary(trend) {
  const normalized = normalizeWorkflowTrend(trend);
  const latestSuccess = normalized.trends.successRate.at(-1);
  const latestFailure = normalized.trends.failureRate.at(-1);
  const latestResume = normalized.trends.resumeRate.at(-1);
  const latestDuration = normalized.trends.duration.at(-1);
  const latestHealth = normalized.trends.workflowHealth.at(-1);

  return [
    "Workflow Trend Summary",
    `Snapshots: ${normalized.sampleCount}`,
    `Latest Success Rate: ${latestSuccess ? formatTrendRatePercent(latestSuccess.value) : "n/a"}`,
    `Latest Failure Rate: ${latestFailure ? formatTrendRatePercent(latestFailure.value) : "n/a"}`,
    `Latest Resume Rate: ${latestResume ? formatTrendRatePercent(latestResume.value) : "n/a"}`,
    `Latest Duration: ${latestDuration ? formatTrendDuration(latestDuration.value) : "n/a"}`,
    `Latest Health: ${latestHealth ? formatTrendHealthLabel(latestHealth.value) : "n/a"}`,
  ].join("\n");
}

/**
 * @param {object} trend
 * @param {string} [rootDir]
 * @returns {string}
 */
export function writeWorkflowTrendJson(trend, rootDir = process.cwd()) {
  const normalized = normalizeWorkflowTrend(trend);
  const validation = validateWorkflowTrend(normalized);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const reportDir = path.join(rootDir, WORKFLOW_TREND_REPORT_DIR);
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, WORKFLOW_TREND_JSON_FILENAME);
  const payload = {
    schema: normalized.schema,
    generatedAt: normalized.generatedAt,
    sampleCount: normalized.sampleCount,
    trends: normalized.trends,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);

  return `${WORKFLOW_TREND_REPORT_DIR}/${WORKFLOW_TREND_JSON_FILENAME}`;
}

/**
 * @param {object} trend
 * @param {string} [rootDir]
 * @returns {string}
 */
export function writeWorkflowTrendMarkdown(trend, rootDir = process.cwd()) {
  const normalized = normalizeWorkflowTrend(trend);
  const reportDir = path.join(rootDir, WORKFLOW_TREND_REPORT_DIR);
  fs.mkdirSync(reportDir, { recursive: true });

  const markdownPath = path.join(reportDir, WORKFLOW_TREND_MD_FILENAME);
  fs.writeFileSync(
    markdownPath,
    `${renderWorkflowTrendMarkdown(normalized)}\n`,
  );

  return `${WORKFLOW_TREND_REPORT_DIR}/${WORKFLOW_TREND_MD_FILENAME}`;
}

/**
 * @param {object} trend
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writeWorkflowTrendReport(trend, rootDir = process.cwd()) {
  return {
    json: writeWorkflowTrendJson(trend, rootDir),
    markdown: writeWorkflowTrendMarkdown(trend, rootDir),
  };
}

/**
 * @param {string} [rootDir]
 * @returns {object[]}
 */
export function readWorkflowTrendSnapshots(rootDir = process.cwd()) {
  const snapshotsPath = path.join(
    rootDir,
    WORKFLOW_TREND_REPORT_DIR,
    WORKFLOW_TREND_SNAPSHOTS_FILENAME,
  );

  if (!fs.existsSync(snapshotsPath)) {
    return [];
  }

  const raw = JSON.parse(fs.readFileSync(snapshotsPath, "utf8"));
  return Array.isArray(raw) ? raw : [];
}

/**
 * @param {object[]} snapshots
 * @param {object} contract
 * @returns {object[]}
 */
export function appendTrendPublicContractSnapshot(snapshots, contract) {
  const normalized = normalizeTrendPublicContract(contract);
  const existing = Array.isArray(snapshots) ? [...snapshots] : [];
  const generatedAt = normalized.metadata.generatedAt;

  if (
    generatedAt &&
    existing.some((item) => item?.metadata?.generatedAt === generatedAt)
  ) {
    return existing;
  }

  existing.push(normalized);
  return existing;
}

/**
 * @param {object[]} snapshots
 * @param {string} [rootDir]
 */
export function writeWorkflowTrendSnapshots(snapshots, rootDir = process.cwd()) {
  const reportDir = path.join(rootDir, WORKFLOW_TREND_REPORT_DIR);
  fs.mkdirSync(reportDir, { recursive: true });

  const snapshotsPath = path.join(reportDir, WORKFLOW_TREND_SNAPSHOTS_FILENAME);
  fs.writeFileSync(snapshotsPath, `${JSON.stringify(snapshots, null, 2)}\n`);
}

/**
 * @param {object} [params]
 * @param {string | null} [params.dashboardPath]
 * @param {string} [params.rootDir]
 * @param {string} [params.generatedAt]
 * @param {object[]} [params.dashboards]
 * @returns {{ trend: object, outputs: { json: string, markdown: string } }}
 */
export function buildWorkflowTrendFromDashboard(params = {}) {
  const rootDir = params.rootDir ?? process.cwd();
  const generatedAt = params.generatedAt ?? new Date().toISOString();

  let parsedInputs;

  if (Array.isArray(params.dashboards)) {
    parsedInputs = parseTrendInputs(params.dashboards);
  } else {
    const dashboardPath =
      params.dashboardPath ??
      `${WORKFLOW_DASHBOARD_REPORT_DIR}/${WORKFLOW_DASHBOARD_JSON_FILENAME}`;
    const dashboard = readWorkflowDashboard(dashboardPath, rootDir);
    const contract = extractDashboardPublicContract(dashboard);
    const snapshots = appendTrendPublicContractSnapshot(
      readWorkflowTrendSnapshots(rootDir),
      contract,
    );
    writeWorkflowTrendSnapshots(snapshots, rootDir);
    parsedInputs = parseTrendContracts(snapshots);
  }

  const trend = buildWorkflowTrend(parsedInputs, { generatedAt });
  const outputs = writeWorkflowTrendReport(trend, rootDir);

  return { trend, outputs };
}
