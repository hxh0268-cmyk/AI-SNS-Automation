#!/usr/bin/env node

import {
  buildDevNextPlan,
  buildVersionConsistencyReport,
  parseArgs,
  writeDevNextReport,
  writeVersionConsistencyReport,
} from "../src/lib/developer_automation.js";

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.dryRun) {
    throw new Error("Only --dry-run mode is supported for dev:next MVP.");
  }

  const plan = buildDevNextPlan();
  const outputs = writeDevNextReport(plan);

  const versionConsistency = buildVersionConsistencyReport();
  const consistencyOutputs = writeVersionConsistencyReport(versionConsistency);

  console.log(
    versionConsistency.status === "ok" ? "Version Check OK" : "Version Check WARNING",
  );
  console.log("[DevNext] dry-run complete");
  console.log(`[DevNext] current version: ${plan.currentVersion}`);
  console.log(
    `[DevNext] recommended next: ${plan.recommendedNext.version} ${plan.recommendedNext.title}`,
  );
  console.log(`[DevNext] report: ${outputs.markdown}`);
  console.log(`[DevNext] version consistency: ${consistencyOutputs.markdown}`);
}

try {
  main();
} catch (error) {
  console.error(`[DevNext] failed: ${error.message}`);
  process.exit(1);
}
