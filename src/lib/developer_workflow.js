import fs from "node:fs";
import path from "node:path";
import {
  DEVELOPER_AUTOMATION_REPORT_DIR,
  buildVersionConsistencyReport,
  writeVersionConsistencyReport,
} from "./developer_automation.js";
import {
  evaluateReleaseReadiness,
  writeReleaseReadinessReport,
} from "./release_readiness.js";
import { buildReleasePlan, writeReleasePlanReport } from "./release_plan.js";
import {
  DEFAULT_WORKFLOW_OPTIONS,
  normalizeWorkflowOptions,
} from "./workflow_options.js";
import {
  evaluateGuard,
  guardDecisionToStepStatus,
  shouldExecuteStep,
  shouldSkipStep,
  shouldStopBeforeStep,
} from "./workflow_guard.js";
import { GUARD_REASON } from "./workflow_guard_reason.js";
import { STEP_STATUS } from "./workflow_step_status.js";
import { WORKFLOW_STATUS } from "./workflow_status.js";
import { WORKFLOW_STOP_REASON } from "./workflow_stop_reason.js";

export const DEVELOPER_AUTOMATION_WORKFLOW_SCHEMA =
  "developer-automation/workflow/1.1";

export { DEFAULT_WORKFLOW_OPTIONS, normalizeWorkflowOptions } from "./workflow_options.js";
export {
  evaluateGuard,
  shouldExecuteStep,
  shouldSkipStep,
  shouldStopBeforeStep,
} from "./workflow_guard.js";
export { GUARD_REASON } from "./workflow_guard_reason.js";
export { WORKFLOW_STOP_REASON } from "./workflow_stop_reason.js";
export { STEP_STATUS } from "./workflow_step_status.js";
export { WORKFLOW_STATUS } from "./workflow_status.js";

/**
 * @param {{
 *   id: string,
 *   name: string,
 *   status: string,
 *   guard?: { shouldExecute: boolean, reason: string },
 *   detail?: unknown,
 * }} params
 * @returns {{
 *   id: string,
 *   name: string,
 *   status: string,
 *   guard: { shouldExecute: boolean, reason: string },
 *   detail: unknown,
 * }}
 */
export function buildStepResult(params) {
  return {
    id: params.id,
    name: params.name,
    status: params.status,
    guard: params.guard ?? {
      shouldExecute: true,
      reason: GUARD_REASON.NONE,
    },
    detail: params.detail ?? null,
  };
}

/**
 * @param {object} [params]
 * @param {string} [params.rootDir]
 * @param {boolean} [params.skipNpmTest]
 * @param {Partial<typeof DEFAULT_WORKFLOW_OPTIONS>} [params.options]
 * @param {string} [params.generatedAt]
 * @returns {{
 *   schema: string,
 *   rootDir: string,
 *   skipNpmTest: boolean,
 *   options: typeof DEFAULT_WORKFLOW_OPTIONS,
 *   results: ReturnType<typeof buildStepResult>[],
 *   status: string,
 *   stopReason: string,
 *   generatedAt: string,
 * }}
 */
export function createWorkflowContext(params = {}) {
  return {
    schema: DEVELOPER_AUTOMATION_WORKFLOW_SCHEMA,
    rootDir: params.rootDir ?? process.cwd(),
    skipNpmTest: params.skipNpmTest ?? false,
    options: normalizeWorkflowOptions(params.options),
    results: [],
    status: WORKFLOW_STATUS.SUCCESS,
    stopReason: WORKFLOW_STOP_REASON.NONE,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
  };
}

/**
 * @param {ReturnType<typeof createWorkflowContext>} context
 * @param {ReturnType<typeof buildStepResult>} stepResult
 * @returns {ReturnType<typeof createWorkflowContext>}
 */
export function appendStepResult(context, stepResult) {
  return {
    ...context,
    results: [...context.results, stepResult],
  };
}

/**
 * @param {ReturnType<typeof createWorkflowContext>} context
 * @returns {string}
 */
export function computeWorkflowStatus(context) {
  const { results, stopReason } = context;

  if (
    stopReason === WORKFLOW_STOP_REASON.STOP_BEFORE_STEP ||
    results.some((result) => result.status === STEP_STATUS.STOPPED)
  ) {
    return WORKFLOW_STATUS.STOPPED;
  }

  if (
    stopReason === WORKFLOW_STOP_REASON.FAIL_FAST ||
    results.some((result) => result.status === STEP_STATUS.FAIL)
  ) {
    return WORKFLOW_STATUS.FAILURE;
  }

  return WORKFLOW_STATUS.SUCCESS;
}

/**
 * @param {ReturnType<typeof createWorkflowContext>} context
 * @returns {ReturnType<typeof createWorkflowContext>}
 */
export function finalizeWorkflowContext(context) {
  return {
    ...context,
    status: computeWorkflowStatus(context),
  };
}

/**
 * @param {ReturnType<typeof createWorkflowContext>} context
 * @returns {ReturnType<typeof createWorkflowContext>}
 */
export function stepVersionConsistency(context) {
  const report = buildVersionConsistencyReport({ rootDir: context.rootDir });
  writeVersionConsistencyReport(report, context.rootDir);

  return appendStepResult(
    context,
    buildStepResult({
      id: "version-consistency",
      name: "Version Consistency",
      status: report.status === "ok" ? STEP_STATUS.PASS : STEP_STATUS.FAIL,
      guard: {
        shouldExecute: true,
        reason: GUARD_REASON.NONE,
      },
      detail: {
        reportStatus: report.status,
        gitTag: report.gitTag,
        versionMd: report.versionMd,
        changelog: report.changelog,
      },
    }),
  );
}

/**
 * @param {ReturnType<typeof createWorkflowContext>} context
 * @returns {ReturnType<typeof createWorkflowContext>}
 */
export function stepReleaseReadiness(context) {
  const report = evaluateReleaseReadiness({
    rootDir: context.rootDir,
    skipNpmTest: context.skipNpmTest,
  });
  writeReleaseReadinessReport(report, context.rootDir);

  return appendStepResult(
    context,
    buildStepResult({
      id: "release-readiness",
      name: "Release Readiness",
      status: report.status === "ready" ? STEP_STATUS.PASS : STEP_STATUS.FAIL,
      guard: {
        shouldExecute: true,
        reason: GUARD_REASON.NONE,
      },
      detail: {
        readinessStatus: report.status,
        checks: report.checks,
      },
    }),
  );
}

/**
 * @param {ReturnType<typeof createWorkflowContext>} context
 * @returns {ReturnType<typeof createWorkflowContext>}
 */
export function stepReleasePlan(context) {
  const plan = buildReleasePlan({ rootDir: context.rootDir });
  writeReleasePlanReport(plan, context.rootDir);

  return appendStepResult(
    context,
    buildStepResult({
      id: "release-plan",
      name: "Release Plan",
      status: plan.status === "ready" ? STEP_STATUS.PASS : STEP_STATUS.FAIL,
      guard: {
        shouldExecute: true,
        reason: GUARD_REASON.NONE,
      },
      detail: {
        planStatus: plan.status,
        stepCount: plan.steps.length,
      },
    }),
  );
}

export const WORKFLOW_STEP_REGISTRY = [
  {
    id: "version-consistency",
    name: "Version Consistency",
    run: stepVersionConsistency,
  },
  {
    id: "release-readiness",
    name: "Release Readiness",
    run: stepReleaseReadiness,
  },
  {
    id: "release-plan",
    name: "Release Plan",
    run: stepReleasePlan,
  },
];

/**
 * @param {ReturnType<typeof createWorkflowContext>} context
 * @param {typeof WORKFLOW_STEP_REGISTRY} registry
 * @returns {ReturnType<typeof createWorkflowContext>}
 */
export function executeWorkflowSteps(
  context,
  registry = WORKFLOW_STEP_REGISTRY,
  executionOptions = {},
) {
  const knownStepIds = registry.map((step) => step.id);
  const completedStepIds = new Set(executionOptions.completedStepIds ?? []);
  const skippedStepIds = new Set(executionOptions.skippedStepIds ?? []);
  let currentContext = { ...context };

  for (const step of registry) {
    if (completedStepIds.has(step.id) || skippedStepIds.has(step.id)) {
      continue;
    }

    if (currentContext.stopReason !== WORKFLOW_STOP_REASON.NONE) {
      break;
    }

    const guard = evaluateGuard(currentContext, step, knownStepIds);

    if (!guard.shouldExecute) {
      currentContext = appendStepResult(
        currentContext,
        buildStepResult({
          id: step.id,
          name: step.name,
          status: guardDecisionToStepStatus(guard),
          guard,
        }),
      );

      if (guard.reason === GUARD_REASON.STOP_BEFORE_STEP) {
        currentContext = {
          ...currentContext,
          stopReason: WORKFLOW_STOP_REASON.STOP_BEFORE_STEP,
        };
      }

      continue;
    }

    currentContext = step.run(currentContext);
    const lastResult = currentContext.results.at(-1);

    if (
      lastResult?.status === STEP_STATUS.FAIL &&
      currentContext.options.failFast
    ) {
      currentContext = {
        ...currentContext,
        stopReason: WORKFLOW_STOP_REASON.FAIL_FAST,
      };
      break;
    }
  }

  return currentContext;
}

/**
 * @param {object} [params]
 * @param {string} [params.rootDir]
 * @param {boolean} [params.skipNpmTest]
 * @param {Partial<typeof DEFAULT_WORKFLOW_OPTIONS>} [params.options]
 * @param {string} [params.generatedAt]
 * @param {typeof WORKFLOW_STEP_REGISTRY} [params.registry]
 * @returns {ReturnType<typeof createWorkflowContext>}
 */
export function runDeveloperWorkflow(params = {}) {
  const context = createWorkflowContext(params);
  const executed = executeWorkflowSteps(context, params.registry);
  return finalizeWorkflowContext(executed);
}

/**
 * @param {ReturnType<typeof buildStepResult>[]} results
 * @returns {{ executed: number, skipped: number, stopped: number }}
 */
export function buildGuardSummary(results) {
  return {
    executed: results.filter((result) => result.guard.shouldExecute === true).length,
    skipped: results.filter((result) => result.status === STEP_STATUS.SKIPPED).length,
    stopped: results.filter((result) => result.status === STEP_STATUS.STOPPED).length,
  };
}

/**
 * @param {ReturnType<typeof runDeveloperWorkflow>} context
 * @returns {{
 *   schema: string,
 *   status: string,
 *   options: {
 *     dryRun: boolean,
 *     failFast: boolean,
 *     stopBeforeStep: string | null,
 *     skipSteps: string[],
 *   },
 *   stopReason: string,
 *   guardHooks: unknown[],
 *   guardSummary: { executed: number, skipped: number, stopped: number },
 *   results: ReturnType<typeof buildStepResult>[],
 *   generatedAt: string,
 * }}
 */
export function buildDeveloperAutomationReport(context) {
  return {
    schema: context.schema,
    status: context.status,
    options: {
      dryRun: context.options.dryRun,
      failFast: context.options.failFast,
      stopBeforeStep: context.options.stopBeforeStep,
      skipSteps: context.options.skipSteps,
    },
    stopReason: context.stopReason,
    guardHooks: context.options.guardHooks,
    guardSummary: buildGuardSummary(context.results),
    results: context.results,
    generatedAt: context.generatedAt,
  };
}

/**
 * @param {boolean} value
 * @returns {string}
 */
function formatBooleanOption(value) {
  return value ? "YES" : "NO";
}

/**
 * @param {string[]} skipSteps
 * @returns {string}
 */
function formatSkipStepsOption(skipSteps) {
  return skipSteps.length > 0 ? skipSteps.join(", ") : "none";
}

/**
 * @param {string | null} stopBeforeStep
 * @returns {string}
 */
function formatStopBeforeOption(stopBeforeStep) {
  return stopBeforeStep ?? "none";
}

/**
 * @param {ReturnType<typeof runDeveloperWorkflow>} context
 * @returns {string}
 */
export function buildDeveloperAutomationReportMarkdown(context) {
  const report = buildDeveloperAutomationReport(context);

  const lines = [
    "# Developer Automation Report",
    "",
    "## Workflow",
    "",
    `- Schema: ${report.schema}`,
    `- Generated at: ${report.generatedAt}`,
    "",
    "## Workflow Options",
    "",
    `- Dry Run: ${formatBooleanOption(report.options.dryRun)}`,
    `- Fail Fast: ${formatBooleanOption(report.options.failFast)}`,
    `- Stop Before: ${formatStopBeforeOption(report.options.stopBeforeStep)}`,
    `- Skip Steps: ${formatSkipStepsOption(report.options.skipSteps)}`,
    "",
    "## Workflow Status",
    "",
    report.status,
    "",
    `- Stop Reason: ${report.stopReason}`,
    "",
    "## Guard Summary",
    "",
    `- Executed: ${report.guardSummary.executed}`,
    `- Skipped: ${report.guardSummary.skipped}`,
    `- Stopped: ${report.guardSummary.stopped}`,
    "",
    "## Step Results",
    "",
  ];

  for (const result of report.results) {
    lines.push(`### ${result.name}`, "");
    lines.push(`- Status: ${result.status}`);
    lines.push(`- Guard Should Execute: ${result.guard.shouldExecute ? "YES" : "NO"}`);
    lines.push(`- Guard Reason: ${result.guard.reason}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * @param {ReturnType<typeof runDeveloperWorkflow>} context
 * @returns {string}
 */
export function buildDeveloperAutomationWorkflowCliSummary(context) {
  const report = buildDeveloperAutomationReport(context);

  const lines = [
    "Developer Automation Workflow",
    "",
    "Options",
    "",
    "Dry Run",
    formatBooleanOption(report.options.dryRun),
    "",
    "Fail Fast",
    formatBooleanOption(report.options.failFast),
    "",
    "Stop Before",
    formatStopBeforeOption(report.options.stopBeforeStep),
    "",
    "Skip Steps",
    formatSkipStepsOption(report.options.skipSteps),
    "",
    "Workflow Status",
    report.status,
    "",
    "Guard Summary",
    "",
    "Executed",
    String(report.guardSummary.executed),
    "",
    "Skipped",
    String(report.guardSummary.skipped),
    "",
    "Stopped",
    String(report.guardSummary.stopped),
    "",
    "Step Results",
    "",
  ];

  for (const result of report.results) {
    lines.push(result.name);
    lines.push(result.status);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/**
 * @param {ReturnType<typeof runDeveloperWorkflow>} context
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writeDeveloperAutomationReport(context, rootDir = process.cwd()) {
  const reportDir = path.join(rootDir, "reports", "developer-automation", "latest");
  fs.mkdirSync(reportDir, { recursive: true });

  const report = buildDeveloperAutomationReport(context);
  const jsonPath = path.join(reportDir, "developer-automation-report.json");
  const markdownPath = path.join(reportDir, "developer-automation-report.md");

  const jsonPayload = {
    schema: report.schema,
    status: report.status,
    options: report.options,
    stopReason: report.stopReason,
    guardHooks: report.guardHooks,
    guardSummary: report.guardSummary,
    results: report.results,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(
    markdownPath,
    `${buildDeveloperAutomationReportMarkdown(context)}\n`,
  );

  return {
    json: `${DEVELOPER_AUTOMATION_REPORT_DIR}/developer-automation-report.json`,
    markdown: `${DEVELOPER_AUTOMATION_REPORT_DIR}/developer-automation-report.md`,
  };
}
