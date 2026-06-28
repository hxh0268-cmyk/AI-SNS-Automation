import { InputConfigurationError } from "./exit_codes.js";

/** @typedef {typeof PIPELINE_PHASES[keyof typeof PIPELINE_PHASES]} PipelinePhase */

/** 品質パイプラインの Phase 定数 */
export const PIPELINE_PHASES = {
  INIT: "INIT",
  HEALTH_CHECK: "HEALTH_CHECK",
  POST_GENERATION: "POST_GENERATION",
  POST_REVIEW: "POST_REVIEW",
  CAROUSEL_GENERATION: "CAROUSEL_GENERATION",
  CAROUSEL_REVIEW: "CAROUSEL_REVIEW",
  IMAGE_PROMPT: "IMAGE_PROMPT",
  IMAGE_GENERATION: "IMAGE_GENERATION",
  IMAGE_REVIEW: "IMAGE_REVIEW",
  IMPROVEMENT: "IMPROVEMENT",
  RE_REVIEW: "RE_REVIEW",
  EXPORT: "EXPORT",
  REPORT: "REPORT",
  COMPLETE: "COMPLETE",
  FAILED: "FAILED",
};

/** 通常実行順序（FAILED は含まない） */
export const PHASE_ORDER = [
  PIPELINE_PHASES.INIT,
  PIPELINE_PHASES.HEALTH_CHECK,
  PIPELINE_PHASES.POST_GENERATION,
  PIPELINE_PHASES.POST_REVIEW,
  PIPELINE_PHASES.CAROUSEL_GENERATION,
  PIPELINE_PHASES.CAROUSEL_REVIEW,
  PIPELINE_PHASES.IMAGE_PROMPT,
  PIPELINE_PHASES.IMAGE_GENERATION,
  PIPELINE_PHASES.IMAGE_REVIEW,
  PIPELINE_PHASES.IMPROVEMENT,
  PIPELINE_PHASES.RE_REVIEW,
  PIPELINE_PHASES.EXPORT,
  PIPELINE_PHASES.REPORT,
  PIPELINE_PHASES.COMPLETE,
];

/** Phase 表示ラベル（日本語） */
const PHASE_LABELS = {
  [PIPELINE_PHASES.INIT]: "初期化",
  [PIPELINE_PHASES.HEALTH_CHECK]: "Health Check",
  [PIPELINE_PHASES.POST_GENERATION]: "投稿生成",
  [PIPELINE_PHASES.POST_REVIEW]: "投稿 Gemini レビュー",
  [PIPELINE_PHASES.CAROUSEL_GENERATION]: "カルーセル生成",
  [PIPELINE_PHASES.CAROUSEL_REVIEW]: "カルーセルレビュー",
  [PIPELINE_PHASES.IMAGE_PROMPT]: "画像プロンプト作成",
  [PIPELINE_PHASES.IMAGE_GENERATION]: "画像生成",
  [PIPELINE_PHASES.IMAGE_REVIEW]: "画像レビュー",
  [PIPELINE_PHASES.IMPROVEMENT]: "品質改善",
  [PIPELINE_PHASES.RE_REVIEW]: "再レビュー",
  [PIPELINE_PHASES.EXPORT]: "Instagram Package 出力",
  [PIPELINE_PHASES.REPORT]: "レポート生成",
  [PIPELINE_PHASES.COMPLETE]: "完了",
  [PIPELINE_PHASES.FAILED]: "失敗",
};

/** CLI 入力の別名（kebab-case / snake_case → Enum） */
const PHASE_ALIASES = {
  init: PIPELINE_PHASES.INIT,
  "health-check": PIPELINE_PHASES.HEALTH_CHECK,
  health_check: PIPELINE_PHASES.HEALTH_CHECK,
  "post-generation": PIPELINE_PHASES.POST_GENERATION,
  post_generation: PIPELINE_PHASES.POST_GENERATION,
  "post-review": PIPELINE_PHASES.POST_REVIEW,
  post_review: PIPELINE_PHASES.POST_REVIEW,
  "carousel-generation": PIPELINE_PHASES.CAROUSEL_GENERATION,
  carousel_generation: PIPELINE_PHASES.CAROUSEL_GENERATION,
  "carousel-review": PIPELINE_PHASES.CAROUSEL_REVIEW,
  carousel_review: PIPELINE_PHASES.CAROUSEL_REVIEW,
  "image-prompt": PIPELINE_PHASES.IMAGE_PROMPT,
  image_prompt: PIPELINE_PHASES.IMAGE_PROMPT,
  "image-generation": PIPELINE_PHASES.IMAGE_GENERATION,
  image_generation: PIPELINE_PHASES.IMAGE_GENERATION,
  "image-review": PIPELINE_PHASES.IMAGE_REVIEW,
  image_review: PIPELINE_PHASES.IMAGE_REVIEW,
  improvement: PIPELINE_PHASES.IMPROVEMENT,
  "re-review": PIPELINE_PHASES.RE_REVIEW,
  re_review: PIPELINE_PHASES.RE_REVIEW,
  export: PIPELINE_PHASES.EXPORT,
  report: PIPELINE_PHASES.REPORT,
  complete: PIPELINE_PHASES.COMPLETE,
  failed: PIPELINE_PHASES.FAILED,
};

/**
 * Phase の表示ラベルを返す
 * @param {string} phase
 * @returns {string}
 */
export function getPhaseLabel(phase) {
  return PHASE_LABELS[phase] ?? phase;
}

/**
 * CLI 文字列を Phase Enum に解決する
 * @param {string} value
 * @returns {PipelinePhase}
 */
export function resolveFromPhase(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new InputConfigurationError("fromPhase の値が空です。");
  }

  const normalized = value.trim();
  const upper = normalized.toUpperCase().replace(/-/g, "_");

  if (Object.values(PIPELINE_PHASES).includes(upper)) {
    return /** @type {PipelinePhase} */ (upper);
  }

  const aliasKey = normalized.toLowerCase().replace(/_/g, "-");
  const aliasKeySnake = normalized.toLowerCase();

  if (PHASE_ALIASES[aliasKey]) {
    return PHASE_ALIASES[aliasKey];
  }

  if (PHASE_ALIASES[aliasKeySnake]) {
    return PHASE_ALIASES[aliasKeySnake];
  }

  throw new InputConfigurationError(
    `不明な fromPhase です: ${value}（例: INIT, image-review, IMAGE_REVIEW）`,
  );
}

/**
 * 次の Phase を返す（終端の次は null）
 * @param {string} phase
 * @returns {PipelinePhase | null}
 */
export function getNextPhase(phase) {
  const index = PHASE_ORDER.indexOf(phase);
  if (index === -1 || index >= PHASE_ORDER.length - 1) {
    return null;
  }

  return PHASE_ORDER[index + 1];
}

/**
 * 改善ループに属する Phase かどうか
 * @param {string} phase
 * @returns {boolean}
 */
export function isLoopPhase(phase) {
  return (
    phase === PIPELINE_PHASES.IMPROVEMENT || phase === PIPELINE_PHASES.RE_REVIEW
  );
}

/**
 * fromPhase 以降の planned phases を返す
 * @param {string} fromPhase
 * @returns {PipelinePhase[]}
 */
export function getPlannedPhases(fromPhase) {
  const resolved = resolveFromPhase(fromPhase);
  const startIndex = PHASE_ORDER.indexOf(resolved);

  if (startIndex === -1) {
    return [];
  }

  return PHASE_ORDER.slice(startIndex);
}

/**
 * PHASE_ORDER 上で a が b より前かどうか
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function isPhaseBefore(a, b) {
  const indexA = PHASE_ORDER.indexOf(a);
  const indexB = PHASE_ORDER.indexOf(b);

  if (indexA === -1 || indexB === -1) {
    return false;
  }

  return indexA < indexB;
}
