#!/usr/bin/env node

import {
  buildDeveloperAutomationWorkflowCliSummary,
  runDeveloperWorkflow,
  writeDeveloperAutomationReport,
  WORKFLOW_STATUS,
} from "../src/lib/developer_workflow.js";
import {
  buildWorkflowResumeReport,
  buildWorkflowResumeCliSummary,
  buildWorkflowState,
  prepareResumeWorkflow,
  runDeveloperWorkflowResume,
  writeWorkflowResumeReport,
  writeWorkflowState,
} from "../src/lib/developer_workflow_resume.js";

export function parseArgs(argv) {
  const options = {
    skipNpmTest: argv.includes("--skip-npm-test"),
    dryRun: !argv.includes("--no-dry-run"),
    failFast: argv.includes("--fail-fast"),
    stopBeforeStep: null,
    skipSteps: [],
    resume: argv.includes("--resume"),
    resumeStatePath: null,
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
      continue;
    }

    if (arg === "--resume-state" && argv[index + 1]) {
      options.resumeStatePath = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--resume-state=")) {
      options.resumeStatePath = arg.slice("--resume-state=".length);
    }
  }

  return options;
}

function main() {
  const cliOptions = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();

  if (cliOptions.resume) {
    const prepared = prepareResumeWorkflow({
      rootDir,
      skipNpmTest: cliOptions.skipNpmTest,
      resumeStatePath: cliOptions.resumeStatePath,
      options: {
        dryRun: cliOptions.dryRun,
        failFast: cliOptions.failFast,
        skipSteps: cliOptions.skipSteps,
      },
    });

    if (!prepared.validation.valid) {
      const failedReport = buildWorkflowResumeReport({
        status: "validation-failed",
        validationErrors: prepared.validation.errors,
        generatedAt: new Date().toISOString(),
      });
      const resumeOutputs = writeWorkflowResumeReport(failedReport, rootDir);

      console.log(buildWorkflowResumeCliSummary(failedReport));
      console.log(`[DeveloperWorkflow] resume json: ${resumeOutputs.json}`);
      console.log(`[DeveloperWorkflow] resume markdown: ${resumeOutputs.markdown}`);
      process.exitCode = 1;
      return;
    }

    const resumeResult = runDeveloperWorkflowResume({
      rootDir,
      skipNpmTest: cliOptions.skipNpmTest,
      resumeStatePath: cliOptions.resumeStatePath,
      options: {
        dryRun: cliOptions.dryRun,
        failFast: cliOptions.failFast,
        skipSteps: cliOptions.skipSteps,
      },
    });
    const resumeReport = buildWorkflowResumeReport({
      status: "resumed",
      resumeFromStepId: resumeResult.resumeFromStepId,
      completedStepIds: resumeResult.state.completedStepIds ?? [],
      workflowStatus: resumeResult.context.status,
      generatedAt: resumeResult.context.generatedAt,
    });
    const resumeOutputs = writeWorkflowResumeReport(resumeReport, rootDir);
    const outputs = writeDeveloperAutomationReport(resumeResult.context);

    console.log(buildDeveloperAutomationWorkflowCliSummary(resumeResult.context));
    console.log("");
    console.log(buildWorkflowResumeCliSummary(resumeReport));
    console.log(`[DeveloperWorkflow] json: ${outputs.json}`);
    console.log(`[DeveloperWorkflow] markdown: ${outputs.markdown}`);
    console.log(`[DeveloperWorkflow] resume json: ${resumeOutputs.json}`);
    console.log(`[DeveloperWorkflow] resume markdown: ${resumeOutputs.markdown}`);

    process.exitCode =
      resumeResult.context.status === WORKFLOW_STATUS.SUCCESS ? 0 : 1;
    return;
  }

  const context = runDeveloperWorkflow({
    rootDir,
    skipNpmTest: cliOptions.skipNpmTest,
    options: {
      dryRun: cliOptions.dryRun,
      failFast: cliOptions.failFast,
      stopBeforeStep: cliOptions.stopBeforeStep,
      skipSteps: cliOptions.skipSteps,
    },
  });
  const outputs = writeDeveloperAutomationReport(context);

  if (context.status === WORKFLOW_STATUS.STOPPED) {
    const statePath = writeWorkflowState(buildWorkflowState(context), rootDir);
    console.log(`[DeveloperWorkflow] state: ${statePath}`);
  }

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
