#!/usr/bin/env node

import {
  describeExitCode,
  getErrorExitCode,
} from "../src/lib/exit_codes.js";
import {
  createPipelineConfig,
  getPipelineHelpText,
  parsePipelineArgs,
} from "../src/lib/pipeline_config.js";
import { mergeHooks, NOOP_HOOKS } from "../src/lib/pipeline_hooks.js";
import { buildPipelineReport } from "../src/lib/pipeline_report.js";
import { runPipeline } from "../src/lib/quality_pipeline.js";

/**
 * 実行サマリーを表示する
 * @param {object} params
 */
function printRunSummary(params) {
  const { config, result } = params;
  const { scoreSummary } = result.state;

  console.log("");
  console.log("[QualityPipeline] Summary");
  console.log(`  mode: ${config.dryRun ? "dry-run" : "apply"}`);
  if (config.resume) {
    console.log("  resume: enabled (state.json checkpoint)");
  }
  console.log(`  regeneration adapter: ${config.regenerationAdapter ?? "nano_banana"}`);
  if (config.cleanLatest) {
    console.log("  workspace: --clean-latest（latest を実行前に削除）");
  } else if (result.state.workspace?.action === "resumed") {
    console.log("  workspace: --resume（latest を archive せず再開）");
  } else if (result.state.workspace?.action === "archived") {
    console.log(`  workspace: archived → ${result.state.workspace.archivePath}`);
  }
  console.log(`  status: ${result.state.status}`);
  console.log(`  final phase: ${result.state.phase}`);
  console.log(`  completed steps: ${result.state.completedSteps.length}`);
  console.log(`  failed steps: ${result.state.failedSteps.length}`);

  if (
    scoreSummary.averageScore !== null &&
    scoreSummary.minScore !== null &&
    scoreSummary.slides.length > 0
  ) {
    console.log(
      `  score: avg=${scoreSummary.averageScore}, min=${scoreSummary.minScore}, passed=${scoreSummary.allSlidesPassed}, publishRecommended=${scoreSummary.allSlidesPublishRecommended}`,
    );
  } else if (!config.dryRun) {
    console.log("  score: (not loaded)");
  }

  if (result.state.improvement?.roundsExecuted > 0) {
    const imp = result.state.improvement;
    console.log(
      `  improvement: rounds=${imp.roundsExecuted}/${imp.maxRounds}, lastTargets=${imp.lastPlan?.totalTargets ?? 0}`,
    );
    if (imp.stopReason) {
      console.log(`  improvement stop: ${imp.stopReason}`);
    }
  }

  if (result.metrics.improvement?.stopReason) {
    console.log(`  metrics stop: ${result.metrics.improvement.stopReason}`);
  }

  if (result.metrics.improvement?.plannedActions > 0) {
    console.log(
      `  improvement metrics: plannedActions=${result.metrics.improvement.plannedActions}, executedNanoBanana=${result.metrics.improvement.executedNanoBanana ?? 0}, executedGeminiReReview=${result.metrics.improvement.executedGeminiReReview ?? 0}`,
    );
  }

  if (result.metrics.improvement?.lastRound) {
    const lr = result.metrics.improvement.lastRound;
    console.log(
      `  lastRound: executed=${lr.executedActions ?? 0}, success=${lr.successfulActions ?? 0}, failed=${lr.failedActions ?? 0}, skipped=${lr.skippedActions ?? 0}`,
    );
    if (lr.scoreBefore && lr.scoreAfter) {
      console.log(
        `  score delta: avg ${lr.scoreBefore.averageScore}→${lr.scoreAfter.averageScore} (${lr.scoreDelta?.averageScore >= 0 ? "+" : ""}${lr.scoreDelta?.averageScore ?? 0}), min ${lr.scoreBefore.minScore}→${lr.scoreAfter.minScore} (${lr.scoreDelta?.minScore >= 0 ? "+" : ""}${lr.scoreDelta?.minScore ?? 0})`,
      );
    }
  }

  if (result.metrics.nanoBananaCalls > 0 || result.metrics.geminiCalls > 0 || result.metrics.openaiCalls > 0) {
    console.log(
      `  api calls: nanoBanana=${result.metrics.nanoBananaCalls}, openai=${result.metrics.openaiCalls ?? 0}, gemini=${result.metrics.geminiCalls}, failed=${result.metrics.failedCalls}`,
    );
  }

  const regenByAdapter = result.metrics.regenerationByAdapter;
  if (regenByAdapter && (regenByAdapter.nano_banana > 0 || regenByAdapter.openai > 0)) {
    console.log(
      `  regeneration by adapter: nano_banana=${regenByAdapter.nano_banana}, openai=${regenByAdapter.openai}`,
    );
  }

  const exportInfo = result.state.export ?? result.metrics.export;
  if (!config.dryRun && exportInfo) {
    if (exportInfo.completed) {
      console.log(
        `  export: completed mode=${exportInfo.mode}, path=${exportInfo.path}, improved=${exportInfo.improvedAdoptedCount ?? 0}`,
      );
    } else if (exportInfo.skipped) {
      console.log(
        `  export: skipped${exportInfo.skipReason ? ` (${exportInfo.skipReason})` : ""}`,
      );
    }
  }

  const reportInfo = result.state.report ?? result.metrics.report;
  if (reportInfo?.generated) {
    console.log(`  report: ${reportInfo.jsonPath}, ${reportInfo.mdPath}`);
  }

  try {
    const report = buildPipelineReport({
      state: result.state,
      metrics: result.metrics,
      exportManifest: null,
      config,
    });
    const nextActions = report.summary.nextActions ?? [];
    if (nextActions.length > 0) {
      console.log("  next actions:");
      for (const action of nextActions.slice(0, 3)) {
        console.log(`    - ${action}`);
      }
      if (nextActions.length > 3) {
        console.log(`    - ... 他 ${nextActions.length - 3} 件（report.md 参照）`);
      }
    } else if (reportInfo?.mdPath) {
      console.log(`  next actions: 特記事項なし（詳細は ${reportInfo.mdPath}）`);
    }
  } catch {
    if (reportInfo?.mdPath) {
      console.log(`  details: see ${reportInfo.mdPath}`);
    }
  }

  console.log(`  state path: ${result.statePath}`);
  console.log(`  metrics path: ${result.metricsPath}`);
  console.log(
    `[QualityPipeline] 終了コード: ${result.exitCode} (${describeExitCode(result.exitCode)})`,
  );
}

async function main() {
  const args = parsePipelineArgs(process.argv);

  if (args.help) {
    console.log(getPipelineHelpText());
    process.exitCode = 0;
    return;
  }

  const config = createPipelineConfig(process.argv);
  const hooks = mergeHooks(NOOP_HOOKS);

  if (!config.dryRun) {
    console.log(
      "[QualityPipeline] apply mode: API calls and file/output changes may occur. Confirm dry-run report first.",
    );
  }

  if (config.resume) {
    console.log(
      "[QualityPipeline] resume mode: continuing from reports/quality-pipeline/latest/state.json",
    );
  }

  const result = await runPipeline(config, { hooks });

  printRunSummary({ config, result });
  process.exitCode = result.exitCode;
}

main().catch(async (error) => {
  const exitCode = getErrorExitCode(error);
  const message = error instanceof Error ? error.message : String(error);

  console.error(`[QualityPipeline] エラー: ${message}`);
  console.error(
    `[QualityPipeline] 終了コード: ${exitCode} (${describeExitCode(exitCode)})`,
  );

  try {
    await NOOP_HOOKS.onFailure({ error, exitCode });
  } catch {
    // hook 失敗は握りつぶす
  }

  process.exitCode = exitCode;
});
