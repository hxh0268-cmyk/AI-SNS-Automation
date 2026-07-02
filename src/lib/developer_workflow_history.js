import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  computeStepRegistryHash,
  DEVELOPER_WORKFLOW_REPORT_DIR,
} from "./developer_workflow_checkpoint.js";
import { WORKFLOW_STEP_REGISTRY } from "./developer_workflow.js";
import { STEP_STATUS } from "./workflow_step_status.js";
import { WORKFLOW_STATUS } from "./workflow_status.js";

export const WORKFLOW_HISTORY_SCHEMA = "developer-automation/workflow-history/1.0";
export const WORKFLOW_HISTORY_VERSION = "1.0";
export const WORKFLOW_HISTORY_JSON_FILENAME = "workflow-history.json";
export const WORKFLOW_HISTORY_MD_FILENAME = "workflow-history.md";

export const HISTORY_RUN_STATUS = {
  COMPLETED: "completed",
  FAILED: "failed",
  STOPPED: "stopped",
  UNKNOWN: "unknown",
};

export const HISTORY_STEP_STATUS = {
  COMPLETED: "completed",
  FAILED: "failed",
  SKIPPED: "skipped",
  STOPPED: "stopped",
  UNKNOWN: "unknown",
};

/**
 * @param {string} [generatedAt]
 * @returns {object}
 */
export function createEmptyWorkflowHistory(generatedAt = new Date().toISOString()) {
  return {
    schema: WORKFLOW_HISTORY_SCHEMA,
    generatedAt,
    historyVersion: WORKFLOW_HISTORY_VERSION,
    runs: [],
  };
}

/**
 * @param {string} rootDir
 * @param {string | null | undefined} historyPath
 * @returns {string}
 */
export function getWorkflowHistoryAbsolutePath(rootDir, historyPath) {
  if (historyPath) {
    return path.isAbsolute(historyPath)
      ? historyPath
      : path.join(rootDir, historyPath);
  }

  return path.join(
    rootDir,
    DEVELOPER_WORKFLOW_REPORT_DIR,
    WORKFLOW_HISTORY_JSON_FILENAME,
  );
}

/**
 * @param {string | null | undefined} historyPath
 * @param {string} [rootDir]
 * @returns {object}
 */
export function readWorkflowHistory(historyPath, rootDir = process.cwd()) {
  const absolutePath = getWorkflowHistoryAbsolutePath(rootDir, historyPath);

  if (!fs.existsSync(absolutePath)) {
    return createEmptyWorkflowHistory();
  }

  const raw = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(raw);
}

/**
 * @param {object | null | undefined} history
 * @returns {object}
 */
export function normalizeWorkflowHistory(history) {
  if (!history || typeof history !== "object") {
    return createEmptyWorkflowHistory();
  }

  const runs = Array.isArray(history.runs) ? history.runs : [];

  return {
    schema: history.schema ?? WORKFLOW_HISTORY_SCHEMA,
    generatedAt: history.generatedAt ?? new Date().toISOString(),
    historyVersion: history.historyVersion ?? WORKFLOW_HISTORY_VERSION,
    runs: runs.map((run) => normalizeWorkflowHistoryRun(run)),
  };
}

/**
 * @param {object | null | undefined} run
 * @returns {object}
 */
export function normalizeWorkflowHistoryRun(run) {
  if (!run || typeof run !== "object") {
    return {
      runId: randomUUID(),
      startedAt: null,
      completedAt: null,
      status: HISTORY_RUN_STATUS.UNKNOWN,
      workflowSchemaVersion: null,
      stepRegistryHash: null,
      currentStepId: null,
      resumeSupported: false,
      resumeUnsupportedReason: null,
      checkpointPath: null,
      statePath: null,
      steps: [],
    };
  }

  return {
    runId: run.runId ?? randomUUID(),
    startedAt: run.startedAt ?? null,
    completedAt: run.completedAt ?? null,
    status: run.status ?? HISTORY_RUN_STATUS.UNKNOWN,
    ...(typeof run.durationMs === "number" ? { durationMs: run.durationMs } : {}),
    workflowSchemaVersion: run.workflowSchemaVersion ?? null,
    stepRegistryHash: run.stepRegistryHash ?? null,
    currentStepId: run.currentStepId ?? null,
    resumeSupported: run.resumeSupported ?? false,
    resumeUnsupportedReason: run.resumeUnsupportedReason ?? null,
    checkpointPath: run.checkpointPath ?? null,
    statePath: run.statePath ?? null,
    steps: Array.isArray(run.steps)
      ? run.steps.map((step) => normalizeWorkflowHistoryStep(step))
      : [],
  };
}

/**
 * @param {object | null | undefined} step
 * @returns {object}
 */
export function normalizeWorkflowHistoryStep(step) {
  if (!step || typeof step !== "object") {
    return {
      stepId: "unknown",
      status: HISTORY_STEP_STATUS.UNKNOWN,
      startedAt: null,
      completedAt: null,
    };
  }

  return {
    stepId: step.stepId ?? "unknown",
    status: step.status ?? HISTORY_STEP_STATUS.UNKNOWN,
    startedAt: step.startedAt ?? null,
    completedAt: step.completedAt ?? null,
    ...(typeof step.durationMs === "number" ? { durationMs: step.durationMs } : {}),
  };
}

/**
 * @param {object | null | undefined} history
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateWorkflowHistory(history) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!history || typeof history !== "object") {
    return {
      valid: false,
      errors: ["workflow history must be an object"],
      warnings: [],
    };
  }

  if (history.schema !== WORKFLOW_HISTORY_SCHEMA) {
    errors.push(`schema must be ${WORKFLOW_HISTORY_SCHEMA}`);
  }

  if (history.historyVersion !== WORKFLOW_HISTORY_VERSION) {
    warnings.push(
      `historyVersion ${history.historyVersion ?? "missing"} treated as legacy`,
    );
  }

  if (!Array.isArray(history.runs)) {
    errors.push("runs must be an array");
    return { valid: false, errors, warnings };
  }

  for (const [index, run] of history.runs.entries()) {
    if (!run || typeof run !== "object") {
      errors.push(`runs[${index}] must be an object`);
      continue;
    }

    if (!run.runId) {
      errors.push(`runs[${index}].runId is required`);
    }

    if (!run.status) {
      errors.push(`runs[${index}].status is required`);
    }

    if (!Array.isArray(run.steps)) {
      errors.push(`runs[${index}].steps must be an array`);
      continue;
    }

    for (const [stepIndex, step] of run.steps.entries()) {
      if (!step?.stepId) {
        errors.push(`runs[${index}].steps[${stepIndex}].stepId is required`);
      }
      if (!step?.status) {
        errors.push(`runs[${index}].steps[${stepIndex}].status is required`);
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
 * @param {string} workflowStatus
 * @returns {string}
 */
export function mapWorkflowStatusToHistoryRunStatus(workflowStatus) {
  switch (workflowStatus) {
    case WORKFLOW_STATUS.SUCCESS:
      return HISTORY_RUN_STATUS.COMPLETED;
    case WORKFLOW_STATUS.FAILURE:
      return HISTORY_RUN_STATUS.FAILED;
    case WORKFLOW_STATUS.STOPPED:
      return HISTORY_RUN_STATUS.STOPPED;
    default:
      return HISTORY_RUN_STATUS.UNKNOWN;
  }
}

/**
 * @param {string} stepStatus
 * @returns {string}
 */
export function mapStepStatusToHistoryStepStatus(stepStatus) {
  switch (stepStatus) {
    case STEP_STATUS.PASS:
      return HISTORY_STEP_STATUS.COMPLETED;
    case STEP_STATUS.FAIL:
      return HISTORY_STEP_STATUS.FAILED;
    case STEP_STATUS.SKIPPED:
      return HISTORY_STEP_STATUS.SKIPPED;
    case STEP_STATUS.STOPPED:
      return HISTORY_STEP_STATUS.STOPPED;
    default:
      return HISTORY_STEP_STATUS.UNKNOWN;
  }
}

/**
 * @param {object} params
 * @param {ReturnType<typeof import("./developer_workflow.js").createWorkflowContext>} params.context
 * @param {object | null} [params.state]
 * @param {string | null} [params.checkpointPath]
 * @param {string | null} [params.statePath]
 * @param {string | null} [params.runId]
 * @param {typeof WORKFLOW_STEP_REGISTRY} [params.registry]
 * @returns {object}
 */
export function buildWorkflowHistoryRun(params) {
  const {
    context,
    state = null,
    checkpointPath = null,
    statePath = null,
    runId = randomUUID(),
    registry = WORKFLOW_STEP_REGISTRY,
  } = params;

  const timestamp = context.generatedAt ?? new Date().toISOString();

  return {
    runId,
    startedAt: timestamp,
    completedAt: timestamp,
    status: mapWorkflowStatusToHistoryRunStatus(context.status),
    workflowSchemaVersion: state?.workflowSchemaVersion ?? "1.2",
    stepRegistryHash: state?.stepRegistryHash ?? computeStepRegistryHash(registry),
    currentStepId: state?.currentStepId ?? state?.stoppedBeforeStepId ?? null,
    resumeSupported: state?.resumeSupported ?? context.status === WORKFLOW_STATUS.STOPPED,
    resumeUnsupportedReason: state?.resumeUnsupportedReason ?? null,
    checkpointPath,
    statePath,
    steps: context.results.map((result) => ({
      stepId: result.id,
      status: mapStepStatusToHistoryStepStatus(result.status),
      startedAt: timestamp,
      completedAt: timestamp,
    })),
  };
}

/**
 * @param {object} history
 * @param {object} run
 * @param {string} [generatedAt]
 * @returns {object}
 */
export function appendWorkflowHistoryRun(history, run, generatedAt = new Date().toISOString()) {
  const normalized = normalizeWorkflowHistory(history);

  return {
    ...normalized,
    generatedAt,
    runs: [...normalized.runs, normalizeWorkflowHistoryRun(run)],
  };
}

/**
 * @param {object} history
 * @returns {string}
 */
export function buildWorkflowHistoryMarkdown(history) {
  const normalized = normalizeWorkflowHistory(history);

  const lines = [
    "# Developer Workflow History Report",
    "",
    "## History",
    "",
    `- Schema: ${normalized.schema}`,
    `- History Version: ${normalized.historyVersion}`,
    `- Generated at: ${normalized.generatedAt}`,
    `- Run Count: ${normalized.runs.length}`,
    "",
  ];

  if (normalized.runs.length === 0) {
    lines.push("No workflow runs recorded.", "");
    return lines.join("\n");
  }

  lines.push("## Runs", "");

  for (const run of normalized.runs) {
    lines.push(`### Run ${run.runId}`, "");
    lines.push(`- Status: ${run.status}`);
    lines.push(`- Started at: ${run.startedAt ?? "unknown"}`);
    lines.push(`- Completed at: ${run.completedAt ?? "unknown"}`);
    lines.push(`- Current Step: ${run.currentStepId ?? "none"}`);
    lines.push(`- Workflow Schema Version: ${run.workflowSchemaVersion ?? "unknown"}`);
    lines.push(`- Resume Supported: ${run.resumeSupported}`);
    lines.push(`- Checkpoint Path: ${run.checkpointPath ?? "none"}`);
    lines.push(`- State Path: ${run.statePath ?? "none"}`);
    lines.push("");
    lines.push("#### Steps", "");

    if (run.steps.length === 0) {
      lines.push("- none", "");
      continue;
    }

    for (const step of run.steps) {
      lines.push(`- ${step.stepId}: ${step.status}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * @param {object} history
 * @returns {string}
 */
export function buildWorkflowHistoryCliSummary(history) {
  const normalized = normalizeWorkflowHistory(history);
  const latestRun = normalized.runs.at(-1);

  return [
    "Workflow History",
    "",
    "Run Count",
    String(normalized.runs.length),
    "",
    "Latest Run Status",
    latestRun?.status ?? "none",
    "",
    "Latest Run Step Count",
    latestRun ? String(latestRun.steps.length) : "0",
    "",
    "Latest Current Step",
    latestRun?.currentStepId ?? "none",
  ].join("\n");
}

/**
 * @param {object} history
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writeWorkflowHistoryReport(history, rootDir = process.cwd()) {
  const normalized = normalizeWorkflowHistory(history);
  const validation = validateWorkflowHistory(normalized);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const reportDir = path.join(rootDir, "reports", "developer-workflow", "latest");
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, WORKFLOW_HISTORY_JSON_FILENAME);
  const markdownPath = path.join(reportDir, WORKFLOW_HISTORY_MD_FILENAME);

  const jsonPayload = {
    schema: normalized.schema,
    generatedAt: normalized.generatedAt,
    historyVersion: normalized.historyVersion,
    runs: normalized.runs,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(
    markdownPath,
    `${buildWorkflowHistoryMarkdown(normalized)}\n`,
  );

  return {
    json: `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_HISTORY_JSON_FILENAME}`,
    markdown: `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_HISTORY_MD_FILENAME}`,
  };
}

/**
 * @param {object} params
 * @param {ReturnType<typeof import("./developer_workflow.js").createWorkflowContext>} params.context
 * @param {object | null} [params.state]
 * @param {string | null} [params.checkpointPath]
 * @param {string | null} [params.statePath]
 * @param {string | null} [params.historyPath]
 * @param {string} [params.rootDir]
 * @param {typeof WORKFLOW_STEP_REGISTRY} [params.registry]
 * @returns {{ history: object, outputs: { json: string, markdown: string } }}
 */
export function recordWorkflowHistoryRun(params) {
  const rootDir = params.rootDir ?? process.cwd();
  const existing = readWorkflowHistory(params.historyPath, rootDir);
  const run = buildWorkflowHistoryRun({
    context: params.context,
    state: params.state,
    checkpointPath: params.checkpointPath,
    statePath: params.statePath,
    registry: params.registry,
  });
  const history = appendWorkflowHistoryRun(existing, run);
  const outputs = writeWorkflowHistoryReport(history, rootDir);

  return { history, outputs };
}
