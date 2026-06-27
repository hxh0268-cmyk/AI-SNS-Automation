/**
 * CLI 終了コード定義
 *
 * 0 = 正常終了
 * 1 = 入力エラー・設定エラー
 * 2 = APIエラー（対象すべて失敗）
 * 3 = 部分成功・一部失敗あり
 * 4 = 内部エラー
 */
export const EXIT_CODES = {
  /** 正常終了 */
  SUCCESS: 0,
  /** 入力エラー・設定エラー（ファイル不在、JSON 不正、CLI 引数不正など） */
  INPUT_ERROR: 1,
  /** API エラー（改善 / 再レビュー対象がすべて失敗） */
  API_ERROR: 2,
  /** 部分成功（一部成功・一部 failed / failed_review）— 完全失敗ではなく要確認 */
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
      return "正常終了";
    case EXIT_CODES.INPUT_ERROR:
      return "入力エラー・設定エラー";
    case EXIT_CODES.API_ERROR:
      return "APIエラー";
    case EXIT_CODES.PARTIAL_SUCCESS:
      return "部分成功・要確認";
    case EXIT_CODES.INTERNAL_ERROR:
      return "内部エラー";
    default:
      return "不明";
  }
}
