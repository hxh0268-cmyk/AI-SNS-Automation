#!/usr/bin/env node

import {
  buildAnalyticsPipeline,
  printAnalyticsSummary,
} from "../src/lib/analytics.js";

function main() {
  const { analytics, paths } = buildAnalyticsPipeline(null, {
    rootDir: process.cwd(),
  });

  console.log(printAnalyticsSummary(analytics));
  console.log(`[Analytics] json: ${paths.json}`);
  console.log(`[Analytics] markdown: ${paths.markdown}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Analytics] failed: ${message}`);
  process.exitCode = 1;
}
