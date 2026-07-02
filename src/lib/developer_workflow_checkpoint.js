import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { WORKFLOW_STEP_REGISTRY } from "./developer_workflow.js";

export const WORKFLOW_STATE_SCHEMA = "developer-automation/workflow-state/1.2";
export const WORKFLOW_STATE_SCHEMA_LEGACY = "developer-automation/workflow-state/1.0";
export const WORKFLOW_CHECKPOINT_SCHEMA = "developer-automation/workflow-checkpoint/1.0";
export const DEVELOPER_WORKFLOW_REPORT_DIR = "reports/developer-workflow/latest";
export const WORKFLOW_CHECKPOINT_JSON_FILENAME = "workflow-checkpoint.json";
export const WORKFLOW_CHECKPOINT_MD_FILENAME = "workflow-checkpoint.md";
export const SUPPORTED_WORKFLOW_STATE_SCHEMAS = [
  WORKFLOW_STATE_SCHEMA_LEGACY,
  WORKFLOW_STATE_SCHEMA,
];
export const SUPPORTED_WORKFLOW_SCHEMA_VERSIONS = ["1.0", "1.2"];

/**
 * @param {typeof WORKFLOW_STEP_REGISTRY} registry
 * @returns {string}
 */
export function computeStepRegistryHash(registry) {
  const stepIds = registry.map((step) => step.id).join(",");
  const digest = createHash("sha256").update(stepIds).digest("hex");
  return `sha256:${digest}`;
}

/**
 * @param {object | null | undefined} state
 * @returns {object}
 */
export function normalizeWorkflowState(state) {
  if (!state || typeof state !== "object") {
    return {};
  }

  const workflowSchemaVersion =
    state.workflowSchemaVersion ??
    (state.schema === WORKFLOW_STATE_SCHEMA
      ? "1.2"
      : state.schema === WORKFLOW_STATE_SCHEMA_LEGACY
        ? "1.0"
        : null);

  const stoppedBeforeStepId = state.stoppedBeforeStepId ?? null;
  const currentStepId = state.currentStepId ?? stoppedBeforeStepId;
  const status = state.status ?? state.workflowStatus ?? null;

  return {
    ...state,
    workflowSchemaVersion,
    stoppedBeforeStepId,
    currentStepId,
    status,
    resumeSupported:
      state.resumeSupported ??
      (status === "stopped" && Array.isArray(state.failedStepIds)
        ? state.failedStepIds.length === 0
        : status === "stopped"),
    resumeUnsupportedReason: state.resumeUnsupportedReason ?? null,
    completedStepIds: state.completedStepIds ?? [],
    skippedStepIds: state.skippedStepIds ?? [],
    failedStepIds: state.failedStepIds ?? [],
  };
}

/**
 * @param {object} params
 * @param {object} params.state
 * @param {typeof WORKFLOW_STEP_REGISTRY} [params.stepRegistry]
 * @param {string[]} [params.supportedWorkflowSchemaVersions]
 * @returns {{
 *   valid: boolean,
 *   resumeSupported: boolean,
 *   errors: string[],
 *   warnings: string[],
 *   currentStepId: string | null,
 *   stepRegistryHashMatched: boolean,
 *   workflowSchemaVersionSupported: boolean,
 * }}
 */
export function validateWorkflowCheckpoint(params) {
  const stepRegistry = params.stepRegistry ?? WORKFLOW_STEP_REGISTRY;
  const supportedWorkflowSchemaVersions =
    params.supportedWorkflowSchemaVersions ?? SUPPORTED_WORKFLOW_SCHEMA_VERSIONS;
  const normalized = normalizeWorkflowState(params.state);
  const registryIds = new Set(stepRegistry.map((step) => step.id));
  const expectedRegistryHash = computeStepRegistryHash(stepRegistry);

  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!params.state || typeof params.state !== "object") {
    return {
      valid: false,
      resumeSupported: false,
      errors: ["workflow state must be an object"],
      warnings: [],
      currentStepId: null,
      stepRegistryHashMatched: false,
      workflowSchemaVersionSupported: false,
    };
  }

  const schemaSupported = SUPPORTED_WORKFLOW_STATE_SCHEMAS.includes(
    normalized.schema,
  );
  const workflowSchemaVersionSupported =
    normalized.workflowSchemaVersion !== null &&
    supportedWorkflowSchemaVersions.includes(normalized.workflowSchemaVersion);

  if (!schemaSupported) {
    errors.push(`unsupported workflow-state schema: ${normalized.schema ?? "missing"}`);
  }

  if (!workflowSchemaVersionSupported) {
    if (normalized.workflowSchemaVersion === null) {
      warnings.push("workflowSchemaVersion missing; treated as legacy state");
    } else {
      errors.push(
        `unsupported workflowSchemaVersion: ${normalized.workflowSchemaVersion}`,
      );
    }
  }

  if (normalized.status !== "stopped") {
    errors.push('status must be "stopped"');
  }

  if (!normalized.currentStepId) {
    errors.push("currentStepId must be present");
  } else if (!registryIds.has(normalized.currentStepId)) {
    errors.push("currentStepId must exist in step registry");
  }

  if (!normalized.stoppedBeforeStepId) {
    errors.push("stoppedBeforeStepId must be present");
  } else if (!registryIds.has(normalized.stoppedBeforeStepId)) {
    errors.push("stoppedBeforeStepId must exist in step registry");
  }

  let stepRegistryHashMatched = true;
  if (!normalized.stepRegistryHash) {
    warnings.push("stepRegistryHash missing; legacy state accepted with warning");
    stepRegistryHashMatched = false;
  } else if (normalized.stepRegistryHash !== expectedRegistryHash) {
    errors.push("stepRegistryHash does not match current step registry");
    stepRegistryHashMatched = false;
  }

  if (normalized.resumeSupported === false) {
    errors.push(
      normalized.resumeUnsupportedReason
        ? `resume unsupported: ${normalized.resumeUnsupportedReason}`
        : "resume unsupported",
    );
  }

  const resumeSupported = errors.length === 0 && normalized.resumeSupported !== false;

  return {
    valid: errors.length === 0,
    resumeSupported,
    errors,
    warnings,
    currentStepId: normalized.currentStepId ?? null,
    stepRegistryHashMatched,
    workflowSchemaVersionSupported:
      workflowSchemaVersionSupported || normalized.workflowSchemaVersion === null,
  };
}

/**
 * @param {ReturnType<typeof validateWorkflowCheckpoint>} checkpointValidation
 * @param {object} state
 * @param {string} [generatedAt]
 * @returns {object}
 */
export function buildWorkflowCheckpointReport(
  checkpointValidation,
  state,
  generatedAt = new Date().toISOString(),
) {
  const normalized = normalizeWorkflowState(state);

  return {
    schema: WORKFLOW_CHECKPOINT_SCHEMA,
    valid: checkpointValidation.valid,
    resumeSupported: checkpointValidation.resumeSupported,
    currentStepId: checkpointValidation.currentStepId,
    stepRegistryHashMatched: checkpointValidation.stepRegistryHashMatched,
    workflowSchemaVersionSupported: checkpointValidation.workflowSchemaVersionSupported,
    workflowSchemaVersion: normalized.workflowSchemaVersion,
    stepRegistryHash: normalized.stepRegistryHash ?? null,
    resumeSupportedInState: normalized.resumeSupported ?? null,
    resumeUnsupportedReason: normalized.resumeUnsupportedReason ?? null,
    errors: checkpointValidation.errors,
    warnings: checkpointValidation.warnings,
    generatedAt,
  };
}

/**
 * @param {ReturnType<typeof buildWorkflowCheckpointReport>} report
 * @returns {string}
 */
export function buildWorkflowCheckpointMarkdown(report) {
  const lines = [
    "# Developer Workflow Checkpoint Report",
    "",
    "## Checkpoint",
    "",
    `- Schema: ${report.schema}`,
    `- Valid: ${report.valid}`,
    `- Resume Supported: ${report.resumeSupported}`,
    `- Generated at: ${report.generatedAt}`,
    "",
    "## State",
    "",
    `- Current Step: ${report.currentStepId ?? "none"}`,
    `- Workflow Schema Version: ${report.workflowSchemaVersion ?? "unknown"}`,
    `- Step Registry Hash Matched: ${report.stepRegistryHashMatched}`,
    `- Workflow Schema Version Supported: ${report.workflowSchemaVersionSupported}`,
    `- Resume Supported In State: ${report.resumeSupportedInState ?? "unknown"}`,
    `- Resume Unsupported Reason: ${report.resumeUnsupportedReason ?? "none"}`,
    `- Step Registry Hash: ${report.stepRegistryHash ?? "none"}`,
    "",
  ];

  if (report.warnings.length > 0) {
    lines.push("## Warnings", "");
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  if (report.errors.length > 0) {
    lines.push("## Errors", "");
    for (const error of report.errors) {
      lines.push(`- ${error}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * @param {ReturnType<typeof buildWorkflowCheckpointReport>} report
 * @returns {string}
 */
export function buildWorkflowCheckpointCliSummary(report) {
  return [
    "Workflow Checkpoint",
    "",
    "Valid",
    String(report.valid),
    "",
    "Resume Supported",
    String(report.resumeSupported),
    "",
    "Current Step",
    report.currentStepId ?? "none",
    "",
    "Step Registry Hash Matched",
    String(report.stepRegistryHashMatched),
    "",
    "Workflow Schema Version",
    report.workflowSchemaVersion ?? "unknown",
  ].join("\n");
}

/**
 * @param {ReturnType<typeof buildWorkflowCheckpointReport>} report
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writeWorkflowCheckpointReport(report, rootDir = process.cwd()) {
  const reportDir = path.join(rootDir, "reports", "developer-workflow", "latest");
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, WORKFLOW_CHECKPOINT_JSON_FILENAME);
  const markdownPath = path.join(reportDir, WORKFLOW_CHECKPOINT_MD_FILENAME);

  const jsonPayload = {
    schema: report.schema,
    valid: report.valid,
    resumeSupported: report.resumeSupported,
    currentStepId: report.currentStepId,
    stepRegistryHashMatched: report.stepRegistryHashMatched,
    workflowSchemaVersionSupported: report.workflowSchemaVersionSupported,
    workflowSchemaVersion: report.workflowSchemaVersion,
    stepRegistryHash: report.stepRegistryHash,
    resumeSupportedInState: report.resumeSupportedInState,
    resumeUnsupportedReason: report.resumeUnsupportedReason,
    errors: report.errors,
    warnings: report.warnings,
    generatedAt: report.generatedAt,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(
    markdownPath,
    `${buildWorkflowCheckpointMarkdown(report)}\n`,
  );

  return {
    json: `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_CHECKPOINT_JSON_FILENAME}`,
    markdown: `${DEVELOPER_WORKFLOW_REPORT_DIR}/${WORKFLOW_CHECKPOINT_MD_FILENAME}`,
  };
}
