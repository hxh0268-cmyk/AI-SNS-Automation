import fs from "node:fs/promises";
import path from "node:path";
import { createPartFromBase64, createPartFromText } from "@google/genai";
import { SLIDE_TYPES } from "./carousel.js";
import { generateWithRetry } from "./gemini.js";
import { extractJsonFromText } from "./json.js";
import {
  DEFAULT_RETRY,
  DEFAULT_TIMEOUT_MS,
  IMPROVED_OUTPUT_DIR,
  PROJECT_ROOT,
  improveImageWithNanoBanana,
} from "./nano_banana.js";
import {
  buildScoreDelta,
  extractScoreSnapshot,
  mergeReviewResultIntoScoreSummary,
  resolveReviewSourceFromManifestItem,
} from "./pipeline_score.js";
import {
  incrementApiCall,
  recordFailedCall,
  recordImprovementExecutionMetrics,
} from "./pipeline_metrics.js";
import { PIPELINE_PHASES } from "./phases.js";
import {
  DEFAULT_REGENERATION_ADAPTER_ID,
  planRegeneration,
  regenerateImage,
} from "./regeneration_engine.js";
import { classifyRootCause } from "./root_cause.js";
import { isLimitZeroError } from "./retry.js";
import {
  applySmartAutoFixForSlide,
  getSlideFilePaths,
} from "./smart_auto_fix.js";

/** @typedef {"BOOST_TO_PUBLISH_RECOMMENDED" | "REPAIR_REQUIRED"} ImprovementAction */

/**
 * slide から rootCause を解決する
 * @param {object} slide
 * @returns {string | null}
 */
function resolveRootCause(slide) {
  const explicit =
    slide.rootCause ??
    slide.afterRootCause ??
    slide.beforeRootCause ??
    null;

  if (typeof explicit === "string" && explicit.trim()) {
    return explicit.trim().toUpperCase();
  }

  const classification = classifyRootCause({
    improvements: slide.recommendations ?? slide.improvements ?? [],
    issues: slide.issues ?? [],
  });

  return classification.rootCause;
}

/**
 * rootCause に応じた tool ルーティング
 * @param {object} slide
 * @param {string | null} rootCause
 * @param {object} config
 * @returns {object}
 */
function routeByRootCause(slide, rootCause, config) {
  const targetScore = config.targetScore ?? 90;
  const passingScore = config.passingScore ?? 80;
  const base = {
    slideId: slide.slideId,
    score: slide.score,
    rootCause,
    action: /** @type {ImprovementAction} */ ("REPAIR_REQUIRED"),
  };

  switch (rootCause) {
    case "TEXT":
      return {
        ...base,
        tool: "smart_auto_fix",
        autoFixable: true,
        reason: "テキスト・誤字・文言修正が必要",
      };
    case "LAYOUT":
      return {
        ...base,
        tool: "nano_banana",
        autoFixable: true,
        reason: "レイアウト改善が必要",
      };
    case "STYLE":
      return {
        ...base,
        tool: "nano_banana",
        autoFixable: true,
        reason: "スタイル改善が必要",
      };
    case "PROMPT":
      return {
        ...base,
        tool: "openai_regenerate",
        autoFixable: true,
        reason: "プロンプト不足による再生成が必要",
      };
    case "OTHER":
      return {
        ...base,
        tool: "manual_review",
        autoFixable: false,
        reason: "手動確認が必要（OTHER rootCause）",
      };
    default:
      if (slide.score >= passingScore && slide.score < targetScore) {
        return {
          ...base,
          rootCause: null,
          action: "BOOST_TO_PUBLISH_RECOMMENDED",
          tool: "nano_banana",
          autoFixable: true,
          reason: `rootCause 不明: score ${slide.score} を targetScore(${targetScore}) へ引き上げ`,
        };
      }

      return {
        ...base,
        rootCause: null,
        tool: "manual_review",
        autoFixable: false,
        reason: `rootCause 不明: score ${slide.score} が passingScore(${passingScore}) 未満`,
      };
  }
}

/**
 * 1 slide の改善対象を分類する
 * @param {object} slide
 * @param {object} config
 * @returns {object | null}
 */
export function classifyImprovementTarget(slide, config) {
  const targetScore = config.targetScore ?? 90;
  const passingScore = config.passingScore ?? 80;

  if (typeof slide.score !== "number" || !Number.isFinite(slide.score)) {
    return null;
  }

  if (slide.score >= targetScore) {
    return null;
  }

  if (slide.score >= passingScore && slide.score < targetScore) {
    return {
      slideId: slide.slideId,
      score: slide.score,
      rootCause: resolveRootCause(slide),
      action: "BOOST_TO_PUBLISH_RECOMMENDED",
      tool: "nano_banana",
      autoFixable: true,
      reason: `score ${slide.score} は passingScore(${passingScore}) 以上だが targetScore(${targetScore}) 未達`,
    };
  }

  const rootCause = resolveRootCause(slide);
  return routeByRootCause(slide, rootCause, config);
}

/**
 * 改善対象 slide を抽出する
 * @param {object} scoreSummary
 * @param {object} config
 * @returns {object[]}
 */
export function getImprovementTargets(scoreSummary, config) {
  if (!scoreSummary?.slides?.length) {
    return [];
  }

  return scoreSummary.slides
    .map((slide) => classifyImprovementTarget(slide, config))
    .filter(Boolean);
}

/**
 * 改善 plan を作成する
 * @param {object} scoreSummary
 * @param {object} config
 * @returns {object}
 */
export function createImprovementPlan(scoreSummary, config) {
  const round = config.round ?? 1;
  const targetScore = config.targetScore ?? 90;
  const passingScore = config.passingScore ?? 80;
  const targets = getImprovementTargets(scoreSummary, config);
  const autoFixableTargets = targets.filter((target) => target.autoFixable).length;
  const manualReviewTargets = targets.filter((target) => !target.autoFixable).length;

  return {
    round,
    targetScore,
    passingScore,
    totalTargets: targets.length,
    autoFixableTargets,
    manualReviewTargets,
    targets,
  };
}

/**
 * 改善ループ停止理由
 */
export const IMPROVEMENT_STOP_REASONS = {
  ALL_SLIDES_PUBLISH_RECOMMENDED: "ALL_SLIDES_PUBLISH_RECOMMENDED",
  MAX_ROUNDS_REACHED: "MAX_ROUNDS_REACHED",
  EMPTY_SCORE_SUMMARY: "EMPTY_SCORE_SUMMARY",
  NO_AUTOFIXABLE_TARGETS: "NO_AUTOFIXABLE_TARGETS",
  LIMIT_ZERO_DETECTED: "LIMIT_ZERO_DETECTED",
  MAX_API_CALLS_REACHED: "MAX_API_CALLS_REACHED",
  /** @deprecated 互換用。新規判定では NO_SUCCESSFUL_ACTIONS_API_FAILED を使用 */
  NO_SUCCESSFUL_ACTIONS: "NO_SUCCESSFUL_ACTIONS",
  NO_SUCCESSFUL_ACTIONS_API_FAILED: "NO_SUCCESSFUL_ACTIONS_API_FAILED",
  NO_SCORE_IMPROVEMENT: "NO_SCORE_IMPROVEMENT",
  MANUAL_REVIEW_ONLY: "MANUAL_REVIEW_ONLY",
};

/** 改善 tool 識別子（接続準備用） */
export const IMPROVEMENT_TOOLS = {
  NANO_BANANA: "nano_banana",
  SMART_AUTO_FIX: "smart_auto_fix",
  OPENAI_REGENERATE: "openai_regenerate",
  MANUAL_REVIEW: "manual_review",
};

/** TEXT 改善チェーン（Phase 4-C） */
const IMPROVEMENT_PIPELINE_SMART_AUTO_FIX = [
  IMPROVEMENT_TOOLS.SMART_AUTO_FIX,
  "regeneration_engine",
];

/**
 * 改善ループを継続すべきか判定する
 * @param {object} scoreSummary
 * @param {number} round - 完了済みラウンド数
 * @param {object} config
 * @param {object} [options]
 * @param {object} [options.metrics]
 * @param {object} [options.lastRoundResult]
 * @param {boolean} [options.dryRun]
 * @returns {{ continue: boolean, reason: string | null }}
 */
export function shouldContinueImprovement(scoreSummary, round, config, options = {}) {
  const { metrics = null, lastRoundResult = null, dryRun = config?.dryRun ?? false } =
    options;

  if (!scoreSummary?.slides?.length) {
    return {
      continue: false,
      reason: IMPROVEMENT_STOP_REASONS.EMPTY_SCORE_SUMMARY,
    };
  }

  if (scoreSummary.allSlidesPublishRecommended) {
    return {
      continue: false,
      reason: IMPROVEMENT_STOP_REASONS.ALL_SLIDES_PUBLISH_RECOMMENDED,
    };
  }

  const maxRounds = config.maxRounds ?? 3;
  if (round >= maxRounds) {
    return {
      continue: false,
      reason: IMPROVEMENT_STOP_REASONS.MAX_ROUNDS_REACHED,
    };
  }

  if (metrics?.limitZeroDetected || metrics?.improvement?.limitZeroDetected) {
    return {
      continue: false,
      reason: IMPROVEMENT_STOP_REASONS.LIMIT_ZERO_DETECTED,
    };
  }

  if (
    config.maxApiCalls !== null &&
    config.maxApiCalls !== undefined &&
    metrics !== null &&
    metrics.totalApiCalls >= config.maxApiCalls
  ) {
    return {
      continue: false,
      reason: IMPROVEMENT_STOP_REASONS.MAX_API_CALLS_REACHED,
    };
  }

  if (lastRoundResult) {
    if (lastRoundResult.limitZeroDetected) {
      return {
        continue: false,
        reason: IMPROVEMENT_STOP_REASONS.LIMIT_ZERO_DETECTED,
      };
    }

    if (!dryRun && lastRoundResult.manualReviewOnly) {
      return {
        continue: false,
        reason: IMPROVEMENT_STOP_REASONS.MANUAL_REVIEW_ONLY,
      };
    }

    if (
      !dryRun &&
      lastRoundResult.executedActions > 0 &&
      lastRoundResult.successfulActions === 0 &&
      lastRoundResult.failedActions > 0
    ) {
      return {
        continue: false,
        reason: IMPROVEMENT_STOP_REASONS.NO_SUCCESSFUL_ACTIONS_API_FAILED,
      };
    }

    if (
      !dryRun &&
      (lastRoundResult.improvedCount ?? 0) > 0 &&
      !scoreSummary.allSlidesPublishRecommended
    ) {
      return {
        continue: false,
        reason: IMPROVEMENT_STOP_REASONS.NO_SCORE_IMPROVEMENT,
      };
    }
  }

  const nextPlan = createImprovementPlan(scoreSummary, {
    ...config,
    round: round + 1,
  });

  if (nextPlan.autoFixableTargets < 1) {
    if (nextPlan.manualReviewTargets > 0) {
      return {
        continue: false,
        reason: IMPROVEMENT_STOP_REASONS.MANUAL_REVIEW_ONLY,
      };
    }

    return {
      continue: false,
      reason: IMPROVEMENT_STOP_REASONS.NO_AUTOFIXABLE_TARGETS,
    };
  }

  return { continue: true, reason: null };
}

/**
 * targetResults からラウンド action 件数を集計する
 * @param {object[]} targetResults
 * @param {object} [reReviewResult]
 * @returns {{ executedActions: number, successfulActions: number, failedActions: number, skippedActions: number }}
 */
export function countImprovementRoundActions(targetResults = [], reReviewResult = {}) {
  let executedActions = 0;
  let successfulActions = 0;
  let failedActions = 0;
  let skippedActions = 0;

  for (const result of targetResults) {
    const tool = result.tool;
    const status = result.status;

    if (tool === IMPROVEMENT_TOOLS.NANO_BANANA) {
      if (status === "improved" || status === "failed") {
        executedActions += 1;
        if (status === "improved") {
          successfulActions += 1;
        } else {
          failedActions += 1;
        }
      }
      continue;
    }

    if (tool === IMPROVEMENT_TOOLS.SMART_AUTO_FIX) {
      if (
        status === "planned" ||
        status === "improved"
      ) {
        executedActions += 1;
        successfulActions += 1;
      } else if (
        status === "saf_failed" ||
        status === "regen_failed" ||
        status === "failed"
      ) {
        executedActions += 1;
        failedActions += 1;
      }
      continue;
    }

    if (
      tool === IMPROVEMENT_TOOLS.OPENAI_REGENERATE ||
      tool === IMPROVEMENT_TOOLS.MANUAL_REVIEW ||
      status === "manual_review" ||
      status === "placeholder" ||
      status === "placeholder_prepared"
    ) {
      skippedActions += 1;
    }
  }

  const reviewedCount = reReviewResult.reviewedCount ?? 0;
  const failedReviewCount = reReviewResult.failedReviewCount ?? 0;
  successfulActions += reviewedCount;
  failedActions += failedReviewCount;

  return {
    executedActions,
    successfulActions,
    failedActions,
    skippedActions,
  };
}

/**
 * 改善ラウンド結果を組み立てる
 * @param {object} plan
 * @param {object} [options]
 * @param {object} [options.improvementResult]
 * @param {object} [options.reReviewResult]
 * @param {object[]} [options.targetResults]
 * @param {object | null} [options.scoreBefore]
 * @param {object | null} [options.scoreAfter]
 * @returns {object}
 */
export function buildLastRoundResult(plan, options = {}) {
  const improvementResult = options.improvementResult ?? options;
  const reReviewResult = options.reReviewResult ?? {};
  const targetResults = options.targetResults ?? improvementResult.targets ?? [];

  const improvedCount = improvementResult.improvedCount ?? 0;
  const failedImproveCount = improvementResult.failedCount ?? 0;
  const reviewedCount = reReviewResult.reviewedCount ?? 0;
  const failedReviewCount = reReviewResult.failedReviewCount ?? 0;

  const scoreBefore =
    options.scoreBefore !== undefined
      ? options.scoreBefore
      : extractScoreSnapshot(improvementResult.scoreSummary ?? null);
  const scoreAfter =
    options.scoreAfter !== undefined
      ? options.scoreAfter
      : extractScoreSnapshot(reReviewResult.scoreSummary ?? null);
  const scoreDelta = buildScoreDelta(scoreBefore, scoreAfter);

  const actionCounts = countImprovementRoundActions(targetResults, reReviewResult);

  return {
    round: plan.round,
    executedActions: actionCounts.executedActions,
    successfulActions: actionCounts.successfulActions,
    failedActions: actionCounts.failedActions,
    skippedActions: actionCounts.skippedActions,
    scoreBefore,
    scoreAfter,
    scoreDelta,
    manualReviewOnly: plan.autoFixableTargets === 0 && plan.manualReviewTargets > 0,
    limitZeroDetected:
      Boolean(improvementResult.limitZeroDetected) ||
      Boolean(reReviewResult.limitZeroDetected),
    improvedCount,
    failedImproveCount,
    reviewedCount,
    failedReviewCount,
  };
}

/**
 * 改善ループが必要か判定する
 * @param {object} scoreSummary
 * @param {object} config
 * @returns {boolean}
 */
export function needsImprovementLoop(scoreSummary, config) {
  if (!scoreSummary?.slides?.length) {
    return false;
  }

  if (scoreSummary.allSlidesPublishRecommended) {
    return false;
  }

  const plan = createImprovementPlan(scoreSummary, { ...config, round: 1 });
  return plan.autoFixableTargets > 0;
}

const SOURCE_IMAGE_DIR = "images/carousel/output";
const MANIFEST_RELATIVE_PATH = `${IMPROVED_OUTPUT_DIR}/manifest.json`;
const REVIEW_RESULT_RELATIVE_PATH = "reports/nano-banana-improve/review_result.json";
const MANIFEST_SCHEMA_VERSION = "1.0";
const MANIFEST_TOOL = "nano_banana_image_improvement";
const MANIFEST_VERSION = "v1.2.1";

const NO_ISSUE_PATTERNS = [
  /^特になし\.?$/u,
  /^なし\.?$/u,
  /^問題なし\.?$/u,
  /^none\.?$/iu,
  /^no issues?\.?$/iu,
];

/** rootCause 別の改善指示（英語プロンプト用） */
const ROOT_CAUSE_INSTRUCTIONS = {
  LAYOUT: [
    "Use a plain solid background behind the text area (no patterns overlapping text).",
    "Strengthen contrast between text and background for mobile readability.",
    "Keep at least 20% safe margins on all sides; center the main text block.",
    "Improve composition so the message is instantly readable on Instagram.",
  ],
  PROMPT: [
    "Increase font size for smartphone viewing while keeping EXACT Japanese text unchanged.",
    "Maintain wide safe margins; do not add extra decorative text.",
    "Ensure every character in the original Japanese text remains identical.",
  ],
  STYLE: [
    "Align color palette and visual tone with a cohesive Instagram carousel series.",
    "Unify icon and illustration style without changing the slide meaning.",
    "Preserve brand tone; adjust only visual consistency and polish.",
  ],
  OTHER: [
    "Improve overall Instagram carousel visibility: readability, margins, composition, and contrast.",
    "Keep the existing message and Japanese wording exactly as in the source image.",
  ],
};

const SINGLE_SLIDE_REVIEW_PROMPT = `あなたはSNSビジュアルデザイナー兼Instagram編集長です。

Nano Banana で改善された Instagram カルーセル画像1枚を、100点満点で採点・レビューしてください。

【レビュー項目】
- 誤字・脱字
- 日本語の自然さ
- テキストの見切れ
- 可読性
- 配色
- ブランドデザインの統一
- アイコンやイラストの適切さ
- CTAの視認性

【採点基準】
- 100点満点で採点
- 80点以上：合格
- 90点以上：公開推奨

【出力形式】
必ず以下のJSON形式のみで出力してください。

{
  "score": 85,
  "strengths": ["良い点1"],
  "improvements": ["改善点1"]
}`;

/**
 * プロジェクト相対パスを返す
 * @param {string} absolutePath
 * @returns {string}
 */
function toProjectRelativePath(absolutePath) {
  return path.relative(PROJECT_ROOT, absolutePath).split(path.sep).join("/");
}

/**
 * scoreSummary から slide を取得する
 * @param {object} scoreSummary
 * @param {string} slideId
 * @returns {object | undefined}
 */
function findSlideInSummary(scoreSummary, slideId) {
  return scoreSummary?.slides?.find((slide) => slide.slideId === slideId);
}

/**
 * 改善点テキストを整形する
 * @param {unknown} value
 * @returns {string[]}
 */
function extractActionableImprovements(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !NO_ISSUE_PATTERNS.some((pattern) => pattern.test(item)));
}

/**
 * スライド Markdown を読み込む
 * @param {string} slideId
 * @returns {Promise<string | null>}
 */
async function loadSlideMarkdown(slideId) {
  const markdownPath = path.join(PROJECT_ROOT, "content/carousel", `${slideId}.md`);

  try {
    const content = await fs.readFile(markdownPath, "utf-8");
    return content.trim() || null;
  } catch {
    return null;
  }
}

/**
 * rootCause に応じた Nano Banana 改善プロンプトを生成する
 * @param {object} options
 * @returns {string}
 */
function buildNanoBananaPrompt({ slideReview, rootCause, slideMarkdown }) {
  const improvements = extractActionableImprovements(slideReview.improvements);
  const improvementLines =
    improvements.length > 0
      ? improvements.map((item) => `- ${item}`).join("\n")
      : "- Improve readability, margins, composition, contrast, and Instagram carousel visibility.";

  const focusLines =
    ROOT_CAUSE_INSTRUCTIONS[rootCause] ?? ROOT_CAUSE_INSTRUCTIONS.OTHER;

  const exactTextSection = slideMarkdown
    ? `\nReference slide copy (do NOT change any Japanese characters):\n${slideMarkdown}\n`
    : "";

  return [
    "Improve this Instagram carousel slide image for restaurant managers and owners.",
    "",
    "STRICT PROHIBITIONS:",
    "- Do NOT change the post theme or core meaning.",
    "- Do NOT alter, translate, or rewrite any Japanese text in the image.",
    "- Do NOT change brand tone or add new marketing messages.",
    "- Do NOT change aspect ratio (keep 1:1 square).",
    "",
    `Root cause focus (${rootCause}):`,
    ...focusLines.map((line) => `- ${line}`),
    "",
    "Review feedback to address:",
    improvementLines,
    exactTextSection,
    "Priority: text legibility, safe margins, balanced composition, light/dark contrast, and mobile visibility.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * slideId からスライド番号を取得する
 * @param {string} slideId
 * @returns {number | null}
 */
function parseSlideNumber(slideId) {
  const match = slideId.match(/^slide(\d{2})$/i);
  if (!match) {
    return null;
  }

  const number = Number(match[1]);
  return number >= 1 && number <= SLIDE_TYPES.length ? number : null;
}

/**
 * スライド種別を取得する
 * @param {string} slideId
 * @returns {string}
 */
function getSlideType(slideId) {
  const number = parseSlideNumber(slideId);
  return number ? SLIDE_TYPES[number - 1] : "不明";
}

/**
 * Gemini 再レビュー入力を組み立てる
 * @param {object} options
 * @returns {Promise<import('@google/genai').Part[]>}
 */
async function buildReviewInput({ slideId, improvedImagePath, slideMarkdown }) {
  const slideType = getSlideType(slideId);
  const imageBuffer = await fs.readFile(improvedImagePath);
  const imageBase64 = imageBuffer.toString("base64");

  const expectedTextSection = slideMarkdown
    ? `\n【想定テキスト（${slideId}.md）】\n${slideMarkdown}\n`
    : "";

  return [
    createPartFromText(
      `以下の改善済み Instagram カルーセル画像1枚を再レビューしてください。

【スライド情報】
- slideId: ${slideId}
- type: ${slideType}
- fileName: ${path.basename(improvedImagePath)}
${expectedTextSection}`,
    ),
    createPartFromText(`--- ${path.basename(improvedImagePath)}（${slideType}）---`),
    createPartFromBase64(imageBase64, "image/png"),
  ];
}

/**
 * 改善画像1枚を Gemini で再レビューする
 * @param {object} options
 * @returns {Promise<{ score: number, strengths: string[], improvements: string[] }>}
 */
async function reviewImprovedImageWithGemini({ slideId, improvedImagePath }) {
  const slideMarkdown = await loadSlideMarkdown(slideId);
  const reviewInput = await buildReviewInput({
    slideId,
    improvedImagePath,
    slideMarkdown,
  });

  const responseText = await generateWithRetry({
    contents: reviewInput,
    systemInstruction: SINGLE_SLIDE_REVIEW_PROMPT,
    cacheKey: `improved-image-review-${slideId}`,
    cacheInputFiles: [improvedImagePath],
  });

  const parsed = extractJsonFromText(responseText);
  const score = Number(parsed?.score);

  if (!Number.isFinite(score)) {
    throw new Error("再レビュー結果の score が不正です。");
  }

  return {
    score,
    strengths: Array.isArray(parsed?.strengths) ? parsed.strengths.map(String) : [],
    improvements: Array.isArray(parsed?.improvements)
      ? parsed.improvements.map(String)
      : [],
  };
}

/**
 * manifest item を組み立てる
 * @param {object} base
 * @returns {object}
 */
function buildManifestItem(base) {
  const item = {
    slideId: base.slideId,
    sourceImagePath: base.sourceImagePath,
    outputPath: base.outputPath,
    beforeScore: base.beforeScore,
    rootCause: base.rootCause,
    status: base.status,
    error: base.error ?? null,
    elapsedMs: base.elapsedMs ?? 0,
    attempts: base.attempts ?? 0,
    timeoutMs: base.timeoutMs ?? 0,
    retry: base.retry ?? 0,
    tool: base.tool ?? null,
  };

  if (Array.isArray(base.improvementPipeline)) {
    item.improvementPipeline = base.improvementPipeline;
  }
  if (base.regenerationAdapter) {
    item.regenerationAdapter = base.regenerationAdapter;
  }
  if (base.smartAutoFix) {
    item.smartAutoFix = base.smartAutoFix;
  }
  if (base.regeneration) {
    item.regeneration = base.regeneration;
  }

  return item;
}

/**
 * Smart Auto Fix 用 manifest / target result を組み立てる
 * @param {object} params
 * @returns {object}
 */
function buildSmartAutoFixManifestItem(params) {
  const {
    target,
    sourceImagePath,
    outputPath,
    rootCause,
    manifestStatus,
    safResult,
    regenResult,
    timeoutMs,
    retry,
    error,
  } = params;

  const promptPath =
    safResult?.promptPath ??
    getSlideFilePaths(parseSlideNumber(target.slideId) ?? 0).promptMd;

  const regeneration = regenResult
    ? {
        status: regenResult.status,
        adapterId: regenResult.adapterId,
        promptPath: regenResult.promptPath,
        sourceImagePath: regenResult.sourceImagePath,
        outputPath: regenResult.outputPath,
        elapsedMs: regenResult.elapsedMs ?? 0,
        attempts: regenResult.attempts ?? 0,
        error: regenResult.error ?? null,
      }
    : null;

  return buildManifestItem({
    slideId: target.slideId,
    sourceImagePath,
    outputPath,
    beforeScore: target.score,
    rootCause,
    status: manifestStatus,
    error: error ?? null,
    elapsedMs: regenResult?.elapsedMs ?? 0,
    attempts: regenResult?.attempts ?? 0,
    timeoutMs: timeoutMs ?? 0,
    retry: retry ?? 0,
    tool: IMPROVEMENT_TOOLS.SMART_AUTO_FIX,
    improvementPipeline: [...IMPROVEMENT_PIPELINE_SMART_AUTO_FIX],
    regenerationAdapter: regenResult?.adapterId ?? DEFAULT_REGENERATION_ADAPTER_ID,
    smartAutoFix: {
      status: safResult?.status ?? "failed",
      changedFiles: safResult?.changedFiles ?? [],
      backedUpFiles: safResult?.backedUpFiles ?? [],
      skippedFiles: safResult?.skippedFiles ?? [],
      promptPath,
      error: safResult?.error ?? null,
    },
    regeneration,
  });
}

/**
 * pipeline slide から Smart Auto Fix 入力 slide を組み立てる
 * @param {object} target
 * @param {object | null | undefined} slide
 * @returns {object}
 */
function buildSafSlideInput(target, slide) {
  const slideNumber = parseSlideNumber(target.slideId);
  return {
    fileName: `${target.slideId}.png`,
    number: slideNumber,
    score: target.score,
    type: slide?.type ?? null,
    improvements: [
      ...(slide?.recommendations ?? []),
      ...(slide?.issues ?? []),
    ],
    issues: slide?.issues ?? [],
  };
}

/**
 * TEXT rootCause: Smart Auto Fix → Regeneration Engine
 * @param {object} target
 * @param {object | null | undefined} slide
 * @param {object} context
 * @returns {Promise<{ item: object, metrics: object, limitZeroDetected: boolean, skipped: boolean }>}
 */
export async function processSmartAutoFixTarget(target, slide, context) {
  let metrics = context.metrics;
  const dryRun = context.dryRun ?? context.config?.dryRun ?? false;
  const projectRoot = context.projectRoot ?? PROJECT_ROOT;
  const fileName = `${target.slideId}.png`;
  const sourceImagePath = `${SOURCE_IMAGE_DIR}/${fileName}`;
  const outputPath = `${IMPROVED_OUTPUT_DIR}/${fileName}`;
  const timeoutMs = context.config?.nanoBananaTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retry = context.config?.nanoBananaRetry ?? DEFAULT_RETRY;
  const rootCause = target.rootCause ?? "TEXT";

  const safSlide = buildSafSlideInput(target, slide);

  console.log(
    `[QualityPipeline] [${dryRun ? "dry-run" : "apply"}] ${target.slideId}: smart_auto_fix → regeneration_engine`,
  );

  const safResult = await applySmartAutoFixForSlide(safSlide, {
    apply: !dryRun,
    projectRoot,
  });

  if (!dryRun && safResult.status === "failed") {
    const item = buildSmartAutoFixManifestItem({
      target,
      sourceImagePath,
      outputPath,
      rootCause,
      manifestStatus: "saf_failed",
      safResult,
      regenResult: null,
      timeoutMs,
      retry,
      error: safResult.error ?? "Smart Auto Fix に失敗しました。",
    });

    return {
      item: {
        ...item,
        action: target.action,
        beforeScore: target.score,
        autoFixable: target.autoFixable,
      },
      metrics,
      limitZeroDetected: false,
      skipped: true,
    };
  }

  const promptPath =
    safResult.promptPath ??
    getSlideFilePaths(parseSlideNumber(target.slideId) ?? 0).promptMd;

  const regenRequest = {
    slideId: target.slideId,
    promptPath,
    sourceImagePath,
    outputPath,
    adapterId: DEFAULT_REGENERATION_ADAPTER_ID,
    dryRun,
    changedTextPaths: safResult.changedFiles ?? [],
  };

  let regenResult;
  let limitZeroDetected = false;

  if (dryRun) {
    regenResult = await planRegeneration(regenRequest, {
      projectRoot,
      timeoutMs,
      retry,
    });
  } else {
    metrics = incrementApiCall(metrics, "nano_banana", PIPELINE_PHASES.IMPROVEMENT);
    regenResult = await regenerateImage(
      { ...regenRequest, dryRun: false },
      {
        projectRoot,
        timeoutMs,
        retry,
      },
    );

    if (regenResult.status === "failed") {
      const errorMessage = regenResult.error ?? "画像再生成に失敗しました。";
      limitZeroDetected = isLimitZeroError(new Error(errorMessage));
      metrics = recordFailedCall(
        metrics,
        "nano_banana",
        PIPELINE_PHASES.IMPROVEMENT,
        errorMessage,
      );
    }
  }

  let manifestStatus;
  if (dryRun) {
    manifestStatus = regenResult.status === "planned" ? "planned" : "failed";
  } else if (regenResult.status === "improved") {
    manifestStatus = "improved";
  } else {
    manifestStatus = "regen_failed";
  }

  const errorMessage =
    manifestStatus === "failed" || manifestStatus === "regen_failed"
      ? regenResult.error ?? safResult.error ?? null
      : null;

  const item = buildSmartAutoFixManifestItem({
    target,
    sourceImagePath,
    outputPath,
    rootCause,
    manifestStatus,
    safResult,
    regenResult,
    timeoutMs,
    retry,
    error: errorMessage,
  });

  if (!dryRun && manifestStatus === "improved") {
    console.log(
      `[QualityPipeline] [apply] ${target.slideId}: improved via smart_auto_fix + ${regenResult.adapterId}`,
    );
  } else if (!dryRun && manifestStatus === "regen_failed") {
    console.log(
      `[QualityPipeline] [apply] ${target.slideId}: regen_failed (${errorMessage})`,
    );
  } else if (dryRun && manifestStatus === "planned") {
    console.log(
      `  - ${target.slideId}: planned smart_auto_fix + ${regenResult.adapterId} regeneration`,
    );
  }

  return {
    item: {
      ...item,
      action: target.action,
      beforeScore: target.score,
      autoFixable: target.autoFixable,
    },
    metrics,
    limitZeroDetected,
    skipped: dryRun ? false : manifestStatus !== "improved",
  };
}

/**
 * Nano Banana 対象1件を処理する
 * @param {object} target
 * @param {object | undefined} slide
 * @param {object} context
 * @returns {Promise<{ item: object, metrics: object, limitZeroDetected: boolean }>}
 */
async function processNanoBananaTarget(target, slide, context) {
  let metrics = context.metrics;
  const fileName = `${target.slideId}.png`;
  const sourceImagePath = `${SOURCE_IMAGE_DIR}/${fileName}`;
  const outputPath = `${IMPROVED_OUTPUT_DIR}/${fileName}`;
  const sourceAbsolute = path.join(PROJECT_ROOT, sourceImagePath);
  const outputAbsolute = path.join(PROJECT_ROOT, outputPath);
  const timeoutMs = context.config?.nanoBananaTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retry = context.config?.nanoBananaRetry ?? DEFAULT_RETRY;

  const baseItem = {
    slideId: target.slideId,
    sourceImagePath,
    outputPath,
    beforeScore: target.score,
    rootCause: target.rootCause,
    tool: "nano_banana",
    timeoutMs,
    retry,
  };

  try {
    await fs.access(sourceAbsolute);
  } catch {
    return {
      item: buildManifestItem({
        ...baseItem,
        status: "failed",
        error: `元画像が見つかりません: ${sourceImagePath}`,
      }),
      metrics,
      limitZeroDetected: false,
    };
  }

  const rootCause = target.rootCause ?? classifyRootCause({
    improvements: slide?.recommendations ?? [],
    issues: slide?.issues ?? [],
  }).rootCause;

  const slideMarkdown = await loadSlideMarkdown(target.slideId);
  const prompt = buildNanoBananaPrompt({
    slideReview: {
      improvements: slide?.recommendations ?? [],
      score: target.score,
    },
    rootCause: rootCause ?? "OTHER",
    slideMarkdown,
  });

  metrics = incrementApiCall(metrics, "nano_banana", PIPELINE_PHASES.IMPROVEMENT);

  const result = await improveImageWithNanoBanana({
    sourceImagePath: sourceAbsolute,
    prompt,
    outputPath: outputAbsolute,
    dryRun: false,
    timeoutMs,
    retry,
  });

  if (!result.success) {
    const errorMessage = result.error ?? "Nano Banana 改善に失敗しました。";
    const limitZeroDetected = isLimitZeroError(new Error(errorMessage));
    metrics = recordFailedCall(
      metrics,
      "nano_banana",
      PIPELINE_PHASES.IMPROVEMENT,
      errorMessage,
    );

    return {
      item: buildManifestItem({
        ...baseItem,
        rootCause,
        status: "failed",
        error: errorMessage,
        elapsedMs: result.elapsedMs,
        attempts: result.attempts,
      }),
      metrics,
      limitZeroDetected,
    };
  }

  return {
    item: buildManifestItem({
      ...baseItem,
      rootCause,
      status: "improved",
      error: null,
      elapsedMs: result.elapsedMs,
      attempts: result.attempts,
    }),
    metrics,
    limitZeroDetected: false,
  };
}

/**
 * 未接続 tool の placeholder 結果を返す
 * @param {object} target
 * @returns {object}
 */
function buildPlaceholderTargetResult(target) {
  const messageByTool = {
    manual_review: "手動確認が必要（autoFixable: false）",
    openai_regenerate: "Phase 4-D: openai_regenerate は未接続（placeholder_prepared）",
  };

  const message =
    messageByTool[target.tool] ?? `Phase 4-D: ${target.tool} は未接続（placeholder_prepared）`;

  const status =
    target.tool === IMPROVEMENT_TOOLS.MANUAL_REVIEW
      ? "manual_review"
      : target.tool === IMPROVEMENT_TOOLS.OPENAI_REGENERATE
        ? "placeholder_prepared"
        : "placeholder";

  console.log(`  - ${target.slideId}: ${target.tool} (${message})`);

  return {
    slideId: target.slideId,
    tool: target.tool,
    action: target.action,
    rootCause: target.rootCause,
    beforeScore: target.score,
    status,
    error: message,
    autoFixable: target.autoFixable,
  };
}

/**
 * openai_regenerate 接続準備用 placeholder（Phase 4-D: 未実行）
 * @param {object} target
 * @param {object} slide
 * @param {object} context
 * @returns {Promise<object>}
 */
async function processOpenAiRegeneratePlaceholder(target, slide, context) {
  return {
    item: buildPlaceholderTargetResult(target),
    metrics: context.metrics,
    limitZeroDetected: false,
    skipped: true,
  };
}

/**
 * tool 別に改善 target を処理する（dispatcher）
 * @param {object} target
 * @param {object | null | undefined} slide
 * @param {object} context
 * @returns {Promise<object>}
 */
export async function processImprovementTarget(target, slide, context) {
  switch (target.tool) {
    case IMPROVEMENT_TOOLS.NANO_BANANA:
      return processNanoBananaTarget(target, slide, context);
    case IMPROVEMENT_TOOLS.SMART_AUTO_FIX:
      return processSmartAutoFixTarget(target, slide, context);
    case IMPROVEMENT_TOOLS.OPENAI_REGENERATE:
      return processOpenAiRegeneratePlaceholder(target, slide, context);
    case IMPROVEMENT_TOOLS.MANUAL_REVIEW:
      return {
        item: buildPlaceholderTargetResult(target),
        metrics: context.metrics,
        limitZeroDetected: false,
        skipped: true,
      };
    default:
      return {
        item: buildPlaceholderTargetResult(target),
        metrics: context.metrics,
        limitZeroDetected: false,
        skipped: true,
      };
  }
}

/**
 * manifest を書き込む
 * @param {object} manifest
 * @returns {Promise<string>}
 */
async function writeImprovementManifest(manifest) {
  const absolutePath = path.join(PROJECT_ROOT, MANIFEST_RELATIVE_PATH);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  return MANIFEST_RELATIVE_PATH;
}

/**
 * 改善 plan を apply する（Nano Banana のみ実実行）
 * @param {object} plan
 * @param {object} context
 * @returns {Promise<object>}
 */
export async function applyImprovementPlan(plan, context) {
  console.log(
    `[QualityPipeline] [apply] IMPROVEMENT round ${plan.round}: ${plan.totalTargets} target(s) (${plan.autoFixableTargets} auto-fixable, ${plan.manualReviewTargets} manual)`,
  );

  let metrics = context.metrics;
  let limitZeroDetected = false;
  /** @type {object[]} */
  const manifestItems = [];
  /** @type {object[]} */
  const targetResults = [];
  let nanoBananaExecuted = 0;
  let smartAutoFixExecuted = 0;
  let improvedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const smartAutoFixMetrics = {
    executedSmartAutoFix: 0,
    successfulSmartAutoFix: 0,
    failedSmartAutoFix: 0,
    executedRegeneration: 0,
    successfulRegeneration: 0,
    failedRegeneration: 0,
  };

  for (const target of plan.targets) {
    const slide = findSlideInSummary(context.state.scoreSummary, target.slideId);
    const processed = await processImprovementTarget(target, slide, {
      ...context,
      metrics,
      dryRun: false,
    });
    metrics = processed.metrics;
    limitZeroDetected = limitZeroDetected || processed.limitZeroDetected;
    targetResults.push(processed.item);

    if (target.tool === IMPROVEMENT_TOOLS.NANO_BANANA) {
      manifestItems.push(processed.item);
      nanoBananaExecuted += 1;

      if (processed.item.status === "improved") {
        improvedCount += 1;
        console.log(
          `[QualityPipeline] [apply] ${target.slideId}: improved via nano_banana`,
        );
      } else if (processed.item.status === "failed") {
        failedCount += 1;
        console.log(
          `[QualityPipeline] [apply] ${target.slideId}: failed (${processed.item.error})`,
        );
      }
      continue;
    }

    if (target.tool === IMPROVEMENT_TOOLS.SMART_AUTO_FIX) {
      manifestItems.push(processed.item);
      smartAutoFixExecuted += 1;
      nanoBananaExecuted += 1;
      accumulateSmartAutoFixMetrics(processed.item, smartAutoFixMetrics);

      if (processed.item.status === "improved") {
        improvedCount += 1;
      } else if (
        processed.item.status === "saf_failed" ||
        processed.item.status === "regen_failed" ||
        processed.item.status === "failed"
      ) {
        failedCount += 1;
      } else {
        skippedCount += 1;
      }
      continue;
    }

    skippedCount += 1;

    if (
      target.tool !== IMPROVEMENT_TOOLS.MANUAL_REVIEW &&
      target.tool === IMPROVEMENT_TOOLS.OPENAI_REGENERATE
    ) {
      manifestItems.push(
        buildManifestItem({
          slideId: target.slideId,
          sourceImagePath: `${SOURCE_IMAGE_DIR}/${target.slideId}.png`,
          outputPath: `${IMPROVED_OUTPUT_DIR}/${target.slideId}.png`,
          beforeScore: target.score,
          rootCause: target.rootCause,
          tool: target.tool,
          status: processed.item.status,
          error: processed.item.error,
        }),
      );
    }
  }

  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    tool: MANIFEST_TOOL,
    version: MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    pipelineRound: plan.round,
    dryRun: false,
    totalItems: manifestItems.length,
    improvedCount,
    failedCount,
    skippedCount,
    placeholderCount: skippedCount,
    items: manifestItems,
  };

  const manifestPath = await writeImprovementManifest(manifest);

  metrics = recordImprovementExecutionMetrics(metrics, {
    round: plan.round,
    nanoBananaExecuted,
    geminiReReviewExecuted: 0,
    limitZeroDetected,
    successfulActions: improvedCount,
    failedActions: failedCount,
    skippedActions: skippedCount,
    executedActions: nanoBananaExecuted,
    improvedCount,
    failedImproveCount: failedCount,
    manualReviewOnly: plan.autoFixableTargets === 0 && plan.manualReviewTargets > 0,
    executedSmartAutoFix: smartAutoFixMetrics.executedSmartAutoFix,
    successfulSmartAutoFix: smartAutoFixMetrics.successfulSmartAutoFix,
    failedSmartAutoFix: smartAutoFixMetrics.failedSmartAutoFix,
    executedRegeneration: smartAutoFixMetrics.executedRegeneration,
    successfulRegeneration: smartAutoFixMetrics.successfulRegeneration,
    failedRegeneration: smartAutoFixMetrics.failedRegeneration,
  });

  const status =
    failedCount > 0 && improvedCount > 0
      ? "partial"
      : failedCount > 0
        ? "failed"
        : "completed";

  return {
    round: plan.round,
    status,
    manifest,
    manifestPath,
    targetResults,
    improvedCount,
    failedCount,
    skippedCount,
    placeholderCount: skippedCount,
    nanoBananaExecuted,
    limitZeroDetected,
    metrics,
    improvementResult: {
      round: plan.round,
      status,
      plannedActions: plan.totalTargets,
      autoFixableTargets: plan.autoFixableTargets,
      manualReviewTargets: plan.manualReviewTargets,
      targets: targetResults,
      manifestPath,
      improvedCount,
      failedCount,
      skippedCount,
      placeholderCount: skippedCount,
    },
  };
}

/**
 * manifest item が Gemini ReReview 対象かどうか
 * @param {object | null | undefined} manifestItem
 * @returns {boolean}
 */
export function isReReviewEligibleManifestItem(manifestItem) {
  return manifestItem?.status === "improved";
}

/**
 * manifest item から ReReview 結果 item に付与するメタデータ
 * @param {object} manifestItem
 * @returns {object}
 */
export function buildReReviewMetadataFromManifest(manifestItem) {
  return {
    tool: manifestItem.tool ?? null,
    improvementPipeline: manifestItem.improvementPipeline ?? null,
    regenerationAdapter:
      manifestItem.regenerationAdapter ?? manifestItem.regeneration?.adapterId ?? null,
    reviewSource: resolveReviewSourceFromManifestItem(manifestItem),
  };
}

/**
 * Smart Auto Fix 実行結果から metrics カウンタを加算する
 * @param {object} item
 * @param {object} counters
 */
function accumulateSmartAutoFixMetrics(item, counters) {
  counters.executedSmartAutoFix += 1;

  const safStatus = item.smartAutoFix?.status;
  if (item.status === "saf_failed" || safStatus === "failed") {
    counters.failedSmartAutoFix += 1;
    return;
  }

  if (safStatus === "applied" || safStatus === "skipped" || item.status === "planned") {
    counters.successfulSmartAutoFix += 1;
  }

  if (item.regeneration || item.status === "improved" || item.status === "regen_failed") {
    counters.executedRegeneration += 1;
  }

  if (item.status === "improved") {
    counters.successfulRegeneration += 1;
  } else if (item.status === "regen_failed") {
    counters.failedRegeneration += 1;
  }
}

/**
 * manifest の改善画像を Gemini で再レビューする
 * @param {object} context
 * @param {string} [manifestPath]
 * @returns {Promise<object>}
 */
export async function applyReReviewFromManifest(context, manifestPath = MANIFEST_RELATIVE_PATH) {
  const absoluteManifestPath = path.join(PROJECT_ROOT, manifestPath);

  console.log(
    `[QualityPipeline] [apply] RE_REVIEW round ${context.round}: manifest から再レビュー (${manifestPath})`,
  );

  let manifestData;
  try {
    const raw = await fs.readFile(absoluteManifestPath, "utf-8");
    manifestData = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "skipped",
      message: `manifest が読み込めません: ${message}`,
      scoreSummaryLoaded: false,
      metrics: context.metrics,
    };
  }

  let metrics = context.metrics;
  let limitZeroDetected = false;
  /** @type {object[]} */
  const reviewItems = [];
  let geminiReReviewExecuted = 0;
  let reviewedCount = 0;
  let failedReviewCount = 0;

  for (const manifestItem of manifestData.items ?? []) {
    const slideId = manifestItem.slideId;
    const beforeScore =
      typeof manifestItem.beforeScore === "number" ? manifestItem.beforeScore : null;
    const beforeRootCause = manifestItem.rootCause ?? null;

    const baseItem = {
      slideId,
      sourceImagePath: manifestItem.sourceImagePath,
      improvedImagePath: manifestItem.outputPath,
      beforeScore,
      afterScore: null,
      deltaScore: null,
      beforeRootCause,
      afterRootCause: null,
      error: null,
      reviewElapsedMs: 0,
      ...buildReReviewMetadataFromManifest(manifestItem),
    };

    if (!isReReviewEligibleManifestItem(manifestItem)) {
      reviewItems.push({ ...baseItem, status: "skipped" });
      continue;
    }

    const improvedAbsolute = path.isAbsolute(manifestItem.outputPath)
      ? manifestItem.outputPath
      : path.join(PROJECT_ROOT, manifestItem.outputPath);

    try {
      await fs.access(improvedAbsolute);
    } catch {
      failedReviewCount += 1;
      reviewItems.push({
        ...baseItem,
        status: "failed_review",
        error: `改善画像が見つかりません: ${manifestItem.outputPath}`,
      });
      continue;
    }

    const startedAt = Date.now();
    metrics = incrementApiCall(metrics, "gemini", PIPELINE_PHASES.RE_REVIEW);
    geminiReReviewExecuted += 1;

    try {
      const review = await reviewImprovedImageWithGemini({
        slideId,
        improvedImagePath: improvedAbsolute,
      });
      const afterRootCause = classifyRootCause(review).rootCause;
      const afterScore = review.score;
      const deltaScore = beforeScore === null ? null : afterScore - beforeScore;

      reviewedCount += 1;
      reviewItems.push({
        ...baseItem,
        afterScore,
        deltaScore,
        afterRootCause,
        status: "reviewed",
        reviewElapsedMs: Date.now() - startedAt,
      });

      console.log(
        `[QualityPipeline] [apply] RE_REVIEW ${slideId}: reviewed score=${afterScore} (delta=${deltaScore >= 0 ? "+" : ""}${deltaScore}, source=${baseItem.reviewSource})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      limitZeroDetected = limitZeroDetected || isLimitZeroError(error);
      metrics = recordFailedCall(metrics, "gemini", PIPELINE_PHASES.RE_REVIEW, error);
      failedReviewCount += 1;
      reviewItems.push({
        ...baseItem,
        status: "failed_review",
        error: message,
        reviewElapsedMs: Date.now() - startedAt,
      });
      console.log(
        `[QualityPipeline] [apply] RE_REVIEW ${slideId}: failed_review (${message})`,
      );
    }
  }

  const generatedAt = new Date().toISOString();
  const reviewResult = {
    generatedAt,
    manifestFile: manifestPath,
    pipelineRound: context.round,
    totalItems: reviewItems.length,
    reviewTargetCount: (manifestData.items ?? []).filter((item) => item.status === "improved")
      .length,
    reviewedCount,
    failedReviewCount,
    items: reviewItems,
  };

  const reviewResultAbsolutePath = path.join(PROJECT_ROOT, REVIEW_RESULT_RELATIVE_PATH);
  await fs.mkdir(path.dirname(reviewResultAbsolutePath), { recursive: true });
  await fs.writeFile(
    reviewResultAbsolutePath,
    `${JSON.stringify(reviewResult, null, 2)}\n`,
    "utf-8",
  );

  metrics = recordImprovementExecutionMetrics(metrics, {
    round: context.round,
    nanoBananaExecuted: 0,
    geminiReReviewExecuted,
    limitZeroDetected,
    successfulActions: reviewedCount,
    failedActions: failedReviewCount,
    reviewedCount,
    failedReviewCount,
    manualReviewOnly: false,
  });

  const scoreSummary = mergeReviewResultIntoScoreSummary(
    context.state.scoreSummary,
    reviewItems,
    context.config,
  );

  console.log(
    `[QualityPipeline] [apply] RE_REVIEW round ${context.round}: avg=${scoreSummary.averageScore}, min=${scoreSummary.minScore}, publishRecommended=${scoreSummary.allSlidesPublishRecommended}`,
  );

  return {
    status: reviewedCount > 0 ? "completed" : failedReviewCount > 0 ? "partial" : "skipped",
    message: `再レビュー完了: reviewed=${reviewedCount}, failed=${failedReviewCount}`,
    scoreSummary,
    scoreSummaryLoaded: scoreSummary.slides.length > 0,
    reviewResult,
    reviewResultPath: REVIEW_RESULT_RELATIVE_PATH,
    reviewedCount,
    failedReviewCount,
    metrics,
    limitZeroDetected,
  };
}

/**
 * Phase 4-A: 改善 placeholder を適用する（API 未実行）
 * @param {object} plan
 * @param {object} context
 * @returns {Promise<object>}
 */
export async function applyImprovementPlaceholder(plan, context) {
  const dryRun = context.dryRun ?? context.config?.dryRun ?? true;
  const mode = dryRun ? "dry-run" : "apply";

  console.log(
    `[QualityPipeline] [${mode}] IMPROVEMENT round ${plan.round}: ${plan.totalTargets} target(s) (${plan.autoFixableTargets} auto-fixable, ${plan.manualReviewTargets} manual)`,
  );

  /** @type {object[]} */
  const targetResults = [];
  let metrics = context.metrics;
  const smartAutoFixMetrics = {
    executedSmartAutoFix: 0,
    successfulSmartAutoFix: 0,
    failedSmartAutoFix: 0,
    executedRegeneration: 0,
    successfulRegeneration: 0,
    failedRegeneration: 0,
  };

  for (const target of plan.targets) {
    if (target.tool === IMPROVEMENT_TOOLS.SMART_AUTO_FIX) {
      const slide = findSlideInSummary(context.state.scoreSummary, target.slideId);
      const processed = await processSmartAutoFixTarget(target, slide, {
        ...context,
        dryRun: true,
        metrics,
      });
      metrics = processed.metrics;
      targetResults.push(processed.item);
      accumulateSmartAutoFixMetrics(processed.item, smartAutoFixMetrics);
      continue;
    }

    console.log(
      `  - ${target.slideId}: ${target.action} via ${target.tool} (${target.reason})`,
    );
  }

  if (smartAutoFixMetrics.executedSmartAutoFix > 0) {
    metrics = recordImprovementExecutionMetrics(metrics, {
      round: plan.round,
      executedSmartAutoFix: smartAutoFixMetrics.executedSmartAutoFix,
      successfulSmartAutoFix: smartAutoFixMetrics.successfulSmartAutoFix,
      executedRegeneration: smartAutoFixMetrics.executedRegeneration,
      successfulRegeneration: smartAutoFixMetrics.successfulRegeneration,
      failedSmartAutoFix: smartAutoFixMetrics.failedSmartAutoFix,
      failedRegeneration: smartAutoFixMetrics.failedRegeneration,
      manualReviewOnly: false,
    });
  }

  return {
    round: plan.round,
    status: dryRun ? "planned" : "placeholder",
    plannedActions: plan.targets.length,
    autoFixableTargets: plan.autoFixableTargets,
    manualReviewTargets: plan.manualReviewTargets,
    targets: targetResults.length > 0 ? targetResults : plan.targets,
    targetResults,
    metrics,
  };
}
