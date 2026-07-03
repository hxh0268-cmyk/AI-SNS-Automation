#!/usr/bin/env node

import {
  buildImageGenerationPipeline,
  buildImageGenerationSummary,
} from "../src/lib/image_generation.js";

function main() {
  const { output, paths } = buildImageGenerationPipeline(null, {
    rootDir: process.cwd(),
  });

  console.log(buildImageGenerationSummary(output));
  console.log(`[ImageGeneration] json: ${paths.json}`);
  console.log(`[ImageGeneration] markdown: ${paths.markdown}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ImageGeneration] failed: ${message}`);
  process.exitCode = 1;
}
