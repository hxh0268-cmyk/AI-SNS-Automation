import fs from "node:fs/promises";
import path from "node:path";
import { PROJECT_ROOT } from "./pipeline_state.js";

/** 画像レビュー JSON の優先読み込みパス（プロジェクト相対） */
export const IMAGE_REVIEW_CANDIDATE_PATHS = [
  "images/carousel/review/image_review.json",
  "reports/nano-banana-improve/review_result.json",
];

/**
 * 空の scoreSummary を生成する
 * @param {object} config
 * @returns {object}
 */
export function createEmptyScoreSummary(config) {
  return {
    targetScore: config.targetScore ?? 90,
    passingScore: config.passingScore ?? 80,
    averageScore: null,
    minScore: null,
    allSlidesPassed: false,
    allSlidesPublishRecommended: false,
    slides: [],
  };
}

/**
 * scoreSummary から averageScore / minScore スナップショットを抽出する
 * @param {object | null | undefined} scoreSummary
 * @returns {{ averageScore: number | null, minScore: number | null }}
 */
export function extractScoreSnapshot(scoreSummary) {
  if (!scoreSummary?.slides?.length) {
    return { averageScore: null, minScore: null };
  }

  return {
    averageScore:
      typeof scoreSummary.averageScore === "number" ? scoreSummary.averageScore : null,
    minScore: typeof scoreSummary.minScore === "number" ? scoreSummary.minScore : null,
  };
}

/**
 * scoreBefore / scoreAfter から delta を計算する
 * @param {object | null} scoreBefore
 * @param {object | null} scoreAfter
 * @returns {{ averageScore: number, minScore: number }}
 */
export function buildScoreDelta(scoreBefore, scoreAfter) {
  if (!scoreBefore || !scoreAfter) {
    return { averageScore: 0, minScore: 0 };
  }

  return {
    averageScore: (scoreAfter.averageScore ?? 0) - (scoreBefore.averageScore ?? 0),
    minScore: (scoreAfter.minScore ?? 0) - (scoreBefore.minScore ?? 0),
  };
}

/**
 * 数値スコアを item から抽出する
 * @param {object} item
 * @returns {number | null}
 */
function extractScoreFromItem(item) {
  const candidates = [
    item.score,
    item.totalScore,
    item.overallScore,
    item.afterScore,
    item.beforeScore,
    item.rating,
  ];

  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

/**
 * slideId を item から抽出する
 * @param {object} item
 * @param {number} index
 * @returns {string}
 */
function extractSlideId(item, index) {
  if (typeof item.slideId === "string" && item.slideId.trim()) {
    return item.slideId.trim();
  }

  if (typeof item.id === "string" && item.id.trim()) {
    return item.id.trim();
  }

  if (typeof item.fileName === "string" && item.fileName.trim()) {
    return item.fileName.replace(/\.[^.]+$/, "");
  }

  if (typeof item.number === "number") {
    return `slide${String(item.number).padStart(2, "0")}`;
  }

  return `slide${String(index + 1).padStart(2, "0")}`;
}

/**
 * issues / recommendations を item から抽出する
 * @param {object} item
 * @returns {{ issues: string[], recommendations: string[] }}
 */
function extractIssuesAndRecommendations(item) {
  const issues = [];
  const recommendations = [];

  for (const value of [item.issues, item.failedItems, item.weaknesses]) {
    if (Array.isArray(value)) {
      issues.push(...value.filter((entry) => typeof entry === "string"));
    }
  }

  for (const value of [
    item.recommendations,
    item.improvements,
    item.suggestions,
  ]) {
    if (Array.isArray(value)) {
      recommendations.push(...value.filter((entry) => typeof entry === "string"));
    }
  }

  return { issues, recommendations };
}

/**
 * レビュー JSON から slide 配列を抽出する
 * @param {unknown} reviewJson
 * @param {string} source
 * @returns {object[]}
 */
function extractSlideEntries(reviewJson, source) {
  if (!reviewJson || typeof reviewJson !== "object") {
    return [];
  }

  /** @type {object} */
  const data = reviewJson;

  const collections = [
    data.slides,
    data.items,
    data.results,
  ].filter(Array.isArray);

  if (collections.length === 0) {
    const topLevelScore = extractScoreFromItem(data);
    if (topLevelScore !== null) {
      return [
        {
          slideId: "overall",
          score: topLevelScore,
          source,
          issues: Array.isArray(data.failedItems) ? data.failedItems : [],
          recommendations: Array.isArray(data.improvements) ? data.improvements : [],
        },
      ];
    }

    return [];
  }

  const slides = [];
  for (const collection of collections) {
    for (let index = 0; index < collection.length; index += 1) {
      const item = collection[index];
      if (!item || typeof item !== "object") {
        continue;
      }

      const score = extractScoreFromItem(item);
      if (score === null) {
        continue;
      }

      const { issues, recommendations } = extractIssuesAndRecommendations(item);

      slides.push({
        slideId: extractSlideId(item, index),
        score,
        source,
        issues,
        recommendations,
      });
    }
  }

  return slides;
}

/**
 * 既存レビュー JSON を pipeline 用 slide 配列に正規化する
 * @param {unknown} reviewJson
 * @param {object} config
 * @param {string} [source="unknown"]
 * @returns {object[]}
 */
export function normalizeImageReviewScores(reviewJson, config, source = "unknown") {
  try {
    return extractSlideEntries(reviewJson, source);
  } catch {
    return [];
  }
}

/**
 * slide 配列から scoreSummary を計算する
 * @param {object[]} slides
 * @param {object} config
 * @returns {object}
 */
export function calculateScoreSummary(slides, config) {
  const targetScore = config.targetScore ?? 90;
  const passingScore = config.passingScore ?? 80;

  if (!Array.isArray(slides) || slides.length === 0) {
    return createEmptyScoreSummary(config);
  }

  const normalizedSlides = slides
    .filter((slide) => typeof slide.score === "number" && Number.isFinite(slide.score))
    .map((slide) => ({
      slideId: slide.slideId,
      score: slide.score,
      passed: slide.score >= passingScore,
      publishRecommended: slide.score >= targetScore,
      source: slide.source ?? "unknown",
      issues: Array.isArray(slide.issues) ? slide.issues : [],
      recommendations: Array.isArray(slide.recommendations) ? slide.recommendations : [],
      rootCause: slide.rootCause ?? null,
    }));

  if (normalizedSlides.length === 0) {
    return createEmptyScoreSummary(config);
  }

  const scores = normalizedSlides.map((slide) => slide.score);
  const averageScore =
    scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const minScore = Math.min(...scores);

  return {
    targetScore,
    passingScore,
    averageScore,
    minScore,
    allSlidesPassed: normalizedSlides.every((slide) => slide.passed),
    allSlidesPublishRecommended: normalizedSlides.every(
      (slide) => slide.publishRecommended,
    ),
    slides: normalizedSlides,
  };
}

/**
 * ファイルパスが存在するか確認する
 * @param {string} relativePath
 * @returns {Promise<boolean>}
 */
async function fileExists(relativePath) {
  try {
    const stat = await fs.stat(path.join(PROJECT_ROOT, relativePath));
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * 既存レビュー JSON を読み込んで scoreSummary を返す
 * @param {object} config
 * @returns {Promise<{ found: boolean, summary: object | null, source: string | null, path: string | null }>}
 */
export async function readImageReviewScoreSummary(config) {
  for (const relativePath of IMAGE_REVIEW_CANDIDATE_PATHS) {
    if (!(await fileExists(relativePath))) {
      continue;
    }

    try {
      const raw = await fs.readFile(path.join(PROJECT_ROOT, relativePath), "utf-8");
      const reviewJson = JSON.parse(raw);
      const source = relativePath.includes("nano-banana")
        ? "nano_banana_review"
        : "image_review";
      const slides = normalizeImageReviewScores(reviewJson, config, source);

      if (slides.length === 0) {
        continue;
      }

      return {
        found: true,
        summary: calculateScoreSummary(slides, config),
        source,
        path: relativePath,
      };
    } catch {
      continue;
    }
  }

  return {
    found: false,
    summary: null,
    source: null,
    path: null,
  };
}

/**
 * 再レビュー結果を scoreSummary にマージする
 * @param {object} scoreSummary
 * @param {object[]} reviewItems
 * @param {object} config
 * @returns {object}
 */
export function mergeReviewResultIntoScoreSummary(scoreSummary, reviewItems, config) {
  if (!scoreSummary?.slides?.length) {
    return createEmptyScoreSummary(config);
  }

  const reviewBySlideId = new Map(
    reviewItems
      .filter(
        (item) =>
          item.status === "reviewed" &&
          typeof item.afterScore === "number" &&
          Number.isFinite(item.afterScore),
      )
      .map((item) => [item.slideId, item]),
  );

  const mergedSlides = scoreSummary.slides.map((slide) => {
    const reviewed = reviewBySlideId.get(slide.slideId);
    if (!reviewed) {
      return slide;
    }

    return {
      ...slide,
      score: reviewed.afterScore,
      source:
        reviewed.reviewSource ?? resolveReviewSource(null, reviewed),
      rootCause: reviewed.afterRootCause ?? slide.rootCause ?? null,
      issues: [],
      recommendations: [],
    };
  });

  return calculateScoreSummary(mergedSlides, config);
}

/** scoreSummary slide.source: Nano Banana 直呼び後の再レビュー */
export const REVIEW_SOURCE_NANO_BANANA = "nano_banana_re_review";

/** scoreSummary slide.source: Smart Auto Fix → Regeneration チェーン後の再レビュー */
export const REVIEW_SOURCE_SMART_AUTO_FIX = "smart_auto_fix_re_review";

/**
 * manifest item から ReReview / scoreSummary 用 source を決定する
 * @param {object | null | undefined} manifestItem
 * @returns {string}
 */
export function resolveReviewSourceFromManifestItem(manifestItem) {
  if (!manifestItem || typeof manifestItem !== "object") {
    return REVIEW_SOURCE_NANO_BANANA;
  }

  const pipeline = manifestItem.improvementPipeline ?? [];
  if (
    manifestItem.tool === "smart_auto_fix" ||
    pipeline.includes("smart_auto_fix") ||
    pipeline.includes("regeneration_engine")
  ) {
    return REVIEW_SOURCE_SMART_AUTO_FIX;
  }

  if (manifestItem.tool === "nano_banana" || pipeline.includes("nano_banana")) {
    return REVIEW_SOURCE_NANO_BANANA;
  }

  return REVIEW_SOURCE_NANO_BANANA;
}

/**
 * review item / manifest から scoreSummary 用 source を決定する
 * @param {object | null | undefined} manifestItem
 * @param {object | null | undefined} reviewItem
 * @returns {string}
 */
export function resolveReviewSource(manifestItem, reviewItem) {
  if (reviewItem?.reviewSource) {
    return reviewItem.reviewSource;
  }

  if (reviewItem?.tool || reviewItem?.improvementPipeline) {
    return resolveReviewSourceFromManifestItem(reviewItem);
  }

  return resolveReviewSourceFromManifestItem(manifestItem);
}
