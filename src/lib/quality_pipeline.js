import { getPipelineExitCode } from "./exit_codes.js";
import {
  buildLastRoundResult,
  createImprovementPlan,
  IMPROVEMENT_STOP_REASONS,
  needsImprovementLoop,
  shouldContinueImprovement,
} from "./pipeline_improvement.js";
import { mergeHooks, NOOP_HOOKS } from "./pipeline_hooks.js";
import { runPipelinePhase } from "./pipeline_phase_handlers.js";
import {
  getPhaseLabel,
  getPlannedPhases,
  isLoopPhase,
  PIPELINE_PHASES,
  resolveFromPhase,
} from "./phases.js";
import { extractScoreSnapshot } from "./pipeline_score.js";
import {
  appendCompletedStep,
  appendFailedStep,
  createInitialPipelineState,
  DEFAULT_PIPELINE_STATE_DIR,
  readPipelineState,
  recordImprovementRound,
  recordExportResult,
  recordReportResult,
  updateLastImprovementHistoryEntry,
  updatePipelineState,
  writePipelineState,
} from "./pipeline_state.js";
import {
  persistResumeCheckpoint,
  readResumeState,
  RESUME_CHECKPOINT_STOP_REASON_BEFORE_PHASE,
  validateResumeCheckpoint,
} from "./pipeline_resume.js";
import { preparePipelineWorkspace } from "./pipeline_workspace.js";
import {
  appendRoundMetrics,
  createPipelineMetrics,
  finishMetrics,
  readPipelineMetrics,
  recordImprovementMetrics,
  recordExportMetrics,
  recordReportMetrics,
  recordImprovementRoundResult,
  recordPhaseSummary,
  recordPhaseTiming,
  startMetrics,
  writePipelineMetrics,
} from "./pipeline_metrics.js";

/** skipContent 対象 Phase */
const SKIP_CONTENT_PHASES = new Set([
  PIPELINE_PHASES.POST_GENERATION,
  PIPELINE_PHASES.POST_REVIEW,
  PIPELINE_PHASES.CAROUSEL_GENERATION,
  PIPELINE_PHASES.CAROUSEL_REVIEW,
]);

/**
 * Phase をスキップするか判定する
 * @param {string} phase
 * @param {object} config
 * @returns {boolean}
 */
function shouldSkipPhase(phase, config) {
  if (config.skipContent && SKIP_CONTENT_PHASES.has(phase)) {
    return true;
  }

  if (config.skipExport && phase === PIPELINE_PHASES.EXPORT) {
    return true;
  }

  return false;
}

/**
 * 指定 Phase の直前で停止するか判定する
 * @param {string} phase
 * @param {object} config
 * @returns {boolean}
 */
function shouldStopBeforePhase(phase, config) {
  return Boolean(config.stopBeforePhase && phase === config.stopBeforePhase);
}

/**
 * --stop-before-phase による意図的中断 checkpoint を保存する
 * @param {object} params
 * @returns {Promise<string>}
 */
async function persistStopBeforePhaseCheckpoint(params) {
  const { phase, config, state, outputDir } = params;

  console.log(
    `[QualityPipeline] [--stop-before-phase] stopping before ${phase} (checkpoint saved)`,
  );

  return persistResumeCheckpoint({
    pipelineState: state,
    config,
    outputDir,
    stopReason: RESUME_CHECKPOINT_STOP_REASON_BEFORE_PHASE,
    stopBeforePhase: phase,
  });
}

/**
 * 実行計画を改善ループ前後に分割する
 * @param {string[]} phases
 * @returns {{ preLoopPhases: string[], postLoopPhases: string[], hasImprovementLoop: boolean }}
 */
function splitPhasesAroundImprovementLoop(phases) {
  const improvementIndex = phases.indexOf(PIPELINE_PHASES.IMPROVEMENT);
  const reReviewIndex = phases.indexOf(PIPELINE_PHASES.RE_REVIEW);

  if (improvementIndex === -1 || reReviewIndex === -1) {
    return {
      preLoopPhases: phases,
      postLoopPhases: [],
      hasImprovementLoop: false,
    };
  }

  return {
    preLoopPhases: phases.slice(0, improvementIndex),
    postLoopPhases: phases.slice(reReviewIndex + 1),
    hasImprovementLoop: true,
  };
}

/**
 * Phase 2 互換 placeholder（外部参照用）
 * @param {string} phase
 * @param {object} context
 * @returns {Promise<object>}
 */
export async function runPhasePlaceholder(phase, context) {
  const { config, skipped = false } = context;
  const mode = config.dryRun ? "dry-run" : "apply";
  const action = skipped
    ? `skipped:${phase}`
    : config.dryRun
      ? `planned:${phase}`
      : `placeholder:${phase}`;
  const label = getPhaseLabel(phase);

  console.log(
    `[QualityPipeline] [${mode}] ${phase}: ${label} (${action})`,
  );

  return {
    phase,
    mode,
    action,
    label,
    skipped,
    round: context.round ?? 0,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 実行計画（fromPhase 以降）
 * @param {object} config
 * @returns {string[]}
 */
function buildExecutionPlan(config) {
  return getPlannedPhases(config.fromPhase);
}

/**
 * phase result を pipeline state / metrics に反映する
 * @param {object} params
 * @returns {{ state: object, metrics: object, stopPipeline: boolean, healthCheckFailed: boolean, scoreSummaryLoaded: boolean | null }}
 */
function applyPhaseResult(params) {
  const { state, metrics, phase, phaseResult } = params;

  let nextState = state;
  let nextMetrics = recordPhaseSummary(metrics, phase, {
    status: phaseResult.status,
    message: phaseResult.message,
    ...phaseResult.data,
  });

  let stopPipeline = false;
  let healthCheckFailed = false;
  /** @type {boolean | null} */
  let scoreSummaryLoaded = null;

  if (phaseResult.data?.scoreSummary) {
    nextState = updatePipelineState(nextState, {
      scoreSummary: phaseResult.data.scoreSummary,
    });
    scoreSummaryLoaded = phaseResult.data.scoreSummaryLoaded ?? true;
  } else if (phaseResult.data?.scoreSummaryLoaded === false) {
    scoreSummaryLoaded = false;
  }

  if (phaseResult.data?.improvementPlan) {
    const plan = phaseResult.data.improvementPlan;
    const improvementResult = phaseResult.data.improvementResult ?? {};
    nextState = recordImprovementRound(nextState, {
      round: plan.round,
      status: improvementResult.status ?? phaseResult.status,
      totalTargets: plan.totalTargets,
      autoFixableTargets: plan.autoFixableTargets,
      manualReviewTargets: plan.manualReviewTargets,
      targets: improvementResult.targets ?? plan.targets,
      plan,
      manifestPath: phaseResult.data.manifestPath ?? null,
      improvedCount: improvementResult.improvedCount ?? null,
      failedCount: improvementResult.failedCount ?? null,
    });
    nextMetrics = recordImprovementMetrics(nextMetrics, plan);
  }

  if (phaseResult.data?.metrics) {
    nextMetrics = phaseResult.data.metrics;
  }

  if (phaseResult.data?.exportResult) {
    nextState = recordExportResult(nextState, phaseResult.data.exportResult);
    nextMetrics = recordExportMetrics(nextMetrics, phaseResult.data.exportResult);
  }

  if (phaseResult.data?.reportResult) {
    nextState = recordReportResult(nextState, phaseResult.data.reportResult);
    nextMetrics = recordReportMetrics(nextMetrics, phaseResult.data.reportResult);
  }

  if (phaseResult.data?.limitZeroDetected) {
    nextMetrics = { ...nextMetrics, limitZeroDetected: true };
  }

  if (phaseResult.status === "failed") {
    nextState = appendFailedStep(nextState, phase, phaseResult.message);
    stopPipeline = true;
    if (phase === PIPELINE_PHASES.HEALTH_CHECK) {
      healthCheckFailed = true;
    }
    return {
      state: nextState,
      metrics: nextMetrics,
      stopPipeline,
      healthCheckFailed,
      scoreSummaryLoaded,
    };
  }

  nextState = appendCompletedStep(nextState, phase);

  return {
    state: nextState,
    metrics: nextMetrics,
    stopPipeline,
    healthCheckFailed,
    scoreSummaryLoaded,
  };
}

/**
 * 1 Phase を実行する
 * @param {object} params
 * @returns {Promise<{ state: object, metrics: object, stopPipeline: boolean, healthCheckFailed: boolean, scoreSummaryLoaded: boolean | null, statePath: string, metricsPath: string }>}
 */
async function executeSinglePhase(params) {
  const {
    phase,
    config,
    state,
    metrics,
    outputDir,
    hooks,
    round = 0,
    plan = null,
  } = params;

  const skipped = shouldSkipPhase(phase, config);
  let nextState = updatePipelineState(state, { phase, round: round || state.round });

  const phaseStartedAt = Date.now();
  const context = {
    config,
    state: nextState,
    metrics,
    outputDir,
    dryRun: config.dryRun,
    phase,
    round: round || nextState.round,
    skipped,
    plan,
  };

  await hooks.beforePhase(context);

  const phaseResult = await runPipelinePhase(phase, context);

  const phaseEndedAt = Date.now();
  let nextMetrics = recordPhaseTiming(metrics, phase, phaseStartedAt, phaseEndedAt);

  const applied = applyPhaseResult({
    state: nextState,
    metrics: nextMetrics,
    phase,
    phaseResult,
  });

  nextState = applied.state;
  nextMetrics = applied.metrics;

  await hooks.afterPhase({
    ...context,
    result: phaseResult,
    state: nextState,
    metrics: nextMetrics,
  });

  const statePath = await writePipelineState(nextState, outputDir);
  const metricsPath = await writePipelineMetrics(nextMetrics, outputDir);

  if (!applied.stopPipeline && phaseResult.status !== "failed") {
    await persistResumeCheckpoint({
      pipelineState: nextState,
      config,
      outputDir,
    });
  }

  return {
    state: nextState,
    metrics: nextMetrics,
    stopPipeline: applied.stopPipeline,
    healthCheckFailed: applied.healthCheckFailed,
    scoreSummaryLoaded: applied.scoreSummaryLoaded,
    statePath,
    metricsPath,
  };
}

/**
 * 改善ループ停止理由をログ出力する
 * @param {string | null} reason
 */
function logImprovementStopReason(reason) {
  if (!reason) {
    return;
  }

  console.log(`[QualityPipeline] 改善ループ停止: ${reason}`);
}

/**
 * state に改善ループ停止理由を記録する
 * @param {object} state
 * @param {string | null} stopReason
 * @returns {object}
 */
function recordImprovementStopReason(state, stopReason) {
  if (!stopReason) {
    return state;
  }

  return updatePipelineState(state, {
    improvement: {
      ...state.improvement,
      stopReason,
    },
  });
}

/**
 * 改善ループ（IMPROVEMENT → RE_REVIEW）を実行する
 * @param {object} params
 * @returns {Promise<object>}
 */
async function runImprovementLoop(params) {
  let {
    state,
    metrics,
    config,
    hooks,
    outputDir,
    healthCheckFailed,
    scoreSummaryLoaded,
    statePath,
    metricsPath,
    startRound = 0,
  } = params;

  /** @type {string | null} */
  let improvementStopReason = null;

  if (!needsImprovementLoop(state.scoreSummary, config)) {
    const prePlan = createImprovementPlan(state.scoreSummary, { ...config, round: 1 });
    if (prePlan.manualReviewTargets > 0 && prePlan.autoFixableTargets === 0) {
      improvementStopReason = IMPROVEMENT_STOP_REASONS.MANUAL_REVIEW_ONLY;
      logImprovementStopReason(improvementStopReason);
      state = recordImprovementStopReason(state, improvementStopReason);
      metrics = recordImprovementRoundResult(metrics, null, improvementStopReason);
    } else {
      console.log(
        "[QualityPipeline] 改善ループ不要: 全スライドが targetScore 以上、または autoFixable 対象がありません",
      );
    }

    return {
      state,
      metrics,
      stopPipeline: false,
      stoppedBeforePhase: null,
      healthCheckFailed,
      scoreSummaryLoaded,
      statePath,
      metricsPath,
      improvementStopReason,
    };
  }

  let round = startRound;

  while (true) {
    if (state.scoreSummary.allSlidesPublishRecommended) {
      improvementStopReason = IMPROVEMENT_STOP_REASONS.ALL_SLIDES_PUBLISH_RECOMMENDED;
      break;
    }

    if (round >= config.maxRounds) {
      improvementStopReason = IMPROVEMENT_STOP_REASONS.MAX_ROUNDS_REACHED;
      break;
    }

    if (
      config.maxApiCalls !== null &&
      config.maxApiCalls !== undefined &&
      metrics.totalApiCalls >= config.maxApiCalls
    ) {
      improvementStopReason = IMPROVEMENT_STOP_REASONS.MAX_API_CALLS_REACHED;
      logImprovementStopReason(improvementStopReason);
      break;
    }

    const nextRound = round + 1;
    const plan = createImprovementPlan(state.scoreSummary, {
      ...config,
      round: nextRound,
    });

    if (plan.totalTargets === 0) {
      improvementStopReason = IMPROVEMENT_STOP_REASONS.NO_AUTOFIXABLE_TARGETS;
      break;
    }

    if (plan.autoFixableTargets === 0) {
      improvementStopReason =
        plan.manualReviewTargets > 0
          ? IMPROVEMENT_STOP_REASONS.MANUAL_REVIEW_ONLY
          : IMPROVEMENT_STOP_REASONS.NO_AUTOFIXABLE_TARGETS;
      logImprovementStopReason(improvementStopReason);
      break;
    }

    state = updatePipelineState(state, { round: nextRound });
    await hooks.beforeRound({ config, state, metrics, round: nextRound });

    if (shouldStopBeforePhase(PIPELINE_PHASES.IMPROVEMENT, config)) {
      await persistStopBeforePhaseCheckpoint({
        phase: PIPELINE_PHASES.IMPROVEMENT,
        config,
        state,
        outputDir,
      });
      return {
        state,
        metrics,
        stopPipeline: false,
        stoppedBeforePhase: PIPELINE_PHASES.IMPROVEMENT,
        healthCheckFailed,
        scoreSummaryLoaded,
        statePath,
        metricsPath,
        improvementStopReason,
      };
    }

    const scoreBefore = extractScoreSnapshot(state.scoreSummary);

    let improvementExec = await executeSinglePhase({
      phase: PIPELINE_PHASES.IMPROVEMENT,
      config,
      state,
      metrics,
      outputDir,
      hooks,
      round: nextRound,
      plan,
    });

    state = improvementExec.state;
    metrics = improvementExec.metrics;
    statePath = improvementExec.statePath;
    metricsPath = improvementExec.metricsPath;

    if (improvementExec.healthCheckFailed) {
      healthCheckFailed = true;
    }
    if (improvementExec.scoreSummaryLoaded !== null) {
      scoreSummaryLoaded = improvementExec.scoreSummaryLoaded;
    }
    if (improvementExec.stopPipeline) {
      return {
        state,
        metrics,
        stopPipeline: true,
        stoppedBeforePhase: null,
        healthCheckFailed,
        scoreSummaryLoaded,
        statePath,
        metricsPath,
        improvementStopReason,
      };
    }

    if (shouldStopBeforePhase(PIPELINE_PHASES.RE_REVIEW, config)) {
      await persistStopBeforePhaseCheckpoint({
        phase: PIPELINE_PHASES.RE_REVIEW,
        config,
        state,
        outputDir,
      });
      return {
        state,
        metrics,
        stopPipeline: false,
        stoppedBeforePhase: PIPELINE_PHASES.RE_REVIEW,
        healthCheckFailed,
        scoreSummaryLoaded,
        statePath,
        metricsPath,
        improvementStopReason,
      };
    }

    let reReviewExec = await executeSinglePhase({
      phase: PIPELINE_PHASES.RE_REVIEW,
      config,
      state,
      metrics,
      outputDir,
      hooks,
      round: nextRound,
    });

    state = reReviewExec.state;
    metrics = reReviewExec.metrics;
    statePath = reReviewExec.statePath;
    metricsPath = reReviewExec.metricsPath;

    if (reReviewExec.healthCheckFailed) {
      healthCheckFailed = true;
    }
    if (reReviewExec.scoreSummaryLoaded !== null) {
      scoreSummaryLoaded = reReviewExec.scoreSummaryLoaded;
    }
    if (reReviewExec.stopPipeline) {
      return {
        state,
        metrics,
        stopPipeline: true,
        stoppedBeforePhase: null,
        healthCheckFailed,
        scoreSummaryLoaded,
        statePath,
        metricsPath,
        improvementStopReason,
      };
    }

    const metricsLastRound = metrics.improvement?.lastRound ?? {};
    const historyEntry = state.improvement?.history?.[state.improvement.history.length - 1];
    const targetResults = historyEntry?.targets ?? [];
    const scoreAfter = extractScoreSnapshot(state.scoreSummary);

    const finalRoundResult = buildLastRoundResult(plan, {
      improvementResult: {
        improvedCount: metricsLastRound.improvedCount ?? 0,
        failedCount: metricsLastRound.failedImproveCount ?? 0,
        limitZeroDetected:
          metrics.limitZeroDetected || metrics.improvement?.limitZeroDetected,
        targets: targetResults,
      },
      reReviewResult: {
        reviewedCount: metricsLastRound.reviewedCount ?? 0,
        failedReviewCount: metricsLastRound.failedReviewCount ?? 0,
        limitZeroDetected: metrics.limitZeroDetected,
      },
      targetResults,
      scoreBefore,
      scoreAfter,
    });

    state = updateLastImprovementHistoryEntry(state, {
      executedActions: finalRoundResult.executedActions,
      successfulActions: finalRoundResult.successfulActions,
      failedActions: finalRoundResult.failedActions,
      skippedActions: finalRoundResult.skippedActions,
      scoreBefore: finalRoundResult.scoreBefore,
      scoreAfter: finalRoundResult.scoreAfter,
      scoreDelta: finalRoundResult.scoreDelta,
      reviewedCount: finalRoundResult.reviewedCount,
      failedReviewCount: finalRoundResult.failedReviewCount,
    });
    statePath = await writePipelineState(state, outputDir);

    metrics = appendRoundMetrics(metrics, {
      round: nextRound,
      geminiCalls: metrics.geminiCalls,
      openaiCalls: metrics.openaiCalls,
      nanoBananaCalls: metrics.nanoBananaCalls,
      failedCalls: metrics.failedCalls,
      mode: config.dryRun ? "dry-run" : "apply",
      placeholder: config.dryRun,
      totalTargets: plan.totalTargets,
      autoFixableTargets: plan.autoFixableTargets,
      manualReviewTargets: plan.manualReviewTargets,
      limitZeroDetected: metrics.limitZeroDetected,
      successfulActions: finalRoundResult.successfulActions,
      failedActions: finalRoundResult.failedActions,
    });
    metricsPath = await writePipelineMetrics(metrics, outputDir);

    await hooks.afterRound({ config, state, metrics, round: nextRound });

    round = nextRound;

    const continueCheck = shouldContinueImprovement(state.scoreSummary, round, config, {
      metrics,
      lastRoundResult: finalRoundResult,
      dryRun: config.dryRun,
    });

    if (!continueCheck.continue) {
      improvementStopReason = continueCheck.reason;
      metrics = recordImprovementRoundResult(metrics, finalRoundResult, improvementStopReason);
      logImprovementStopReason(improvementStopReason);
      break;
    }
  }

  state = recordImprovementStopReason(state, improvementStopReason);
  if (improvementStopReason) {
    metrics = recordImprovementRoundResult(
      metrics,
      metrics.improvement?.lastRound ?? null,
      improvementStopReason,
    );
    metricsPath = await writePipelineMetrics(metrics, outputDir);
    statePath = await writePipelineState(state, outputDir);
  }

  await persistResumeCheckpoint({
    pipelineState: state,
    config,
    outputDir,
  });

  return {
    state,
    metrics,
    stopPipeline: false,
    stoppedBeforePhase: null,
    healthCheckFailed,
    scoreSummaryLoaded,
    statePath,
    metricsPath,
    improvementStopReason,
  };
}

/**
 * 品質パイプラインを実行する
 * @param {object} config
 * @param {object} [options]
 * @param {Partial<import("./pipeline_hooks.js").PipelineHooks>} [options.hooks]
 * @param {object} [options.metrics]
 * @param {string} [options.outputDir]
 * @returns {Promise<{ state: object, metrics: object, exitCode: number, statePath: string, metricsPath: string }>}
 */
export async function runPipeline(config, options = {}) {
  const hooks = mergeHooks(options.hooks ?? NOOP_HOOKS);
  const outputDir = options.outputDir ?? DEFAULT_PIPELINE_STATE_DIR;

  /** @type {object} */
  let effectiveConfig = { ...config };
  /** @type {number} */
  let improvementStartRound = 0;

  /** @type {object | null} */
  let resumeCheckpoint = null;

  if (config.resume) {
    resumeCheckpoint = await readResumeState(outputDir);
    validateResumeCheckpoint(resumeCheckpoint);

    effectiveConfig = {
      ...effectiveConfig,
      fromPhase: resolveFromPhase(resumeCheckpoint.nextPhase),
    };
    improvementStartRound = resumeCheckpoint.checkpointRound ?? 0;

    console.log(
      `[QualityPipeline] [--resume] checkpoint=${resumeCheckpoint.checkpointPhase}, next=${resumeCheckpoint.nextPhase}, round=${improvementStartRound}`,
    );
  }

  const workspace = await preparePipelineWorkspace(effectiveConfig, outputDir);

  let metrics;
  let state;

  if (config.resume) {
    state = await readPipelineState(outputDir);
    try {
      metrics = startMetrics(await readPipelineMetrics(outputDir));
    } catch {
      metrics = startMetrics(createPipelineMetrics());
    }

    state = updatePipelineState(state, {
      status: "running",
      phase: effectiveConfig.fromPhase,
      workspace,
      resume: {
        enabled: true,
        checkpointPhase: resumeCheckpoint?.checkpointPhase ?? null,
        checkpointRound: improvementStartRound,
      },
      failedSteps: [],
      lastError: null,
    });
  } else {
    metrics = startMetrics(options.metrics ?? createPipelineMetrics());
    state = createInitialPipelineState(effectiveConfig);
    if (workspace.action !== "none") {
      state = updatePipelineState(state, { workspace });
    }
    state = updatePipelineState(state, { status: "running" });
  }

  let statePath = await writePipelineState(state, outputDir);
  let metricsPath = await writePipelineMetrics(metrics, outputDir);

  if (!config.resume) {
    await persistResumeCheckpoint({
      pipelineState: state,
      config: effectiveConfig,
      outputDir,
    });
  }

  /** @type {unknown} */
  let pipelineError = null;
  let healthCheckFailed = false;
  /** @type {boolean | null} */
  let scoreSummaryLoaded = null;
  let stopPipeline = false;
  /** @type {string | null} */
  let stoppedBeforePhase = null;
  /** @type {string | null} */
  let improvementStopReason = null;

  try {
    await hooks.beforePipeline({ config: effectiveConfig, state, metrics });

    const allPhases = buildExecutionPlan(effectiveConfig);
    const { preLoopPhases, postLoopPhases, hasImprovementLoop } =
      splitPhasesAroundImprovementLoop(allPhases);

    for (const phase of preLoopPhases) {
      if (shouldStopBeforePhase(phase, effectiveConfig)) {
        await persistStopBeforePhaseCheckpoint({
          phase,
          config: effectiveConfig,
          state,
          outputDir,
        });
        stoppedBeforePhase = phase;
        break;
      }

      const result = await executeSinglePhase({
        phase,
        config: effectiveConfig,
        state,
        metrics,
        outputDir,
        hooks,
      });

      state = result.state;
      metrics = result.metrics;
      statePath = result.statePath;
      metricsPath = result.metricsPath;

      if (result.healthCheckFailed) {
        healthCheckFailed = true;
      }
      if (result.scoreSummaryLoaded !== null) {
        scoreSummaryLoaded = result.scoreSummaryLoaded;
      }
      if (result.stopPipeline) {
        stopPipeline = true;
        break;
      }
    }

    if (!stopPipeline && !stoppedBeforePhase && hasImprovementLoop) {
      if (shouldStopBeforePhase(PIPELINE_PHASES.IMPROVEMENT, effectiveConfig)) {
        await persistStopBeforePhaseCheckpoint({
          phase: PIPELINE_PHASES.IMPROVEMENT,
          config: effectiveConfig,
          state,
          outputDir,
        });
        stoppedBeforePhase = PIPELINE_PHASES.IMPROVEMENT;
      } else {
        const loopResult = await runImprovementLoop({
          state,
          metrics,
          config: effectiveConfig,
          hooks,
          outputDir,
          healthCheckFailed,
          scoreSummaryLoaded,
          statePath,
          metricsPath,
          startRound: improvementStartRound,
        });

        state = loopResult.state;
        metrics = loopResult.metrics;
        statePath = loopResult.statePath;
        metricsPath = loopResult.metricsPath;
        stopPipeline = loopResult.stopPipeline;
        stoppedBeforePhase = loopResult.stoppedBeforePhase ?? null;
        healthCheckFailed = loopResult.healthCheckFailed;
        if (loopResult.scoreSummaryLoaded !== null) {
          scoreSummaryLoaded = loopResult.scoreSummaryLoaded;
        }
        improvementStopReason =
          loopResult.improvementStopReason ??
          loopResult.state?.improvement?.stopReason ??
          metrics.improvement?.stopReason ??
          null;
      }
    }

    if (!stopPipeline && !stoppedBeforePhase) {
      for (const phase of postLoopPhases) {
        if (shouldStopBeforePhase(phase, effectiveConfig)) {
          await persistStopBeforePhaseCheckpoint({
            phase,
            config: effectiveConfig,
            state,
            outputDir,
          });
          stoppedBeforePhase = phase;
          break;
        }

        const result = await executeSinglePhase({
          phase,
          config: effectiveConfig,
          state,
          metrics,
          outputDir,
          hooks,
        });

        state = result.state;
        metrics = result.metrics;
        statePath = result.statePath;
        metricsPath = result.metricsPath;

        if (result.healthCheckFailed) {
          healthCheckFailed = true;
        }
        if (result.scoreSummaryLoaded !== null) {
          scoreSummaryLoaded = result.scoreSummaryLoaded;
        }
        if (result.stopPipeline) {
          stopPipeline = true;
          break;
        }
      }
    }

    if (!healthCheckFailed && !stopPipeline && !stoppedBeforePhase && state.status !== "failed") {
      state = updatePipelineState(state, {
        phase: PIPELINE_PHASES.COMPLETE,
        status: "completed",
      });
      await hooks.onSuccess({
        config: effectiveConfig,
        state,
        metrics,
        exportPath: state.export?.path ?? undefined,
      });
      await persistResumeCheckpoint({
        pipelineState: state,
        config: effectiveConfig,
        outputDir,
      });
    }
  } catch (error) {
    pipelineError = error;
    const reason = error instanceof Error ? error.message : String(error);
    const failedPhase =
      state.phase === PIPELINE_PHASES.FAILED
        ? PIPELINE_PHASES.INIT
        : state.phase;

    state = appendFailedStep(state, failedPhase, reason);
    await persistResumeCheckpoint({
      pipelineState: state,
      config: effectiveConfig,
      outputDir,
    });
    await hooks.onFailure({ config: effectiveConfig, state, metrics, error });
  } finally {
    metrics = finishMetrics(metrics);

    statePath = await writePipelineState(state, outputDir);
    metricsPath = await writePipelineMetrics(metrics, outputDir);

    if (state.status !== "completed") {
      await persistResumeCheckpoint({
        pipelineState: state,
        config: effectiveConfig,
        outputDir,
        stopReason: stoppedBeforePhase
          ? RESUME_CHECKPOINT_STOP_REASON_BEFORE_PHASE
          : null,
        stopBeforePhase: stoppedBeforePhase,
      });
    }

    await hooks.afterPipeline({
      config: effectiveConfig,
      state,
      metrics,
      error: pipelineError ?? undefined,
    });
  }

  const exitCode = getPipelineExitCode({
    state,
    config: effectiveConfig,
    metrics,
    error: pipelineError,
    dryRun: config.dryRun,
    healthCheckFailed,
    scoreSummaryLoaded,
    limitZeroDetected: metrics.limitZeroDetected || metrics.improvement?.limitZeroDetected,
    improvementStopReason:
      improvementStopReason ??
      state.improvement?.stopReason ??
      metrics.improvement?.stopReason ??
      null,
    allSlidesPublishRecommended: state.scoreSummary.allSlidesPublishRecommended,
    allSlidesPassed: state.scoreSummary.allSlidesPassed,
  });

  return {
    state,
    metrics,
    exitCode,
    statePath,
    metricsPath,
    stoppedBeforePhase,
  };
}

/**
 * loop phase かどうか（外部参照用）
 * @param {string} phase
 * @returns {boolean}
 */
export function isPipelineLoopPhase(phase) {
  return isLoopPhase(phase);
}
