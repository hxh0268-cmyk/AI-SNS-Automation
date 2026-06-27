import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyRootCause } from "../src/lib/root_cause.js";
import {
  DEFAULT_RETRY,
  DEFAULT_TIMEOUT_MS,
  IMPROVED_OUTPUT_DIR,
  PROJECT_ROOT,
  improveImageWithNanoBanana,
} from "../src/lib/nano_banana.js";
import {
  EXIT_CODES,
  InputConfigurationError,
  describeExitCode,
  getErrorExitCode,
  getExitCodeByResult,
} from "../src/lib/exit_codes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCORE_THRESHOLD = 80;
const SOURCE_IMAGE_DIR = "images/carousel/output";
const MANIFEST_FILE = path.join(PROJECT_ROOT, IMPROVED_OUTPUT_DIR, "manifest.json");

/** manifest.json スキーマ識別子（docs/MANIFEST_SCHEMA.md 参照） */
const MANIFEST_SCHEMA_VERSION = "1.0";
const MANIFEST_TOOL = "nano_banana_image_improvement";
const MANIFEST_VERSION = "v1.2.1";

/** @type {readonly string[]} */
const DEFAULT_REVIEW_CANDIDATES = [
  "reports/image_review.json",
  "reports/carousel-image-review.json",
  "output/carousel/image_review.json",
];

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

/**
 * CLI 引数を解析する
 * @param {string[]} argv
 * @returns {{ apply: boolean, review: string | null, timeoutMs: number, retry: number }}
 */
function parseArgs(argv) {
  const options = {
    apply: false,
    review: null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    retry: DEFAULT_RETRY,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--apply") {
      options.apply = true;
      continue;
    }

    if (arg === "--review") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new InputConfigurationError(
          "--review にはファイルパスを指定してください。",
        );
      }
      options.review = value;
      index += 1;
      continue;
    }

    if (arg === "--timeout-ms") {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new InputConfigurationError(
          "--timeout-ms には正の数値を指定してください。",
        );
      }
      options.timeoutMs = value;
      index += 1;
      continue;
    }

    if (arg === "--retry") {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value < 1) {
        throw new InputConfigurationError(
          "--retry には 1 以上の整数を指定してください。",
        );
      }
      options.retry = Math.floor(value);
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
  console.log(`Usage: node scripts/improve_with_nano_banana.js [options]

Options:
  --apply                 API を呼び出して改善を実行（デフォルトは dry-run）
  --review <path>         image_review.json のパス
  --timeout-ms <number> API タイムアウト（ミリ秒、デフォルト: ${DEFAULT_TIMEOUT_MS}）
  --retry <number>        最大試行回数（デフォルト: ${DEFAULT_RETRY}）
  --help, -h              このヘルプを表示

デフォルトのレビューファイル候補:
${DEFAULT_REVIEW_CANDIDATES.map((candidate) => `  - ${candidate}`).join("\n")}
`);
}

/**
 * レビューファイルのパスを解決する
 * @param {string | null} explicitPath
 * @returns {Promise<string>}
 */
async function resolveReviewFile(explicitPath) {
  if (explicitPath) {
    const absolutePath = path.isAbsolute(explicitPath)
      ? path.normalize(explicitPath)
      : path.join(PROJECT_ROOT, explicitPath);

    try {
      await fs.access(absolutePath);
      return absolutePath;
    } catch {
      throw new InputConfigurationError(
        `指定されたレビューファイルが見つかりません: ${explicitPath}`,
      );
    }
  }

  for (const candidate of DEFAULT_REVIEW_CANDIDATES) {
    const absolutePath = path.join(PROJECT_ROOT, candidate);
    try {
      await fs.access(absolutePath);
      return absolutePath;
    } catch {
      // 次の候補を試す
    }
  }

  throw new InputConfigurationError(
    [
      "レビューファイルが見つかりません。以下のいずれかを用意するか、--review でパスを指定してください:",
      ...DEFAULT_REVIEW_CANDIDATES.map((candidate) => `  - ${candidate}`),
    ].join("\n"),
  );
}

/**
 * fileName から slideId を取得する
 * @param {string} fileName
 * @returns {string | null}
 */
function toSlideId(fileName) {
  const match = fileName.match(/^(slide\d{2})\.png$/i);
  return match ? match[1].toLowerCase() : null;
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
 * スライド Markdown から正しい文言を読み込む（任意）
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
 * @param {object} options.slideReview
 * @param {string} options.rootCause
 * @param {string | null} options.slideMarkdown
 * @returns {string}
 */
function buildImprovementPrompt({ slideReview, rootCause, slideMarkdown }) {
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
 * manifest 用の相対パスを返す
 * @param {string} absolutePath
 * @returns {string}
 */
function toProjectRelativePath(absolutePath) {
  return path.relative(PROJECT_ROOT, absolutePath).split(path.sep).join("/");
}

/**
 * 画像ファイルの存在を確認する
 * @param {string} absolutePath
 * @returns {Promise<boolean>}
 */
async function imageExists(absolutePath) {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * manifest の item オブジェクトを組み立てる
 * @param {object} base
 * @returns {object}
 */
function buildManifestItem(base) {
  return {
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
  };
}

/**
 * 1 枚のスライドを処理する
 * @param {object} options
 * @param {object} options.slideReview
 * @param {boolean} options.apply
 * @param {number} options.timeoutMs
 * @param {number} options.retry
 * @returns {Promise<object>}
 */
async function processSlide({ slideReview, apply, timeoutMs, retry }) {
  const fileName =
    typeof slideReview.fileName === "string" ? slideReview.fileName : "";
  const slideId = toSlideId(fileName);
  const beforeScore =
    typeof slideReview.score === "number" ? slideReview.score : null;

  const sourceAbsolute = path.join(PROJECT_ROOT, SOURCE_IMAGE_DIR, fileName);
  const outputAbsolute = path.join(PROJECT_ROOT, IMPROVED_OUTPUT_DIR, fileName);
  const sourceImagePath = `${SOURCE_IMAGE_DIR}/${fileName}`;
  const outputPath = `${IMPROVED_OUTPUT_DIR}/${fileName}`;

  const baseItem = {
    slideId: slideId ?? fileName.replace(/\.png$/i, ""),
    sourceImagePath,
    outputPath,
    beforeScore,
    rootCause: null,
    timeoutMs,
    retry,
  };

  if (beforeScore === null) {
    return buildManifestItem({
      ...baseItem,
      status: "failed",
      error: "スライド score が取得できません。",
      elapsedMs: 0,
      attempts: 0,
    });
  }

  if (beforeScore >= SCORE_THRESHOLD) {
    return buildManifestItem({
      ...baseItem,
      status: "skipped",
      error: null,
      elapsedMs: 0,
      attempts: 0,
    });
  }

  if (!slideId) {
    return buildManifestItem({
      ...baseItem,
      status: "failed",
      error: `fileName の形式が不正です: ${fileName}`,
      elapsedMs: 0,
      attempts: 0,
    });
  }

  if (!(await imageExists(sourceAbsolute))) {
    return buildManifestItem({
      ...baseItem,
      status: "failed",
      error: `元画像が見つかりません: ${sourceImagePath}`,
      elapsedMs: 0,
      attempts: 0,
    });
  }

  const classification = classifyRootCause(slideReview);
  const rootCause = classification.rootCause;

  if (rootCause === "TEXT") {
    return buildManifestItem({
      ...baseItem,
      rootCause,
      status: "skipped",
      error:
        "rootCause=TEXT のため Nano Banana 改善対象外（Smart Auto Fix + OpenAI 再生成を使用してください）",
      elapsedMs: 0,
      attempts: 0,
    });
  }

  const slideMarkdown = await loadSlideMarkdown(slideId);
  const prompt = buildImprovementPrompt({
    slideReview,
    rootCause,
    slideMarkdown,
  });

  try {
    const result = await improveImageWithNanoBanana({
      sourceImagePath: sourceAbsolute,
      prompt,
      outputPath: outputAbsolute,
      dryRun: !apply,
      timeoutMs,
      retry,
    });

    if (!apply) {
      return buildManifestItem({
        ...baseItem,
        rootCause,
        status: "planned",
        error: result.plannedAction,
        elapsedMs: result.elapsedMs,
        attempts: result.attempts,
      });
    }

    if (!result.success) {
      return buildManifestItem({
        ...baseItem,
        rootCause,
        status: "failed",
        error: result.error ?? "Nano Banana 改善に失敗しました。",
        elapsedMs: result.elapsedMs,
        attempts: result.attempts,
      });
    }

    return buildManifestItem({
      ...baseItem,
      rootCause,
      status: "improved",
      error: null,
      elapsedMs: result.elapsedMs,
      attempts: result.attempts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildManifestItem({
      ...baseItem,
      rootCause,
      status: "failed",
      error: message,
      elapsedMs: 0,
      attempts: 0,
    });
  }
}

/**
 * @param {object} options
 * @param {string | null} options.review
 * @param {boolean} options.apply
 * @param {number} options.timeoutMs
 * @param {number} options.retry
 */
async function main({ review: reviewPath, apply, timeoutMs, retry }) {
  const reviewAbsolutePath = await resolveReviewFile(reviewPath);

  let reviewData;
  try {
    const raw = await fs.readFile(reviewAbsolutePath, "utf-8");
    reviewData = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new InputConfigurationError(
      `image_review.json の読み込みに失敗しました: ${message}`,
    );
  }

  if (!reviewData || !Array.isArray(reviewData.slides)) {
    throw new InputConfigurationError(
      "image_review.json の slides が取得できません。",
    );
  }

  const dryRun = !apply;
  const modeLabel = dryRun ? "dry-run" : "apply";

  console.log(`[NanoBananaImprove] モード: ${modeLabel}`);
  console.log(
    `[NanoBananaImprove] レビューファイル: ${toProjectRelativePath(reviewAbsolutePath)}`,
  );
  console.log(
    `[NanoBananaImprove] 改善閾値: score < ${SCORE_THRESHOLD} のスライドのみ対象`,
  );

  /** @type {object[]} */
  const items = [];

  for (const slideReview of reviewData.slides) {
    const item = await processSlide({
      slideReview,
      apply,
      timeoutMs,
      retry,
    });
    items.push(item);

    console.log(
      `[NanoBananaImprove] ${item.slideId}: ${item.status}` +
        (item.error && item.status !== "skipped" ? ` (${item.error})` : ""),
    );
  }

  const targetCount = items.filter(
    (item) =>
      typeof item.beforeScore === "number" && item.beforeScore < SCORE_THRESHOLD,
  ).length;
  const skippedCount = items.filter((item) => item.status === "skipped").length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  const improvedCount = items.filter((item) => item.status === "improved").length;
  const plannedCount = items.filter((item) => item.status === "planned").length;

  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    tool: MANIFEST_TOOL,
    version: MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    reviewFile: toProjectRelativePath(reviewAbsolutePath),
    dryRun,
    threshold: SCORE_THRESHOLD,
    totalImages: items.length,
    targetCount,
    skippedCount,
    failedCount,
    improvedCount,
    items,
  };

  await fs.mkdir(path.dirname(MANIFEST_FILE), { recursive: true });
  await fs.writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

  console.log(`[NanoBananaImprove] manifest を保存しました: ${IMPROVED_OUTPUT_DIR}/manifest.json`);
  console.log(
    `[NanoBananaImprove] 結果: total=${items.length}, target=${targetCount}, skipped=${skippedCount}, improved=${improvedCount}, planned=${plannedCount}, failed=${failedCount}`,
  );

  if (targetCount === 0) {
    console.log(
      `[NanoBananaImprove] 改善対象（score < ${SCORE_THRESHOLD}）は 0 件です。正常終了します。`,
    );
  }

  const exitCode = getExitCodeByResult({
    script: "improve",
    apply,
    targetCount,
    improvedCount,
    failedCount,
  });

  if (exitCode !== EXIT_CODES.SUCCESS) {
    console.log(
      `[NanoBananaImprove] 終了コード: ${exitCode} (${describeExitCode(exitCode)})`,
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
  console.error(`[NanoBananaImprove] エラー: ${message}`);
  console.error(
    `[NanoBananaImprove] 終了コード: ${exitCode} (${describeExitCode(exitCode)})`,
  );
  process.exit(exitCode);
}
