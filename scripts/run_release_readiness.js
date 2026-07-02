#!/usr/bin/env node

import {
  buildReleaseReadinessCliSummary,
  evaluateReleaseReadiness,
  writeReleaseReadinessReport,
} from "../src/lib/release_readiness.js";

function parseArgs(argv) {
  return {
    skipNpmTest: argv.includes("--skip-npm-test"),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = evaluateReleaseReadiness({ skipNpmTest: options.skipNpmTest });
  const outputs = writeReleaseReadinessReport(report);

  console.log(buildReleaseReadinessCliSummary(report));
  console.log(`[ReleaseReadiness] json: ${outputs.json}`);
  console.log(`[ReleaseReadiness] markdown: ${outputs.markdown}`);

  process.exitCode = report.status === "ready" ? 0 : 1;
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ReleaseReadiness] failed: ${message}`);
  process.exitCode = 1;
}
