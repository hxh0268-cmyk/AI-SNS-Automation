#!/usr/bin/env node

import {
  buildPublishingCliSummary,
  buildPublishingPipeline,
} from "../src/lib/publishing.js";

function main() {
  const { output, paths } = buildPublishingPipeline(null, {
    rootDir: process.cwd(),
  });

  console.log(buildPublishingCliSummary(output));
  console.log(`[Publishing] json: ${paths.json}`);
  console.log(`[Publishing] markdown: ${paths.markdown}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Publishing] failed: ${message}`);
  process.exitCode = 1;
}
