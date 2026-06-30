#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TREND_DATA_SCHEMA_VERSION = "1.2";
export const TREND_DATA_SCHEMA_VERSION_LEGACY = "1.1";
export const SUPPORTED_TREND_DATA_SCHEMA_VERSIONS = ["1.1", "1.2"];
export const DEFAULT_OUTPUT_DIR = path.join(
  "reports",
  "performance-trend",
  "latest",
);
export const OBSERVATION_FILENAME = "performance-observation.json";
export const FIXTURE_ARTIFACTS_FILENAME = "artifacts.json";

export const DEFAULT_WORKFLOWS = [
  ".github/workflows/quality-pipeline-ci.yml",
  ".github/workflows/nightly-apply.yml",
];

export const ARTIFACT_NAME_PATTERNS = [
  /^quality-pipeline-reports-/,
  /^nightly-apply-/,
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
 * @param {Record<string, unknown>} apiArtifact
 * @returns {Record<string, unknown>}
 */
export function normalizeArtifactRecord(apiArtifact) {
  return {
    id: typeof apiArtifact.id === "number" ? apiArtifact.id : null,
    name: typeof apiArtifact.name === "string" ? apiArtifact.name : null,
    sizeInBytes:
      typeof apiArtifact.size_in_bytes === "number" ? apiArtifact.size_in_bytes : null,
    expired: apiArtifact.expired === true,
    expiresAt:
      typeof apiArtifact.expires_at === "string" ? apiArtifact.expires_at : null,
    archiveDownloadUrl:
      typeof apiArtifact.archive_download_url === "string"
        ? apiArtifact.archive_download_url
        : null,
    digest: typeof apiArtifact.digest === "string" ? apiArtifact.digest : null,
  };
}

/**
 * @param {string} output
 * @returns {Array<Record<string, unknown>>}
 */
export function parsePaginatedArtifactsResponse(output) {
  /** @type {Array<Record<string, unknown>>} */
  const artifacts = [];
  const trimmed = output.trim();
  if (!trimmed) {
    return artifacts;
  }

  let depth = 0;
  let start = -1;
  for (let i = 0; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (char === "{") {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const chunk = trimmed.slice(start, i + 1);
        const parsed = JSON.parse(chunk);
        if (Array.isArray(parsed.artifacts)) {
          artifacts.push(...parsed.artifacts);
        } else if (parsed.id && parsed.name) {
          artifacts.push(parsed);
        }
        start = -1;
      }
    }
  }

  return artifacts;
}

/**
 * @param {unknown} fixtureContent
 * @returns {Array<Record<string, unknown>>}
 */
export function parseFixtureArtifacts(fixtureContent) {
  if (Array.isArray(fixtureContent)) {
    return fixtureContent.flatMap((page) => {
      if (page && typeof page === "object" && Array.isArray(page.artifacts)) {
        return page.artifacts;
      }
      if (page && typeof page === "object" && page.id && page.name) {
        return [page];
      }
      return [];
    });
  }
  if (
    fixtureContent &&
    typeof fixtureContent === "object" &&
    Array.isArray(/** @type {Record<string, unknown>} */ (fixtureContent).artifacts)
  ) {
    return /** @type {Record<string, unknown>} */ (fixtureContent).artifacts;
  }
  return [];
}

/**
 * @param {Array<Record<string, unknown>>} artifacts
 * @returns {Record<string, unknown> | null}
 */
export function selectPerformanceArtifact(artifacts) {
  for (const pattern of ARTIFACT_NAME_PATTERNS) {
    const match = artifacts.find(
      (artifact) =>
        typeof artifact.name === "string" && pattern.test(artifact.name),
    );
    if (match) {
      return match;
    }
  }
  return artifacts[0] ?? null;
}

/**
 * @param {object} params
 * @param {Record<string, unknown> | null} params.rawArtifact
 * @param {string} params.runId
 * @returns {{
 *   artifact: Record<string, unknown> | null,
 *   skip: boolean,
 *   warnings: Array<{ runId?: string, message: string, kind?: string }>,
 *   metadataWarnings: Array<{ runId?: string, message: string, kind?: string }>,
 * }}
 */
export function evaluateArtifactMetadata(params) {
  const { rawArtifact, runId } = params;
  /** @type {Array<{ runId?: string, message: string, kind?: string }>} */
  const warnings = [];
  /** @type {Array<{ runId?: string, message: string, kind?: string }>} */
  const metadataWarnings = [];

  if (!rawArtifact) {
    return { artifact: null, skip: false, warnings, metadataWarnings };
  }

  const artifact = normalizeArtifactRecord(rawArtifact);

  if (artifact.expired === true) {
    warnings.push({
      runId,
      kind: "artifact-expired",
      message: `artifact "${artifact.name}" is expired — skipped`,
    });
    return { artifact, skip: true, warnings, metadataWarnings };
  }

  if (!artifact.expiresAt) {
    metadataWarnings.push({
      runId,
      kind: "artifact-expires-at-missing",
      message: `artifact "${artifact.name}" missing expires_at`,
    });
  }

  return { artifact, skip: false, warnings, metadataWarnings };
}

/**
 * @param {object} params
 * @param {string} params.runId
 * @param {string} [params.repo]
 * @param {typeof execSync} [params.execSyncImpl]
 * @param {NodeJS.ProcessEnv} [params.env]
 * @returns {{ artifacts: Array<Record<string, unknown>>, error: string | null }}
 */
export function fetchRunArtifactsFromApi(params) {
  const execSyncImpl = params.execSyncImpl ?? execSync;
  const execOptions = {
    encoding: "utf8",
    stdio: "pipe",
    env: params.env ?? process.env,
  };
  const repo = params.repo ?? resolveGhRepo(execSyncImpl, params.env);
  if (!repo) {
    return { artifacts: [], error: "unable to resolve repository for gh api" };
  }

  try {
    const cmd =
      `gh api repos/${repo}/actions/runs/${params.runId}/artifacts --paginate`;
    const output = execSyncImpl(cmd, execOptions);
    return {
      artifacts: parsePaginatedArtifactsResponse(output),
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { artifacts: [], error: message };
  }
}

/**
 * @param {typeof execSync} [execSyncImpl]
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string | null}
 */
export function resolveGhRepo(execSyncImpl = execSync, env = process.env) {
  try {
    const output = execSyncImpl("gh repo view --json nameWithOwner -q .nameWithOwner", {
      encoding: "utf8",
      stdio: "pipe",
      env,
    });
    const repo = output.trim();
    return repo.length > 0 ? repo : null;
  } catch {
    return null;
  }
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
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{
 *   isGitHubActions: boolean,
 *   ghToken: string | null,
 *   repo: string | null,
 *   workflowRunId: string | null,
 *   sourceWorkflow: string | null,
 *   trigger: string | null,
 *   ghEnv: NodeJS.ProcessEnv | undefined,
 *   warnings: Array<{ message: string, kind?: string }>,
 * }}
 */
export function resolveGhAuthContext(env = process.env) {
  /** @type {Array<{ message: string, kind?: string }>} */
  const warnings = [];
  const isGitHubActions = env.GITHUB_ACTIONS === "true";
  const ghToken = env.GH_TOKEN ?? env.GITHUB_TOKEN ?? null;

  if (isGitHubActions && !ghToken) {
    warnings.push({
      kind: "gh-token-missing",
      message:
        "GH_TOKEN is not set in GitHub Actions — gh CLI may fail without Actions read token",
    });
  }

  /** @type {NodeJS.ProcessEnv | undefined} */
  let ghEnv;
  if (ghToken) {
    ghEnv = { ...env, GH_TOKEN: ghToken };
  }

  return {
    isGitHubActions,
    ghToken,
    repo: typeof env.GITHUB_REPOSITORY === "string" ? env.GITHUB_REPOSITORY : null,
    workflowRunId: typeof env.GITHUB_RUN_ID === "string" ? env.GITHUB_RUN_ID : null,
    sourceWorkflow: typeof env.GITHUB_WORKFLOW === "string" ? env.GITHUB_WORKFLOW : null,
    trigger: typeof env.GITHUB_EVENT_NAME === "string" ? env.GITHUB_EVENT_NAME : null,
    ghEnv,
    warnings,
  };
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{
 *   valid: boolean,
 *   errors: string[],
 *   warnings: Array<{ message: string, kind?: string }>,
 * }}
 */
export function validateGitHubActionsEnv(env = process.env) {
  /** @type {string[]} */
  const errors = [];
  const authContext = resolveGhAuthContext(env);

  if (env.GITHUB_ACTIONS !== "true") {
    errors.push("GITHUB_ACTIONS must be true");
  }
  if (!authContext.repo) {
    errors.push("GITHUB_REPOSITORY is required");
  }
  if (!authContext.workflowRunId) {
    errors.push("GITHUB_RUN_ID is required");
  }
  if (!authContext.sourceWorkflow) {
    errors.push("GITHUB_WORKFLOW is required");
  }
  if (!authContext.trigger) {
    errors.push("GITHUB_EVENT_NAME is required");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: authContext.warnings,
  };
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Record<string, string | null>}
 */
export function buildCollectionMetadata(env = process.env) {
  const authContext = resolveGhAuthContext(env);
  return {
    mode: authContext.isGitHubActions ? "github-actions" : "local",
    trigger: authContext.trigger,
    workflowRunId: authContext.workflowRunId,
    sourceWorkflow: authContext.sourceWorkflow,
    collectedAt: new Date().toISOString(),
  };
}

/**
 * @param {object} params
 * @param {"fixture" | "gh-cli" | "github-actions"} params.source
 * @param {Array<Record<string, unknown>>} params.observations
 * @param {Array<{ runId?: string, message: string, kind?: string }>} params.warnings
 * @param {Array<{ runId?: string, message: string, kind?: string }>} [params.metadataWarnings]
 * @param {number} params.runsRequested
 * @param {Record<string, string | null>} [params.collection]
 * @returns {Record<string, unknown>}
 */
export function buildTrendData(params) {
  const {
    source,
    observations,
    warnings,
    metadataWarnings = [],
    runsRequested,
    collection,
  } = params;

  const skippedExpiredArtifacts = warnings.filter(
    (warning) => warning.kind === "artifact-expired",
  ).length;

  const recentRuns = observations.map((observation) => {
    const workflow = /** @type {Record<string, unknown>} */ (observation.workflow);
    const cache = /** @type {Record<string, unknown>} */ (observation.cache);
    const durations = /** @type {Record<string, unknown>} */ (observation.durations);
    const artifact = /** @type {Record<string, unknown> | undefined} */ (observation.artifact);
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
      artifact: artifact ?? null,
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

  const schemaVersion = collection
    ? TREND_DATA_SCHEMA_VERSION
    : TREND_DATA_SCHEMA_VERSION_LEGACY;

  return {
    schemaVersion,
    generatedAt: new Date().toISOString(),
    source,
    ...(collection ? { collection } : {}),
    summary: {
      runsRequested,
      runsAnalyzed: observations.length,
      runsSkipped: warnings.length,
      metadataWarningCount: metadataWarnings.length,
      skippedExpiredArtifacts,
    },
    warnings,
    metadataWarnings,
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
  const metadataWarnings = /** @type {Array<Record<string, string>>} */ (
    trendData.metadataWarnings ?? []
  );
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
    `| Metadata warnings | ${summary.metadataWarningCount ?? 0} |`,
    `| Skipped expired artifacts | ${summary.skippedExpiredArtifacts ?? 0} |`,
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

  lines.push("", "## Artifact Metadata", "");
  lines.push(
    "| Run ID | Artifact name | Size (bytes) | Expired | Expires at | Digest |",
    "|--------|---------------|--------------|---------|------------|--------|",
  );

  let artifactRows = 0;
  for (const run of recentRuns) {
    const artifact = /** @type {Record<string, unknown> | null} */ (run.artifact ?? null);
    if (!artifact) {
      continue;
    }
    artifactRows += 1;
    const digest =
      typeof artifact.digest === "string" && artifact.digest.length > 16
        ? `${artifact.digest.slice(0, 16)}…`
        : (artifact.digest ?? "—");
    lines.push(
      `| ${run.runId} | ${artifact.name ?? "—"} | ${artifact.sizeInBytes ?? "—"} | ${artifact.expired ?? "—"} | ${artifact.expiresAt ?? "—"} | ${digest} |`,
    );
  }
  if (artifactRows === 0) {
    lines.push("| (none) | — | — | — | — | — |");
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
  lines.push("- gh run download alone does not expose expires_at / expired / digest metadata.");
  lines.push("- Artifact metadata uses gh api with Actions read permission on private repos.");
  lines.push("- Strict cache-hit detection is not available in v1.19.0.");
  if (trendData.collection) {
    const collection = /** @type {Record<string, unknown>} */ (trendData.collection);
    lines.push(
      `- Collected via ${collection.mode ?? "unknown"} (trigger: ${collection.trigger ?? "—"}, run: ${collection.workflowRunId ?? "—"}).`,
    );
  } else {
    lines.push("- Local gh CLI / fixture analysis — use workflow_dispatch for automated collection.");
  }
  if (warnings.length > 0) {
    lines.push("", "### Warnings", "");
    for (const warning of warnings) {
      const prefix = warning.runId ? `Run ${warning.runId}: ` : "";
      lines.push(`- ${prefix}${warning.message}`);
    }
  }
  if (metadataWarnings.length > 0) {
    lines.push("", "### Metadata Warnings", "");
    for (const warning of metadataWarnings) {
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
    "metadataWarnings",
    "recentRuns",
    "trendObservation",
  ];
  for (const key of required) {
    if (!(key in record)) {
      errors.push(`missing key: ${key}`);
    }
  }
  if (!SUPPORTED_TREND_DATA_SCHEMA_VERSIONS.includes(String(record.schemaVersion))) {
    errors.push(
      `schemaVersion must be one of: ${SUPPORTED_TREND_DATA_SCHEMA_VERSIONS.join(", ")}`,
    );
  }
  if (record.schemaVersion === TREND_DATA_SCHEMA_VERSION) {
    const collection = record.collection;
    if (!collection || typeof collection !== "object") {
      errors.push("collection is required for schemaVersion 1.2");
    } else {
      const collectionRecord = /** @type {Record<string, unknown>} */ (collection);
      for (const key of [
        "mode",
        "trigger",
        "workflowRunId",
        "sourceWorkflow",
        "collectedAt",
      ]) {
        if (!(key in collectionRecord)) {
          errors.push(`collection.${key} is required for schemaVersion 1.2`);
        }
      }
    }
  }
  if (!Array.isArray(record.warnings)) {
    errors.push("warnings must be an array");
  }
  if (!Array.isArray(record.metadataWarnings)) {
    errors.push("metadataWarnings must be an array");
  }
  if (!Array.isArray(record.recentRuns)) {
    errors.push("recentRuns must be an array");
  }
  if (!record.trendObservation || typeof record.trendObservation !== "object") {
    errors.push("trendObservation must be an object");
  }
  const summary = record.summary;
  if (!summary || typeof summary !== "object") {
    errors.push("summary must be an object");
  } else {
    const summaryRecord = /** @type {Record<string, unknown>} */ (summary);
    if (!("metadataWarningCount" in summaryRecord)) {
      errors.push("summary.metadataWarningCount is required");
    }
    if (!("skippedExpiredArtifacts" in summaryRecord)) {
      errors.push("summary.skippedExpiredArtifacts is required");
    }
  }
  return errors;
}

/**
 * @param {string} runDir
 * @returns {Array<Record<string, unknown>> | null}
 */
export function loadFixtureArtifacts(runDir) {
  const artifactsPath = path.join(runDir, FIXTURE_ARTIFACTS_FILENAME);
  if (!fs.existsSync(artifactsPath)) {
    return null;
  }
  return parseFixtureArtifacts(JSON.parse(fs.readFileSync(artifactsPath, "utf8")));
}

/**
 * @param {object} params
 * @param {string} params.runId
 * @param {string} params.runDirName
 * @param {Array<Record<string, unknown>> | null} [params.fixtureArtifacts]
 * @param {typeof execSync} [params.execSyncImpl]
 * @param {string} [params.repo]
 * @param {NodeJS.ProcessEnv} [params.ghEnv]
 * @returns {{
 *   artifact: Record<string, unknown> | null,
 *   skip: boolean,
 *   warnings: Array<{ runId?: string, message: string, kind?: string }>,
 *   metadataWarnings: Array<{ runId?: string, message: string, kind?: string }>,
 * }}
 */
export function resolveRunArtifactMetadata(params) {
  /** @type {Array<{ runId?: string, message: string, kind?: string }>} */
  const warnings = [];
  /** @type {Array<{ runId?: string, message: string, kind?: string }>} */
  const metadataWarnings = [];

  if (params.fixtureArtifacts) {
    const rawArtifact = selectPerformanceArtifact(params.fixtureArtifacts);
    return evaluateArtifactMetadata({
      rawArtifact,
      runId: params.runId,
    });
  }

  const fetched = fetchRunArtifactsFromApi({
    runId: params.runId,
    repo: params.repo,
    execSyncImpl: params.execSyncImpl,
    env: params.ghEnv,
  });

  if (fetched.error) {
    metadataWarnings.push({
      runId: params.runId,
      kind: "artifact-metadata-fetch-failed",
      message: `artifact metadata fetch failed — continuing with gh run download (${fetched.error})`,
    });
    return { artifact: null, skip: false, warnings, metadataWarnings };
  }

  const rawArtifact = selectPerformanceArtifact(fetched.artifacts);
  const evaluated = evaluateArtifactMetadata({
    rawArtifact,
    runId: params.runId,
  });
  return {
    artifact: evaluated.artifact,
    skip: evaluated.skip,
    warnings: [...warnings, ...evaluated.warnings],
    metadataWarnings: [...metadataWarnings, ...evaluated.metadataWarnings],
  };
}

/**
 * @param {string} fixtureDir
 * @returns {{
 *   observations: Array<Record<string, unknown>>,
 *   warnings: Array<{ runId?: string, message: string, kind?: string }>,
 *   metadataWarnings: Array<{ runId?: string, message: string, kind?: string }>,
 *   runsRequested: number,
 * }}
 */
export function collectFromFixtureDir(fixtureDir) {
  /** @type {Array<Record<string, unknown>>} */
  const observations = [];
  /** @type {Array<{ runId?: string, message: string, kind?: string }>} */
  const warnings = [];
  /** @type {Array<{ runId?: string, message: string, kind?: string }>} */
  const metadataWarnings = [];
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
    const runDir = path.join(fixtureDir, runDirName);
    const runId = runDirName.replace(/^run-/, "");
    const fixtureArtifacts = loadFixtureArtifacts(runDir);
    const artifactMeta = resolveRunArtifactMetadata({
      runId,
      runDirName,
      fixtureArtifacts,
    });
    warnings.push(...artifactMeta.warnings);
    metadataWarnings.push(...artifactMeta.metadataWarnings);

    if (artifactMeta.skip) {
      continue;
    }

    const observationPath = path.join(runDir, OBSERVATION_FILENAME);
    if (!fs.existsSync(observationPath)) {
      warnings.push({
        runId,
        message: `${OBSERVATION_FILENAME} not found — skipped`,
      });
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
      continue;
    }

    if (!isValidObservation(parsed)) {
      warnings.push({
        runId,
        message: `invalid observation schema — skipped`,
      });
      continue;
    }

    const observation = /** @type {Record<string, unknown>} */ (parsed);
    if (artifactMeta.artifact) {
      observation.artifact = artifactMeta.artifact;
    }
    observations.push(observation);
  }

  return { observations, warnings, metadataWarnings, runsRequested };
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
 * @param {NodeJS.ProcessEnv} [params.ghEnv]
 * @param {boolean} [params.skipAuthCheck]
 * @returns {{
 *   observations: Array<Record<string, unknown>>,
 *   warnings: Array<{ runId?: string, message: string, kind?: string }>,
 *   metadataWarnings: Array<{ runId?: string, message: string, kind?: string }>,
 *   runsRequested: number,
 * }}
 */
export function collectFromGhCli(params = {}) {
  const execSyncImpl = params.execSyncImpl ?? execSync;
  const limit = params.limit ?? 10;
  const workflows = params.workflows ?? DEFAULT_WORKFLOWS;
  const repoFlag = params.repo ? `--repo ${params.repo}` : "";
  const execEnv = params.ghEnv ?? process.env;
  const execOptions = { encoding: "utf8", stdio: "pipe", env: execEnv };

  if (!params.skipAuthCheck) {
    try {
      execSyncImpl("gh auth status", execOptions);
    } catch {
      throw new Error("gh auth status failed — authenticate with `gh auth login` first");
    }
  }

  /** @type {Array<Record<string, unknown>>} */
  const observations = [];
  /** @type {Array<{ runId?: string, message: string, kind?: string }>} */
  const warnings = [];
  /** @type {Array<{ runId?: string, message: string, kind?: string }>} */
  const metadataWarnings = [];
  let runsRequested = 0;

  for (const workflow of workflows) {
    const listCmd =
      `gh run list ${repoFlag} --workflow "${workflow}" --limit ${limit} ` +
      `--json databaseId,workflowName,conclusion,createdAt,displayTitle`.trim();
    const runs = JSON.parse(execSyncImpl(listCmd, execOptions));

    for (const run of runs) {
      runsRequested += 1;
      const runId = String(run.databaseId);
      const artifactMeta = resolveRunArtifactMetadata({
        runId,
        runDirName: runId,
        execSyncImpl,
        repo: params.repo,
        ghEnv: execEnv,
      });
      warnings.push(...artifactMeta.warnings);
      metadataWarnings.push(...artifactMeta.metadataWarnings);

      if (artifactMeta.skip) {
        continue;
      }

      const tempDir = path.join(
        "reports",
        "performance-trend",
        ".tmp",
        `run-${runId}`,
      );
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        execSyncImpl(`gh run download ${runId} ${repoFlag} -D "${tempDir}"`, execOptions);
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

      const observation = /** @type {Record<string, unknown>} */ (parsed);
      if (artifactMeta.artifact) {
        observation.artifact = artifactMeta.artifact;
      }
      observations.push(observation);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  return { observations, warnings, metadataWarnings, runsRequested };
}

/**
 * @param {Record<string, unknown>} trendData
 * @returns {string}
 */
export function buildPerformanceTrendStepSummary(trendData) {
  const summary = /** @type {Record<string, number>} */ (trendData.summary ?? {});
  const collection = /** @type {Record<string, unknown>} */ (trendData.collection ?? {});
  const lines = [
    "## Performance Trend Analysis",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| Source | ${trendData.source ?? "unknown"} |`,
    `| Schema | ${trendData.schemaVersion ?? "unknown"} |`,
    `| Mode | ${collection.mode ?? "—"} |`,
    `| Trigger | ${collection.trigger ?? "—"} |`,
    `| Collector run ID | ${collection.workflowRunId ?? "—"} |`,
    `| Runs requested | ${summary.runsRequested ?? 0} |`,
    `| Runs analyzed | ${summary.runsAnalyzed ?? 0} |`,
    `| Runs skipped | ${summary.runsSkipped ?? 0} |`,
    `| Metadata warnings | ${summary.metadataWarningCount ?? 0} |`,
    `| Skipped expired artifacts | ${summary.skippedExpiredArtifacts ?? 0} |`,
    `| Generated at | ${trendData.generatedAt ?? ""} |`,
    "",
    "### Outputs",
    "",
    "- `reports/performance-trend/latest/trend-report.md`",
    "- `reports/performance-trend/latest/trend-data.json`",
    "",
  ];
  return `${lines.join("\n")}`;
}

/**
 * @param {Record<string, unknown>} trendData
 * @param {string} [summaryPath]
 * @returns {boolean}
 */
export function writePerformanceTrendStepSummary(
  trendData,
  summaryPath = process.env.GITHUB_STEP_SUMMARY,
) {
  if (!summaryPath) {
    return false;
  }
  fs.appendFileSync(summaryPath, buildPerformanceTrendStepSummary(trendData));
  return true;
}

/**
 * @param {object} params
 * @param {"fixture" | "gh-cli" | "github-actions"} params.source
 * @param {Array<Record<string, unknown>>} params.observations
 * @param {Array<{ runId?: string, message: string, kind?: string }>} params.warnings
 * @param {Array<{ runId?: string, message: string, kind?: string }>} [params.metadataWarnings]
 * @param {number} params.runsRequested
 * @param {Record<string, string | null>} [params.collection]
 * @param {string} [params.outputDir]
 * @param {boolean} [params.writeStepSummary]
 * @returns {{ trendData: Record<string, unknown>, reportPath: string, dataPath: string }}
 */
export function writeTrendOutputs(params) {
  const outputDir = params.outputDir ?? DEFAULT_OUTPUT_DIR;
  const trendData = buildTrendData({
    source: params.source,
    observations: params.observations,
    warnings: params.warnings,
    metadataWarnings: params.metadataWarnings,
    runsRequested: params.runsRequested,
    collection: params.collection,
  });
  const report = buildTrendReport(trendData);
  fs.mkdirSync(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, "trend-report.md");
  const dataPath = path.join(outputDir, "trend-data.json");
  fs.writeFileSync(reportPath, report);
  fs.writeFileSync(dataPath, `${JSON.stringify(trendData, null, 2)}\n`);
  if (params.writeStepSummary) {
    writePerformanceTrendStepSummary(trendData);
  }
  return { trendData, reportPath, dataPath };
}

/**
 * @param {object} [options]
 * @param {string} [options.fixtureDir]
 * @param {string} [options.outputDir]
 * @param {number} [options.limit]
 * @param {string} [options.repo]
 * @param {typeof execSync} [options.execSyncImpl]
 * @param {boolean} [options.githubActions]
 * @returns {{ trendData: Record<string, unknown>, reportPath: string, dataPath: string }}
 */
export function analyzePerformanceTrend(options = {}) {
  let source;
  let collected;
  /** @type {Record<string, string | null> | undefined} */
  let collection;
  /** @type {Array<{ runId?: string, message: string, kind?: string }>} */
  const envMetadataWarnings = [];

  const githubActionsMode =
    options.githubActions === true ||
    (options.githubActions !== false &&
      !options.fixtureDir &&
      process.env.GITHUB_ACTIONS === "true");

  if (options.fixtureDir) {
    source = "fixture";
    collected = collectFromFixtureDir(options.fixtureDir);
  } else if (githubActionsMode) {
    const envValidation = validateGitHubActionsEnv(process.env);
    if (!envValidation.valid) {
      throw new Error(
        `GitHub Actions environment invalid: ${envValidation.errors.join(", ")}`,
      );
    }
    for (const warning of envValidation.warnings) {
      envMetadataWarnings.push({
        kind: warning.kind,
        message: warning.message,
      });
    }

    const authContext = resolveGhAuthContext(process.env);
    source = "github-actions";
    collection = buildCollectionMetadata(process.env);
    collected = collectFromGhCli({
      execSyncImpl: options.execSyncImpl,
      limit: options.limit,
      repo: options.repo ?? authContext.repo ?? undefined,
      ghEnv: authContext.ghEnv,
      skipAuthCheck: Boolean(authContext.ghToken),
    });
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
    metadataWarnings: [...envMetadataWarnings, ...collected.metadataWarnings],
    runsRequested: collected.runsRequested,
    collection,
    outputDir: options.outputDir,
    writeStepSummary: githubActionsMode,
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
    } else if (token === "--github-actions") {
      args.githubActions = true;
    } else if (token === "--no-github-actions") {
      args.githubActions = false;
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
  --github-actions       Force GitHub Actions mode (schema 1.2 + Step Summary)
  --no-github-actions    Disable auto GitHub Actions detection
  --help                 Show this help

GitHub Actions flow:
  1. Set GH_TOKEN (github.token) with actions: read
  2. gh run list / gh api artifacts / gh run download
  3. Write trend outputs + GITHUB_STEP_SUMMARY

Production flow (gh CLI):
  1. gh auth status
  2. gh run list --json ...
  3. gh api repos/{owner}/{repo}/actions/runs/{run_id}/artifacts --paginate
  4. gh run download <run-id>
  5. Parse performance-observation.json from artifacts

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
      githubActions: args.githubActions === true ? true : args.githubActions === false ? false : undefined,
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
