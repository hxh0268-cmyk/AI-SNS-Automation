import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { classifyRootCause } from "./lib/root_cause.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const RESEARCH_MD = path.join(PROJECT_ROOT, "content/research/latest.md");
const RESEARCH_JSON = path.join(PROJECT_ROOT, "content/research/latest.json");
const IMAGE_REVIEW_JSON = path.join(
  PROJECT_ROOT,
  "images/carousel/review/image_review.json",
);
const OUTPUT_DIR = path.join(PROJECT_ROOT, "output/instagram");
const OUTPUT_SLIDES_DIR = path.join(OUTPUT_DIR, "slides");
const DAILY_LOG = path.join(PROJECT_ROOT, "logs/daily.log");
const GEMINI_CACHE_DIR = path.join(PROJECT_ROOT, ".cache/gemini");
const HEALTH_CHECK_SCRIPT = path.join(PROJECT_ROOT, "src/health_check.js");

const SLIDE_FILES = ["slide01.png", "slide02.png", "slide03.png", "slide04.png", "slide05.png"];
const DEFAULT_PASSING_SCORE = 80;

const ICON = {
  ok: "✅ 正常",
  warning: "⚠ 注意",
  error: "❌ 要対応",
};

/**
 * パスが存在するか確認する
 * @param {string} targetPath
 * @param {"file" | "dir" | "any"} kind
 * @returns {Promise<boolean>}
 */
async function pathExists(targetPath, kind = "any") {
  try {
    const stat = await fs.stat(targetPath);
    if (kind === "file") {
      return stat.isFile();
    }
    if (kind === "dir") {
      return stat.isDirectory();
    }
    return stat.isFile() || stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * 1 件の診断結果を表示する
 * @param {string} label
 * @param {"ok" | "warning" | "error"} status
 * @param {string} detail
 */
function printResult(label, status, detail) {
  console.log(`${ICON[status]} ${label}`);
  console.log(`   ${detail}`);
}

/**
 * postValueScore が最も高い topic を選ぶ
 * @param {unknown} topics
 * @returns {object | null}
 */
function selectTopTopic(topics) {
  if (!Array.isArray(topics) || topics.length === 0) {
    return null;
  }

  return topics.reduce((best, current) => {
    const bestScore = Number(best?.postValueScore ?? -1);
    const currentScore = Number(current?.postValueScore ?? -1);
    return currentScore > bestScore ? current : best;
  });
}

/**
 * health-check を内部実行する
 * @returns {Promise<{ runnable: boolean, ok: number, warning: number, error: number }>}
 */
async function runHealthCheck() {
  const scriptExists = await pathExists(HEALTH_CHECK_SCRIPT, "file");
  if (!scriptExists) {
    return { runnable: false, ok: 0, warning: 0, error: 0 };
  }

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [HEALTH_CHECK_SCRIPT], {
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.on("error", () => {
      resolve({ runnable: false, ok: 0, warning: 0, error: 0 });
    });

    child.on("close", () => {
      const okMatch = output.match(/OK: (\d+) 件/);
      const warningMatch = output.match(/Warning: (\d+) 件/);
      const errorMatch = output.match(/Error: (\d+) 件/);

      resolve({
        runnable: true,
        ok: okMatch ? Number(okMatch[1]) : 0,
        warning: warningMatch ? Number(warningMatch[1]) : 0,
        error: errorMatch ? Number(errorMatch[1]) : 0,
      });
    });
  });
}

/**
 * latest.json を読み込む
 * @returns {Promise<{ readable: boolean, data: object | null, topScore: number | null, topTitle: string | null }>}
 */
async function readResearchJson() {
  const exists = await pathExists(RESEARCH_JSON, "file");
  if (!exists) {
    return { readable: false, data: null, topScore: null, topTitle: null };
  }

  try {
    const content = await fs.readFile(RESEARCH_JSON, "utf-8");
    if (!content.trim()) {
      return { readable: false, data: null, topScore: null, topTitle: null };
    }

    const data = JSON.parse(content);
    const topTopic = selectTopTopic(data.topics);
    const topScore =
      topTopic?.postValueScore != null ? Number(topTopic.postValueScore) : null;

    return {
      readable: true,
      data,
      topScore: Number.isFinite(topScore) ? topScore : null,
      topTitle: topTopic?.title ?? null,
    };
  } catch {
    return { readable: false, data: null, topScore: null, topTitle: null };
  }
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
 * 不合格スライドの rootCause 分析結果を取得する
 * @param {object} reviewData
 * @returns {Array<{ slideKey: string, score: number | null, type: string | null, classification: ReturnType<typeof classifyRootCause> }>}
 */
function analyzeFailedSlides(reviewData) {
  const passingScore = Number(reviewData.passingScore ?? DEFAULT_PASSING_SCORE);
  const failedItems = toFailedItemSet(reviewData.failedItems);
  const slides = Array.isArray(reviewData.slides) ? reviewData.slides : [];

  return slides
    .filter((slide) => isTargetSlide(slide, failedItems, passingScore))
    .map((slide) => {
      const slideNumber = Number(slide.number);
      const slideKey =
        slide.fileName ??
        `slide${String(slideNumber).padStart(2, "0")}.png`;

      return {
        slideKey,
        score: Number.isFinite(Number(slide.score)) ? Number(slide.score) : null,
        type: slide.type ?? null,
        classification: classifyRootCause(slide),
      };
    });
}

/**
 * image_review.json を読み込む
 * @returns {Promise<{ exists: boolean, readable: boolean, passed: boolean | null, score: number | null, failedItems: string[], data: object | null }>}
 */
async function readImageReview() {
  const exists = await pathExists(IMAGE_REVIEW_JSON, "file");
  if (!exists) {
    return {
      exists: false,
      readable: false,
      passed: null,
      score: null,
      failedItems: [],
      data: null,
    };
  }

  try {
    const content = await fs.readFile(IMAGE_REVIEW_JSON, "utf-8");
    const data = JSON.parse(content);
    const failedItems = Array.isArray(data.failedItems) ? data.failedItems : [];
    const score = data.score != null ? Number(data.score) : null;

    return {
      exists: true,
      readable: true,
      passed: typeof data.passed === "boolean" ? data.passed : null,
      score: Number.isFinite(score) ? score : null,
      failedItems,
      data,
    };
  } catch {
    return {
      exists: true,
      readable: false,
      passed: null,
      score: null,
      failedItems: [],
      data: null,
    };
  }
}

/**
 * output/instagram/slides/ の画像を確認する
 * @returns {Promise<{ complete: boolean, missing: string[] }>}
 */
async function checkOutputSlides() {
  const missing = [];

  for (const fileName of SLIDE_FILES) {
    const exists = await pathExists(path.join(OUTPUT_SLIDES_DIR, fileName), "file");
    if (!exists) {
      missing.push(fileName);
    }
  }

  return { complete: missing.length === 0, missing };
}

/**
 * おすすめコマンドを決める
 * @param {object} state
 * @returns {{ command: string, reason: string, applyCommand?: string, applyReason?: string, legacyCommand?: string, legacyReason?: string }}
 */
function getRecommendation(state) {
  if (!state.healthCheckRunnable) {
    return {
      command: "npm run health-check",
      reason: "Health Check が実行できませんでした。まず環境を確認してください。",
    };
  }

  if (state.healthCheckError > 0) {
    return {
      command: "npm run health-check",
      reason: "環境設定に不足があります。表示された Error を修正してください。",
    };
  }

  if (state.imageReviewExists && state.imageReviewPassed === false) {
    return {
      command: "npm run smart-auto-fix",
      reason:
        "画像レビューが不合格です。原因別の改善計画を確認してください（dry-run・ファイルは変更しません）。",
      applyCommand: "npm run smart-auto-fix -- --apply",
      applyReason:
        "改善計画を確認後、バックアップ準備まで進める場合に実行してください。",
      legacyCommand: "npm run image-improve",
      legacyReason:
        "従来方式：原因分析なしで、一律プロンプト改善 + 画像再生成を行います。",
    };
  }

  if (!state.hasResearchMd && !state.hasResearchJson) {
    return {
      command: "npm run research-check",
      reason: "Genspark リサーチファイルがありません。状態を確認し、必要なら調査結果を保存してください。",
    };
  }

  if (!state.researchJsonReadable && state.hasResearchJson) {
    return {
      command: "npm run research-check",
      reason: "latest.json が読めません。ファイル形式を確認してください。",
    };
  }

  if (!state.hasOutput || !state.slidesComplete) {
    return {
      command: "npm run daily",
      reason: "Instagram 投稿素材がまだありません（または不完全です）。一括生成を実行してください。",
    };
  }

  if (
    state.imageReviewPassed === true &&
    state.hasOutput &&
    state.slidesComplete
  ) {
    return {
      command: "npm run daily",
      reason: "投稿素材の準備はできています。新しいネタで再生成する場合は daily を実行してください。",
    };
  }

  return {
    command: "npm run daily",
    reason: "すべて問題ありません。npm run daily を実行できます。",
  };
}

/**
 * メイン処理
 */
async function main() {
  console.log("========================================");
  console.log("Doctor（現在状態の診断）");
  console.log("========================================");
  console.log("");
  console.log("Health Check より詳しく、リサーチ・画像・出力の");
  console.log("状態を確認し、次に何をすべきかお知らせします。");
  console.log("");

  const counts = { ok: 0, warning: 0, error: 0 };

  /**
   * @param {"ok" | "warning" | "error"} status
   * @param {string} label
   * @param {string} detail
   */
  function record(status, label, detail) {
    counts[status] += 1;
    printResult(label, status, detail);
    console.log("");
  }

  const state = {
    healthCheckRunnable: false,
    healthCheckOk: 0,
    healthCheckWarning: 0,
    healthCheckError: 0,
    hasResearchMd: false,
    hasResearchJson: false,
    researchJsonReadable: false,
    topScore: null,
    topTitle: null,
    imageReviewExists: false,
    imageReviewReadable: false,
    imageReviewPassed: null,
    imageReviewScore: null,
    failedItems: [],
    failedSlideAnalysis: [],
    hasOutput: false,
    slidesComplete: false,
    missingSlides: [],
    hasDailyLog: false,
    hasGeminiCache: false,
  };

  const healthCheck = await runHealthCheck();
  state.healthCheckRunnable = healthCheck.runnable;
  state.healthCheckOk = healthCheck.ok;
  state.healthCheckWarning = healthCheck.warning;
  state.healthCheckError = healthCheck.error;

  if (!healthCheck.runnable) {
    record(
      "error",
      "Health Check の実行",
      "health_check.js を起動できませんでした。プロジェクトのファイルが不足している可能性があります。",
    );
  } else if (healthCheck.error > 0) {
    record(
      "error",
      "Health Check の実行",
      `実行できましたが、要対応 ${healthCheck.error} 件があります（正常 ${healthCheck.ok} / 注意 ${healthCheck.warning}）。`,
    );
  } else if (healthCheck.warning > 0) {
    record(
      "warning",
      "Health Check の実行",
      `実行できました（正常 ${healthCheck.ok} / 注意 ${healthCheck.warning} / 要対応 ${healthCheck.error}）。`,
    );
  } else {
    record(
      "ok",
      "Health Check の実行",
      `実行できました（正常 ${healthCheck.ok} 件）。環境は問題ありません。`,
    );
  }

  state.hasResearchMd = await pathExists(RESEARCH_MD, "file");
  if (state.hasResearchMd) {
    record("ok", "content/research/latest.md", "リサーチ結果（人間向け）があります。");
  } else {
    record(
      "warning",
      "content/research/latest.md",
      "まだありません。Genspark 連携を使う場合は保存してください（なくても daily は動きます）。",
    );
  }

  state.hasResearchJson = await pathExists(RESEARCH_JSON, "file");
  if (state.hasResearchJson) {
    record("ok", "content/research/latest.json", "リサーチ結果（AI 向け）があります。");
  } else {
    record(
      "warning",
      "content/research/latest.json",
      "まだありません。JSON 形式のリサーチがない場合、固定テーマで投稿生成されます。",
    );
  }

  const researchJson = await readResearchJson();
  state.researchJsonReadable = researchJson.readable;
  state.topScore = researchJson.topScore;
  state.topTitle = researchJson.topTitle;

  if (!state.hasResearchJson) {
    record(
      "warning",
      "latest.json の読み込み",
      "latest.json がないため、スキップします。",
    );
  } else if (researchJson.readable) {
    const scoreText =
      researchJson.topScore != null ? `${researchJson.topScore} 点` : "取得できません";
    const titleText = researchJson.topTitle ?? "（タイトルなし）";
    record(
      "ok",
      "latest.json の読み込み",
      `読み込めました。最高 postValueScore: ${scoreText}（${titleText}）`,
    );
  } else {
    record(
      "error",
      "latest.json の読み込み",
      "ファイルはありますが、読み込めません。JSON 形式が壊れている可能性があります。",
    );
  }

  const imageReview = await readImageReview();
  state.imageReviewExists = imageReview.exists;
  state.imageReviewReadable = imageReview.readable;
  state.imageReviewPassed = imageReview.passed;
  state.imageReviewScore = imageReview.score;
  state.failedItems = imageReview.failedItems;

  if (!imageReview.exists) {
    record(
      "warning",
      "images/carousel/review/image_review.json",
      "まだありません。npm run daily を実行すると作成されます。",
    );
  } else {
    record("ok", "images/carousel/review/image_review.json", "画像レビュー結果があります。");
  }

  if (!imageReview.exists) {
    record(
      "warning",
      "画像レビュー結果（passed / score / failedItems）",
      "image_review.json がないため、スキップします。",
    );
  } else if (!imageReview.readable) {
    record(
      "error",
      "画像レビュー結果（passed / score / failedItems）",
      "image_review.json が読めません。ファイル形式を確認してください。",
    );
  } else if (imageReview.passed === true) {
    record(
      "ok",
      "画像レビュー結果（passed / score / failedItems）",
      `passed: true / score: ${imageReview.score ?? "なし"} / failedItems: なし`,
    );
  } else if (imageReview.passed === false) {
    const failedText =
      imageReview.failedItems.length > 0
        ? imageReview.failedItems.join(", ")
        : "なし";
    record(
      "error",
      "画像レビュー結果（passed / score / failedItems）",
      `passed: false / score: ${imageReview.score ?? "なし"} / failedItems: ${failedText}`,
    );

    if (imageReview.data) {
      state.failedSlideAnalysis = analyzeFailedSlides(imageReview.data);

      if (state.failedSlideAnalysis.length > 0) {
        console.log("【不合格スライドの rootCause 分析】");
        console.log("");

        for (const item of state.failedSlideAnalysis) {
          console.log(`■ ${item.slideKey}${item.type ? `（${item.type}）` : ""}`);
          console.log(`  - score: ${item.score ?? "不明"}`);
          console.log(`  - rootCause: ${item.classification.rootCause}`);
          console.log(`  - reason: ${item.classification.reason}`);

          if (item.classification.matchedKeywords.length > 0) {
            console.log(
              `  - matchedKeywords: ${item.classification.matchedKeywords.join(", ")}`,
            );
          } else {
            console.log("  - matchedKeywords: なし");
          }

          console.log("");
        }
      }
    }
  } else {
    record(
      "warning",
      "画像レビュー結果（passed / score / failedItems）",
      "passed や score の情報が不完全です。npm run image-review を再実行してください。",
    );
  }

  state.hasOutput = await pathExists(OUTPUT_DIR, "dir");
  if (state.hasOutput) {
    record("ok", "output/instagram/", "Instagram 投稿用フォルダがあります。");
  } else {
    record(
      "warning",
      "output/instagram/",
      "まだありません。npm run daily 完了後に作成されます。",
    );
  }

  const slides = await checkOutputSlides();
  state.slidesComplete = slides.complete;
  state.missingSlides = slides.missing;

  if (!state.hasOutput) {
    record(
      "warning",
      "output/instagram/slides/ の画像",
      "output/instagram/ がないため、スキップします。",
    );
  } else if (slides.complete) {
    record(
      "ok",
      "output/instagram/slides/ の画像",
      "slide01.png 〜 slide05.png がすべて揃っています。",
    );
  } else {
    record(
      "error",
      "output/instagram/slides/ の画像",
      `不足しています: ${slides.missing.join(", ")}`,
    );
  }

  state.hasDailyLog = await pathExists(DAILY_LOG, "file");
  if (state.hasDailyLog) {
    record("ok", "logs/daily.log", "実行ログがあります。");
  } else {
    record(
      "warning",
      "logs/daily.log",
      "まだありません。npm run daily を実行すると作成されます。",
    );
  }

  state.hasGeminiCache = await pathExists(GEMINI_CACHE_DIR, "dir");
  if (state.hasGeminiCache) {
    record("ok", ".cache/gemini/", "Gemini キャッシュフォルダがあります。");
  } else {
    record(
      "warning",
      ".cache/gemini/",
      "まだありません。Gemini API 利用時に自動作成されます（問題ありません）。",
    );
  }

  const recommendation = getRecommendation(state);

  console.log("========================================");
  console.log("Doctor 完了");
  console.log("========================================");
  console.log("");
  console.log("【現在の状態まとめ】");
  console.log(`- 診断結果: 正常 ${counts.ok} / 注意 ${counts.warning} / 要対応 ${counts.error}`);
  console.log(
    `- 環境（Health Check）: ${
      state.healthCheckError > 0
        ? "要対応あり"
        : state.healthCheckWarning > 0
          ? "注意あり"
          : "問題なし"
    }`,
  );
  console.log(
    `- リサーチ: ${
      state.hasResearchMd || state.hasResearchJson
        ? state.researchJsonReadable
          ? `あり（最高スコア ${state.topScore ?? "不明"}）`
          : "ファイルあり（JSON 読込に問題）"
        : "なし（固定テーマで生成）"
    }`,
  );
  console.log(
    `- 画像レビュー: ${
      !state.imageReviewExists
        ? "未実施"
        : state.imageReviewPassed === true
          ? `合格（score: ${state.imageReviewScore ?? "不明"}）`
          : state.imageReviewPassed === false
            ? `不合格（score: ${state.imageReviewScore ?? "不明"}）`
            : "結果不明"
    }`,
  );

  if (state.failedSlideAnalysis.length > 0) {
    const causeSummary = state.failedSlideAnalysis
      .map(
        (item) =>
          `${item.slideKey}=${item.classification.rootCause}`,
      )
      .join(", ");
    console.log(`- 不合格原因: ${causeSummary}`);
  }

  console.log(
    `- 投稿素材（output/instagram/）: ${
      state.hasOutput && state.slidesComplete
        ? "準備完了"
        : state.hasOutput
          ? "フォルダあり（画像不足）"
          : "未作成"
    }`,
  );
  console.log("");
  console.log("【次に実行すべきおすすめコマンド】");
  console.log(`→ ${recommendation.command}`);
  console.log(`   ${recommendation.reason}`);

  if (recommendation.applyCommand) {
    console.log(`→ ${recommendation.applyCommand}`);
    console.log(`   ${recommendation.applyReason}`);
  }

  if (recommendation.legacyCommand) {
    console.log("");
    console.log("【従来の改善コマンド（補足）】");
    console.log(`→ ${recommendation.legacyCommand}`);
    console.log(`   ${recommendation.legacyReason}`);
  }

  console.log("");
}

main().catch((error) => {
  console.error(`予期しないエラー: ${error.message}`);
  process.exit(0);
});
