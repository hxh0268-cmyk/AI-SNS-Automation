#!/usr/bin/env node

import crypto from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const OUTPUT_PATH = path.join(
  "reports",
  "quality-pipeline",
  "latest",
  "performance-observation.json",
);

/**
 * @param {string | undefined} filePath
 * @returns {Array<{ step: string, durationSeconds: number, status: string }>}
 */
export function readStepTimings(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return [];
  }

  return fs
    .readFileSync(filePath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [step, durationSeconds, status] = line.split("|");
      return {
        step,
        durationSeconds: Number(durationSeconds),
        status,
      };
    });
}

/**
 * @param {Array<{ step: string, durationSeconds: number }>} timings
 * @param {string} stepName
 * @returns {number | null}
 */
export function durationFromTimings(timings, stepName) {
  const row = timings.find((entry) => entry.step === stepName);
  if (!row || !Number.isFinite(row.durationSeconds)) {
    return null;
  }
  return row.durationSeconds;
}

/**
 * @param {string | undefined} value
 * @returns {number | null}
 */
export function parsePipelineExitCode(value) {
  if (value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * @param {number | null} pipelineExitCode
 * @returns {string | null}
 */
function resolveQualityStatus(pipelineExitCode) {
  if (pipelineExitCode === null) {
    return null;
  }
  if (pipelineExitCode === 0) {
    return "Publish Recommended";
  }
  if (pipelineExitCode === 3) {
    return "Improvement Recommended";
  }
  return "Failed / Error";
}

/**
 * @returns {string | null}
 */
function readPackageLockHash() {
  const lockPath = "package-lock.json";
  if (!fs.existsSync(lockPath)) {
    return null;
  }
  return crypto.createHash("sha256").update(fs.readFileSync(lockPath)).digest("hex");
}

function readNpmVersion() {
  try {
    return execSync("npm -v", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

export function buildObservation() {
  const variant = process.env.PO_VARIANT ?? "ci";
  const stepTimings = readStepTimings(process.env.PO_TIMING_FILE);
  const pipelineExitCode =
    variant === "nightly"
      ? parsePipelineExitCode(process.env.PIPELINE_EXIT_CODE)
      : undefined;

  const observation = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    workflow: {
      name: process.env.GHA_WORKFLOW_NAME ?? "",
      runId: process.env.GHA_RUN_ID ?? "",
      jobResult: process.env.JOB_STATUS ?? "",
    },
    runtime: {
      nodeVersion: process.version,
      npmVersion: readNpmVersion(),
    },
    cache: {
      enabled: true,
      provider: "setup-node",
      dependencyPath: "package-lock.json",
      packageLockHash: readPackageLockHash(),
    },
    durations: {},
    stepTimings,
  };

  if (variant === "ci") {
    observation.durations = {
      npmCiSeconds: durationFromTimings(stepTimings, "npm ci"),
      npmTestSeconds: durationFromTimings(stepTimings, "npm test"),
      dryRunStopBeforePhaseSeconds: durationFromTimings(
        stepTimings,
        "quality-pipeline dry-run (stop-before-phase)",
      ),
      dryRunResumeSeconds: durationFromTimings(
        stepTimings,
        "quality-pipeline dry-run (resume)",
      ),
    };
  } else {
    observation.workflow.pipelineExitCode = pipelineExitCode;
    observation.workflow.qualityStatus = resolveQualityStatus(pipelineExitCode);
    observation.durations = {
      npmCiSeconds: durationFromTimings(stepTimings, "npm ci"),
      applySeconds: durationFromTimings(stepTimings, "quality-pipeline apply"),
    };
  }

  return observation;
}

function main() {
  const observation = buildObservation();
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(observation, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main();
