import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyRootCause } from "./lib/root_cause.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const REVIEW_JSON_FILE = path.join(
  PROJECT_ROOT,
  "images/carousel/review/image_review.json",
);

const DEFAULT_PASSING_SCORE = 80;

/**
 * image_review.json を読み込む
 * @returns {Promise<object>}
 */
async function loadReviewJson() {
  let fileContent;
  try {
    fileContent = await fs.readFile(REVIEW_JSON_FILE, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "レビューファイルが見つかりません: images/carousel/review/image_review.json",
      );
    }
    throw new Error(
      `image_review.json の読み込みに失敗しました: ${error.message}`,
    );
  }

  try {
    return JSON.parse(fileContent);
  } catch {
    throw new Error("image_review.json の形式が不正です。");
  }
}

/**
 * 改善対象スライドか判定する
 * @param {object} slide
 * @param {Set<string>} failedItems
 * @param {number} passingScore
 * @returns {boolean}
 */
function isTargetSlide(slide, failedItems, passingScore) {
  const slideKey = slide.fileName?.replace(/\.png$/i, "");
  if (slideKey && failedItems.has(slideKey)) {
    return true;
  }

  const score = Number(slide.score);
  return Number.isFinite(score) && score < passingScore;
}

/**
 * failedItems を Set として取得する
 * @param {unknown} failedItems
 * @returns {Set<string>}
 */
function toFailedItemSet(failedItems) {
  if (!Array.isArray(failedItems)) {
    return new Set();
  }

  return new Set(
    failedItems.filter((item) => typeof item === "string" && item.trim()),
  );
}

/**
 * メイン処理
 */
async function main() {
  console.log("========================================");
  console.log("rootCause 判定チェック");
  console.log("========================================");
  console.log("");

  const review = await loadReviewJson();
  const passingScore = Number(review.passingScore ?? DEFAULT_PASSING_SCORE);
  const failedItems = toFailedItemSet(review.failedItems);
  const slides = Array.isArray(review.slides) ? review.slides : [];

  const targets = slides.filter((slide) =>
    isTargetSlide(slide, failedItems, passingScore),
  );

  console.log(`合格ライン: ${passingScore} 点`);
  console.log(`failedItems: ${failedItems.size > 0 ? [...failedItems].join(", ") : "なし"}`);
  console.log("");

  if (targets.length === 0) {
    console.log("改善対象なし");
    console.log("");
    console.log("すべてのスライドが合格ライン以上です。");
    return;
  }

  console.log(`改善対象: ${targets.length} 枚`);
  console.log("");

  for (const slide of targets) {
    const result = classifyRootCause(slide);
    const slideKey = slide.fileName ?? `slide${String(slide.number).padStart(2, "0")}.png`;

    console.log(`【${slideKey}】（${slide.type ?? "種別不明"} / ${slide.score ?? "点数不明"} 点）`);
    console.log(`- rootCause: ${result.rootCause}`);
    console.log(`- reason: ${result.reason}`);

    if (result.matchedKeywords.length > 0) {
      console.log(`- matchedKeywords: ${result.matchedKeywords.join(", ")}`);
    } else {
      console.log("- matchedKeywords: なし");
    }

    const improvements = Array.isArray(slide.improvements)
      ? slide.improvements.filter((item) => typeof item === "string" && item.trim())
      : [];

    if (improvements.length > 0) {
      console.log("- improvements:");
      for (const item of improvements) {
        console.log(`  - ${item}`);
      }
    }

    console.log("");
  }

  console.log("========================================");
  console.log("rootCause 判定チェック完了");
  console.log("========================================");
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
