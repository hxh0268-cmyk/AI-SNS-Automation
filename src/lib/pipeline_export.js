import fs from "node:fs/promises";
import path from "node:path";
import {
  getCarouselOutputImageFileName,
  SLIDE_COUNT,
  SLIDE_TYPES,
} from "./carousel.js";
import { IMPROVED_OUTPUT_DIR } from "./nano_banana.js";
import { extractScoreSnapshot, REVIEW_SOURCE_SMART_AUTO_FIX, REVIEW_SOURCE_NANO_BANANA } from "./pipeline_score.js";
import { PROJECT_ROOT } from "./pipeline_state.js";

/** Instagram Package 出力先（プロジェクト相対） */
export const DEFAULT_INSTAGRAM_EXPORT_DIR = "output/instagram";

/** 改善 manifest デフォルトパス */
export const DEFAULT_IMPROVED_MANIFEST_PATH = `${IMPROVED_OUTPUT_DIR}/manifest.json`;

/** 再レビュー結果デフォルトパス */
export const DEFAULT_REVIEW_RESULT_PATH = "reports/nano-banana-improve/review_result.json";

/** export manifest ファイル名 */
export const EXPORT_MANIFEST_FILENAME = "export_manifest.json";

/** ReReview 後に improved 採用を許容する scoreSummary source */
const ADOPTABLE_REVIEW_SOURCES = new Set([
  REVIEW_SOURCE_NANO_BANANA,
  REVIEW_SOURCE_SMART_AUTO_FIX,
]);

/** 元画像ディレクトリ（プロジェクト相対） */
const SOURCE_OUTPUT_DIR = "images/carousel/output";

/** キャプションファイル（プロジェクト相対） */
const CAPTION_RELATIVE_PATH = "content/reviewed/post.md";

/** export manifest スキーマ */
export const EXPORT_MANIFEST_SCHEMA_VERSION = "1.0";

/** export スキップ理由 */
export const EXPORT_SKIP_REASONS = {
  BELOW_TARGET_SCORE: "BELOW_TARGET_SCORE",
  EMPTY_SCORE_SUMMARY: "EMPTY_SCORE_SUMMARY",
  SKIP_EXPORT_FLAG: "SKIP_EXPORT_FLAG",
};

/**
 * ファイルが存在するか確認する
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
 * JSON ファイルを読み込む
 * @param {string} relativePath
 * @returns {Promise<object | null>}
 */
async function readJsonFile(relativePath) {
  try {
    const raw = await fs.readFile(path.join(PROJECT_ROOT, relativePath), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * export ゲートを評価する
 * @param {object} state
 * @param {object} config
 * @returns {{ allowed: boolean, mode: "full" | "partial" | null, reason: string | null }}
 */
function evaluateExportGate(state, config) {
  const scoreSummary = state.scoreSummary;

  if (!scoreSummary?.slides?.length) {
    return {
      allowed: false,
      mode: null,
      reason: EXPORT_SKIP_REASONS.EMPTY_SCORE_SUMMARY,
    };
  }

  if (scoreSummary.allSlidesPublishRecommended) {
    return { allowed: true, mode: "full", reason: null };
  }

  if (config.allowPartialExport && scoreSummary.allSlidesPassed) {
    return { allowed: true, mode: "partial", reason: null };
  }

  return {
    allowed: false,
    mode: null,
    reason: EXPORT_SKIP_REASONS.BELOW_TARGET_SCORE,
  };
}

/**
 * improved manifest を読み込む
 * @param {object} state
 * @returns {Promise<object | null>}
 */
async function loadImprovementManifest(state) {
  const manifestPath =
    state.improvement?.lastManifestPath ?? DEFAULT_IMPROVED_MANIFEST_PATH;
  return readJsonFile(manifestPath);
}

/**
 * 再レビュー結果を読み込む
 * @returns {Promise<object | null>}
 */
async function loadReviewResult() {
  return readJsonFile(DEFAULT_REVIEW_RESULT_PATH);
}

/**
 * 各スライドの export 画像を選定する
 * @param {object} state
 * @param {object} config
 * @returns {Promise<object[]>}
 */
export async function selectExportImages(state, config) {
  const scoreSummary = state.scoreSummary ?? { slides: [] };
  const manifest = await loadImprovementManifest(state);
  const reviewResult = await loadReviewResult();

  const manifestBySlideId = new Map(
    (manifest?.items ?? []).map((item) => [item.slideId, item]),
  );
  const reviewBySlideId = new Map(
    (reviewResult?.items ?? []).map((item) => [item.slideId, item]),
  );
  const scoreBySlideId = new Map(
    (scoreSummary.slides ?? []).map((slide) => [slide.slideId, slide]),
  );

  /** @type {object[]} */
  const selections = [];

  for (let number = 1; number <= SLIDE_COUNT; number++) {
    const slideId = `slide${String(number).padStart(2, "0")}`;
    const fileName = getCarouselOutputImageFileName(number);
    const originalPath = `${SOURCE_OUTPUT_DIR}/${fileName}`;
    const improvedPath = `${IMPROVED_OUTPUT_DIR}/${fileName}`;

    const manifestItem = manifestBySlideId.get(slideId) ?? null;
    const reviewItem = reviewBySlideId.get(slideId) ?? null;
    const slideScore = scoreBySlideId.get(slideId) ?? null;

    const improvedAvailable = await fileExists(improvedPath);
    const manifestImproved = manifestItem?.status === "improved";
    const reviewScoreMaintained =
      reviewItem?.status === "reviewed" &&
      typeof reviewItem.beforeScore === "number" &&
      typeof reviewItem.afterScore === "number" &&
      reviewItem.afterScore >= reviewItem.beforeScore;
    const reviewSourceAllowed =
      !slideScore?.source || ADOPTABLE_REVIEW_SOURCES.has(slideScore.source);

    let source = "original";
    let sourcePath = originalPath;
    let selectionReason = "original_default";

    if (manifestImproved && reviewScoreMaintained && improvedAvailable && reviewSourceAllowed) {
      source = "improved";
      sourcePath = improvedPath;
      selectionReason =
        manifestItem?.tool === "smart_auto_fix" ||
        (manifestItem?.improvementPipeline ?? []).includes("regeneration_engine")
          ? "improved_adopted_text_chain"
          : "improved_adopted";
    } else if (manifestImproved && !improvedAvailable) {
      selectionReason = "improved_file_missing";
    } else if (manifestImproved && !reviewScoreMaintained) {
      selectionReason = "re_review_score_not_improved";
    } else if (manifestImproved && !reviewSourceAllowed) {
      selectionReason = "re_review_source_not_allowed";
    }

    selections.push({
      slideId,
      fileName,
      slideNumber: number,
      slideType: SLIDE_TYPES[number - 1] ?? null,
      source,
      sourcePath,
      originalPath,
      improvedPath,
      adoptedImproved: source === "improved",
      selectionReason,
      improvementTool: manifestItem?.tool ?? null,
      improvementPipeline: manifestItem?.improvementPipeline ?? null,
      regenerationAdapter: manifestItem?.regenerationAdapter ?? null,
      reviewSource: reviewItem?.reviewSource ?? slideScore?.source ?? null,
      score: slideScore?.score ?? null,
      publishRecommended: slideScore?.publishRecommended ?? null,
      beforeScore: reviewItem?.beforeScore ?? manifestItem?.beforeScore ?? null,
      afterScore: reviewItem?.afterScore ?? null,
    });
  }

  return selections;
}

/**
 * キャプション本文を読み込む
 * @returns {Promise<string>}
 */
async function loadCaption() {
  const absolutePath = path.join(PROJECT_ROOT, CAPTION_RELATIVE_PATH);

  try {
    const content = await fs.readFile(absolutePath, "utf-8");
    if (!content.trim()) {
      throw new Error("content/reviewed/post.md が空です。");
    }
    return content;
  } catch (error) {
    if (error instanceof Error && error.message.includes("空です")) {
      throw error;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(
        "キャプションファイルが見つかりません: content/reviewed/post.md",
      );
    }
    throw error;
  }
}

/**
 * scoreSummary からレビュー要約 Markdown を生成する
 * @param {object} scoreSummary
 * @param {object} config
 * @param {object} exportMeta
 * @returns {string}
 */
function buildReviewSummaryMarkdown(scoreSummary, config, exportMeta) {
  const targetScore = config.targetScore ?? scoreSummary.targetScore ?? 90;
  const passingScore = config.passingScore ?? scoreSummary.passingScore ?? 80;

  const slideLines = (scoreSummary.slides ?? [])
    .map((slide) => {
      const status = slide.publishRecommended
        ? "公開推奨"
        : slide.passed
          ? "合格"
          : "改善が必要";
      const sourceLabel =
        slide.source === REVIEW_SOURCE_NANO_BANANA ||
        slide.source === REVIEW_SOURCE_SMART_AUTO_FIX
          ? " (improved)"
          : "";
      return `- ${slide.slideId}: ${slide.score} / 100点（${status}）${sourceLabel}`;
    })
    .join("\n");

  const adoptedLines = (exportMeta.selections ?? [])
    .filter((item) => item.adoptedImproved)
    .map((item) => `- ${item.slideId}: ${item.improvedPath}`)
    .join("\n");

  return `# Instagram画像レビュー要約

## 総合点
平均 ${scoreSummary.averageScore} / 100点（最低 ${scoreSummary.minScore} 点）

## 判定
${scoreSummary.allSlidesPublishRecommended ? "全スライド公開推奨（targetScore 以上）" : scoreSummary.allSlidesPassed ? "全スライド合格（passingScore 以上）" : "改善が必要"}

## Export モード
${exportMeta.mode ?? "skipped"}${exportMeta.mode === "partial" ? "（allowPartialExport）" : ""}

## 各スライドの採点
${slideLines || "- なし"}

## improved 画像採用
${adoptedLines || "- なし（すべて元画像を使用）"}

## 基準
- targetScore: ${targetScore}
- passingScore: ${passingScore}
`;
}

/**
 * export 先ディレクトリを作り直す
 * @param {string} exportDirRelative
 * @returns {Promise<string>}
 */
async function recreateExportDirectory(exportDirRelative) {
  const exportAbsolute = path.join(PROJECT_ROOT, exportDirRelative);
  const slidesAbsolute = path.join(exportAbsolute, "slides");

  await fs.rm(exportAbsolute, { recursive: true, force: true });
  await fs.mkdir(slidesAbsolute, { recursive: true });

  return exportDirRelative;
}

/**
 * 選定画像を Instagram Package にコピーする
 * @param {object[]} selections
 * @param {string} exportDirRelative
 * @returns {Promise<string[]>}
 */
async function copySelectedImages(selections, exportDirRelative) {
  const copiedFiles = [];

  for (const selection of selections) {
    const sourceAbsolute = path.join(PROJECT_ROOT, selection.sourcePath);
    const destAbsolute = path.join(
      PROJECT_ROOT,
      exportDirRelative,
      "slides",
      selection.fileName,
    );

    try {
      await fs.copyFile(sourceAbsolute, destAbsolute);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : null;
      if (code === "ENOENT") {
        throw new Error(
          `export 元画像が見つかりません: ${selection.sourcePath} (${selection.slideId})`,
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${selection.fileName} のコピーに失敗しました: ${message}`);
    }

    copiedFiles.push(`slides/${selection.fileName}`);
  }

  return copiedFiles;
}

/**
 * export manifest を書き込む
 * @param {object} exportResult
 * @param {string} outputDir - pipeline 出力ディレクトリ（プロジェクト相対）
 * @returns {Promise<string>}
 */
export async function writeExportManifest(exportResult, outputDir) {
  const manifestPath = path.join(outputDir, EXPORT_MANIFEST_FILENAME);
  const absolutePath = path.join(PROJECT_ROOT, manifestPath);

  const manifest = {
    schemaVersion: EXPORT_MANIFEST_SCHEMA_VERSION,
    tool: "quality_pipeline_export",
    generatedAt: new Date().toISOString(),
    exportAllowed: exportResult.exportAllowed ?? false,
    exportCompleted: exportResult.exportCompleted ?? false,
    skipped: exportResult.skipped ?? false,
    skipReason: exportResult.skipReason ?? null,
    mode: exportResult.mode ?? null,
    allowPartialExport: exportResult.allowPartialExport ?? false,
    exportPath: exportResult.exportPath ?? null,
    improvedAdoptedCount: exportResult.improvedAdoptedCount ?? 0,
    originalCount: exportResult.originalCount ?? 0,
    scoreSummary: exportResult.scoreSummary ?? null,
    selections: exportResult.selections ?? [],
    packageFiles: exportResult.packageFiles ?? [],
  };

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

  return manifestPath;
}

/**
 * Instagram Package を export する
 * @param {object} state
 * @param {object} config
 * @param {object} [context]
 * @returns {Promise<object>}
 */
export async function runInstagramPackageExport(state, config, context = {}) {
  const outputDir = context.outputDir ?? "reports/quality-pipeline/latest";
  const exportDirRelative = DEFAULT_INSTAGRAM_EXPORT_DIR;
  const gate = evaluateExportGate(state, config);
  const selections = await selectExportImages(state, config);
  const improvedAdoptedCount = selections.filter((item) => item.adoptedImproved).length;
  const originalCount = selections.length - improvedAdoptedCount;
  const scoreSnapshot = extractScoreSnapshot(state.scoreSummary);

  const baseResult = {
    exportAllowed: gate.allowed,
    exportCompleted: false,
    skipped: !gate.allowed,
    skipReason: gate.reason,
    mode: gate.mode,
    allowPartialExport: config.allowPartialExport ?? false,
    exportPath: null,
    manifestPath: null,
    improvedAdoptedCount,
    originalCount,
    scoreSummary: {
      ...scoreSnapshot,
      allSlidesPassed: state.scoreSummary?.allSlidesPassed ?? false,
      allSlidesPublishRecommended:
        state.scoreSummary?.allSlidesPublishRecommended ?? false,
    },
    selections,
    packageFiles: [],
  };

  if (!gate.allowed) {
    console.log(
      `[QualityPipeline] [apply] EXPORT: スキップ (${gate.reason ?? "export 条件未達"})`,
    );
    const manifestPath = await writeExportManifest(baseResult, outputDir);
    return {
      ...baseResult,
      status: "skipped",
      message: `Export skipped: ${gate.reason ?? "export 条件未達"}`,
      manifestPath,
    };
  }

  const caption = await loadCaption();
  await recreateExportDirectory(exportDirRelative);
  const slideFiles = await copySelectedImages(selections, exportDirRelative);

  const packageFiles = ["caption.txt", "review-summary.md", ...slideFiles, "package-info.json"];
  const exportAbsolute = path.join(PROJECT_ROOT, exportDirRelative);
  const exportedAt = new Date().toISOString();

  const reviewSummary = buildReviewSummaryMarkdown(state.scoreSummary, config, {
    mode: gate.mode,
    selections,
  });

  const packageInfo = {
    exportedAt,
    exportMode: gate.mode,
    allowPartialExport: config.allowPartialExport ?? false,
    imageReviewScore: state.scoreSummary.averageScore,
    imageReviewPassed: state.scoreSummary.allSlidesPassed,
    allSlidesPublishRecommended: state.scoreSummary.allSlidesPublishRecommended,
    improvedAdoptedCount,
    originalCount,
    slideCount: SLIDE_COUNT,
    files: packageFiles,
    selections: selections.map((item) => ({
      slideId: item.slideId,
      source: item.source,
      sourcePath: item.sourcePath,
      score: item.score,
    })),
  };

  await fs.writeFile(path.join(exportAbsolute, "caption.txt"), caption, "utf-8");
  await fs.writeFile(
    path.join(exportAbsolute, "review-summary.md"),
    `${reviewSummary}\n`,
    "utf-8",
  );
  await fs.writeFile(
    path.join(exportAbsolute, "package-info.json"),
    `${JSON.stringify(packageInfo, null, 2)}\n`,
    "utf-8",
  );

  console.log(
    `[QualityPipeline] [apply] EXPORT: Instagram Package 出力 (${gate.mode}, improved=${improvedAdoptedCount}/${selections.length})`,
  );
  console.log(`[QualityPipeline] [apply] EXPORT: ${exportDirRelative}/`);

  const completedResult = {
    ...baseResult,
    exportCompleted: true,
    skipped: false,
    skipReason: null,
    exportPath: exportDirRelative,
    packageFiles,
    status: "completed",
    message: `Instagram Package exported (${gate.mode})`,
  };

  const manifestPath = await writeExportManifest(completedResult, outputDir);

  return {
    ...completedResult,
    manifestPath,
  };
}
