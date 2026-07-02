#!/usr/bin/env node

import {
  buildReleasePlan,
  buildReleasePlanCliSummary,
  writeReleasePlanReport,
} from "../src/lib/release_plan.js";

function main() {
  const plan = buildReleasePlan();
  const outputs = writeReleasePlanReport(plan);

  console.log(buildReleasePlanCliSummary(plan));
  console.log(`[ReleasePlan] json: ${outputs.json}`);
  console.log(`[ReleasePlan] markdown: ${outputs.markdown}`);

  process.exitCode = plan.status === "ready" ? 0 : 1;
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ReleasePlan] failed: ${message}`);
  process.exitCode = 1;
}
