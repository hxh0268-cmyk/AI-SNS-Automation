import fs from "node:fs";
import path from "node:path";
import { DEVELOPER_WORKFLOW_REPORT_DIR } from "./developer_workflow_checkpoint.js";
import {
  WORKFLOW_TIMELINE_JSON_FILENAME,
  WORKFLOW_TIMELINE_SCHEMA,
} from "./developer_workflow_timeline.js";

export const WORKFLOW_DASHBOARD_SCHEMA =
  "developer-automation/workflow-dashboard/1.0";
export const WORKFLOW_DASHBOARD_JSON_FILENAME = "workflow-dashboard.json";
export const WORKFLOW_DASHBOARD_MD_FILENAME = "workflow-dashboard.md";

export const DASHBOARD_STATUS = {
  SUCCESS: "success",
  FAILED: "failed",
  MIXED: "mixed",
  UNKNOWN: "unknown",
};

const RUN_STATUS_KEYS = ["completed", "failed", "stopped", "unknown"];
const STEP_STATUS_KEYS = ["completed", "failed", "skipped", "stopped", "unknown"];

/**
 * @param {string | null | undefined} rootDir
 * @param {string | null | undefined} timelinePath
 * @returns {string}
 */
function getWorkflowTimelineAbsolutePath(rootDir, timelinePath) {
  const resolvedRootDir = rootDir ?? process.cwd();
  const relativePath =
    timelinePath ??
    `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_TIMELINE_JSON_FILENAME}`;

  return path.isAbsolute(relativePath)
    ? relativePath
    : path.join(resolvedRootDir, relativePath);
}

/**
 * @param {string | null | undefined} rootDir
 * @param {string | null | undefined} dashboardPath
 * @returns {string}
 */
function getWorkflowDashboardAbsolutePath(rootDir, dashboardPath) {
  const resolvedRootDir = rootDir ?? process.cwd();
  const relativePath =
    dashboardPath ??
    `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_DASHBOARD_JSON_FILENAME}`;

  return path.isAbsolute(relativePath)
    ? relativePath
    : path.join(resolvedRootDir, relativePath);
}

/**
 * @returns {object}
 */
function createEmptyTimelineSource() {
  return {
    schema: WORKFLOW_TIMELINE_SCHEMA,
    generatedAt: new Date().toISOString(),
    source: {
      historyPath: null,
      historySchema: null,
    },
    summary: {
      runCount: 0,
      stepCount: 0,
      firstRunAt: null,
      lastRunAt: null,
    },
    runs: [],
  };
}

/**
 * @param {unknown} durationMs
 * @returns {number}
 */
export function resolveDashboardDurationMs(durationMs) {
  return typeof durationMs === "number" && Number.isFinite(durationMs)
    ? durationMs
    : 0;
}

/**
 * @param {unknown} status
 * @returns {string}
 */
export function normalizeDashboardStatusValue(status) {
  return typeof status === "string" ? status : "unknown";
}

/**
 * @param {number} stepCount
 * @param {number} successCount
 * @param {number} failedCount
 * @returns {string}
 */
export function resolveDashboardStatus(stepCount, successCount, failedCount) {
  if (stepCount === 0) {
    return DASHBOARD_STATUS.UNKNOWN;
  }

  if (successCount > 0 && failedCount > 0) {
    return DASHBOARD_STATUS.MIXED;
  }

  if (failedCount > 0) {
    return DASHBOARD_STATUS.FAILED;
  }

  if (successCount > 0 && failedCount === 0) {
    return DASHBOARD_STATUS.SUCCESS;
  }

  return DASHBOARD_STATUS.UNKNOWN;
}

/**
 * @param {object | null | undefined} timeline
 * @param {object} [options]
 * @param {string} [options.generatedAt]
 * @param {string} [options.timelinePath]
 * @returns {object}
 */
export function buildWorkflowDashboard(timeline, options = {}) {
  /** @type {string[]} */
  const warnings = [];

  if (!timeline || typeof timeline !== "object") {
    warnings.push("timeline missing or invalid; using empty dashboard");
    timeline = createEmptyTimelineSource();
  }

  if (
    timeline.schema &&
    timeline.schema !== WORKFLOW_TIMELINE_SCHEMA
  ) {
    warnings.push(
      `timeline schema ${timeline.schema} treated as legacy timeline input`,
    );
  }

  const runs = Array.isArray(timeline.runs) ? timeline.runs : [];
  const runCount =
    typeof timeline.summary?.runCount === "number"
      ? timeline.summary.runCount
      : runs.length;

  let stepCount =
    typeof timeline.summary?.stepCount === "number"
      ? timeline.summary.stepCount
      : 0;

  if (typeof timeline.summary?.stepCount !== "number") {
    stepCount = runs.reduce(
      (total, run) =>
        total + (Array.isArray(run?.steps) ? run.steps.length : 0),
      0,
    );
  }

  /** @type {Record<string, number>} */
  const runStatusCounts = Object.fromEntries(
    RUN_STATUS_KEYS.map((key) => [key, 0]),
  );
  /** @type {Record<string, number>} */
  const stepStatusCounts = Object.fromEntries(
    STEP_STATUS_KEYS.map((key) => [key, 0]),
  );

  let successCount = 0;
  let failedCount = 0;
  let resumeCount = 0;
  let totalDurationMs = 0;
  /** @type {number[]} */
  const stepDurations = [];

  /** @type {object[]} */
  const dashboardRuns = [];

  for (const run of runs) {
    const runStatus = normalizeDashboardStatusValue(run?.status);
    if (runStatus in runStatusCounts) {
      runStatusCounts[runStatus] += 1;
    } else {
      runStatusCounts.unknown += 1;
    }

    if (run?.resume?.isResume === true) {
      resumeCount += 1;
    }

    const steps = Array.isArray(run?.steps) ? run.steps : [];
    let runStepDurationMs = 0;

    for (const step of steps) {
      const stepStatus = normalizeDashboardStatusValue(step?.status);
      if (stepStatus in stepStatusCounts) {
        stepStatusCounts[stepStatus] += 1;
      } else {
        stepStatusCounts.unknown += 1;
      }

      if (stepStatus === "completed") {
        successCount += 1;
      } else if (stepStatus === "failed") {
        failedCount += 1;
      }

      const stepDurationMs = resolveDashboardDurationMs(step?.durationMs);
      totalDurationMs += stepDurationMs;
      runStepDurationMs += stepDurationMs;
      if (stepDurationMs > 0) {
        stepDurations.push(stepDurationMs);
      }
    }

    if (steps.length === 0) {
      const runDurationMs = resolveDashboardDurationMs(run?.durationMs);
      totalDurationMs += runDurationMs;
      runStepDurationMs = runDurationMs;
      if (runDurationMs > 0) {
        stepDurations.push(runDurationMs);
      }
    }

    dashboardRuns.push({
      runId: run?.runId ?? "unknown",
      status: runStatus,
      stepCount: steps.length,
      durationMs: runStepDurationMs,
      resume: run?.resume?.isResume === true,
    });
  }

  const averageDurationMs =
    stepCount > 0 ? Math.round(totalDurationMs / stepCount) : 0;
  const minDurationMs =
    stepDurations.length > 0 ? Math.min(...stepDurations) : 0;
  const maxDurationMs =
    stepDurations.length > 0 ? Math.max(...stepDurations) : 0;
  const resumeRate = runCount > 0 ? resumeCount / runCount : 0;

  return {
    schema: WORKFLOW_DASHBOARD_SCHEMA,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source: {
      schema: WORKFLOW_TIMELINE_SCHEMA,
      path:
        options.timelinePath ??
        `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_TIMELINE_JSON_FILENAME}`,
    },
    status: resolveDashboardStatus(stepCount, successCount, failedCount),
    summary: {
      runCount,
      stepCount,
      successCount,
      failedCount,
      resumeCount,
      totalDurationMs,
      averageDurationMs,
    },
    metrics: {
      runs: runStatusCounts,
      steps: stepStatusCounts,
      duration: {
        totalMs: totalDurationMs,
        averageMs: averageDurationMs,
        minMs: minDurationMs,
        maxMs: maxDurationMs,
      },
      resume: {
        count: resumeCount,
        rate: resumeRate,
      },
    },
    runs: dashboardRuns,
    warnings,
  };
}

/**
 * @param {string | null | undefined} timelinePath
 * @param {string} [rootDir]
 * @returns {object}
 */
export function readWorkflowDashboardTimelineSource(
  timelinePath,
  rootDir = process.cwd(),
) {
  const absolutePath = getWorkflowTimelineAbsolutePath(rootDir, timelinePath);

  if (!fs.existsSync(absolutePath)) {
    return createEmptyTimelineSource();
  }

  const raw = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(raw);
}

/**
 * @param {string | null | undefined} dashboardPath
 * @param {string} [rootDir]
 * @returns {object}
 */
export function readWorkflowDashboard(dashboardPath, rootDir = process.cwd()) {
  const absolutePath = getWorkflowDashboardAbsolutePath(rootDir, dashboardPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`workflow dashboard not found: ${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(raw);
}

/**
 * @param {object | null | undefined} dashboard
 * @returns {object}
 */
export function normalizeWorkflowDashboard(dashboard) {
  if (!dashboard || typeof dashboard !== "object") {
    return buildWorkflowDashboard(createEmptyTimelineSource());
  }

  return {
    schema: dashboard.schema ?? WORKFLOW_DASHBOARD_SCHEMA,
    generatedAt: dashboard.generatedAt ?? new Date().toISOString(),
    source: {
      schema: dashboard.source?.schema ?? WORKFLOW_TIMELINE_SCHEMA,
      path:
        dashboard.source?.path ??
        `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_TIMELINE_JSON_FILENAME}`,
    },
    status: dashboard.status ?? DASHBOARD_STATUS.UNKNOWN,
    summary: {
      runCount: dashboard.summary?.runCount ?? 0,
      stepCount: dashboard.summary?.stepCount ?? 0,
      successCount: dashboard.summary?.successCount ?? 0,
      failedCount: dashboard.summary?.failedCount ?? 0,
      resumeCount: dashboard.summary?.resumeCount ?? 0,
      totalDurationMs: dashboard.summary?.totalDurationMs ?? 0,
      averageDurationMs: dashboard.summary?.averageDurationMs ?? 0,
    },
    metrics: {
      runs: dashboard.metrics?.runs ?? {},
      steps: dashboard.metrics?.steps ?? {},
      duration: dashboard.metrics?.duration ?? {},
      resume: dashboard.metrics?.resume ?? {},
    },
    runs: Array.isArray(dashboard.runs) ? dashboard.runs : [],
    warnings: Array.isArray(dashboard.warnings) ? dashboard.warnings : [],
  };
}

/**
 * @param {object | null | undefined} dashboard
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateWorkflowDashboard(dashboard) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!dashboard || typeof dashboard !== "object") {
    return {
      valid: false,
      errors: ["workflow dashboard must be an object"],
      warnings: [],
    };
  }

  if (dashboard.schema !== WORKFLOW_DASHBOARD_SCHEMA) {
    warnings.push(
      `dashboard schema ${dashboard.schema ?? "missing"} treated as legacy`,
    );
  }

  if (!dashboard.generatedAt) {
    errors.push("generatedAt is required");
  }

  if (!dashboard.source || typeof dashboard.source !== "object") {
    errors.push("source is required");
  } else {
    if (!dashboard.source.schema) {
      warnings.push("source.schema missing");
    }
    if (!dashboard.source.path) {
      warnings.push("source.path missing");
    }
  }

  if (!dashboard.status) {
    errors.push("status is required");
  }

  if (!dashboard.summary || typeof dashboard.summary !== "object") {
    errors.push("summary is required");
  } else {
    for (const field of [
      "runCount",
      "stepCount",
      "successCount",
      "failedCount",
      "resumeCount",
      "totalDurationMs",
      "averageDurationMs",
    ]) {
      if (typeof dashboard.summary[field] !== "number") {
        errors.push(`summary.${field} must be a number`);
      }
    }
  }

  if (!dashboard.metrics || typeof dashboard.metrics !== "object") {
    errors.push("metrics is required");
  }

  if (!Array.isArray(dashboard.runs)) {
    errors.push("runs must be an array");
  }

  if (!Array.isArray(dashboard.warnings)) {
    warnings.push("warnings must be an array");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * @param {object} dashboard
 * @returns {string}
 */
export function renderWorkflowDashboardMarkdown(dashboard) {
  const normalized = normalizeWorkflowDashboard(dashboard);

  return [
    "# Developer Workflow Dashboard",
    "",
    "| Field | Value |",
    "|---|---:|",
    `| Status | ${normalized.status} |`,
    `| Runs | ${normalized.summary.runCount} |`,
    `| Steps | ${normalized.summary.stepCount} |`,
    `| Success | ${normalized.summary.successCount} |`,
    `| Failed | ${normalized.summary.failedCount} |`,
    `| Resume | ${normalized.summary.resumeCount} |`,
    `| Total Duration | ${normalized.summary.totalDurationMs}ms |`,
    `| Average Duration | ${normalized.summary.averageDurationMs}ms |`,
    "",
  ].join("\n");
}

/**
 * @param {object} dashboard
 * @returns {string}
 */
export function buildWorkflowDashboardCliSummary(dashboard) {
  const normalized = normalizeWorkflowDashboard(dashboard);

  return [
    "Developer Workflow Dashboard",
    `Runs: ${normalized.summary.runCount}`,
    `Steps: ${normalized.summary.stepCount}`,
    `Success: ${normalized.summary.successCount}`,
    `Failed: ${normalized.summary.failedCount}`,
    `Resume: ${normalized.summary.resumeCount}`,
    `Total Duration: ${normalized.summary.totalDurationMs}ms`,
    `Average Duration: ${normalized.summary.averageDurationMs}ms`,
    `Status: ${normalized.status}`,
  ].join("\n");
}

/**
 * @param {object} dashboard
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writeWorkflowDashboardReport(dashboard, rootDir = process.cwd()) {
  const normalized = normalizeWorkflowDashboard(dashboard);
  const validation = validateWorkflowDashboard(normalized);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const reportDir = path.join(rootDir, "reports", "developer-workflow", "latest");
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, WORKFLOW_DASHBOARD_JSON_FILENAME);
  const markdownPath = path.join(reportDir, WORKFLOW_DASHBOARD_MD_FILENAME);

  const jsonPayload = {
    schema: normalized.schema,
    generatedAt: normalized.generatedAt,
    source: normalized.source,
    status: normalized.status,
    summary: normalized.summary,
    metrics: normalized.metrics,
    runs: normalized.runs,
    warnings: normalized.warnings,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(
    markdownPath,
    `${renderWorkflowDashboardMarkdown(normalized)}\n`,
  );

  return {
    json: `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_DASHBOARD_JSON_FILENAME}`,
    markdown: `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_DASHBOARD_MD_FILENAME}`,
  };
}

/**
 * @param {object} [params]
 * @param {string | null} [params.timelinePath]
 * @param {string} [params.rootDir]
 * @param {string} [params.generatedAt]
 * @returns {{ dashboard: object, outputs: { json: string, markdown: string } }}
 */
export function buildWorkflowDashboardFromTimeline(params = {}) {
  const rootDir = params.rootDir ?? process.cwd();
  const timelinePath =
    params.timelinePath ??
    `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_TIMELINE_JSON_FILENAME}`;
  const timeline = readWorkflowDashboardTimelineSource(timelinePath, rootDir);
  const dashboard = buildWorkflowDashboard(timeline, {
    generatedAt: params.generatedAt,
    timelinePath,
  });
  const outputs = writeWorkflowDashboardReport(dashboard, rootDir);

  return { dashboard, outputs };
}
