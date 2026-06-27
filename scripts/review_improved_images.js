import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { createPartFromBase64, createPartFromText } from "@google/genai";
import { SLIDE_TYPES } from "../src/lib/carousel.js";
import { generateWithRetry } from "../src/lib/gemini.js";
import { extractJsonFromText } from "../src/lib/json.js";
import { classifyRootCause } from "../src/lib/root_cause.js";
import { PROJECT_ROOT } from "../src/lib/nano_banana.js";
import {
  EXIT_CODES,
  InputConfigurationError,
  describeExitCode,
  getErrorExitCode,
  getExitCodeByResult,
} from "../src/lib/exit_codes.js";

const DEFAULT_MANIFEST_PATH = "output/carousel/improved/manifest.json";
const REVIEW_RESULT_PATH = "reports/nano-banana-improve/review_result.json";

/** 既存 image-review と同じ採点基準（1枚用） */
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

【評価の観点】
- 飲食店オーナー・店長向けInstagramカルーセルとして適切か
- 1枚1メッセージが視覚的に伝わるか
- スマホ画面で3秒で読めるか
- 保存したくなるビジュアルか

【採点基準】
- 100点満点で採点
- 80点以上：合格
- 90点以上：公開推奨
- 80点未満：再改善候補

【出力形式】
必ず以下のJSON形式のみで出力してください。説明文は不要です。

{
  "score": 85,
  "strengths": ["良い点1"],
  "improvements": ["改善点1"]
}`;

/**
 * CLI 引数を解析する
 * @param {string[]} argv
 * @returns {{ apply: boolean, manifest: string | null }}
 */
function parseArgs(argv) {
  const options = {
    apply: false,
    manifest: null,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--apply") {
      options.apply = true;
      continue;
    }

    if (arg === "--manifest") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new InputConfigurationError(
          "--manifest にはファイルパスを指定してください。",
        );
      }
      options.manifest = value;
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    throw new InputConfigurationError(`不明な引数: ${arg}`);
  }

  return options;
}

function printUsage() {
  console.log(`Usage: node scripts/review_improved_images.js [options]

Options:
  --apply                 Gemini で再レビューを実行（デフォルトは dry-run）
  --manifest <path>       manifest.json のパス（デフォルト: ${DEFAULT_MANIFEST_PATH}）
  --help, -h              このヘルプを表示
`);
}

/**
 * manifest ファイルのパスを解決する
 * @param {string | null} explicitPath
 * @returns {Promise<string>}
 */
async function resolveManifestPath(explicitPath) {
  const candidate = explicitPath ?? DEFAULT_MANIFEST_PATH;
  const absolutePath = path.isAbsolute(candidate)
    ? path.normalize(candidate)
    : path.join(PROJECT_ROOT, candidate);

  try {
    await fs.access(absolutePath);
    return absolutePath;
  } catch {
    throw new InputConfigurationError(`manifest が見つかりません: ${candidate}`);
  }
}

/**
 * プロジェクトルートからの相対パスを返す
 * @param {string} absolutePath
 * @returns {string}
 */
function toProjectRelativePath(absolutePath) {
  return path.relative(PROJECT_ROOT, absolutePath).split(path.sep).join("/");
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
 * ファイルが存在するか確認する
 * @param {string} absolutePath
 * @returns {Promise<boolean>}
 */
async function fileExists(absolutePath) {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gemini レスポンスを正規化する
 * @param {unknown} data
 * @returns {{ score: number, strengths: string[], improvements: string[] }}
 */
function normalizeSingleSlideReview(data) {
  const score = Number(data?.score);

  if (!Number.isFinite(score)) {
    throw new Error("再レビュー結果の score が不正です。");
  }

  return {
    score,
    strengths: Array.isArray(data?.strengths)
      ? data.strengths.map(String)
      : [],
    improvements: Array.isArray(data?.improvements)
      ? data.improvements.map(String)
      : [],
  };
}

/**
 * Gemini 再レビュー入力を組み立てる
 * @param {object} options
 * @param {string} options.slideId
 * @param {string} options.improvedImagePath
 * @param {string | null} options.slideMarkdown
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
 * @param {string} options.slideId
 * @param {string} options.improvedImagePath
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

  let parsed;
  try {
    parsed = extractJsonFromText(responseText);
  } catch {
    throw new Error("Gemini API のレスポンスをJSONとして解析できませんでした。");
  }

  return normalizeSingleSlideReview(parsed);
}

/**
 * manifest item を再レビュー結果 item に変換する
 * @param {object} manifestItem
 * @param {boolean} apply
 * @returns {Promise<object>}
 */
async function processManifestItem(manifestItem, apply) {
  const slideId = manifestItem.slideId;
  const improvedImagePath = manifestItem.outputPath;
  const beforeScore =
    typeof manifestItem.beforeScore === "number" ? manifestItem.beforeScore : null;
  const beforeRootCause = manifestItem.rootCause ?? null;

  const baseItem = {
    slideId,
    sourceImagePath: manifestItem.sourceImagePath,
    improvedImagePath,
    beforeScore,
    afterScore: null,
    deltaScore: null,
    beforeRootCause,
    afterRootCause: null,
    error: null,
    reviewElapsedMs: 0,
  };

  if (manifestItem.status !== "improved") {
    return {
      ...baseItem,
      status: "skipped",
    };
  }

  const improvedAbsolute = path.isAbsolute(improvedImagePath)
    ? improvedImagePath
    : path.join(PROJECT_ROOT, improvedImagePath);

  if (!(await fileExists(improvedAbsolute))) {
    return {
      ...baseItem,
      status: "failed_review",
      error: `改善画像が見つかりません: ${improvedImagePath}`,
    };
  }

  if (!apply) {
    return {
      ...baseItem,
      status: "planned",
      error: "dry-run: Gemini 再レビュー予定",
    };
  }

  const startedAt = Date.now();

  try {
    const review = await reviewImprovedImageWithGemini({
      slideId,
      improvedImagePath: improvedAbsolute,
    });
    const afterRootCause = classifyRootCause(review).rootCause;
    const afterScore = review.score;
    const deltaScore =
      beforeScore === null ? null : afterScore - beforeScore;

    return {
      ...baseItem,
      afterScore,
      deltaScore,
      afterRootCause,
      status: "reviewed",
      error: null,
      reviewElapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...baseItem,
      status: "failed_review",
      error: message,
      reviewElapsedMs: Date.now() - startedAt,
    };
  }
}

/**
 * manifest に afterReview 情報を追記する
 * @param {object} manifest
 * @param {object[]} resultItems
 * @param {string} generatedAt
 */
function appendAfterReviewToManifest(manifest, resultItems, generatedAt) {
  const resultBySlideId = new Map(
    resultItems.map((item) => [item.slideId, item]),
  );

  manifest.items = manifest.items.map((manifestItem) => {
    const resultItem = resultBySlideId.get(manifestItem.slideId);
    if (!resultItem || manifestItem.status !== "improved") {
      return manifestItem;
    }

    return {
      ...manifestItem,
      afterReview: {
        reviewedAt: generatedAt,
        afterScore: resultItem.afterScore,
        deltaScore: resultItem.deltaScore,
        afterRootCause: resultItem.afterRootCause,
        status: resultItem.status,
        error: resultItem.error,
        reviewElapsedMs: resultItem.reviewElapsedMs,
      },
    };
  });

}

/**
 * @param {object} options
 * @param {string | null} options.manifest
 * @param {boolean} options.apply
 */
async function main({ manifest, apply }) {
  const manifestAbsolutePath = await resolveManifestPath(manifest);

  let manifestData;
  try {
    const raw = await fs.readFile(manifestAbsolutePath, "utf-8");
    manifestData = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new InputConfigurationError(
      `manifest の読み込みに失敗しました: ${message}`,
    );
  }

  if (!manifestData || !Array.isArray(manifestData.items)) {
    throw new InputConfigurationError("manifest の items が取得できません。");
  }

  const dryRun = !apply;
  const modeLabel = dryRun ? "dry-run" : "apply";

  console.log(`[ImprovedImageReview] モード: ${modeLabel}`);
  console.log(
    `[ImprovedImageReview] manifest: ${toProjectRelativePath(manifestAbsolutePath)}`,
  );
  console.log(
    `[ImprovedImageReview] 再レビュー対象: manifest items の status=improved のみ`,
  );

  /** @type {object[]} */
  const items = [];

  for (const manifestItem of manifestData.items) {
    const resultItem = await processManifestItem(manifestItem, apply);
    items.push(resultItem);

    const detail =
      resultItem.status === "reviewed"
        ? `afterScore=${resultItem.afterScore}, delta=${resultItem.deltaScore >= 0 ? "+" : ""}${resultItem.deltaScore}`
        : resultItem.error && resultItem.status !== "skipped"
          ? resultItem.error
          : "";

    console.log(
      `[ImprovedImageReview] ${resultItem.slideId}: ${resultItem.status}` +
        (detail ? ` (${detail})` : ""),
    );
  }

  const reviewTargetCount = manifestData.items.filter(
    (item) => item.status === "improved",
  ).length;
  const reviewedCount = items.filter((item) => item.status === "reviewed").length;
  const failedReviewCount = items.filter(
    (item) => item.status === "failed_review",
  ).length;
  const plannedCount = items.filter((item) => item.status === "planned").length;

  const generatedAt = new Date().toISOString();

  const reviewResult = {
    generatedAt,
    manifestFile: toProjectRelativePath(manifestAbsolutePath),
    totalItems: items.length,
    reviewTargetCount,
    reviewedCount,
    failedReviewCount,
    items,
  };

  const reviewResultAbsolutePath = path.join(PROJECT_ROOT, REVIEW_RESULT_PATH);
  await fs.mkdir(path.dirname(reviewResultAbsolutePath), { recursive: true });
  await fs.writeFile(
    reviewResultAbsolutePath,
    `${JSON.stringify(reviewResult, null, 2)}\n`,
    "utf-8",
  );

  console.log(
    `[ImprovedImageReview] review_result を保存しました: ${REVIEW_RESULT_PATH}`,
  );

  if (apply) {
    appendAfterReviewToManifest(manifestData, items, generatedAt);
    await fs.writeFile(
      manifestAbsolutePath,
      `${JSON.stringify(manifestData, null, 2)}\n`,
      "utf-8",
    );
    console.log(
      `[ImprovedImageReview] manifest に afterReview を追記しました: ${toProjectRelativePath(manifestAbsolutePath)}`,
    );
  }

  console.log(
    `[ImprovedImageReview] 結果: total=${items.length}, target=${reviewTargetCount}, reviewed=${reviewedCount}, planned=${plannedCount}, failed_review=${failedReviewCount}`,
  );

  if (reviewTargetCount === 0) {
    console.log(
      "[ImprovedImageReview] status=improved の item がないため、再レビュー対象は 0 件です。",
    );
  }

  const exitCode = getExitCodeByResult({
    script: "review",
    apply,
    reviewTargetCount,
    reviewedCount,
    failedReviewCount,
  });

  if (exitCode !== EXIT_CODES.SUCCESS) {
    console.log(
      `[ImprovedImageReview] 終了コード: ${exitCode} (${describeExitCode(exitCode)})`,
    );
  }

  process.exit(exitCode);
}

try {
  const options = parseArgs(process.argv);
  await main(options);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const exitCode = getErrorExitCode(error);
  console.error(`[ImprovedImageReview] エラー: ${message}`);
  console.error(
    `[ImprovedImageReview] 終了コード: ${exitCode} (${describeExitCode(exitCode)})`,
  );
  process.exit(exitCode);
}
