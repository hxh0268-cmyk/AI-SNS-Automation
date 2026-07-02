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

export const DEVELOPER_AUTOMATION_WORKFLOW_SCHEMA =
  "developer-automation/workflow/1.0";

export const STEP_STATUS = {
  PASS: "pass",
  FAIL: "fail",
  SKIP: "skip",
};

export const WORKFLOW_STATUS = {
  SUCCESS: "success",
  FAILURE: "failure",
};

/**
 * @param {{
 *   id: string,
 *   name: string,
 *   status: string,
 *   detail?: unknown,
 * }} params
 * @returns {{
 *   id: string,
 *   name: string,
 *   status: string,
 *   detail: unknown,
 * }}
 */
export function buildStepResult(params) {
  return {
    id: params.id,
    name: params.name,
    status: params.status,
    detail: params.detail ?? null,
  };
}

/**
 * @param {object} [params]
 * @param {string} [params.rootDir]
 * @param {boolean} [params.skipNpmTest]
 * @param {string} [params.generatedAt]
 * @returns {{
 *   schema: string,
 *   rootDir: string,
 *   skipNpmTest: boolean,
 *   results: ReturnType<typeof buildStepResult>[],
 *   status: string,
 *   generatedAt: string,
 * }}
 */
export function createWorkflowContext(params = {}) {
  return {
    schema: DEVELOPER_AUTOMATION_WORKFLOW_SCHEMA,
    rootDir: params.rootDir ?? process.cwd(),
    skipNpmTest: params.skipNpmTest ?? false,
    results: [],
    status: WORKFLOW_STATUS.SUCCESS,
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
 * @param {ReturnType<typeof buildStepResult>[]} results
 * @returns {string}
 */
export function computeWorkflowStatus(results) {
  const hasFail = results.some((result) => result.status === STEP_STATUS.FAIL);
  return hasFail ? WORKFLOW_STATUS.FAILURE : WORKFLOW_STATUS.SUCCESS;
}

/**
 * @param {ReturnType<typeof createWorkflowContext>} context
 * @returns {ReturnType<typeof createWorkflowContext>}
 */
export function finalizeWorkflowContext(context) {
  return {
    ...context,
    status: computeWorkflowStatus(context.results),
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
 * @param {typeof WORKFLOW_STEP_REGISTRY} [registry]
 * @returns {ReturnType<typeof createWorkflowContext>}
 */
export function executeWorkflowSteps(context, registry = WORKFLOW_STEP_REGISTRY) {
  return registry.reduce((currentContext, step) => step.run(currentContext), context);
}

/**
 * @param {object} [params]
 * @param {string} [params.rootDir]
 * @param {boolean} [params.skipNpmTest]
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
 * @param {ReturnType<typeof runDeveloperWorkflow>} context
 * @returns {{
 *   schema: string,
 *   status: string,
 *   results: ReturnType<typeof buildStepResult>[],
 *   generatedAt: string,
 * }}
 */
export function buildDeveloperAutomationReport(context) {
  return {
    schema: context.schema,
    status: context.status,
    results: context.results,
    generatedAt: context.generatedAt,
  };
}

/**
 * @param {ReturnType<typeof runDeveloperWorkflow>} context
 * @returns {string}
 */
export function buildDeveloperAutomationReportMarkdown(context) {
  const report = buildDeveloperAutomationReport(context);
  const displayStatus =
    report.status === WORKFLOW_STATUS.SUCCESS ? "SUCCESS" : "FAILURE";

  const lines = [
    "# Developer Automation Report",
    "",
    "## Workflow",
    "",
    `- Schema: ${report.schema}`,
    `- Generated at: ${report.generatedAt}`,
    "",
    "## Status",
    "",
    displayStatus,
    "",
    "## Step Results",
    "",
  ];

  for (const result of report.results) {
    lines.push(`- ${result.name} — ${result.status}`);
  }

  lines.push("");

  return lines.join("\n");
}

/**
 * @param {ReturnType<typeof runDeveloperWorkflow>} context
 * @returns {string}
 */
export function buildDeveloperAutomationWorkflowCliSummary(context) {
  const report = buildDeveloperAutomationReport(context);
  const icon = (status) => {
    if (status === STEP_STATUS.PASS) {
      return "✔";
    }
    if (status === STEP_STATUS.FAIL) {
      return "✘";
    }
    return "○";
  };

  const lines = [
    "Developer Automation Workflow",
    "",
    `Status: ${report.status === WORKFLOW_STATUS.SUCCESS ? "SUCCESS" : "FAILURE"}`,
    "",
    "Step Results",
    "",
  ];

  for (const result of report.results) {
    lines.push(`${icon(result.status)} ${result.name} — ${result.status}`);
  }

  return lines.join("\n");
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
