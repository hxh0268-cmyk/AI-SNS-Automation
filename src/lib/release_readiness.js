import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  DEVELOPER_AUTOMATION_REPORT_DIR,
  buildVersionConsistencyReport,
} from "./developer_automation.js";

export const RELEASE_READINESS_SCHEMA =
  "developer-automation/release-readiness/1.0";

export const REQUIRED_REPORTS = [
  "version-consistency.json",
  "version-consistency.md",
];

/**
 * @param {string} [rootDir]
 * @param {typeof execSync} [execSyncImpl]
 * @returns {{ status: "pass" | "fail", detail: string }}
 */
export function checkWorkingTree(rootDir = process.cwd(), execSyncImpl = execSync) {
  try {
    const status = execSyncImpl("git status --porcelain", {
      cwd: rootDir,
      encoding: "utf8",
      stdio: "pipe",
    }).trim();

    if (status.length === 0) {
      return { status: "pass", detail: "clean" };
    }

    return { status: "fail", detail: status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "fail", detail: message };
  }
}

/**
 * @param {object} [params]
 * @param {string} [params.rootDir]
 * @param {ReturnType<typeof buildVersionConsistencyReport>} [params.versionReport]
 * @returns {{ status: "pass" | "fail", detail: ReturnType<typeof buildVersionConsistencyReport> }}
 */
export function checkVersionConsistency(params = {}) {
  const report =
    params.versionReport ??
    buildVersionConsistencyReport({ rootDir: params.rootDir ?? process.cwd() });

  return {
    status: report.status === "ok" ? "pass" : "fail",
    detail: report,
  };
}

/**
 * @param {string} [rootDir]
 * @returns {{ status: "pass" | "fail", detail: { required: string[], missing: string[] } }}
 */
export function checkRequiredReports(rootDir = process.cwd()) {
  const reportDir = path.join(rootDir, "reports", "developer-automation", "latest");
  const missing = REQUIRED_REPORTS.filter(
    (filename) => !fs.existsSync(path.join(reportDir, filename)),
  );

  return {
    status: missing.length === 0 ? "pass" : "fail",
    detail: {
      required: [...REQUIRED_REPORTS],
      missing,
    },
  };
}

/**
 * @param {object} [params]
 * @param {string} [params.rootDir]
 * @param {typeof execSync} [params.execSyncImpl]
 * @param {boolean} [params.skip]
 * @returns {{ status: "pass" | "fail", detail: string }}
 */
export function checkNpmTest(params = {}) {
  const rootDir = params.rootDir ?? process.cwd();
  const execSyncImpl = params.execSyncImpl ?? execSync;

  if (params.skip) {
    return { status: "pass", detail: "skipped" };
  }

  try {
    execSyncImpl("npm test", {
      cwd: rootDir,
      encoding: "utf8",
      stdio: "pipe",
    });
    return { status: "pass", detail: "npm test passed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "fail", detail: message };
  }
}

/**
 * @param {object} [params]
 * @param {string} [params.rootDir]
 * @param {typeof execSync} [params.execSyncImpl]
 * @param {boolean} [params.skipNpmTest]
 * @param {ReturnType<typeof checkWorkingTree>} [params.workingTree]
 * @param {ReturnType<typeof checkVersionConsistency>} [params.versionConsistency]
 * @param {ReturnType<typeof checkRequiredReports>} [params.requiredReports]
 * @param {ReturnType<typeof checkNpmTest>} [params.npmTest]
 * @param {string} [params.generatedAt]
 * @returns {{
 *   schema: string,
 *   status: "ready" | "not-ready",
 *   checks: {
 *     workingTree: { status: "pass" | "fail" },
 *     versionConsistency: { status: "pass" | "fail" },
 *     requiredReports: { status: "pass" | "fail" },
 *     npmTest: { status: "pass" | "fail" },
 *   },
 *   generatedAt: string,
 * }}
 */
export function evaluateReleaseReadiness(params = {}) {
  const rootDir = params.rootDir ?? process.cwd();
  const workingTree =
    params.workingTree ?? checkWorkingTree(rootDir, params.execSyncImpl);
  const versionConsistency =
    params.versionConsistency ??
    checkVersionConsistency({ rootDir, versionReport: params.versionReport });
  const requiredReports =
    params.requiredReports ?? checkRequiredReports(rootDir);
  const npmTest =
    params.npmTest ??
    checkNpmTest({
      rootDir,
      execSyncImpl: params.execSyncImpl,
      skip: params.skipNpmTest,
    });

  const checks = {
    workingTree: { status: workingTree.status },
    versionConsistency: { status: versionConsistency.status },
    requiredReports: { status: requiredReports.status },
    npmTest: { status: npmTest.status },
  };

  const allPass = Object.values(checks).every((check) => check.status === "pass");

  return {
    schema: RELEASE_READINESS_SCHEMA,
    status: allPass ? "ready" : "not-ready",
    checks,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
  };
}

/**
 * @param {{
 *   schema: string,
 *   status: "ready" | "not-ready",
 *   checks: Record<string, { status: "pass" | "fail" }>,
 *   generatedAt: string,
 * }} report
 * @returns {string}
 */
export function buildReleaseReadinessMarkdown(report) {
  const displayStatus = (status) => (status === "pass" ? "pass" : "fail");
  const lines = [
    "# Release Readiness Report",
    "",
    "## Release Readiness",
    "",
    `- Schema: ${report.schema}`,
    `- Generated at: ${report.generatedAt}`,
    "",
    "## Status",
    "",
    report.status === "ready" ? "READY" : "NOT READY",
    "",
    "## Working Tree",
    "",
    displayStatus(report.checks.workingTree.status),
    "",
    "## Version Consistency",
    "",
    displayStatus(report.checks.versionConsistency.status),
    "",
    "## Required Reports",
    "",
    displayStatus(report.checks.requiredReports.status),
    "",
    "## npm test",
    "",
    displayStatus(report.checks.npmTest.status),
    "",
  ];

  return lines.join("\n");
}

/**
 * @param {{
 *   schema: string,
 *   status: "ready" | "not-ready",
 *   checks: Record<string, { status: "pass" | "fail" }>,
 * }} report
 * @returns {string}
 */
export function buildReleaseReadinessCliSummary(report) {
  const icon = (status) => (status === "pass" ? "✔" : "✘");
  const lines = [
    "Release Readiness",
    "",
    `${icon(report.checks.workingTree.status)} Working Tree`,
    `${icon(report.checks.versionConsistency.status)} Version Consistency`,
    `${icon(report.checks.requiredReports.status)} Required Reports`,
    `${icon(report.checks.npmTest.status)} npm test`,
    "",
    `Status: ${report.status === "ready" ? "READY" : "NOT READY"}`,
  ];

  return lines.join("\n");
}

/**
 * @param {ReturnType<typeof evaluateReleaseReadiness>} report
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writeReleaseReadinessReport(report, rootDir = process.cwd()) {
  const reportDir = path.join(rootDir, "reports", "developer-automation", "latest");
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, "release-readiness.json");
  const markdownPath = path.join(reportDir, "release-readiness.md");

  const jsonPayload = {
    schema: report.schema,
    status: report.status,
    checks: report.checks,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(markdownPath, `${buildReleaseReadinessMarkdown(report)}\n`);

  return {
    json: `${DEVELOPER_AUTOMATION_REPORT_DIR}/release-readiness.json`,
    markdown: `${DEVELOPER_AUTOMATION_REPORT_DIR}/release-readiness.md`,
  };
}
