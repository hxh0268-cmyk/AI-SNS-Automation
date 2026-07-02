#!/usr/bin/env node

import {
  buildDeveloperAutomationWorkflowCliSummary,
  runDeveloperWorkflow,
  writeDeveloperAutomationReport,
  WORKFLOW_STATUS,
} from "../src/lib/developer_workflow.js";

function parseArgs(argv) {
  return {
    skipNpmTest: argv.includes("--skip-npm-test"),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const context = runDeveloperWorkflow({ skipNpmTest: options.skipNpmTest });
  const outputs = writeDeveloperAutomationReport(context);

  console.log(buildDeveloperAutomationWorkflowCliSummary(context));
  console.log(`[DeveloperWorkflow] json: ${outputs.json}`);
  console.log(`[DeveloperWorkflow] markdown: ${outputs.markdown}`);

  process.exitCode = context.status === WORKFLOW_STATUS.SUCCESS ? 0 : 1;
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[DeveloperWorkflow] failed: ${message}`);
  process.exitCode = 1;
}
