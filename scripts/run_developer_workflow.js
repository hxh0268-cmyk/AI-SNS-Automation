#!/usr/bin/env node

import {
  buildDeveloperAutomationWorkflowCliSummary,
  runDeveloperWorkflow,
  writeDeveloperAutomationReport,
  WORKFLOW_STATUS,
} from "../src/lib/developer_workflow.js";

function parseArgs(argv) {
  const options = {
    skipNpmTest: argv.includes("--skip-npm-test"),
    dryRun: !argv.includes("--no-dry-run"),
    failFast: argv.includes("--fail-fast"),
    stopBeforeStep: null,
    skipSteps: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--stop-before-step" && argv[index + 1]) {
      options.stopBeforeStep = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--stop-before-step=")) {
      options.stopBeforeStep = arg.slice("--stop-before-step=".length);
      continue;
    }

    if (arg === "--skip-step" && argv[index + 1]) {
      options.skipSteps.push(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--skip-step=")) {
      options.skipSteps.push(arg.slice("--skip-step=".length));
    }
  }

  return options;
}

function main() {
  const cliOptions = parseArgs(process.argv.slice(2));
  const context = runDeveloperWorkflow({
    skipNpmTest: cliOptions.skipNpmTest,
    options: {
      dryRun: cliOptions.dryRun,
      failFast: cliOptions.failFast,
      stopBeforeStep: cliOptions.stopBeforeStep,
      skipSteps: cliOptions.skipSteps,
    },
  });
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
