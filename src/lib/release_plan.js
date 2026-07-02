import fs from "node:fs";
import path from "node:path";
import { DEVELOPER_AUTOMATION_REPORT_DIR } from "./developer_automation.js";

export const RELEASE_PLAN_SCHEMA = "developer-automation/release-plan/1.0";

export const RELEASE_PLAN_STEPS = [
  { id: "git-commit", name: "git commit", required: true },
  { id: "git-tag", name: "git tag", required: true },
  { id: "git-push", name: "git push", required: true },
  { id: "github-release", name: "GitHub Release", required: false },
  { id: "publish", name: "Publish", required: false },
];

const REASON_PENDING = "Pending human approval";
const REASON_OUT_OF_SCOPE = "Out of MVP scope";
const REASON_NOT_READY = "Release readiness is not ready";

/**
 * @param {{ id: string, name: string, required: boolean }} step
 * @param {"ready" | "not-ready"} readinessStatus
 * @returns {string}
 */
export function getStepReason(step, readinessStatus) {
  if (!step.required) {
    return REASON_OUT_OF_SCOPE;
  }

  if (readinessStatus !== "ready") {
    return REASON_NOT_READY;
  }

  return REASON_PENDING;
}

/**
 * @param {string} [rootDir]
 * @returns {{ schema?: string, status: "ready" | "not-ready", checks?: Record<string, unknown> }}
 */
export function readReleaseReadinessReport(rootDir = process.cwd()) {
  const jsonPath = path.join(
    rootDir,
    "reports",
    "developer-automation",
    "latest",
    "release-readiness.json",
  );

  if (!fs.existsSync(jsonPath)) {
    return { status: "not-ready" };
  }

  return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
}

/**
 * @param {object} [params]
 * @param {string} [params.rootDir]
 * @param {{ status: "ready" | "not-ready" }} [params.readiness]
 * @param {string} [params.generatedAt]
 * @returns {{
 *   schema: string,
 *   status: "ready" | "not-ready",
 *   steps: Array<{
 *     id: string,
 *     name: string,
 *     required: boolean,
 *     completed: boolean,
 *     reason: string,
 *   }>,
 *   generatedAt: string,
 * }}
 */
export function buildReleasePlan(params = {}) {
  const rootDir = params.rootDir ?? process.cwd();
  const readiness = params.readiness ?? readReleaseReadinessReport(rootDir);
  const status = readiness.status === "ready" ? "ready" : "not-ready";

  const steps = RELEASE_PLAN_STEPS.map((step) => ({
    id: step.id,
    name: step.name,
    required: step.required,
    completed: false,
    reason: getStepReason(step, status),
  }));

  return {
    schema: RELEASE_PLAN_SCHEMA,
    status,
    steps,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
  };
}

/**
 * @param {ReturnType<typeof buildReleasePlan>} plan
 * @returns {string}
 */
export function buildReleasePlanMarkdown(plan) {
  const lines = [
    "# Release Plan Report",
    "",
    "## Release Plan",
    "",
    `- Schema: ${plan.schema}`,
    `- Generated at: ${plan.generatedAt}`,
    "",
    "## Status",
    "",
    plan.status === "ready" ? "READY" : "NOT READY",
    "",
    "## Planned Steps",
    "",
  ];

  for (const step of plan.steps) {
    lines.push(`- ${step.name} — ${step.reason}`);
  }

  lines.push("");

  return lines.join("\n");
}

/**
 * @param {ReturnType<typeof buildReleasePlan>} plan
 * @returns {string}
 */
export function buildReleasePlanCliSummary(plan) {
  const lines = [
    "Release Plan",
    "",
    `Status: ${plan.status === "ready" ? "READY" : "NOT READY"}`,
    "",
    "Planned Steps",
    "",
  ];

  for (const step of plan.steps) {
    lines.push(`○ ${step.name} — ${step.reason}`);
  }

  return lines.join("\n");
}

/**
 * @param {ReturnType<typeof buildReleasePlan>} plan
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writeReleasePlanReport(plan, rootDir = process.cwd()) {
  const reportDir = path.join(rootDir, "reports", "developer-automation", "latest");
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, "release-plan.json");
  const markdownPath = path.join(reportDir, "release-plan.md");

  const jsonPayload = {
    schema: plan.schema,
    status: plan.status,
    steps: plan.steps,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(markdownPath, `${buildReleasePlanMarkdown(plan)}\n`);

  return {
    json: `${DEVELOPER_AUTOMATION_REPORT_DIR}/release-plan.json`,
    markdown: `${DEVELOPER_AUTOMATION_REPORT_DIR}/release-plan.md`,
  };
}
