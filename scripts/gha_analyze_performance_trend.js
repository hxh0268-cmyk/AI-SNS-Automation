#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TREND_DATA_SCHEMA_VERSION = "1.0";
export const DEFAULT_OUTPUT_DIR = path.join(
  "reports",
  "performance-trend",
  "latest",
);
export const OBSERVATION_FILENAME = "performance-observation.json";

export const DEFAULT_WORKFLOWS = [
  ".github/workflows/quality-pipeline-ci.yml",
  ".github/workflows/nightly-apply.yml",
];

/**
 * @param {unknown} observation
 * @returns {boolean}
 */
export function isValidObservation(observation) {
  if (!observation || typeof observation !== "object") {
    return false;
  }
  const record = /** @type {Record<string, unknown>} */ (observation);
  if (record.schemaVersion !== "1.0") {
    return false;
  }
  if (!record.workflow || typeof record.workflow !== "object") {
    return false;
  }
  if (!record.cache || typeof record.cache !== "object") {
    return false;
  }
  if (!record.durations || typeof record.durations !== "object") {
    return false;
  }
  const workflow = /** @type {Record<string, unknown>} */ (record.workflow);
  return typeof workflow.runId === "string" && workflow.runId.length > 0;
}

/**
 * @param {number[]} values
 * @returns {{ min: number, max: number, avg: number, samples: number } | null}
 */
export function summarizeNumericValues(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (filtered.length === 0) {
    return null;
  }
  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  const avg =
    Math.round((filtered.reduce((sum, value) => sum + value, 0) / filtered.length) * 100) /
    100;
  return { min, max, avg, samples: filtered.length };
}

/**
 * @param {Array<Record<string, unknown>>} observations
 * @returns {Record<string, Record<string, unknown>>}
 */
export function buildTrendObservation(observations) {
  /** @type {Record<string, { observations: Array<Record<string, unknown>> }>} */
  const byHash = {};

  for (const observation of observations) {
    const cache = /** @type {Record<string, unknown>} */ (observation.cache);
    const hash =
      typeof cache.packageLockHash === "string" && cache.packageLockHash.length > 0
        ? cache.packageLockHash
        : "(unknown)";
    if (!byHash[hash]) {
      byHash[hash] = { observations: [] };
    }
    byHash[hash].observations.push(observation);
  }

  /** @type {Record<string, Record<string, unknown>>} */
  const trendObservation = {};

  for (const [hash, group] of Object.entries(byHash)) {
    const npmCiValues = group.observations.map((obs) => {
      const durations = /** @type {Record<string, unknown>} */ (obs.durations);
      return typeof durations.npmCiSeconds === "number" ? durations.npmCiSeconds : NaN;
    });
    trendObservation[hash] = {
      npmCiSeconds: summarizeNumericValues(npmCiValues),
      runCount: group.observations.length,
    };
  }

  return trendObservation;
}

/**
 * @param {object} params
 * @param {"fixture" | "gh-cli"} params.source
 * @param {Array<Record<string, unknown>>} params.observations
 * @param {Array<{ runId?: string, message: string }>} params.warnings
 * @param {number} params.runsRequested
 * @returns {Record<string, unknown>}
 */
export function buildTrendData(params) {
  const { source, observations, warnings, runsRequested } = params;

  const recentRuns = observations.map((observation) => {
    const workflow = /** @type {Record<string, unknown>} */ (observation.workflow);
    const cache = /** @type {Record<string, unknown>} */ (observation.cache);
    const durations = /** @type {Record<string, unknown>} */ (observation.durations);
    return {
      runId: workflow.runId,
      workflowName: workflow.name ?? null,
      jobResult: workflow.jobResult ?? null,
      pipelineExitCode:
        typeof workflow.pipelineExitCode === "number" ? workflow.pipelineExitCode : null,
      qualityStatus:
        typeof workflow.qualityStatus === "string" ? workflow.qualityStatus : null,
      generatedAt: observation.generatedAt ?? null,
      packageLockHash:
        typeof cache.packageLockHash === "string" ? cache.packageLockHash : null,
      durations: {
        npmCiSeconds:
          typeof durations.npmCiSeconds === "number" ? durations.npmCiSeconds : null,
        npmTestSeconds:
          typeof durations.npmTestSeconds === "number" ? durations.npmTestSeconds : null,
        dryRunStopBeforePhaseSeconds:
          typeof durations.dryRunStopBeforePhaseSeconds === "number"
            ? durations.dryRunStopBeforePhaseSeconds
            : null,
        dryRunResumeSeconds:
          typeof durations.dryRunResumeSeconds === "number"
            ? durations.dryRunResumeSeconds
            : null,
        applySeconds:
          typeof durations.applySeconds === "number" ? durations.applySeconds : null,
      },
    };
  });

  return {
    schemaVersion: TREND_DATA_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source,
    summary: {
      runsRequested,
      runsAnalyzed: observations.length,
      runsSkipped: warnings.length,
    },
    warnings,
    recentRuns,
    trendObservation: buildTrendObservation(observations),
  };
}

/**
 * @param {Record<string, unknown>} trendData
 * @returns {string}
 */
export function buildTrendReport(trendData) {
  const summary = /** @type {Record<string, number>} */ (trendData.summary ?? {});
  const recentRuns = /** @type {Array<Record<string, unknown>>} */ (
    trendData.recentRuns ?? []
  );
  const warnings = /** @type {Array<Record<string, string>>} */ (trendData.warnings ?? []);
  const trendObservation = /** @type {Record<string, Record<string, unknown>>} */ (
    trendData.trendObservation ?? {}
  );

  const lines = [
    "# Performance Trend Report",
    "",
    "## Summary",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| Source | ${trendData.source ?? "unknown"} |`,
    `| Runs requested | ${summary.runsRequested ?? 0} |`,
    `| Runs analyzed | ${summary.runsAnalyzed ?? 0} |`,
    `| Runs skipped | ${summary.runsSkipped ?? 0} |`,
    `| Generated at | ${trendData.generatedAt ?? ""} |`,
    "",
    "## Recent Runs",
    "",
    "| Run ID | Workflow | Job result | npm ci (s) | package-lock hash |",
    "|--------|----------|------------|------------|-------------------|",
  ];

  if (recentRuns.length === 0) {
    lines.push("| (none) | — | — | — | — |");
  } else {
    for (const run of recentRuns) {
      const durations = /** @type {Record<string, unknown>} */ (run.durations ?? {});
      const hash = run.packageLockHash ?? "—";
      const hashShort =
        typeof hash === "string" && hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
      lines.push(
        `| ${run.runId} | ${run.workflowName ?? "—"} | ${run.jobResult ?? "—"} | ${durations.npmCiSeconds ?? "—"} | ${hashShort} |`,
      );
    }
  }

  lines.push("", "## Trend Observation", "");
  if (Object.keys(trendObservation).length === 0) {
    lines.push("- No trend data available.");
  } else {
    for (const [hash, stats] of Object.entries(trendObservation)) {
      const npmCi = /** @type {Record<string, unknown> | null} */ (stats.npmCiSeconds ?? null);
      const hashShort = hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
      if (npmCi) {
        lines.push(
          `- **${hashShort}** — npm ci: min=${npmCi.min}s, max=${npmCi.max}s, avg=${npmCi.avg}s (${npmCi.samples} samples)`,
        );
      } else {
        lines.push(`- **${hashShort}** — npm ci: no samples`);
      }
    }
  }

  lines.push("", "## Notes", "");
  lines.push(
    "- Compare runs with the same package-lock hash to estimate npm cache benefit.",
  );
  lines.push("- Strict cache-hit detection is not available in v1.17.0.");
  lines.push("- REST API aggregation is deferred to v1.18.0+.");
  if (warnings.length > 0) {
    lines.push("", "### Warnings", "");
    for (const warning of warnings) {
      const prefix = warning.runId ? `Run ${warning.runId}: ` : "";
      lines.push(`- ${prefix}${warning.message}`);
    }
  }

  lines.push("");
  return `${lines.join("\n")}`;
}

/**
 * @param {unknown} trendData
 * @returns {string[]}
 */
export function validateTrendDataContract(trendData) {
  const errors = [];
  if (!trendData || typeof trendData !== "object") {
    return ["trendData must be an object"];
  }
  const record = /** @type {Record<string, unknown>} */ (trendData);
  const required = [
    "schemaVersion",
    "generatedAt",
    "source",
    "summary",
    "warnings",
    "recentRuns",
    "trendObservation",
  ];
  for (const key of required) {
    if (!(key in record)) {
      errors.push(`missing key: ${key}`);
    }
  }
  if (record.schemaVersion !== TREND_DATA_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${TREND_DATA_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(record.warnings)) {
    errors.push("warnings must be an array");
  }
  if (!Array.isArray(record.recentRuns)) {
    errors.push("recentRuns must be an array");
  }
  if (!record.trendObservation || typeof record.trendObservation !== "object") {
    errors.push("trendObservation must be an object");
  }
  return errors;
}

/**
 * @param {string} fixtureDir
 * @returns {{ observations: Array<Record<string, unknown>>, warnings: Array<{ runId?: string, message: string }>, runsRequested: number }}
 */
export function collectFromFixtureDir(fixtureDir) {
  /** @type {Array<Record<string, unknown>>} */
  const observations = [];
  /** @type {Array<{ runId?: string, message: string }>} */
  const warnings = [];
  let runsRequested = 0;

  if (!fs.existsSync(fixtureDir)) {
    throw new Error(`fixture directory not found: ${fixtureDir}`);
  }

  const entries = fs
    .readdirSync(fixtureDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const runDirName of entries) {
    runsRequested += 1;
    const observationPath = path.join(fixtureDir, runDirName, OBSERVATION_FILENAME);
    if (!fs.existsSync(observationPath)) {
      warnings.push({
        runId: runDirName,
        message: `${OBSERVATION_FILENAME} not found — skipped`,
      });
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(observationPath, "utf8"));
    } catch (error) {
      warnings.push({
        runId: runDirName,
        message: `invalid JSON in ${OBSERVATION_FILENAME} — skipped`,
      });
      continue;
    }

    if (!isValidObservation(parsed)) {
      warnings.push({
        runId: runDirName,
        message: `invalid observation schema — skipped`,
      });
      continue;
    }

    observations.push(/** @type {Record<string, unknown>} */ (parsed));
  }

  return { observations, warnings, runsRequested };
}

/**
 * @param {string} searchRoot
 * @returns {string | null}
 */
export function findObservationFile(searchRoot) {
  if (!fs.existsSync(searchRoot)) {
    return null;
  }

  const direct = path.join(searchRoot, OBSERVATION_FILENAME);
  if (fs.existsSync(direct)) {
    return direct;
  }

  const nested = path.join(
    searchRoot,
    "reports",
    "quality-pipeline",
    "latest",
    OBSERVATION_FILENAME,
  );
  if (fs.existsSync(nested)) {
    return nested;
  }

  for (const entry of fs.readdirSync(searchRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const found = findObservationFile(path.join(searchRoot, entry.name));
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * @param {object} params
 * @param {typeof execSync} [params.execSyncImpl]
 * @param {number} [params.limit]
 * @param {string[]} [params.workflows]
 * @param {string} [params.repo]
 * @returns {{ observations: Array<Record<string, unknown>>, warnings: Array<{ runId?: string, message: string }>, runsRequested: number }}
 */
export function collectFromGhCli(params = {}) {
  const execSyncImpl = params.execSyncImpl ?? execSync;
  const limit = params.limit ?? 10;
  const workflows = params.workflows ?? DEFAULT_WORKFLOWS;
  const repoFlag = params.repo ? `--repo ${params.repo}` : "";

  try {
    execSyncImpl("gh auth status", { stdio: "pipe" });
  } catch {
    throw new Error("gh auth status failed — authenticate with `gh auth login` first");
  }

  /** @type {Array<Record<string, unknown>>} */
  const observations = [];
  /** @type {Array<{ runId?: string, message: string }>} */
  const warnings = [];
  let runsRequested = 0;

  for (const workflow of workflows) {
    const listCmd =
      `gh run list ${repoFlag} --workflow "${workflow}" --limit ${limit} ` +
      `--json databaseId,workflowName,conclusion,createdAt,displayTitle`.trim();
    const runs = JSON.parse(execSyncImpl(listCmd, { encoding: "utf8" }));

    for (const run of runs) {
      runsRequested += 1;
      const runId = String(run.databaseId);
      const tempDir = path.join(
        "reports",
        "performance-trend",
        ".tmp",
        `run-${runId}`,
      );
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        execSyncImpl(`gh run download ${runId} ${repoFlag} -D "${tempDir}"`, {
          stdio: "pipe",
        });
      } catch {
        warnings.push({
          runId,
          message: `gh run download failed — skipped`,
        });
        fs.rmSync(tempDir, { recursive: true, force: true });
        continue;
      }

      const observationPath = findObservationFile(tempDir);
      if (!observationPath) {
        warnings.push({
          runId,
          message: `${OBSERVATION_FILENAME} not found in artifact — skipped`,
        });
        fs.rmSync(tempDir, { recursive: true, force: true });
        continue;
      }

      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(observationPath, "utf8"));
      } catch {
        warnings.push({
          runId,
          message: `invalid JSON in ${OBSERVATION_FILENAME} — skipped`,
        });
        fs.rmSync(tempDir, { recursive: true, force: true });
        continue;
      }

      if (!isValidObservation(parsed)) {
        warnings.push({
          runId,
          message: `invalid observation schema — skipped`,
        });
        fs.rmSync(tempDir, { recursive: true, force: true });
        continue;
      }

      observations.push(/** @type {Record<string, unknown>} */ (parsed));
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  return { observations, warnings, runsRequested };
}

/**
 * @param {object} params
 * @param {"fixture" | "gh-cli"} params.source
 * @param {Array<Record<string, unknown>>} params.observations
 * @param {Array<{ runId?: string, message: string }>} params.warnings
 * @param {number} params.runsRequested
 * @param {string} [params.outputDir]
 * @returns {{ trendData: Record<string, unknown>, reportPath: string, dataPath: string }}
 */
export function writeTrendOutputs(params) {
  const outputDir = params.outputDir ?? DEFAULT_OUTPUT_DIR;
  const trendData = buildTrendData({
    source: params.source,
    observations: params.observations,
    warnings: params.warnings,
    runsRequested: params.runsRequested,
  });
  const report = buildTrendReport(trendData);
  fs.mkdirSync(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, "trend-report.md");
  const dataPath = path.join(outputDir, "trend-data.json");
  fs.writeFileSync(reportPath, report);
  fs.writeFileSync(dataPath, `${JSON.stringify(trendData, null, 2)}\n`);
  return { trendData, reportPath, dataPath };
}

/**
 * @param {object} [options]
 * @param {string} [options.fixtureDir]
 * @param {string} [options.outputDir]
 * @param {number} [options.limit]
 * @param {string} [options.repo]
 * @param {typeof execSync} [options.execSyncImpl]
 * @returns {{ trendData: Record<string, unknown>, reportPath: string, dataPath: string }}
 */
export function analyzePerformanceTrend(options = {}) {
  let source;
  let collected;

  if (options.fixtureDir) {
    source = "fixture";
    collected = collectFromFixtureDir(options.fixtureDir);
  } else {
    source = "gh-cli";
    collected = collectFromGhCli({
      execSyncImpl: options.execSyncImpl,
      limit: options.limit,
      repo: options.repo,
    });
  }

  if (collected.observations.length === 0) {
    throw new Error(
      "No valid performance-observation.json files found — cannot generate trend report",
    );
  }

  return writeTrendOutputs({
    source,
    observations: collected.observations,
    warnings: collected.warnings,
    runsRequested: collected.runsRequested,
    outputDir: options.outputDir,
  });
}

function parseArgs(argv) {
  /** @type {Record<string, string | number | boolean>} */
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--fixture-dir") {
      args.fixtureDir = argv[++i];
    } else if (token === "--output-dir") {
      args.outputDir = argv[++i];
    } else if (token === "--limit") {
      args.limit = Number(argv[++i]);
    } else if (token === "--repo") {
      args.repo = argv[++i];
    } else if (token === "--help") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/gha_analyze_performance_trend.js [options]

Options:
  --fixture-dir <path>   Analyze local fixture runs (no gh network calls)
  --output-dir <path>    Output directory (default: reports/performance-trend/latest)
  --limit <n>            gh run list limit per workflow (default: 10)
  --repo <owner/repo>    Target repository for gh CLI
  --help                 Show this help

Production flow (gh CLI):
  1. gh auth status
  2. gh run list --json ...
  3. gh run download <run-id>
  4. Parse performance-observation.json from artifacts

Outputs:
  reports/performance-trend/latest/trend-report.md
  reports/performance-trend/latest/trend-data.json
`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exitCode = 0;
    return;
  }

  try {
    const result = analyzePerformanceTrend({
      fixtureDir: typeof args.fixtureDir === "string" ? args.fixtureDir : undefined,
      outputDir: typeof args.outputDir === "string" ? args.outputDir : undefined,
      limit: typeof args.limit === "number" ? args.limit : undefined,
      repo: typeof args.repo === "string" ? args.repo : undefined,
    });
    console.log(`Wrote ${result.reportPath}`);
    console.log(`Wrote ${result.dataPath}`);
    process.exitCode = 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[PerformanceTrend] Error: ${message}`);
    process.exitCode = 1;
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
