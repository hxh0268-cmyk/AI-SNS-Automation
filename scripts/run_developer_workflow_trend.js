#!/usr/bin/env node

import {
  buildWorkflowTrendCliSummary,
  buildWorkflowTrendFromDashboard,
} from "../src/lib/developer_workflow_trend.js";

function main() {
  const rootDir = process.cwd();
  const { trend, outputs } = buildWorkflowTrendFromDashboard({ rootDir });

  console.log(buildWorkflowTrendCliSummary(trend));
  console.log(`[WorkflowTrend] json: ${outputs.json}`);
  console.log(`[WorkflowTrend] markdown: ${outputs.markdown}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[WorkflowTrend] failed: ${message}`);
  process.exitCode = 1;
}
