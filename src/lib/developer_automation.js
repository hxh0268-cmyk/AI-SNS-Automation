import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

export const DEV_NEXT_SCHEMA = "developer-automation/dev-next/1.0";
export const VERSION_CONSISTENCY_SCHEMA = "developer-automation/version-consistency/1.0";
export const DEVELOPER_AUTOMATION_REPORT_DIR = "reports/developer-automation/latest";

export function parseArgs(args = []) {
  return {
    dryRun: args.includes("--dry-run")
  };
}

export function readTextFile(filePath, fallback = "") {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return fs.readFileSync(filePath, "utf8");
}

export function detectCurrentVersion(rootDir = process.cwd()) {
  const version = getVersionFromVersionMd(rootDir);

  if (!version) {
    return {
      version: "unknown",
      nextPatch: "unknown",
      nextMinor: "unknown",
    };
  }

  const match = version.match(/^v(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return {
      version: "unknown",
      nextPatch: "unknown",
      nextMinor: "unknown",
    };
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  return {
    version,
    nextPatch: `v${major}.${minor}.${patch + 1}`,
    nextMinor: `v${major}.${minor + 1}.0`,
  };
}

/**
 * @param {string} [rootDir]
 * @param {typeof execSync} [execSyncImpl]
 * @returns {string | null}
 */
export function getLatestGitTag(rootDir = process.cwd(), execSyncImpl = execSync) {
  try {
    const output = execSyncImpl("git tag --sort=-v:refname", {
      cwd: rootDir,
      encoding: "utf8",
      stdio: "pipe",
    });
    const tags = output
      .trim()
      .split("\n")
      .map((tag) => tag.trim())
      .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag));

    return tags[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * @param {string} [rootDir]
 * @returns {string | null}
 */
export function getVersionFromVersionMd(rootDir = process.cwd()) {
  const versionDoc = readTextFile(path.join(rootDir, "docs", "VERSION.md"));
  const match = versionDoc.match(/\*\*(v\d+\.\d+\.\d+)\*\*/);
  return match ? match[1] : null;
}

/**
 * @param {string} [rootDir]
 * @returns {string | null}
 */
export function getChangelogLatestVersion(rootDir = process.cwd()) {
  const changelog = readTextFile(path.join(rootDir, "docs", "CHANGELOG.md"));
  const match = changelog.match(/^##\s+(v\d+\.\d+\.\d+)\s/m);
  return match ? match[1] : null;
}

/**
 * @param {object} [params]
 * @param {string} [params.rootDir]
 * @param {string | null} [params.gitTag]
 * @param {string | null} [params.versionMd]
 * @param {string | null} [params.changelogVersion]
 * @param {string} [params.generatedAt]
 * @returns {{
 *   schema: string,
 *   status: "ok" | "warning",
 *   gitTag: string | null,
 *   versionMd: string | null,
 *   changelog: string | null,
 *   warnings: string[],
 *   generatedAt: string,
 * }}
 */
export function buildVersionConsistencyReport(params = {}) {
  const rootDir = params.rootDir ?? process.cwd();
  const gitTag = params.gitTag ?? getLatestGitTag(rootDir);
  const versionMd = params.versionMd ?? getVersionFromVersionMd(rootDir);
  const changelog = params.changelogVersion ?? getChangelogLatestVersion(rootDir);
  /** @type {string[]} */
  const warnings = [];

  if (!gitTag) {
    warnings.push("Git tag not found.");
  }
  if (!versionMd) {
    warnings.push("VERSION.md current version not found.");
  }
  if (!changelog) {
    warnings.push("CHANGELOG.md version section not found.");
  }

  const presentVersions = [gitTag, versionMd, changelog].filter(Boolean);
  const uniqueVersions = [...new Set(presentVersions)];
  if (uniqueVersions.length > 1) {
    warnings.push(
      "Version mismatch detected between Git Tag, VERSION.md, and CHANGELOG.md.",
    );
  }

  return {
    schema: VERSION_CONSISTENCY_SCHEMA,
    status: warnings.length === 0 ? "ok" : "warning",
    gitTag,
    versionMd,
    changelog,
    warnings,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
  };
}

export function buildVersionConsistencyMarkdown(report) {
  const display = (value) => value ?? "—";
  const lines = [
    "# Version Consistency Report",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Schema | ${report.schema} |`,
    `| Status | ${report.status} |`,
    `| Git Tag | ${display(report.gitTag)} |`,
    `| VERSION.md | ${display(report.versionMd)} |`,
    `| CHANGELOG.md | ${display(report.changelog)} |`,
    "",
    "## Version Consistency",
    "",
    "3-way consistency across Git Tag, VERSION.md, and CHANGELOG.md.",
    "",
    "## Warnings",
    "",
  ];

  if (report.warnings.length === 0) {
    lines.push("None");
  } else {
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function writeVersionConsistencyReport(report, rootDir = process.cwd()) {
  const reportDir = path.join(rootDir, "reports", "developer-automation", "latest");
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, "version-consistency.json");
  const markdownPath = path.join(reportDir, "version-consistency.md");

  const jsonPayload = {
    schema: report.schema,
    status: report.status,
    gitTag: report.gitTag,
    versionMd: report.versionMd,
    changelog: report.changelog,
    warnings: report.warnings,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`);
  fs.writeFileSync(markdownPath, `${buildVersionConsistencyMarkdown(report)}\n`);

  return {
    json: `${DEVELOPER_AUTOMATION_REPORT_DIR}/version-consistency.json`,
    markdown: `${DEVELOPER_AUTOMATION_REPORT_DIR}/version-consistency.md`,
  };
}

export function getGitStatus(rootDir = process.cwd()) {
  try {
    return execSync("git status --short", {
      cwd: rootDir,
      encoding: "utf8"
    }).trim();
  } catch (error) {
    return `git status failed: ${error.message}`;
  }
}

export function buildDevNextPlan({ rootDir = process.cwd(), generatedAt = new Date().toISOString() } = {}) {
  const version = detectCurrentVersion(rootDir);
  const gitStatus = getGitStatus(rootDir);

  const recommendedNext = {
    version: version.nextMinor,
    title: "Developer Automation Foundation",
    commands: [
      "npm run dev:next",
      "npm run release",
      "npm run release -- --push"
    ]
  };

  return {
    schema: DEV_NEXT_SCHEMA,
    mode: "dry-run",
    generatedAt,
    currentVersion: version.version,
    recommendedNext,
    gitStatus,
    humanApprovalGate: {
      required: true,
      rule: "Publishing must require explicit human approval. No dry-run or apply mode may publish."
    },
    nextActions: [
      "Review docs/ARCHITECTURE.md",
      "Review version-consistency report before release",
      "Run npm test before any release approval",
      "Add release automation in v1.27.0 or later",
    ],
  };
}

export function buildDevNextMarkdown(plan) {
  const lines = [
    "# Developer Automation Next Plan",
    "",
    `- Schema: ${plan.schema}`,
    `- Mode: ${plan.mode}`,
    `- Generated at: ${plan.generatedAt}`,
    `- Current version: ${plan.currentVersion}`,
    `- Recommended next version: ${plan.recommendedNext.version}`,
    `- Recommended title: ${plan.recommendedNext.title}`,
    "",
    "## Recommended Commands",
    ""
  ];

  for (const command of plan.recommendedNext.commands) {
    lines.push(`- \`${command}\``);
  }

  lines.push("");
  lines.push("## Human Approval Gate");
  lines.push("");
  lines.push(`- Required: ${plan.humanApprovalGate.required}`);
  lines.push(`- Rule: ${plan.humanApprovalGate.rule}`);
  lines.push("");
  lines.push("## Git Status");
  lines.push("");
  lines.push("```text");
  lines.push(plan.gitStatus || "clean");
  lines.push("```");
  lines.push("");
  lines.push("## Next Actions");
  lines.push("");

  for (const action of plan.nextActions) {
    lines.push(`- ${action}`);
  }

  lines.push("");

  return lines.join("\n");
}

export function writeDevNextReport(plan, rootDir = process.cwd()) {
  const reportDir = path.join(rootDir, "reports", "developer-automation", "latest");
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, "dev-next.json");
  const markdownPath = path.join(reportDir, "dev-next.md");

  fs.writeFileSync(jsonPath, JSON.stringify(plan, null, 2) + "\n");
  fs.writeFileSync(markdownPath, buildDevNextMarkdown(plan) + "\n");

  return {
    json: "reports/developer-automation/latest/dev-next.json",
    markdown: "reports/developer-automation/latest/dev-next.md"
  };
}
