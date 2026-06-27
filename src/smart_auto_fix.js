import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCarouselPromptFileName } from "./lib/carousel.js";
import { classifyRootCause } from "./lib/root_cause.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const REVIEW_JSON_FILE = path.join(
  PROJECT_ROOT,
  "images/carousel/review/image_review.json",
);
const BACKUP_DIR = path.join(PROJECT_ROOT, "images/carousel/backup");
const REPORT_DIR = path.join(PROJECT_ROOT, "reports/smart-auto-fix");

const DEFAULT_PASSING_SCORE = 80;
const SMART_AUTO_FIX_HEADING = "## Smart Auto Fix 指示";

/** @typedef {"TEXT" | "LAYOUT" | "PROMPT" | "STYLE" | "OTHER"} RootCause */

/**
 * @typedef {object} FixPlan
 * @property {string[]} filesToModify
 * @property {string[]} strategy
 */

/**
 * @typedef {object} SlideProcessResult
 * @property {string} slideKey
 * @property {string | null} type
 * @property {number | string | null} score
 * @property {ReturnType<typeof classifyRootCause>} classification
 * @property {FixPlan} fixPlan
 * @property {string[]} changedFiles
 * @property {string[]} skippedFiles
 * @property {string[]} backedUpFiles
 */

/** rootCause ごとの追記指示 */
const APPLY_INSTRUCTIONS = {
  TEXT: [
    "- 画像内テキストを短くする",
    "- 日本語は誤字が出やすいため短文にする",
    "- 重要文字は大きく中央配置",
    "- EXACT text を使う",
  ],
  LAYOUT: [
    "- 文字エリアには背景模様を入れない",
    "- 背景と文字のコントラストを強くする",
    "- 余白を20%以上確保する",
    "- 文字背後に単色矩形を置く",
  ],
  PROMPT: [
    "- EXACT text 指定を追加",
    "- safe margin を明記",
    "- font size を大きく指定",
    "- no extra text を明記",
  ],
  STYLE: [
    "- ブランドカラーを統一",
    "- アイコンの雰囲気を統一",
    "- フォントイメージを統一",
    "- シリーズ感を出す",
  ],
  OTHER: [
    "- 手動確認が必要",
    "- image_review.md を確認する",
  ],
};

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
 * スライド番号を取得する
 * @param {object} slide
 * @returns {number}
 */
function getSlideNumber(slide) {
  if (Number.isFinite(slide.number)) {
    return Number(slide.number);
  }

  const match = slide.fileName?.match(/slide(\d{2})\.png/i);
  return match ? Number(match[1]) : 0;
}

/**
 * スライド関連ファイルの相対パスを取得する
 * @param {number} slideNumber
 * @returns {{ slideMd: string, promptMd: string }}
 */
function getSlideFilePaths(slideNumber) {
  const suffix = String(slideNumber).padStart(2, "0");
  return {
    slideMd: `content/carousel/slide${suffix}.md`,
    promptMd: `images/carousel/generated-prompts/${getCarouselPromptFileName(slideNumber)}`,
  };
}

/**
 * rootCause に応じた改善方針を返す
 * @param {RootCause} rootCause
 * @param {number} slideNumber
 * @returns {FixPlan}
 */
function buildFixPlan(rootCause, slideNumber) {
  const { slideMd, promptMd } = getSlideFilePaths(slideNumber);

  switch (rootCause) {
    case "TEXT":
      return {
        filesToModify: [slideMd, promptMd],
        strategy: [
          `${slideMd} の文言を短くし、誤字・文字崩れが起きにくい表現に調整する`,
          `${promptMd} に EXACT text 指定と文字崩れ防止ルール（白文字・大きい字号・無地背景）を追加する`,
        ],
      };
    case "LAYOUT":
      return {
        filesToModify: [promptMd],
        strategy: [
          `${promptMd} に余白（safe zone 20%）・中央配置・文字背後の無地矩形を追加する`,
          `${promptMd} に背景パターンが文字と重ならないよう禁止事項を追加する`,
          `${promptMd} にコントラスト強化（白文字 + 暗い背景）を明記する`,
        ],
      };
    case "PROMPT":
      return {
        filesToModify: [promptMd],
        strategy: [
          `${promptMd} に EXACT text（正確な日本語表示）指定を追加する`,
          `${promptMd} に文字サイズ（very large）と安全余白（wide margins）を追加する`,
          `${promptMd} に文字エリアを無地矩形で固定する指示を追加する`,
        ],
      };
    case "STYLE":
      return {
        filesToModify: [promptMd],
        strategy: [
          `${promptMd} に他スライドと揃えるブランドカラー・統一感の指示を追加する`,
          `${promptMd} にシリーズ全体のトーン＆マナーを合わせる指示を追加する`,
          `${promptMd} に必要に応じてアイコン・視覚要素の追加指示を記載する`,
        ],
      };
    default:
      return {
        filesToModify: [promptMd],
        strategy: [
          "自動分類できないため、images/carousel/review/image_review.md を確認して手動で対応してください",
          `${promptMd} に手動確認の指示を追記する`,
        ],
      };
  }
}

/**
 * rootCause 用の追記ブロックを生成する
 * @param {RootCause} rootCause
 * @returns {string}
 */
function buildInstructionBlock(rootCause) {
  const lines = APPLY_INSTRUCTIONS[rootCause] ?? APPLY_INSTRUCTIONS.OTHER;
  return `${SMART_AUTO_FIX_HEADING}\n\n${lines.join("\n")}\n`;
}

/**
 * レポート用タイムスタンプを生成する
 * @param {Date} [date]
 * @returns {string}
 */
function formatReportTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
}

/**
 * 実行結果ラベルを決める
 * @param {object} options
 * @returns {string}
 */
function determineResult({ targetCount, applyMode, slideResults }) {
  if (targetCount === 0) {
    return "改善対象なし";
  }

  const hasOther = slideResults.some(
    (item) => item.classification.rootCause === "OTHER",
  );
  if (hasOther) {
    return "手動確認が必要";
  }

  if (applyMode) {
    return "apply完了";
  }

  return "dry-run完了";
}

/**
 * レポート Markdown を生成する
 * @param {object} data
 * @returns {string}
 */
function buildReportMarkdown(data) {
  const lines = [
    "# Smart Auto Fix Report",
    "",
    "## 実行概要",
    "",
    `- 実行日時: ${data.executedAt}`,
    `- 実行モード: ${data.mode}`,
    `- 画像レビュー総合 score: ${data.reviewScore ?? "不明"}`,
    `- passed: ${data.passed ?? "不明"}`,
    `- failedItems: ${data.failedItemsText}`,
    `- 結果: **${data.result}**`,
    "",
  ];

  if (data.targetSlides.length === 0) {
    lines.push("## 改善対象スライド", "", "なし（すべて合格ライン以上）", "");
  } else {
    lines.push("## 改善対象スライド", "");
    for (const slide of data.targetSlides) {
      lines.push(`### ${slide.slideKey}`);
      lines.push("");
      lines.push(`- 種別: ${slide.type ?? "不明"}`);
      lines.push(`- score: ${slide.score ?? "不明"}`);
      lines.push(`- rootCause: ${slide.classification.rootCause}`);
      lines.push(`- reason: ${slide.classification.reason}`);
      lines.push(
        `- matchedKeywords: ${
          slide.classification.matchedKeywords.length > 0
            ? slide.classification.matchedKeywords.join(", ")
            : "なし"
        }`,
      );
      lines.push("- 修正予定ファイル:");
      if (slide.fixPlan.filesToModify.length > 0) {
        for (const filePath of slide.fixPlan.filesToModify) {
          lines.push(`  - ${filePath}`);
        }
      } else {
        lines.push("  - なし");
      }
      lines.push("- 改善方針:");
      for (const strategy of slide.fixPlan.strategy) {
        lines.push(`  - ${strategy}`);
      }
      lines.push("");
    }
  }

  lines.push("## 実行結果（ファイル）", "");
  lines.push("### 実際に変更したファイル");
  if (data.changedFiles.length > 0) {
    for (const filePath of data.changedFiles) {
      lines.push(`- ${filePath}`);
    }
  } else {
    lines.push("- なし");
  }
  lines.push("");
  lines.push("### バックアップしたファイル");
  if (data.backedUpFiles.length > 0) {
    for (const filePath of data.backedUpFiles) {
      lines.push(`- ${filePath}`);
    }
  } else {
    lines.push("- なし");
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

/**
 * レポートを保存する
 * @param {string} content
 * @param {Date} executedAt
 * @returns {Promise<string>}
 */
async function saveReport(content, executedAt) {
  await fs.mkdir(REPORT_DIR, { recursive: true });
  const fileName = `${formatReportTimestamp(executedAt)}.md`;
  const relativePath = `reports/smart-auto-fix/${fileName}`;
  const absolutePath = path.join(PROJECT_ROOT, relativePath);
  await fs.writeFile(absolutePath, content);
  return relativePath;
}

/**
 * ファイルが存在するか確認する
 * @param {string} absolutePath
 * @returns {Promise<boolean>}
 */
async function fileExists(absolutePath) {
  try {
    const stat = await fs.stat(absolutePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * apply モード用に対象ファイルをバックアップする
 * @param {string} relativePath
 * @returns {Promise<string | null>}
 */
async function backupFile(relativePath) {
  const sourcePath = path.join(PROJECT_ROOT, relativePath);
  const exists = await fileExists(sourcePath);
  if (!exists) {
    return null;
  }

  await fs.mkdir(BACKUP_DIR, { recursive: true });

  const backupName = `${path.basename(relativePath, path.extname(relativePath))}-before-smart-auto-fix${path.extname(relativePath)}`;
  const backupPath = path.join(BACKUP_DIR, backupName);
  await fs.copyFile(sourcePath, backupPath);
  return `images/carousel/backup/${backupName}`;
}

/**
 * Smart Auto Fix 指示をファイル末尾に追記する
 * @param {string} relativePath
 * @param {RootCause} rootCause
 * @returns {Promise<"changed" | "skipped" | "missing">}
 */
async function appendInstructions(relativePath, rootCause) {
  const absolutePath = path.join(PROJECT_ROOT, relativePath);
  const exists = await fileExists(absolutePath);
  if (!exists) {
    return "missing";
  }

  const content = await fs.readFile(absolutePath, "utf-8");
  if (content.includes(SMART_AUTO_FIX_HEADING)) {
    return "skipped";
  }

  const block = buildInstructionBlock(rootCause);
  const newContent = `${content.trimEnd()}\n\n${block}`;
  await fs.writeFile(absolutePath, newContent);
  return "changed";
}

/**
 * スライド1件分の改善計画を処理する
 * @param {object} slide
 * @param {boolean} applyMode
 * @returns {Promise<SlideProcessResult>}
 */
async function processSlide(slide, applyMode) {
  const slideNumber = getSlideNumber(slide);
  const slideKey =
    slide.fileName ?? `slide${String(slideNumber).padStart(2, "0")}.png`;
  const classification = classifyRootCause(slide);
  const fixPlan = buildFixPlan(classification.rootCause, slideNumber);

  const changedFiles = [];
  const skippedFiles = [];
  const backedUpFiles = [];

  console.log(`【対象スライド】 ${slideKey}`);
  console.log(`- 種別: ${slide.type ?? "不明"}`);
  console.log(`- score: ${slide.score ?? "不明"}`);
  console.log(`- rootCause: ${classification.rootCause}`);
  console.log(`- reason: ${classification.reason}`);

  if (classification.matchedKeywords.length > 0) {
    console.log(
      `- matchedKeywords: ${classification.matchedKeywords.join(", ")}`,
    );
  } else {
    console.log("- matchedKeywords: なし");
  }

  if (fixPlan.filesToModify.length > 0) {
    console.log("- 修正予定ファイル:");
    for (const filePath of fixPlan.filesToModify) {
      console.log(`  - ${filePath}`);
    }
  } else {
    console.log("- 修正予定ファイル: なし（手動確認）");
  }

  console.log("- 改善方針:");
  for (const line of fixPlan.strategy) {
    console.log(`  - ${line}`);
  }

  if (applyMode && fixPlan.filesToModify.length > 0) {
    for (const relativePath of fixPlan.filesToModify) {
      const backupPath = await backupFile(relativePath);
      if (backupPath) {
        backedUpFiles.push(backupPath);
      }

      const result = await appendInstructions(
        relativePath,
        classification.rootCause,
      );

      if (result === "changed") {
        changedFiles.push(relativePath);
      } else if (result === "skipped") {
        skippedFiles.push(relativePath);
      }
    }

    if (backedUpFiles.length > 0) {
      console.log("- バックアップ:");
      for (const backupPath of backedUpFiles) {
        console.log(`  - ${backupPath}`);
      }
    }

    if (changedFiles.length > 0) {
      console.log("- apply mode: 指示を追記しました");
      console.log("- 変更したファイル:");
      for (const filePath of changedFiles) {
        console.log(`  - ${filePath}`);
      }
    } else if (skippedFiles.length > 0) {
      console.log("- apply mode: 追記スキップ（既に Smart Auto Fix 指示あり）");
      for (const filePath of skippedFiles) {
        console.log(`  - ${filePath}`);
      }
    } else {
      console.log("- apply mode: 変更対象ファイルが見つかりませんでした");
    }
  }

  console.log("");

  return {
    slideKey,
    type: slide.type ?? null,
    score: slide.score ?? null,
    classification,
    fixPlan,
    changedFiles,
    skippedFiles,
    backedUpFiles,
  };
}

/**
 * メイン処理
 */
async function main() {
  const applyMode = process.argv.includes("--apply");
  const executedAt = new Date();

  console.log("========================================");
  console.log("Smart Auto Fix");
  console.log("========================================");
  console.log("");
  console.log(
    applyMode
      ? "モード: apply（バックアップ後に Smart Auto Fix 指示を追記します）"
      : "モード: dry-run（計画表示のみ・ファイルは変更しません）",
  );
  console.log("");

  const review = await loadReviewJson();
  const passingScore = Number(review.passingScore ?? DEFAULT_PASSING_SCORE);
  const failedItems = toFailedItemSet(review.failedItems);
  const failedItemsList = [...failedItems];
  const slides = Array.isArray(review.slides) ? review.slides : [];

  const targets = slides.filter((slide) =>
    isTargetSlide(slide, failedItems, passingScore),
  );

  console.log(`合格ライン: ${passingScore} 点`);
  console.log(
    `failedItems: ${failedItemsList.length > 0 ? failedItemsList.join(", ") : "なし"}`,
  );
  console.log(
    `総合判定: ${review.passed === true ? "合格" : review.passed === false ? "不合格" : "不明"}`,
  );
  console.log("");

  const slideResults = [];
  const allChangedFiles = new Set();
  const allBackedUpFiles = new Set();

  if (targets.length === 0) {
    console.log("改善対象なし");
    console.log("");
    console.log("すべてのスライドが合格ライン以上です。");
    console.log("");
  } else {
    console.log(`改善対象: ${targets.length} 枚`);
    console.log("");

    for (const slide of targets) {
      const result = await processSlide(slide, applyMode);
      slideResults.push(result);

      for (const filePath of result.changedFiles) {
        allChangedFiles.add(filePath);
      }
      for (const filePath of result.backedUpFiles) {
        allBackedUpFiles.add(filePath);
      }
    }
  }

  const result = determineResult({
    targetCount: targets.length,
    applyMode,
    slideResults,
  });

  const reportPath = await saveReport(
    buildReportMarkdown({
      executedAt: executedAt.toLocaleString("ja-JP"),
      mode: applyMode ? "apply" : "dry-run",
      reviewScore: review.score ?? null,
      passed: review.passed ?? null,
      failedItemsText:
        failedItemsList.length > 0 ? failedItemsList.join(", ") : "なし",
      result,
      targetSlides: slideResults,
      changedFiles: [...allChangedFiles],
      backedUpFiles: [...allBackedUpFiles],
    }),
    executedAt,
  );

  console.log("========================================");
  console.log("Smart Auto Fix 完了");
  console.log("========================================");

  if (applyMode && allChangedFiles.size > 0) {
    console.log("");
    console.log("【変更したファイル一覧】");
    for (const filePath of allChangedFiles) {
      console.log(`- ${filePath}`);
    }
    console.log("");
    console.log("（画像生成・画像レビューはまだ実行しません）");
  }

  if (!applyMode && targets.length > 0) {
    console.log("");
    console.log("指示を追記する場合:");
    console.log("npm run smart-auto-fix -- --apply");
  }

  console.log("");
  console.log("【レポート保存】");
  console.log(`→ ${reportPath}`);
  console.log(`   結果: ${result}`);
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
