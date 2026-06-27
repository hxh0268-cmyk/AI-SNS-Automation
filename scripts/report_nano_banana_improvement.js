import fs from "node:fs/promises";
import path from "node:path";
import { PROJECT_ROOT } from "../src/lib/nano_banana.js";
import {
  InputConfigurationError,
  describeExitCode,
  getErrorExitCode,
  getExitCodeByResult,
} from "../src/lib/exit_codes.js";

const DEFAULT_MANIFEST_PATH = "output/carousel/improved/manifest.json";
const DEFAULT_REVIEW_RESULT_PATH = "reports/nano-banana-improve/review_result.json";
const REPORT_DIR = "reports/nano-banana-improve";
const REPORT_JSON_PATH = `${REPORT_DIR}/report.json`;
const REPORT_MD_PATH = `${REPORT_DIR}/report.md`;

/** report.json スキーマ識別子（docs/REPORT_SCHEMA.md 参照） */
const REPORT_SCHEMA_VERSION = "1.0";
const REPORT_TOOL = "nano_banana_image_improvement_report";
const REPORT_VERSION = "v1.2.1";

const PASSING_SCORE = 80;
const PUBLISH_RECOMMENDED_SCORE = 90;

/**
 * CLI 引数を解析する
 * @param {string[]} argv
 * @returns {{ manifest: string | null, reviewResult: string | null }}
 */
function parseArgs(argv) {
  const options = {
    manifest: null,
    reviewResult: null,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

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

    if (arg === "--review-result") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new InputConfigurationError(
          "--review-result にはファイルパスを指定してください。",
        );
      }
      options.reviewResult = value;
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
  console.log(`Usage: node scripts/report_nano_banana_improvement.js [options]

Options:
  --manifest <path>        manifest.json のパス（デフォルト: ${DEFAULT_MANIFEST_PATH}）
  --review-result <path>   review_result.json のパス（デフォルト: ${DEFAULT_REVIEW_RESULT_PATH}）
  --help, -h               このヘルプを表示
`);
}

/**
 * 相対パスまたは絶対パスを絶対パスに変換する
 * @param {string} targetPath
 * @returns {string}
 */
function toAbsolutePath(targetPath) {
  return path.isAbsolute(targetPath)
    ? path.normalize(targetPath)
    : path.join(PROJECT_ROOT, targetPath);
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
 * JSON ファイルを読み込む
 * @param {string} relativeOrAbsolutePath
 * @param {string} label
 * @returns {Promise<object>}
 */
async function loadJsonFile(relativeOrAbsolutePath, label) {
  const absolutePath = toAbsolutePath(relativeOrAbsolutePath);

  let raw;
  try {
    raw = await fs.readFile(absolutePath, "utf-8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new InputConfigurationError(
        `${label} が見つかりません: ${relativeOrAbsolutePath}`,
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new InputConfigurationError(
      `${label} の読み込みに失敗しました: ${message}`,
    );
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new InputConfigurationError(
      `${label} の JSON 形式が不正です: ${relativeOrAbsolutePath}`,
    );
  }
}

/**
 * 数値の平均を計算する
 * @param {Array<number | null | undefined>} values
 * @returns {number | null}
 */
function average(values) {
  const numbers = values.filter((value) => typeof value === "number");
  if (numbers.length === 0) {
    return null;
  }

  const sum = numbers.reduce((total, value) => total + value, 0);
  return Math.round((sum / numbers.length) * 10) / 10;
}

/**
 * recommendation を判定する
 * @param {object} manifestItem
 * @param {object | undefined} reviewItem
 * @returns {string}
 */
function resolveRecommendation(manifestItem, reviewItem) {
  const improvementStatus = manifestItem.status;

  if (improvementStatus === "failed") {
    return "improvement_failed";
  }

  const afterScore =
    reviewItem?.afterScore ??
    manifestItem.afterReview?.afterScore ??
    null;

  if (improvementStatus === "improved") {
    if (typeof afterScore === "number") {
      if (afterScore >= PUBLISH_RECOMMENDED_SCORE) {
        return "publish_recommended";
      }
      if (afterScore >= PASSING_SCORE) {
        return "passed";
      }
      return "needs_re_improvement";
    }
    return "review_pending";
  }

  if (improvementStatus === "planned") {
    return "review_pending";
  }

  return "review_pending";
}

/**
 * manifest と review_result を統合した item を組み立てる
 * @param {object} manifestItem
 * @param {object | undefined} reviewItem
 * @returns {object}
 */
function buildReportItem(manifestItem, reviewItem) {
  const afterScore =
    reviewItem?.afterScore ??
    manifestItem.afterReview?.afterScore ??
    null;
  const deltaScore =
    reviewItem?.deltaScore ??
    manifestItem.afterReview?.deltaScore ??
    (typeof afterScore === "number" && typeof manifestItem.beforeScore === "number"
      ? afterScore - manifestItem.beforeScore
      : null);

  const reviewStatus = reviewItem?.status ?? null;
  const improvementStatus = manifestItem.status;

  const error =
    improvementStatus === "failed"
      ? manifestItem.error ?? reviewItem?.error ?? null
      : reviewStatus === "reviewed"
        ? null
        : reviewItem?.error ?? manifestItem.error ?? null;

  return {
    slideId: manifestItem.slideId,
    sourceImagePath: manifestItem.sourceImagePath,
    improvedImagePath: manifestItem.outputPath ?? reviewItem?.improvedImagePath ?? null,
    beforeScore: manifestItem.beforeScore ?? null,
    afterScore,
    deltaScore,
    beforeRootCause: manifestItem.rootCause ?? reviewItem?.beforeRootCause ?? null,
    afterRootCause:
      reviewItem?.afterRootCause ?? manifestItem.afterReview?.afterRootCause ?? null,
    improvementStatus,
    reviewStatus,
    elapsedMs: manifestItem.elapsedMs ?? 0,
    reviewElapsedMs: reviewItem?.reviewElapsedMs ?? 0,
    attempts: manifestItem.attempts ?? 0,
    error,
    recommendation: resolveRecommendation(manifestItem, reviewItem),
  };
}

/**
 * レポートデータを組み立てる
 * @param {object} options
 * @param {object} options.manifest
 * @param {object} options.reviewResult
 * @param {string} options.manifestFile
 * @param {string} options.reviewResultFile
 * @returns {object}
 */
function buildReportData({ manifest, reviewResult, manifestFile, reviewResultFile }) {
  const reviewBySlideId = new Map(
    (reviewResult.items ?? []).map((item) => [item.slideId, item]),
  );

  const items = (manifest.items ?? []).map((manifestItem) =>
    buildReportItem(manifestItem, reviewBySlideId.get(manifestItem.slideId)),
  );

  const scoredAfterItems = items.filter((item) => typeof item.afterScore === "number");

  const summary = {
    totalImages: manifest.totalImages ?? items.length,
    targetCount:
      typeof manifest.targetCount === "number"
        ? manifest.targetCount
        : items.filter(
            (item) =>
              typeof item.beforeScore === "number" &&
              item.beforeScore < PASSING_SCORE,
          ).length,
    improvedCount:
      manifest.improvedCount ??
      items.filter((item) => item.improvementStatus === "improved").length,
    failedCount:
      manifest.failedCount ??
      items.filter((item) => item.improvementStatus === "failed").length,
    skippedCount:
      manifest.skippedCount ??
      items.filter((item) => item.improvementStatus === "skipped").length,
    reviewedCount:
      reviewResult.reviewedCount ??
      items.filter((item) => item.reviewStatus === "reviewed").length,
    failedReviewCount:
      reviewResult.failedReviewCount ??
      items.filter((item) => item.reviewStatus === "failed_review").length,
    averageBeforeScore: average(scoredAfterItems.map((item) => item.beforeScore)),
    averageAfterScore: average(scoredAfterItems.map((item) => item.afterScore)),
    averageDeltaScore: average(scoredAfterItems.map((item) => item.deltaScore)),
    publishRecommendedCount: items.filter(
      (item) => item.recommendation === "publish_recommended",
    ).length,
    passCount: items.filter((item) => item.recommendation === "passed").length,
    needsReImprovementCount: items.filter(
      (item) => item.recommendation === "needs_re_improvement",
    ).length,
  };

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    tool: REPORT_TOOL,
    version: REPORT_VERSION,
    generatedAt: new Date().toISOString(),
    manifestFile,
    reviewResultFile,
    summary,
    items,
  };
}

/**
 * 表示用に score を整形する
 * @param {number | null | undefined} score
 * @returns {string}
 */
function formatScore(score) {
  return typeof score === "number" ? String(score) : "—";
}

/**
 * 表示用に delta を整形する
 * @param {number | null | undefined} delta
 * @returns {string}
 */
function formatDelta(delta) {
  if (typeof delta !== "number") {
    return "—";
  }
  return delta >= 0 ? `+${delta}` : String(delta);
}

/**
 * recommendation の日本語ラベル
 * @param {string} recommendation
 * @returns {string}
 */
function recommendationLabel(recommendation) {
  const labels = {
    publish_recommended: "公開推奨",
    passed: "合格",
    needs_re_improvement: "再改善候補",
    improvement_failed: "改善失敗",
    review_pending: "レビュー未実施",
  };
  return labels[recommendation] ?? recommendation;
}

/**
 * report.md を生成する
 * @param {object} report
 * @returns {string}
 */
function buildReportMarkdown(report) {
  const { summary, items } = report;
  const generatedAt = report.generatedAt;

  const summaryRows = [
    ["総画像数", summary.totalImages],
    ["改善対象数", summary.targetCount],
    ["改善成功", summary.improvedCount],
    ["改善失敗", summary.failedCount],
    ["改善スキップ", summary.skippedCount],
    ["再レビュー成功", summary.reviewedCount],
    ["再レビュー失敗", summary.failedReviewCount],
    ["改善前平均 score", summary.averageBeforeScore ?? "—"],
    ["改善後平均 score", summary.averageAfterScore ?? "—"],
    ["平均 score 差分", summary.averageDeltaScore ?? "—"],
    ["公開推奨", summary.publishRecommendedCount],
    ["合格", summary.passCount],
    ["再改善候補", summary.needsReImprovementCount],
  ];

  const summaryTable = [
    "| 項目 | 値 |",
    "|------|-----|",
    ...summaryRows.map(([label, value]) => `| ${label} | ${value} |`),
  ].join("\n");

  const slideTableHeader = [
    "| スライド | 改善前 | 改善後 | 差分 | rootCause | 改善 | 再レビュー | 推奨 |",
    "|----------|--------|--------|------|-----------|------|------------|------|",
  ];

  const slideTableRows = items.map((item) => {
    const rootCause = item.beforeRootCause ?? "—";
    const afterRootCause =
      item.afterRootCause && item.afterRootCause !== item.beforeRootCause
        ? `${rootCause} → ${item.afterRootCause}`
        : rootCause;

    return `| ${item.slideId} | ${formatScore(item.beforeScore)} | ${formatScore(item.afterScore)} | ${formatDelta(item.deltaScore)} | ${afterRootCause} | ${item.improvementStatus} | ${item.reviewStatus ?? "—"} | ${recommendationLabel(item.recommendation)} |`;
  });

  const publishRecommended = items.filter(
    (item) => item.recommendation === "publish_recommended",
  );
  const needsReImprovement = items.filter(
    (item) => item.recommendation === "needs_re_improvement",
  );
  const failures = items.filter(
    (item) =>
      item.recommendation === "improvement_failed" ||
      item.reviewStatus === "failed_review",
  );

  function formatItemList(list, emptyMessage) {
    if (list.length === 0) {
      return `- ${emptyMessage}`;
    }

    return list
      .map((item) => {
        const parts = [`- **${item.slideId}**`];
        if (typeof item.afterScore === "number") {
          parts.push(`score: ${item.beforeScore ?? "—"} → ${item.afterScore}`);
        } else if (item.beforeScore !== null) {
          parts.push(`改善前 score: ${item.beforeScore}`);
        }
        if (item.error) {
          parts.push(`エラー: ${item.error}`);
        }
        return parts.join(" / ");
      })
      .join("\n");
  }

  const lines = [
    "# Nano Banana 画像改善レポート",
    "",
    "## 生成日時",
    "",
    generatedAt,
    "",
    `- manifest: \`${report.manifestFile}\``,
    `- review_result: \`${report.reviewResultFile}\``,
    "",
    "## サマリー",
    "",
    summaryTable,
    "",
    "## スライド別結果",
    "",
    ...slideTableHeader,
    ...slideTableRows,
    "",
    "## 公開推奨一覧（90点以上）",
    "",
    formatItemList(publishRecommended, "該当なし"),
    "",
    "## 再改善候補一覧（80点未満）",
    "",
    formatItemList(needsReImprovement, "該当なし"),
    "",
    "## 失敗一覧",
    "",
    formatItemList(failures, "該当なし"),
    "",
    "## 運用メモ",
    "",
    "- このレポートは `reports/nano-banana-improve/` に保存されます（Git 管理対象外）。",
    "- 元画像（`images/carousel/output/`）と改善画像（`output/carousel/improved/`）は上書きしません。",
    "- 採点基準: **80点以上 = 合格**、**90点以上 = 公開推奨**、**79点以下 = 再改善候補**。",
    "- 改善失敗時は `npm run smart-auto-fix -- --apply` や OpenAI 再生成を検討してください。",
    "- TEXT 系 rootCause は Nano Banana 非推奨です。Smart Auto Fix を優先してください。",
    "- 再レビュー未実施の場合は `node scripts/review_improved_images.js --apply` を実行してください。",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

/**
 * @param {object} options
 * @param {string | null} options.manifest
 * @param {string | null} options.reviewResult
 */
async function main({ manifest, reviewResult }) {
  const manifestPath = manifest ?? DEFAULT_MANIFEST_PATH;
  const reviewResultPath = reviewResult ?? DEFAULT_REVIEW_RESULT_PATH;

  const manifestData = await loadJsonFile(manifestPath, "manifest.json");
  const reviewResultData = await loadJsonFile(reviewResultPath, "review_result.json");

  if (!Array.isArray(manifestData.items)) {
    throw new InputConfigurationError("manifest.json に items 配列がありません。");
  }

  if (!Array.isArray(reviewResultData.items)) {
    throw new InputConfigurationError(
      "review_result.json に items 配列がありません。",
    );
  }

  const report = buildReportData({
    manifest: manifestData,
    reviewResult: reviewResultData,
    manifestFile: manifestPath,
    reviewResultFile: reviewResultPath,
  });

  const reportJsonAbsolute = path.join(PROJECT_ROOT, REPORT_JSON_PATH);
  const reportMdAbsolute = path.join(PROJECT_ROOT, REPORT_MD_PATH);

  await fs.mkdir(path.dirname(reportJsonAbsolute), { recursive: true });
  await fs.writeFile(reportJsonAbsolute, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
  await fs.writeFile(reportMdAbsolute, buildReportMarkdown(report), "utf-8");

  console.log("[NanoBananaReport] レポートを生成しました:");
  console.log(`  - ${REPORT_MD_PATH}`);
  console.log(`  - ${REPORT_JSON_PATH}`);
  console.log(
    `[NanoBananaReport] サマリー: target=${report.summary.targetCount}, improved=${report.summary.improvedCount}, reviewed=${report.summary.reviewedCount}, publish_recommended=${report.summary.publishRecommendedCount}`,
  );

  process.exit(getExitCodeByResult({ script: "report" }));
}

try {
  const options = parseArgs(process.argv);
  await main(options);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const exitCode = getErrorExitCode(error);
  console.error(`[NanoBananaReport] エラー: ${message}`);
  console.error(
    `[NanoBananaReport] 終了コード: ${exitCode} (${describeExitCode(exitCode)})`,
  );
  process.exit(exitCode);
}
