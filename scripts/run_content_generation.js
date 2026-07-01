#!/usr/bin/env node

import {
  buildContentIdeasData,
  readContentIdeasPrompt,
  writeContentGenerationOutputs
} from "../src/lib/content_generation.js";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");

function main() {
  if (!isDryRun) {
    throw new Error("Only --dry-run mode is supported in v1.25.0.");
  }

  const prompt = readContentIdeasPrompt();
  const data = buildContentIdeasData({ prompt });
  const outputs = writeContentGenerationOutputs(data);

  console.log("[ContentGeneration] dry-run complete");
  console.log(`[ContentGeneration] ideas: ${data.ideas.length}`);
  console.log(`[ContentGeneration] output: ${outputs.outputMarkdown}`);
  console.log(`[ContentGeneration] report: ${outputs.reportMarkdown}`);
}

try {
  main();
} catch (error) {
  console.error(`[ContentGeneration] failed: ${error.message}`);
  process.exit(1);
}
