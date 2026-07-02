import fs from "node:fs";
import path from "node:path";
import { DEVELOPER_WORKFLOW_REPORT_DIR } from "./developer_workflow_checkpoint.js";
import {
  WORKFLOW_HISTORY_JSON_FILENAME,
  WORKFLOW_HISTORY_SCHEMA,
  normalizeWorkflowHistory,
  readWorkflowHistory,
} from "./developer_workflow_history.js";

export const WORKFLOW_TIMELINE_SCHEMA =
  "developer-automation/workflow-timeline/1.0";
export const WORKFLOW_TIMELINE_JSON_FILENAME = "workflow-timeline.json";
export const WORKFLOW_TIMELINE_MD_FILENAME = "workflow-timeline.md";

export const TIMELINE_RUN_STATUS = {
  COMPLETED: "completed",
  FAILED: "failed",
  STOPPED: "stopped",
  UNKNOWN: "unknown",
};

export const TIMELINE_STEP_STATUS = {
  COMPLETED: "completed",
  FAILED: "failed",
  SKIPPED: "skipped",
  STOPPED: "stopped",
  UNKNOWN: "unknown",
};

/**
 * @param {unknown} startedAt
 * @returns {number | null}
 */
export function parseTimelineStartedAtMs(startedAt) {
  if (typeof startedAt !== "string") {
    return null;
  }

  const parsed = Date.parse(startedAt);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

/**
 * @param {string | null | undefined} startedAt
 * @param {string | null | undefined} completedAt
 * @returns {number | null}
 */
export function computeDurationMs(startedAt, completedAt) {
  if (typeof startedAt !== "string" || typeof completedAt !== "string") {
    return null;
  }

  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }

  return Math.max(0, end - start);
}

/**
 * @param {unknown} durationMs
 * @param {string | null | undefined} startedAt
 * @param {string | null | undefined} completedAt
 * @returns {number | null}
 */
export function resolveDurationMs(durationMs, startedAt, completedAt) {
  if (typeof durationMs === "number") {
    return durationMs;
  }

  return computeDurationMs(startedAt, completedAt);
}

/**
 * @param {string | null | undefined} status
 * @returns {string}
 */
export function normalizeTimelineRunStatus(status) {
  const known = Object.values(TIMELINE_RUN_STATUS);
  return known.includes(status) ? status : TIMELINE_RUN_STATUS.UNKNOWN;
}

/**
 * @param {string | null | undefined} status
 * @returns {string}
 */
export function normalizeTimelineStepStatus(status) {
  const known = Object.values(TIMELINE_STEP_STATUS);
  return known.includes(status) ? status : TIMELINE_STEP_STATUS.UNKNOWN;
}

/**
 * @param {object[]} runs
 * @returns {object[]}
 */
export function sortTimelineRuns(runs) {
  const indexedRuns = runs.map((run, index) => ({ run, index }));

  indexedRuns.sort((left, right) => {
    const leftMs = parseTimelineStartedAtMs(left.run.startedAt);
    const rightMs = parseTimelineStartedAtMs(right.run.startedAt);
    const leftValid = leftMs !== null;
    const rightValid = rightMs !== null;

    if (leftValid && rightValid) {
      if (leftMs !== rightMs) {
        return leftMs - rightMs;
      }

      return left.index - right.index;
    }

    if (leftValid) {
      return -1;
    }

    if (rightValid) {
      return 1;
    }

    return left.index - right.index;
  });

  return indexedRuns.map(({ run }) => run);
}

/**
 * @param {object | null | undefined} history
 * @param {object} [params]
 * @param {string} [params.generatedAt]
 * @param {string} [params.historyPath]
 * @returns {object}
 */
export function buildWorkflowTimeline(history, params = {}) {
  const normalizedHistory = normalizeWorkflowHistory(history);
  const sortedRuns = sortTimelineRuns(normalizedHistory.runs);

  /** @type {object[]} */
  const timelineRuns = [];
  let stepCount = 0;
  let firstRunAt = null;
  let lastRunAt = null;

  for (let index = 0; index < sortedRuns.length; index += 1) {
    const run = sortedRuns[index];
    const previousRun = index > 0 ? sortedRuns[index - 1] : null;
    const isResume =
      previousRun?.status === TIMELINE_RUN_STATUS.STOPPED &&
      run.status !== TIMELINE_RUN_STATUS.UNKNOWN;

    const steps = (run.steps ?? []).map((step, stepIndex) => {
      stepCount += 1;
      return {
        stepId: step.stepId ?? "unknown",
        order: stepIndex + 1,
        status: normalizeTimelineStepStatus(step.status),
        startedAt: step.startedAt ?? null,
        completedAt: step.completedAt ?? null,
        durationMs: resolveDurationMs(
          step.durationMs,
          step.startedAt,
          step.completedAt,
        ),
      };
    });

    const startedAt = run.startedAt ?? null;
    const completedAt = run.completedAt ?? null;

    if (startedAt && (!firstRunAt || startedAt < firstRunAt)) {
      firstRunAt = startedAt;
    }
    if (completedAt && (!lastRunAt || completedAt > lastRunAt)) {
      lastRunAt = completedAt;
    } else if (startedAt && (!lastRunAt || startedAt > lastRunAt)) {
      lastRunAt = startedAt;
    }

    timelineRuns.push({
      runId: run.runId,
      status: normalizeTimelineRunStatus(run.status),
      startedAt,
      completedAt,
      durationMs: resolveDurationMs(run.durationMs, startedAt, completedAt),
      resume: {
        isResume,
        resumedFromRunId: isResume ? (previousRun?.runId ?? null) : null,
      },
      steps,
    });
  }

  return {
    schema: WORKFLOW_TIMELINE_SCHEMA,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    source: {
      historyPath:
        params.historyPath ??
        `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_HISTORY_JSON_FILENAME}`,
      historySchema: normalizedHistory.schema ?? WORKFLOW_HISTORY_SCHEMA,
    },
    summary: {
      runCount: timelineRuns.length,
      stepCount,
      firstRunAt,
      lastRunAt,
    },
    runs: timelineRuns,
  };
}

/**
 * @param {string | null | undefined} historyPath
 * @param {string} [rootDir]
 * @returns {object}
 */
export function readWorkflowTimelineSource(historyPath, rootDir = process.cwd()) {
  return readWorkflowHistory(historyPath, rootDir);
}

/**
 * @param {object | null | undefined} timeline
 * @returns {object}
 */
export function normalizeWorkflowTimeline(timeline) {
  if (!timeline || typeof timeline !== "object") {
    return buildWorkflowTimeline(createEmptyTimelineHistory());
  }

  const runs = Array.isArray(timeline.runs) ? timeline.runs : [];

  return {
    schema: timeline.schema ?? WORKFLOW_TIMELINE_SCHEMA,
    generatedAt: timeline.generatedAt ?? new Date().toISOString(),
    source: {
      historyPath:
        timeline.source?.historyPath ??
        `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_HISTORY_JSON_FILENAME}`,
      historySchema:
        timeline.source?.historySchema ?? WORKFLOW_HISTORY_SCHEMA,
    },
    summary: {
      runCount: timeline.summary?.runCount ?? runs.length,
      stepCount:
        timeline.summary?.stepCount ??
        runs.reduce(
          (total, run) => total + (Array.isArray(run.steps) ? run.steps.length : 0),
          0,
        ),
      firstRunAt: timeline.summary?.firstRunAt ?? null,
      lastRunAt: timeline.summary?.lastRunAt ?? null,
    },
    runs: runs.map((run) => normalizeWorkflowTimelineRun(run)),
  };
}

/**
 * @returns {object}
 */
function createEmptyTimelineHistory() {
  return {
    schema: WORKFLOW_HISTORY_SCHEMA,
    generatedAt: new Date().toISOString(),
    historyVersion: "1.0",
    runs: [],
  };
}

/**
 * @param {object | null | undefined} run
 * @returns {object}
 */
export function normalizeWorkflowTimelineRun(run) {
  if (!run || typeof run !== "object") {
    return {
      runId: "unknown",
      status: TIMELINE_RUN_STATUS.UNKNOWN,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      resume: { isResume: false, resumedFromRunId: null },
      steps: [],
    };
  }

  const steps = Array.isArray(run.steps)
    ? run.steps.map((step, index) => normalizeWorkflowTimelineStep(step, index))
    : [];

  return {
    runId: run.runId ?? "unknown",
    status: normalizeTimelineRunStatus(run.status),
    startedAt: run.startedAt ?? null,
    completedAt: run.completedAt ?? null,
    durationMs: resolveDurationMs(
      run.durationMs,
      run.startedAt,
      run.completedAt,
    ),
    resume: {
      isResume: run.resume?.isResume ?? false,
      resumedFromRunId: run.resume?.resumedFromRunId ?? null,
    },
    steps,
  };
}

/**
 * @param {object | null | undefined} step
 * @param {number} [index]
 * @returns {object}
 */
export function normalizeWorkflowTimelineStep(step, index = 0) {
  if (!step || typeof step !== "object") {
    return {
      stepId: "unknown",
      order: index + 1,
      status: TIMELINE_STEP_STATUS.UNKNOWN,
      startedAt: null,
      completedAt: null,
      durationMs: null,
    };
  }

  return {
    stepId: step.stepId ?? "unknown",
    order: step.order ?? index + 1,
    status: normalizeTimelineStepStatus(step.status),
    startedAt: step.startedAt ?? null,
    completedAt: step.completedAt ?? null,
    durationMs: resolveDurationMs(
      step.durationMs,
      step.startedAt,
      step.completedAt,
    ),
  };
}

/**
 * @param {object | null | undefined} timeline
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateWorkflowTimeline(timeline) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!timeline || typeof timeline !== "object") {
    return {
      valid: false,
      errors: ["workflow timeline must be an object"],
      warnings: [],
    };
  }

  if (timeline.schema !== WORKFLOW_TIMELINE_SCHEMA) {
    warnings.push(
      `timeline schema ${timeline.schema ?? "missing"} treated as legacy`,
    );
  }

  if (!timeline.generatedAt) {
    errors.push("generatedAt is required");
  }

  if (!timeline.source || typeof timeline.source !== "object") {
    errors.push("source is required");
  } else {
    if (!timeline.source.historyPath) {
      warnings.push("source.historyPath missing");
    }
    if (
      timeline.source.historySchema &&
      timeline.source.historySchema !== WORKFLOW_HISTORY_SCHEMA
    ) {
      warnings.push("source.historySchema mismatch with workflow history");
    }
  }

  if (!timeline.summary || typeof timeline.summary !== "object") {
    errors.push("summary is required");
  } else {
    if (typeof timeline.summary.runCount !== "number") {
      errors.push("summary.runCount must be a number");
    }
    if (typeof timeline.summary.stepCount !== "number") {
      errors.push("summary.stepCount must be a number");
    }
  }

  if (!Array.isArray(timeline.runs)) {
    errors.push("runs must be an array");
    return { valid: errors.length === 0, errors, warnings };
  }

  for (const [index, run] of timeline.runs.entries()) {
    if (!run?.runId) {
      errors.push(`runs[${index}].runId is required`);
    }
    if (!run?.status) {
      errors.push(`runs[${index}].status is required`);
    }
    if (!Array.isArray(run?.steps)) {
      errors.push(`runs[${index}].steps must be an array`);
      continue;
    }

    for (const [stepIndex, step] of run.steps.entries()) {
      if (!step?.stepId) {
        errors.push(`runs[${index}].steps[${stepIndex}].stepId is required`);
      }
      if (typeof step?.order !== "number") {
        errors.push(`runs[${index}].steps[${stepIndex}].order must be a number`);
      }
    }
  }

  if (
    timeline.summary &&
    typeof timeline.summary.runCount === "number" &&
    timeline.runs.length !== timeline.summary.runCount
  ) {
    warnings.push("summary.runCount does not match runs length");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * @param {object} timeline
 * @returns {string}
 */
export function buildWorkflowTimelineMarkdown(timeline) {
  const normalized = normalizeWorkflowTimeline(timeline);

  const lines = [
    "# Developer Workflow Timeline",
    "",
    "Schema",
    "",
    normalized.schema,
    "",
    "Generated At",
    "",
    normalized.generatedAt,
    "",
    "## Summary",
    "",
    "| Field | Value |",
    "|------|------:|",
    `| Runs | ${normalized.summary.runCount} |`,
    `| Steps | ${normalized.summary.stepCount} |`,
    `| First Run | ${normalized.summary.firstRunAt ?? "none"} |`,
    `| Last Run | ${normalized.summary.lastRunAt ?? "none"} |`,
    "",
    "## Timeline",
    "",
  ];

  if (normalized.runs.length === 0) {
    lines.push("No timeline runs recorded.", "");
    return lines.join("\n");
  }

  for (const run of normalized.runs) {
    const duration =
      run.durationMs === null ? "unknown" : `${run.durationMs}ms`;

    lines.push(`### Run: ${run.runId}`, "");
    lines.push("| Field | Value |");
    lines.push("|------|------|");
    lines.push(`| Status | ${run.status} |`);
    lines.push(`| Started At | ${run.startedAt ?? "unknown"} |`);
    lines.push(`| Completed At | ${run.completedAt ?? "unknown"} |`);
    lines.push(`| Duration | ${duration} |`);
    lines.push(`| Resume | ${run.resume.isResume ? "yes" : "no"} |`);
    lines.push("");

    if (run.steps.length === 0) {
      lines.push("No steps recorded.", "");
      continue;
    }

    lines.push("| Order | Step | Status | Duration |");
    lines.push("|------:|------|--------|----------:|");
    for (const step of run.steps) {
      const stepDuration =
        step.durationMs === null ? "unknown" : `${step.durationMs}ms`;
      lines.push(
        `| ${step.order} | ${step.stepId} | ${step.status} | ${stepDuration} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * @param {object} timeline
 * @returns {string}
 */
export function buildWorkflowTimelineCliSummary(timeline) {
  const normalized = normalizeWorkflowTimeline(timeline);

  return [
    "Workflow timeline: generated",
    `Timeline runs: ${normalized.summary.runCount}`,
    `Timeline steps: ${normalized.summary.stepCount}`,
    "Timeline report:",
    `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_TIMELINE_MD_FILENAME}`,
  ].join("\n");
}

/**
 * @param {object} timeline
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writeWorkflowTimelineReport(timeline, rootDir = process.cwd()) {
  const normalized = normalizeWorkflowTimeline(timeline);
  const validation = validateWorkflowTimeline(normalized);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const reportDir = path.join(rootDir, "reports", "developer-workflow", "latest");
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, WORKFLOW_TIMELINE_JSON_FILENAME);
  const markdownPath = path.join(reportDir, WORKFLOW_TIMELINE_MD_FILENAME);

  const jsonPayload = {
    schema: normalized.schema,
    generatedAt: normalized.generatedAt,
    source: normalized.source,
    summary: normalized.summary,
    runs: normalized.runs,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(
    markdownPath,
    `${buildWorkflowTimelineMarkdown(normalized)}\n`,
  );

  return {
    json: `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_TIMELINE_JSON_FILENAME}`,
    markdown: `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_TIMELINE_MD_FILENAME}`,
  };
}

/**
 * @param {object} [params]
 * @param {string | null} [params.historyPath]
 * @param {string} [params.rootDir]
 * @param {string} [params.generatedAt]
 * @returns {{ timeline: object, outputs: { json: string, markdown: string } }}
 */
export function buildWorkflowTimelineFromHistory(params = {}) {
  const rootDir = params.rootDir ?? process.cwd();
  const historyPath =
    params.historyPath ??
    `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_HISTORY_JSON_FILENAME}`;
  const history = readWorkflowTimelineSource(historyPath, rootDir);
  const timeline = buildWorkflowTimeline(history, {
    generatedAt: params.generatedAt,
    historyPath,
  });
  const outputs = writeWorkflowTimelineReport(timeline, rootDir);

  return { timeline, outputs };
}
