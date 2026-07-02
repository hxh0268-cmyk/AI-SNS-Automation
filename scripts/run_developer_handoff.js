#!/usr/bin/env node

import {
  buildDeveloperHandoff,
  buildDeveloperHandoffCliSummary,
  parseDeveloperHandoffArgs,
  writeDeveloperHandoffReport,
} from "../src/lib/developer_handoff.js";

function main() {
  const cliOptions = parseDeveloperHandoffArgs(process.argv.slice(2));
  const handoff = buildDeveloperHandoff({
    nextVersion: cliOptions.nextVersion,
  });
  const outputs = writeDeveloperHandoffReport(handoff);

  console.log(buildDeveloperHandoffCliSummary(handoff));
  console.log(`[DeveloperHandoff] json: ${outputs.json}`);
  console.log(`[DeveloperHandoff] markdown: ${outputs.markdown}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[DeveloperHandoff] failed: ${message}`);
  process.exitCode = 1;
}
