#!/usr/bin/env node

import {
  buildWorkflowHistoryAnalyticsCliSummary,
  buildWorkflowHistoryAnalyticsFromReports,
} from "../src/lib/developer_workflow_history_analytics.js";

function main() {
  const rootDir = process.cwd();
  const { analytics, outputs } = buildWorkflowHistoryAnalyticsFromReports({
    rootDir,
  });

  console.log(buildWorkflowHistoryAnalyticsCliSummary(analytics));
  console.log(`[WorkflowHistoryAnalytics] json: ${outputs.json}`);
  console.log(`[WorkflowHistoryAnalytics] markdown: ${outputs.markdown}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[WorkflowHistoryAnalytics] failed: ${message}`);
  process.exitCode = 1;
}
