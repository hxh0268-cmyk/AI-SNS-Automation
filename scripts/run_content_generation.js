#!/usr/bin/env node

import {
  buildContentGenerationPipeline,
  buildContentGenerationSummary,
} from "../src/lib/content_generation.js";

function main() {
  const { output, paths } = buildContentGenerationPipeline(null, {
    rootDir: process.cwd(),
  });

  console.log(buildContentGenerationSummary(output));
  console.log(`[ContentGeneration] json: ${paths.json}`);
  console.log(`[ContentGeneration] markdown: ${paths.markdown}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ContentGeneration] failed: ${message}`);
  process.exitCode = 1;
}
