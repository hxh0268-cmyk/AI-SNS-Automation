import fs from "node:fs";
import path from "node:path";
import { detectCurrentVersion } from "./developer_automation.js";
import {
  computeStepRegistryHash,
  normalizeWorkflowState,
  validateWorkflowCheckpoint,
  WORKFLOW_STATE_SCHEMA,
  WORKFLOW_STATE_SCHEMA_LEGACY,
} from "./developer_workflow_checkpoint.js";
import {
  createWorkflowContext,
  executeWorkflowSteps,
  finalizeWorkflowContext,
  WORKFLOW_STEP_REGISTRY,
} from "./developer_workflow.js";
import { GUARD_REASON } from "./workflow_guard_reason.js";
import { STEP_STATUS } from "./workflow_step_status.js";
import { WORKFLOW_STOP_REASON } from "./workflow_stop_reason.js";

export {
  computeStepRegistryHash,
  normalizeWorkflowState,
  validateWorkflowCheckpoint,
  WORKFLOW_STATE_SCHEMA,
  WORKFLOW_STATE_SCHEMA_LEGACY,
} from "./developer_workflow_checkpoint.js";

export const WORKFLOW_RESUME_SCHEMA = "developer-automation/workflow-resume/1.0";
export const DEVELOPER_WORKFLOW_REPORT_DIR = "reports/developer-workflow/latest";
export const WORKFLOW_STATE_FILENAME = "workflow-state.json";
export const WORKFLOW_RESUME_JSON_FILENAME = "workflow-resume.json";
export const WORKFLOW_RESUME_MD_FILENAME = "workflow-resume.md";

/** @deprecated Use WORKFLOW_STATE_SCHEMA from developer_workflow_checkpoint.js */
export const WORKFLOW_STATE_SCHEMA_V1_0 = WORKFLOW_STATE_SCHEMA_LEGACY;

/**
 * @param {string | null | undefined} version
 * @returns {string}
 */
export function normalizeWorkflowVersion(version) {
  if (!version || version === "unknown") {
    return "unknown";
  }

  return version.startsWith("v") ? version.slice(1) : version;
}

/**
 * @param {string} [rootDir]
 * @returns {{ currentVersion: string, nextVersion: string }}
 */
export function getWorkflowVersionContext(rootDir = process.cwd()) {
  const detected = detectCurrentVersion(rootDir);

  return {
    currentVersion: normalizeWorkflowVersion(detected.version),
    nextVersion: normalizeWorkflowVersion(detected.nextMinor),
  };
}

/**
 * @param {string} stopReason
 * @returns {string}
 */
export function mapStopReasonToState(stopReason) {
  switch (stopReason) {
    case WORKFLOW_STOP_REASON.STOP_BEFORE_STEP:
      return "stop-before-step";
    case WORKFLOW_STOP_REASON.FAIL_FAST:
      return "fail-fast";
    default:
      return "none";
  }
}

/**
 * @param {ReturnType<typeof createWorkflowContext>} context
 * @param {object} [params]
 * @param {string} [params.createdAt]
 * @param {string} [params.command]
 * @param {typeof WORKFLOW_STEP_REGISTRY} [params.registry]
 * @returns {object}
 */
export function buildWorkflowState(context, params = {}, registry = WORKFLOW_STEP_REGISTRY) {
  const versionContext = getWorkflowVersionContext(context.rootDir);
  const completedStepIds = context.results
    .filter((result) => result.status === STEP_STATUS.PASS)
    .map((result) => result.id);
  const skippedStepIds = context.results
    .filter((result) => result.status === STEP_STATUS.SKIPPED)
    .map((result) => result.id);
  const failedStepIds = context.results
    .filter((result) => result.status === STEP_STATUS.FAIL)
    .map((result) => result.id);
  const stoppedStep = context.results.find(
    (result) => result.status === STEP_STATUS.STOPPED,
  );
  const stoppedBeforeStepId = stoppedStep?.id ?? null;
  const createdAt = params.createdAt ?? context.generatedAt;

  return {
    schema: WORKFLOW_STATE_SCHEMA,
    workflowSchemaVersion: "1.2",
    status: "stopped",
    currentStepId: stoppedBeforeStepId,
    completedStepIds,
    skippedStepIds,
    stoppedBeforeStepId,
    resumeSupported: failedStepIds.length === 0 && stoppedBeforeStepId !== null,
    resumeUnsupportedReason: null,
    stepRegistryHash: computeStepRegistryHash(registry),
    createdAt,
    updatedAt: createdAt,
    workflowStatus: "stopped",
    stopReason: mapStopReasonToState(context.stopReason),
    currentVersion: versionContext.currentVersion,
    nextVersion: versionContext.nextVersion,
    failedStepIds,
    source: {
      command: params.command ?? "developer:workflow",
      mode: context.options.dryRun ? "dry-run" : "execute",
    },
  };
}

/**
 * @param {string} rootDir
 * @param {string | null | undefined} statePath
 * @returns {string}
 */
export function getWorkflowStateAbsolutePath(rootDir, statePath) {
  if (statePath) {
    return path.isAbsolute(statePath)
      ? statePath
      : path.join(rootDir, statePath);
  }

  return path.join(rootDir, DEVELOPER_WORKFLOW_REPORT_DIR, WORKFLOW_STATE_FILENAME);
}

/**
 * @param {string | null | undefined} statePath
 * @param {string} [rootDir]
 * @returns {object}
 */
export function readWorkflowState(statePath, rootDir = process.cwd()) {
  const absolutePath = getWorkflowStateAbsolutePath(rootDir, statePath);
  const raw = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(raw);
}

/**
 * @param {object} state
 * @param {string} [rootDir]
 * @returns {string}
 */
export function writeWorkflowState(state, rootDir = process.cwd()) {
  const reportDir = path.join(rootDir, "reports", "developer-workflow", "latest");
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, WORKFLOW_STATE_FILENAME);
  fs.writeFileSync(jsonPath, `${JSON.stringify(state, null, 2)}\n`);

  return `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_STATE_FILENAME}`;
}

/**
 * @param {object} state
 * @param {{ currentVersion: string, nextVersion: string }} versionContext
 * @param {typeof WORKFLOW_STEP_REGISTRY} [registry]
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateResumeState(state, versionContext, registry = WORKFLOW_STEP_REGISTRY) {
  /** @type {string[]} */
  const errors = [];
  const normalized = normalizeWorkflowState(state);
  const registryIds = new Set(registry.map((step) => step.id));

  if (!state || typeof state !== "object") {
    return { valid: false, errors: ["workflow state must be an object"] };
  }

  if (
    normalized.schema !== WORKFLOW_STATE_SCHEMA &&
    normalized.schema !== WORKFLOW_STATE_SCHEMA_LEGACY
  ) {
    errors.push(
      `schema must be ${WORKFLOW_STATE_SCHEMA_LEGACY} or ${WORKFLOW_STATE_SCHEMA}`,
    );
  }

  if (normalized.status !== "stopped") {
    errors.push('status must be "stopped"');
  }

  if (normalized.nextVersion !== versionContext.nextVersion) {
    errors.push(
      `nextVersion mismatch: state=${normalized.nextVersion}, expected=${versionContext.nextVersion}`,
    );
  }

  const stoppedBeforeStepId = normalized.stoppedBeforeStepId;
  if (!stoppedBeforeStepId || !registryIds.has(stoppedBeforeStepId)) {
    errors.push("stoppedBeforeStepId must exist in step registry");
  }

  const completedStepIds = normalized.completedStepIds;
  if (!Array.isArray(completedStepIds)) {
    errors.push("completedStepIds must be an array");
  } else {
    for (const stepId of completedStepIds) {
      if (!registryIds.has(stepId)) {
        errors.push(`unknown completed step id: ${stepId}`);
      }
    }

    if (stoppedBeforeStepId) {
      const stoppedIndex = registry.findIndex(
        (step) => step.id === stoppedBeforeStepId,
      );

      for (const stepId of completedStepIds) {
        if (stepId === stoppedBeforeStepId) {
          errors.push("completedStepIds must not include stoppedBeforeStepId");
        }

        const stepIndex = registry.findIndex((step) => step.id === stepId);
        if (stepIndex >= stoppedIndex) {
          errors.push(`completedStepIds contradict registry order: ${stepId}`);
        }
      }
    }
  }

  const failedStepIds = normalized.failedStepIds;
  if (!Array.isArray(failedStepIds) || failedStepIds.length > 0) {
    errors.push("failedStepIds must be empty");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * @param {object} state
 * @param {{ currentVersion: string, nextVersion: string }} versionContext
 * @param {typeof WORKFLOW_STEP_REGISTRY} [registry]
 * @returns {{
 *   valid: boolean,
 *   errors: string[],
 *   warnings: string[],
 *   checkpoint: ReturnType<typeof validateWorkflowCheckpoint>,
 *   resume: { valid: boolean, errors: string[] },
 * }}
 */
export function validateWorkflowResumeState(state, versionContext, registry = WORKFLOW_STEP_REGISTRY) {
  const normalized = normalizeWorkflowState(state);
  const checkpoint = validateWorkflowCheckpoint({
    state: normalized,
    stepRegistry: registry,
  });
  const resume = validateResumeState(normalized, versionContext, registry);

  return {
    valid: checkpoint.valid && resume.valid,
    errors: [...checkpoint.errors, ...resume.errors],
    warnings: checkpoint.warnings,
    checkpoint,
    resume,
  };
}

/**
 * @param {object} state
 * @param {typeof WORKFLOW_STEP_REGISTRY} [registry]
 * @returns {{
 *   resumeFromStepId: string,
 *   startIndex: number,
 *   completedStepIds: string[],
 *   skippedStepIds: string[],
 * }}
 */
export function resolveResumeCursor(state, registry = WORKFLOW_STEP_REGISTRY) {
  const normalized = normalizeWorkflowState(state);
  const resumeFromStepId =
    normalized.currentStepId ?? normalized.stoppedBeforeStepId;
  const startIndex = registry.findIndex((step) => step.id === resumeFromStepId);

  return {
    resumeFromStepId,
    startIndex,
    completedStepIds: [...normalized.completedStepIds],
    skippedStepIds: [...normalized.skippedStepIds],
  };
}

/**
 * @param {object} state
 * @param {typeof WORKFLOW_STEP_REGISTRY} registry
 * @returns {ReturnType<typeof createWorkflowContext>["results"]}
 */
export function buildPriorResultsFromState(state, registry) {
  const normalized = normalizeWorkflowState(state);
  /** @type {ReturnType<typeof createWorkflowContext>["results"]} */
  const results = [];

  for (const stepId of normalized.completedStepIds) {
    const step = registry.find((entry) => entry.id === stepId);
    if (!step) {
      continue;
    }

    results.push({
      id: step.id,
      name: step.name,
      status: STEP_STATUS.PASS,
      guard: { shouldExecute: true, reason: GUARD_REASON.NONE },
      detail: { resumed: true },
    });
  }

  for (const stepId of normalized.skippedStepIds) {
    const step = registry.find((entry) => entry.id === stepId);
    if (!step) {
      continue;
    }

    results.push({
      id: step.id,
      name: step.name,
      status: STEP_STATUS.SKIPPED,
      guard: { shouldExecute: false, reason: GUARD_REASON.SKIP_STEP },
      detail: { resumed: true },
    });
  }

  return results;
}

/**
 * @param {object} [params]
 * @param {string} [params.rootDir]
 * @param {string | null} [params.resumeStatePath]
 * @param {boolean} [params.skipNpmTest]
 * @param {Partial<import("./workflow_options.js").DEFAULT_WORKFLOW_OPTIONS>} [params.options]
 * @param {string} [params.generatedAt]
 * @param {typeof WORKFLOW_STEP_REGISTRY} [params.registry]
 * @returns {{
 *   validation: ReturnType<typeof validateWorkflowResumeState>,
 *   state: object | null,
 *   versionContext: { currentVersion: string, nextVersion: string },
 *   context: ReturnType<typeof createWorkflowContext> | null,
 *   cursor: ReturnType<typeof resolveResumeCursor> | null,
 * }}
 */
export function prepareResumeWorkflow(params = {}, registry = WORKFLOW_STEP_REGISTRY) {
  const rootDir = params.rootDir ?? process.cwd();
  const state = readWorkflowState(params.resumeStatePath, rootDir);
  const versionContext = getWorkflowVersionContext(rootDir);
  const validation = validateWorkflowResumeState(state, versionContext, registry);

  if (!validation.valid) {
    return {
      validation,
      state,
      versionContext,
      context: null,
      cursor: null,
    };
  }

  const normalized = normalizeWorkflowState(state);
  const cursor = resolveResumeCursor(normalized, registry);
  const context = createWorkflowContext({
    rootDir,
    skipNpmTest: params.skipNpmTest,
    generatedAt: params.generatedAt,
    options: {
      ...params.options,
      stopBeforeStep: null,
    },
  });

  return {
    validation,
    state: normalized,
    versionContext,
    context: {
      ...context,
      results: buildPriorResultsFromState(normalized, registry),
    },
    cursor,
  };
}

/**
 * @param {object} [params]
 * @param {typeof WORKFLOW_STEP_REGISTRY} [registry]
 * @returns {{
 *   context: ReturnType<typeof finalizeWorkflowContext>,
 *   resumeFromStepId: string,
 *   validation: ReturnType<typeof validateWorkflowResumeState>,
 *   state: object,
 * }}
 */
export function runDeveloperWorkflowResume(params = {}, registry = WORKFLOW_STEP_REGISTRY) {
  const prepared = prepareResumeWorkflow(params, registry);

  if (!prepared.validation.valid || !prepared.context || !prepared.cursor || !prepared.state) {
    throw new Error(prepared.validation.errors.join("; "));
  }

  const executed = executeWorkflowSteps(prepared.context, registry, {
    completedStepIds: prepared.cursor.completedStepIds,
    skippedStepIds: prepared.cursor.skippedStepIds,
  });

  return {
    context: finalizeWorkflowContext(executed),
    resumeFromStepId: prepared.cursor.resumeFromStepId,
    validation: prepared.validation,
    state: prepared.state,
  };
}

/**
 * @param {object} params
 * @param {string} [params.status]
 * @param {string | null} [params.resumeFromStepId]
 * @param {string[]} [params.completedStepIds]
 * @param {string[]} [params.validationErrors]
 * @param {string[]} [params.validationWarnings]
 * @param {string | null} [params.workflowStatus]
 * @param {string} [params.generatedAt]
 * @returns {object}
 */
export function buildWorkflowResumeReport(params) {
  return {
    schema: WORKFLOW_RESUME_SCHEMA,
    status: params.status ?? "resumed",
    resumeFromStepId: params.resumeFromStepId ?? null,
    completedStepIds: params.completedStepIds ?? [],
    validationErrors: params.validationErrors ?? [],
    validationWarnings: params.validationWarnings ?? [],
    workflowStatus: params.workflowStatus ?? null,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
  };
}

/**
 * @param {ReturnType<typeof buildWorkflowResumeReport>} report
 * @returns {string}
 */
export function buildWorkflowResumeMarkdown(report) {
  const lines = [
    "# Developer Workflow Resume Report",
    "",
    "## Resume",
    "",
    `- Schema: ${report.schema}`,
    `- Status: ${report.status}`,
    `- Generated at: ${report.generatedAt}`,
    "",
    "## Resume Context",
    "",
    `- Resume From Step: ${report.resumeFromStepId ?? "none"}`,
    `- Completed Steps: ${
      report.completedStepIds.length > 0
        ? report.completedStepIds.join(", ")
        : "none"
    }`,
    `- Workflow Status: ${report.workflowStatus ?? "unknown"}`,
    "",
  ];

  if (report.validationWarnings.length > 0) {
    lines.push("## Validation Warnings", "");
    for (const warning of report.validationWarnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  if (report.validationErrors.length > 0) {
    lines.push("## Validation Errors", "");
    for (const error of report.validationErrors) {
      lines.push(`- ${error}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * @param {ReturnType<typeof buildWorkflowResumeReport>} report
 * @returns {string}
 */
export function buildWorkflowResumeCliSummary(report) {
  return [
    "Workflow Resume",
    "",
    "Status",
    report.status,
    "",
    "Resume From",
    report.resumeFromStepId ?? "none",
    "",
    "Completed Steps",
    report.completedStepIds.length > 0
      ? report.completedStepIds.join(", ")
      : "none",
    "",
    "Workflow Status",
    report.workflowStatus ?? "unknown",
  ].join("\n");
}

/**
 * @param {ReturnType<typeof buildWorkflowResumeReport>} report
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writeWorkflowResumeReport(report, rootDir = process.cwd()) {
  const reportDir = path.join(rootDir, "reports", "developer-workflow", "latest");
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, WORKFLOW_RESUME_JSON_FILENAME);
  const markdownPath = path.join(reportDir, WORKFLOW_RESUME_MD_FILENAME);

  const jsonPayload = {
    schema: report.schema,
    status: report.status,
    resumeFromStepId: report.resumeFromStepId,
    completedStepIds: report.completedStepIds,
    validationErrors: report.validationErrors,
    validationWarnings: report.validationWarnings,
    workflowStatus: report.workflowStatus,
    generatedAt: report.generatedAt,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(
    markdownPath,
    `${buildWorkflowResumeMarkdown(report)}\n`,
  );

  return {
    json: `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_RESUME_JSON_FILENAME}`,
    markdown: `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_RESUME_MD_FILENAME}`,
  };
}
