import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SLIDE_COUNT,
  getCarouselOutputImageFileName,
  loadSlides,
} from "./lib/carousel.js";

// プロジェクトルートを取得（このスクリプトは src/ 配下にある前提）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// 入出力ファイルのパス
const CAPTION_FILE = path.join(PROJECT_ROOT, "content/reviewed/post.md");
const CAROUSEL_CONTENT_DIR = path.join(PROJECT_ROOT, "content/carousel");
const IMAGE_OUTPUT_DIR = path.join(PROJECT_ROOT, "images/carousel/output");
const REVIEW_JSON_FILE = path.join(
  PROJECT_ROOT,
  "images/carousel/review/image_review.json",
);
const EXPORT_DIR = path.join(PROJECT_ROOT, "output/instagram");
const EXPORT_SLIDES_DIR = path.join(EXPORT_DIR, "slides");

/**
 * image_review.json を読み込む
 * @returns {Promise<object>}
 */
async function loadImageReview() {
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
 * キャプション本文を読み込む
 * @returns {Promise<string>}
 */
async function loadCaption() {
  try {
    const content = await fs.readFile(CAPTION_FILE, "utf-8");
    if (!content.trim()) {
      throw new Error("content/reviewed/post.md が空です。");
    }
    return content;
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "キャプションファイルが見つかりません: content/reviewed/post.md",
      );
    }
    throw error;
  }
}

/**
 * 画像レビュー結果の要約 Markdown を生成する
 * @param {object} review - image_review.json の内容
 * @returns {string}
 */
function buildReviewSummary(review) {
  const failedItemsLines =
    review.failedItems?.length > 0
      ? review.failedItems.map((item) => `- ${item}`).join("\n")
      : "- なし";

  const slideLines = (review.slides ?? [])
    .map((slide) => {
      const status =
        slide.score >= (review.passingScore ?? 80) ? "合格" : "改善が必要";
      return `- ${slide.fileName}（${slide.type}）: ${slide.score} / 100点（${status}）`;
    })
    .join("\n");

  const strengthsLines =
    review.strengths?.length > 0
      ? review.strengths.map((item) => `- ${item}`).join("\n")
      : "- なし";

  const improvementsLines =
    review.improvements?.length > 0
      ? review.improvements.map((item) => `- ${item}`).join("\n")
      : "- なし";

  return `# Instagram画像レビュー要約

## 総合点
${review.score} / 100点

## 判定
${review.status ?? (review.passed ? "合格" : "改善が必要")}

## 改善対象（${review.passingScore ?? 80}点未満）
${failedItemsLines}

## 各スライドの採点
${slideLines}

## 全体の良い点
${strengthsLines}

## 全体の改善点
${improvementsLines}
`;
}

/**
 * 出力先ディレクトリを作り直す
 * @returns {Promise<void>}
 */
async function recreateExportDir() {
  await fs.rm(EXPORT_DIR, { recursive: true, force: true });
  await fs.mkdir(EXPORT_SLIDES_DIR, { recursive: true });
}

/**
 * 生成済み画像をエクスポート先へコピーする
 * @returns {Promise<string[]>}
 */
async function copySlideImages() {
  const copiedFiles = [];

  for (let number = 1; number <= SLIDE_COUNT; number++) {
    const fileName = getCarouselOutputImageFileName(number);
    const sourceFile = path.join(IMAGE_OUTPUT_DIR, fileName);
    const destFile = path.join(EXPORT_SLIDES_DIR, fileName);

    try {
      await fs.copyFile(sourceFile, destFile);
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(
          `生成画像が見つかりません: images/carousel/output/${fileName}`,
        );
      }
      throw new Error(`${fileName} のコピーに失敗しました: ${error.message}`);
    }

    copiedFiles.push(`slides/${fileName}`);
  }

  return copiedFiles;
}

/**
 * メイン処理
 */
async function main() {
  await loadSlides(CAROUSEL_CONTENT_DIR);
  const caption = await loadCaption();
  const review = await loadImageReview();

  await recreateExportDir();
  const slideFiles = await copySlideImages();

  const files = ["caption.txt", "review-summary.md", ...slideFiles, "package-info.json"];

  const packageInfo = {
    exportedAt: new Date().toISOString(),
    imageReviewScore: review.score,
    imageReviewPassed: review.passed,
    slideCount: SLIDE_COUNT,
    files,
  };

  await fs.writeFile(path.join(EXPORT_DIR, "caption.txt"), caption, "utf-8");
  await fs.writeFile(
    path.join(EXPORT_DIR, "review-summary.md"),
    `${buildReviewSummary(review)}\n`,
    "utf-8",
  );
  await fs.writeFile(
    path.join(EXPORT_DIR, "package-info.json"),
    `${JSON.stringify(packageInfo, null, 2)}\n`,
    "utf-8",
  );

  console.log("Instagram package exported:");
  console.log("output/instagram/");
  console.log(`- caption.txt`);
  console.log(`- review-summary.md`);
  console.log(`- package-info.json`);
  for (const file of slideFiles) {
    console.log(`- ${file}`);
  }
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
