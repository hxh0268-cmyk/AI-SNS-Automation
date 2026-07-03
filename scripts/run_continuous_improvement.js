#!/usr/bin/env node

import {
  buildContinuousImprovementPipeline,
  printContinuousImprovementSummary,
} from "../src/lib/continuous_improvement.js";

function main() {
  const { improvement, paths } = buildContinuousImprovementPipeline(null, {
    rootDir: process.cwd(),
  });

  console.log(printContinuousImprovementSummary(improvement));
  console.log(`[Continuous Improvement] json: ${paths.json}`);
  console.log(`[Continuous Improvement] markdown: ${paths.markdown}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Continuous Improvement] failed: ${message}`);
  process.exitCode = 1;
}
