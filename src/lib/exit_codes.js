import { IMPROVEMENT_STOP_REASONS } from "./pipeline_improvement.js";

/**
 * CLI 終了コード定義
 *
 * 0 = 正常終了
 * 1 = 入力エラー・設定エラー
 * 2 = APIエラー（対象すべて失敗）
 * 3 = 部分成功・品質改善推奨（publish 未達など — システムエラーではない）
 * 4 = 内部エラー
 */
export const EXIT_CODES = {
  /** 正常終了 */
  SUCCESS: 0,
  /** 入力エラー・設定エラー（ファイル不在、JSON 不正、CLI 引数不正など） */
  INPUT_ERROR: 1,
  /** API エラー（改善 / 再レビュー対象がすべて失敗） */
  API_ERROR: 2,
  /** 部分成功（品質不足・改善推奨 — Nightly Apply では Workflow Success 扱い） */
  PARTIAL_SUCCESS: 3,
  /** 想定外の内部エラー */
  INTERNAL_ERROR: 4,
};

/** 入力・設定系エラー（終了コード 1） */
export class InputConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "InputConfigurationError";
  }
}

/**
 * 実行結果から終了コードを決定する
 * @param {object} params
 * @param {"improve" | "review" | "report"} params.script
 * @param {boolean} [params.apply] - improve / review の apply モード
 * @param {number} [params.targetCount] - improve: score 閾値未満の件数
 * @param {number} [params.improvedCount]
 * @param {number} [params.failedCount]
 * @param {number} [params.reviewTargetCount] - review: status=improved の件数
 * @param {number} [params.reviewedCount]
 * @param {number} [params.failedReviewCount]
 * @returns {number}
 */
export function getExitCodeByResult(params) {
  const { script } = params;

  if (script === "report") {
    return EXIT_CODES.SUCCESS;
  }

  if (script === "improve") {
    if (!params.apply) {
      return EXIT_CODES.SUCCESS;
    }

    const targetCount = params.targetCount ?? 0;
    const improvedCount = params.improvedCount ?? 0;
    const failedCount = params.failedCount ?? 0;

    if (targetCount === 0) {
      return EXIT_CODES.SUCCESS;
    }

    if (improvedCount > 0 && failedCount > 0) {
      return EXIT_CODES.PARTIAL_SUCCESS;
    }

    if (improvedCount > 0) {
      return EXIT_CODES.SUCCESS;
    }

    if (failedCount > 0) {
      return EXIT_CODES.API_ERROR;
    }

    // 対象はあるがすべて skipped（例: TEXT rootCause）
    return EXIT_CODES.SUCCESS;
  }

  if (script === "review") {
    if (!params.apply) {
      return EXIT_CODES.SUCCESS;
    }

    const reviewTargetCount = params.reviewTargetCount ?? 0;
    const reviewedCount = params.reviewedCount ?? 0;
    const failedReviewCount = params.failedReviewCount ?? 0;

    if (reviewTargetCount === 0) {
      return EXIT_CODES.SUCCESS;
    }

    if (reviewedCount > 0 && failedReviewCount > 0) {
      return EXIT_CODES.PARTIAL_SUCCESS;
    }

    if (reviewedCount > 0) {
      return EXIT_CODES.SUCCESS;
    }

    if (failedReviewCount > 0) {
      return EXIT_CODES.API_ERROR;
    }

    return EXIT_CODES.SUCCESS;
  }

  return EXIT_CODES.INTERNAL_ERROR;
}

/**
 * 例外から終了コードを決定する
 * @param {unknown} error
 * @returns {number}
 */
export function getErrorExitCode(error) {
  if (error instanceof InputConfigurationError) {
    return EXIT_CODES.INPUT_ERROR;
  }

  return EXIT_CODES.INTERNAL_ERROR;
}

/**
 * 終了コードの説明ラベルを返す
 * @param {number} code
 * @returns {string}
 */
export function describeExitCode(code) {
  switch (code) {
    case EXIT_CODES.SUCCESS:
    case PIPELINE_EXIT_CODES.SUCCESS:
      return "正常終了";
    case EXIT_CODES.INPUT_ERROR:
    case PIPELINE_EXIT_CODES.CONFIG_ERROR:
      return "入力エラー・設定エラー";
    case EXIT_CODES.API_ERROR:
    case PIPELINE_EXIT_CODES.IMPROVEMENT_FAILED:
      return "APIエラー";
    case EXIT_CODES.PARTIAL_SUCCESS:
    case PIPELINE_EXIT_CODES.PARTIAL_SUCCESS:
      return "品質改善推奨（publish 未達）";
    case EXIT_CODES.INTERNAL_ERROR:
    case PIPELINE_EXIT_CODES.UNEXPECTED_ERROR:
      return "内部エラー";
    default:
      return "不明";
  }
}

/** 品質パイプライン専用終了コード（数値は EXIT_CODES と同一体系） */
export const PIPELINE_EXIT_CODES = {
  SUCCESS: 0,
  CONFIG_ERROR: 1,
  IMPROVEMENT_FAILED: 2,
  PARTIAL_SUCCESS: 3,
  UNEXPECTED_ERROR: 4,
};

/**
 * apply 実行が成功扱いとなるか（stale failedSteps は除外して判定）
 * @param {object} params
 * @param {object} [params.state]
 * @param {object} [params.metrics]
 * @param {string | null} [params.improvementStopReason]
 * @param {boolean} [params.healthCheckFailed]
 * @param {boolean} [params.dryRun]
 * @returns {boolean}
 */
export function isPipelineSuccessfulOutcome(params) {
  if (params.dryRun) {
    return false;
  }

  if (params.healthCheckFailed) {
    return false;
  }

  const scoreSummary = params.state?.scoreSummary ?? {};
  if (!scoreSummary.allSlidesPassed || !scoreSummary.allSlidesPublishRecommended) {
    return false;
  }

  const stopReason =
    params.improvementStopReason ??
    params.state?.improvement?.stopReason ??
    params.metrics?.improvement?.stopReason ??
    null;

  if (stopReason !== IMPROVEMENT_STOP_REASONS.ALL_SLIDES_PUBLISH_RECOMMENDED) {
    return false;
  }

  const lastRound = params.metrics?.improvement?.lastRound;
  if (lastRound && (lastRound.failedActions ?? 0) > 0) {
    return false;
  }

  if ((params.metrics?.failedCalls ?? 0) > 0) {
    return false;
  }

  return true;
}

/**
 * 品質パイプライン実行結果から終了コードを決定する
 * @param {object} result
 * @param {unknown} [result.error]
 * @param {unknown} [result.configError]
 * @param {object} [result.state]
 * @param {object} [result.metrics]
 * @param {boolean} [result.limitZeroDetected]
 * @param {boolean} [result.allSlidesPublishRecommended]
 * @param {boolean} [result.allSlidesPassed]
 * @param {boolean} [result.dryRun]
 * @param {boolean} [result.healthCheckFailed]
 * @param {string | null} [result.improvementStopReason]
 * @returns {number}
 */
export function getPipelineExitCode(result) {
  if (isPipelineSuccessfulOutcome(result)) {
    return PIPELINE_EXIT_CODES.SUCCESS;
  }

  if (result.configError || result.healthCheckFailed) {
    return PIPELINE_EXIT_CODES.CONFIG_ERROR;
  }

  if ((result.state?.failedSteps?.length ?? 0) > 0) {
    return PIPELINE_EXIT_CODES.UNEXPECTED_ERROR;
  }

  if (result.error) {
    return PIPELINE_EXIT_CODES.UNEXPECTED_ERROR;
  }

  if (result.dryRun) {
    return PIPELINE_EXIT_CODES.SUCCESS;
  }

  const stopReason = result.improvementStopReason ?? null;
  const limitZeroDetected =
    result.limitZeroDetected || stopReason === "LIMIT_ZERO_DETECTED";

  if (limitZeroDetected && !result.allSlidesPublishRecommended) {
    return PIPELINE_EXIT_CODES.IMPROVEMENT_FAILED;
  }

  if (
    stopReason === "NO_SUCCESSFUL_ACTIONS_API_FAILED" ||
    stopReason === "NO_SUCCESSFUL_ACTIONS"
  ) {
    if (!result.allSlidesPublishRecommended) {
      return PIPELINE_EXIT_CODES.IMPROVEMENT_FAILED;
    }
  }

  if (stopReason === "NO_SCORE_IMPROVEMENT" && !result.allSlidesPublishRecommended) {
    return PIPELINE_EXIT_CODES.PARTIAL_SUCCESS;
  }

  if (result.allSlidesPublishRecommended) {
    return PIPELINE_EXIT_CODES.SUCCESS;
  }

  if (result.allSlidesPassed && !result.allSlidesPublishRecommended) {
    return PIPELINE_EXIT_CODES.PARTIAL_SUCCESS;
  }

  if (result.scoreSummaryLoaded === false) {
    return PIPELINE_EXIT_CODES.PARTIAL_SUCCESS;
  }

  if (
    stopReason === "MAX_API_CALLS_REACHED" ||
    stopReason === "MANUAL_REVIEW_ONLY" ||
    stopReason === "NO_AUTOFIXABLE_TARGETS" ||
    stopReason === "MAX_ROUNDS_REACHED"
  ) {
    return PIPELINE_EXIT_CODES.PARTIAL_SUCCESS;
  }

  return PIPELINE_EXIT_CODES.PARTIAL_SUCCESS;
}

/**
 * Nightly Apply workflow 上で Success 扱いとなる pipeline 終了コードか
 * （0 = 公開推奨、3 = 品質改善推奨 — いずれもシステムエラーではない）
 * @param {number} code
 * @returns {boolean}
 */
export function isNightlyApplyWorkflowSuccessExitCode(code) {
  return (
    code === PIPELINE_EXIT_CODES.SUCCESS ||
    code === PIPELINE_EXIT_CODES.PARTIAL_SUCCESS
  );
}

/**
 * 品質改善推奨（publish 未達）の終了コードか
 * @param {number} code
 * @returns {boolean}
 */
export function isPipelineImprovementRecommendedExitCode(code) {
  return code === PIPELINE_EXIT_CODES.PARTIAL_SUCCESS;
}
