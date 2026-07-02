#!/usr/bin/env node

import {
  buildWorkflowCheckpointReport,
  buildWorkflowCheckpointCliSummary,
  validateWorkflowCheckpoint,
  writeWorkflowCheckpointReport,
} from "../src/lib/developer_workflow_checkpoint.js";
import {
  buildDeveloperAutomationWorkflowCliSummary,
  runDeveloperWorkflow,
  writeDeveloperAutomationReport,
  WORKFLOW_STATUS,
  WORKFLOW_STEP_REGISTRY,
} from "../src/lib/developer_workflow.js";
import {
  buildWorkflowHistoryCliSummary,
  recordWorkflowHistoryRun,
} from "../src/lib/developer_workflow_history.js";
import {
  buildWorkflowTimelineCliSummary,
  buildWorkflowTimelineFromHistory,
} from "../src/lib/developer_workflow_timeline.js";
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

function writeCheckpointOutputs(state, rootDir) {
  const checkpointValidation = validateWorkflowCheckpoint({
    state,
    stepRegistry: WORKFLOW_STEP_REGISTRY,
  });
  const checkpointReport = buildWorkflowCheckpointReport(
    checkpointValidation,
    state,
  );
  const checkpointOutputs = writeWorkflowCheckpointReport(checkpointReport, rootDir);

  return { checkpointValidation, checkpointReport, checkpointOutputs };
}

function writeHistoryOutputs(context, rootDir, options = {}) {
  const { history, outputs } = recordWorkflowHistoryRun({
    rootDir,
    context,
    state: options.state ?? null,
    checkpointPath: options.checkpointPath ?? null,
    statePath: options.statePath ?? null,
  });

  console.log(buildWorkflowHistoryCliSummary(history));
  console.log(`[DeveloperWorkflow] history json: ${outputs.json}`);
  console.log(`[DeveloperWorkflow] history markdown: ${outputs.markdown}`);
  console.log("");

  return { history, outputs };
}

function writeTimelineOutputs(rootDir) {
  try {
    const { timeline, outputs } = buildWorkflowTimelineFromHistory({ rootDir });

    console.log(buildWorkflowTimelineCliSummary(timeline));
    console.log(`[DeveloperWorkflow] timeline json: ${outputs.json}`);
    console.log(`[DeveloperWorkflow] timeline markdown: ${outputs.markdown}`);
    console.log("");

    return { timeline, outputs };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[DeveloperWorkflow] timeline skipped: ${message}`);
    return null;
  }
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

    if (prepared.state) {
      const { checkpointReport, checkpointOutputs } = writeCheckpointOutputs(
        prepared.state,
        rootDir,
      );
      console.log(buildWorkflowCheckpointCliSummary(checkpointReport));
      console.log(`[DeveloperWorkflow] checkpoint json: ${checkpointOutputs.json}`);
      console.log(`[DeveloperWorkflow] checkpoint markdown: ${checkpointOutputs.markdown}`);
      console.log("");
    }

    if (!prepared.validation.valid) {
      const failedReport = buildWorkflowResumeReport({
        status: "validation-failed",
        validationErrors: prepared.validation.errors,
        validationWarnings: prepared.validation.warnings,
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
      validationWarnings: resumeResult.validation.warnings,
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
    console.log("");

    writeHistoryOutputs(resumeResult.context, rootDir, {
      state: resumeResult.state,
    });
    writeTimelineOutputs(rootDir);

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

  let workflowState = null;
  let statePath = null;
  let checkpointPath = null;

  if (context.status === WORKFLOW_STATUS.STOPPED) {
    workflowState = buildWorkflowState(context);
    statePath = writeWorkflowState(workflowState, rootDir);
    const { checkpointReport, checkpointOutputs } = writeCheckpointOutputs(
      workflowState,
      rootDir,
    );

    checkpointPath = checkpointOutputs.json;

    console.log(buildWorkflowCheckpointCliSummary(checkpointReport));
    console.log(`[DeveloperWorkflow] state: ${statePath}`);
    console.log(`[DeveloperWorkflow] checkpoint json: ${checkpointOutputs.json}`);
    console.log(
      `[DeveloperWorkflow] checkpoint markdown: ${checkpointOutputs.markdown}`,
    );
    console.log("");
  }

  console.log(buildDeveloperAutomationWorkflowCliSummary(context));
  console.log(`[DeveloperWorkflow] json: ${outputs.json}`);
  console.log(`[DeveloperWorkflow] markdown: ${outputs.markdown}`);
  console.log("");

  writeHistoryOutputs(context, rootDir, {
    state: workflowState,
    checkpointPath,
    statePath,
  });
  writeTimelineOutputs(rootDir);

  process.exitCode = context.status === WORKFLOW_STATUS.SUCCESS ? 0 : 1;
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[DeveloperWorkflow] failed: ${message}`);
  process.exitCode = 1;
}
