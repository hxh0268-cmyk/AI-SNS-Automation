#!/usr/bin/env node

import { buildAIIdeaPipeline, buildAIIdeaSummary } from "../src/lib/content_ai_idea.js";

function main() {
  const { output, paths } = buildAIIdeaPipeline(null, {
    rootDir: process.cwd(),
  });

  console.log(buildAIIdeaSummary(output));
  console.log(`[ContentAIIdeas] json: ${paths.json}`);
  console.log(`[ContentAIIdeas] markdown: ${paths.markdown}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ContentAIIdeas] failed: ${message}`);
  process.exitCode = 1;
}
