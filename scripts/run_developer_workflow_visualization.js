#!/usr/bin/env node

import {
  generateWorkflowVisualizationReport,
  renderVisualizationSummary,
} from "../src/lib/developer_workflow_visualization.js";

function main() {
  const rootDir = process.cwd();
  const { visualization, outputs } = generateWorkflowVisualizationReport({
    rootDir,
  });

  console.log(renderVisualizationSummary(visualization));
  console.log(`[WorkflowVisualization] json: ${outputs.json}`);
  console.log(`[WorkflowVisualization] markdown: ${outputs.markdown}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[WorkflowVisualization] failed: ${message}`);
  process.exitCode = 1;
}
