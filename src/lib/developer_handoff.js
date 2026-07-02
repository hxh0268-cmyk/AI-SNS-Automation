import fs from "node:fs";
import path from "node:path";
import {
  DEVELOPER_AUTOMATION_REPORT_DIR,
  getVersionFromVersionMd,
} from "./developer_automation.js";

export const DEVELOPER_HANDOFF_SCHEMA = "developer-automation/handoff/1.0";

export const HANDOFF_PROJECT = "AI-SNS-Automation";
export const HANDOFF_PHASE = "Phase2 Developer Automation";
export const HANDOFF_VERSION_FORMAT = /^v\d+\.\d+\.\d+$/;
export const HANDOFF_RELEASE_NAME = "Developer Handoff Prompt Foundation";

export const HANDOFF_OBJECTIVE =
  "Generate a standardized Claude Code implementation prompt from the current project context, next release objective, implementation scope, prohibited actions, required tests, and completion report checklist.";

export const HANDOFF_SCOPE = [
  "Add developer handoff generator",
  "Add machine-readable handoff JSON",
  "Add Claude Code ready markdown prompt",
  "Add developer:handoff npm script",
  "Read current version from docs/VERSION.md",
  "Preserve JSON Source / Markdown View design",
  "Keep output paths fixed under reports/developer-automation/latest",
  "Document the handoff workflow",
];

export const HANDOFF_PROHIBITED_ACTIONS = [
  "git add",
  "git commit",
  "git tag",
  "git push",
  "GitHub Release",
  "Publish",
  "SemVer automatic decision",
  "Git operation automation",
];

export const HANDOFF_REQUIRED_TESTS = [
  "developer handoff generator exists",
  "developer-handoff schema",
  "currentVersion is read from docs/VERSION.md",
  "nextVersion auto increments minor version",
  "developer-handoff.json generated",
  "developer-handoff.md generated",
  "Markdown includes Project Context",
  "Markdown includes Implementation Scope",
  "Markdown includes Prohibited Actions",
  "Markdown includes Completion Report Checklist",
  "CLI summary includes output paths",
  "developer:handoff npm script exists",
  "JSON Source / Markdown View consistency",
  "No git operation automation",
];

export const HANDOFF_COMPLETION_REPORT_CHECKLIST = [
  "変更ファイル一覧",
  "実装内容",
  "追加テスト一覧",
  "npm test 結果",
  "npm run developer:handoff 結果",
  "developer-handoff.json の要約",
  "developer-handoff.md の要約",
  "git status",
  "commit / tag / push は未実施であること",
];

export const HANDOFF_DOCUMENTATION_UPDATES = [
  "README.md",
  "docs/CHANGELOG.md",
  "docs/VERSION.md",
  "package.json",
  "scripts/test_quality_pipeline.sh",
];

/**
 * @param {string} version
 * @returns {boolean}
 */
export function isValidHandoffVersion(version) {
  return HANDOFF_VERSION_FORMAT.test(version);
}

/**
 * @param {string} currentVersion
 * @returns {string}
 */
export function computeNextMinorVersion(currentVersion) {
  const match = currentVersion.match(/^v(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(
      `Cannot compute nextVersion from currentVersion: ${currentVersion}`,
    );
  }

  const major = Number(match[1]);
  const minor = Number(match[2]) + 1;
  return `v${major}.${minor}.0`;
}

/**
 * @param {string} currentVersion
 * @param {string | undefined | null} nextVersionOverride
 * @returns {string}
 */
export function resolveHandoffNextVersion(currentVersion, nextVersionOverride) {
  if (nextVersionOverride !== undefined && nextVersionOverride !== null) {
    if (!isValidHandoffVersion(nextVersionOverride)) {
      throw new Error(
        `Invalid nextVersion format: ${nextVersionOverride}. Expected vX.Y.Z`,
      );
    }
    return nextVersionOverride;
  }

  return computeNextMinorVersion(currentVersion);
}

/**
 * @param {string[]} [argv]
 * @returns {{ nextVersion?: string }}
 */
export function parseDeveloperHandoffArgs(argv = []) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--next-version" && argv[index + 1]) {
      options.nextVersion = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--next-version=")) {
      options.nextVersion = arg.slice("--next-version=".length);
    }
  }

  return options;
}

/**
 * @param {object} [params]
 * @param {string} [params.rootDir]
 * @param {string} [params.generatedAt]
 * @param {string | null} [params.currentVersion]
 * @param {string | undefined | null} [params.nextVersion]
 * @returns {{
 *   schema: string,
 *   project: string,
 *   phase: string,
 *   currentVersion: string,
 *   nextVersion: string,
 *   releaseName: string,
 *   objective: string,
 *   scope: string[],
 *   prohibitedActions: string[],
 *   requiredTests: string[],
 *   completionReportChecklist: string[],
 *   documentationUpdates: string[],
 *   generatedAt: string,
 * }}
 */
export function buildDeveloperHandoff(params = {}) {
  const rootDir = params.rootDir ?? process.cwd();
  const currentVersion =
    params.currentVersion ?? getVersionFromVersionMd(rootDir) ?? "unknown";

  const nextVersion = resolveHandoffNextVersion(currentVersion, params.nextVersion);

  return {
    schema: DEVELOPER_HANDOFF_SCHEMA,
    project: HANDOFF_PROJECT,
    phase: HANDOFF_PHASE,
    currentVersion,
    nextVersion,
    releaseName: HANDOFF_RELEASE_NAME,
    objective: HANDOFF_OBJECTIVE,
    scope: [...HANDOFF_SCOPE],
    prohibitedActions: [...HANDOFF_PROHIBITED_ACTIONS],
    requiredTests: [...HANDOFF_REQUIRED_TESTS],
    completionReportChecklist: [...HANDOFF_COMPLETION_REPORT_CHECKLIST],
    documentationUpdates: [...HANDOFF_DOCUMENTATION_UPDATES],
    generatedAt: params.generatedAt ?? new Date().toISOString(),
  };
}

/**
 * @param {ReturnType<typeof buildDeveloperHandoff>} handoff
 * @returns {string[]}
 */
function formatBulletList(items) {
  return items.map((item) => `- ${item}`);
}

/**
 * @param {ReturnType<typeof buildDeveloperHandoff>} handoff
 * @returns {string}
 */
export function buildDeveloperHandoffMarkdown(handoff) {
  const lines = [
    `# ${handoff.project} ${handoff.nextVersion} Implementation Handoff`,
    "",
    "## Project Context",
    "",
    `- Project: ${handoff.project}`,
    `- Phase: ${handoff.phase}`,
    `- Schema: ${handoff.schema}`,
    `- Generated at: ${handoff.generatedAt}`,
    "",
    "## Current State",
    "",
    `- Current Version: ${handoff.currentVersion}`,
    "",
    "## Next Release",
    "",
    `- Next Version: ${handoff.nextVersion}`,
    `- Release Name: ${handoff.releaseName}`,
    "",
    "## Objective",
    "",
    handoff.objective,
    "",
    "## Implementation Scope",
    "",
    ...formatBulletList(handoff.scope),
    "",
    "## Prohibited Actions",
    "",
    ...formatBulletList(handoff.prohibitedActions),
    "",
    "## Required Tests",
    "",
    ...formatBulletList(handoff.requiredTests),
    "",
    "## Documentation Updates",
    "",
    ...formatBulletList(handoff.documentationUpdates),
    "",
    "## Completion Report Checklist",
    "",
    ...formatBulletList(handoff.completionReportChecklist),
    "",
  ];

  return lines.join("\n");
}

/**
 * @param {ReturnType<typeof buildDeveloperHandoff>} handoff
 * @returns {string}
 */
export function buildDeveloperHandoffCliSummary(handoff) {
  const jsonPath = `${DEVELOPER_AUTOMATION_REPORT_DIR}/developer-handoff.json`;
  const markdownPath = `${DEVELOPER_AUTOMATION_REPORT_DIR}/developer-handoff.md`;

  return [
    "Developer Handoff",
    "",
    `Project: ${handoff.project}`,
    `Current Version: ${handoff.currentVersion}`,
    `Next Version: ${handoff.nextVersion}`,
    `Release: ${handoff.releaseName}`,
    "",
    "Outputs:",
    `- ${jsonPath}`,
    `- ${markdownPath}`,
  ].join("\n");
}

/**
 * @param {ReturnType<typeof buildDeveloperHandoff>} handoff
 * @param {string} [rootDir]
 * @returns {{ json: string, markdown: string }}
 */
export function writeDeveloperHandoffReport(handoff, rootDir = process.cwd()) {
  const reportDir = path.join(rootDir, "reports", "developer-automation", "latest");
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, "developer-handoff.json");
  const markdownPath = path.join(reportDir, "developer-handoff.md");

  const jsonPayload = {
    schema: handoff.schema,
    project: handoff.project,
    phase: handoff.phase,
    currentVersion: handoff.currentVersion,
    nextVersion: handoff.nextVersion,
    releaseName: handoff.releaseName,
    objective: handoff.objective,
    scope: handoff.scope,
    prohibitedActions: handoff.prohibitedActions,
    requiredTests: handoff.requiredTests,
    completionReportChecklist: handoff.completionReportChecklist,
    generatedAt: handoff.generatedAt,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(markdownPath, `${buildDeveloperHandoffMarkdown(handoff)}\n`);

  return {
    json: `${DEVELOPER_AUTOMATION_REPORT_DIR}/developer-handoff.json`,
    markdown: `${DEVELOPER_AUTOMATION_REPORT_DIR}/developer-handoff.md`,
  };
}
