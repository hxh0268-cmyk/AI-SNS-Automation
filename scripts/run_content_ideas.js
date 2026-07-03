#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  buildContentIdeas,
  buildContentIdeasSummary,
  normalizeContentIdeas,
  parseContentIdeaInputs,
  renderContentIdeasMarkdown,
  validateContentIdeas,
} from "../src/lib/content_idea.js";

const OUTPUT_DIR = "output/content-ideas";
const JSON_FILENAME = "content-ideas.json";
const MD_FILENAME = "content-ideas.md";

function main() {
  const rootDir = process.cwd();
  const inputs = parseContentIdeaInputs(null);
  const built = buildContentIdeas(inputs);
  const normalized = normalizeContentIdeas(built);
  const validation = validateContentIdeas(normalized);

  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const outputDir = path.join(rootDir, OUTPUT_DIR);
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, JSON_FILENAME);
  const markdownPath = path.join(outputDir, MD_FILENAME);

  fs.writeFileSync(jsonPath, `${JSON.stringify(normalized, null, 2)}\n`);
  fs.writeFileSync(
    markdownPath,
    `${renderContentIdeasMarkdown(normalized)}\n`,
  );

  console.log(buildContentIdeasSummary(normalized));
  console.log(`[ContentIdeas] json: ${OUTPUT_DIR}/${JSON_FILENAME}`);
  console.log(`[ContentIdeas] markdown: ${OUTPUT_DIR}/${MD_FILENAME}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ContentIdeas] failed: ${message}`);
  process.exitCode = 1;
}
