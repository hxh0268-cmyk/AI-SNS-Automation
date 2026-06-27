import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateWithRetry } from "./lib/gemini.js";
import { extractJsonFromText } from "./lib/json.js";
import { PASSING_SCORE, SLIDE_FILES, loadSlides } from "./lib/carousel.js";

// プロジェクトルートを取得（このスクリプトは src/ 配下にある前提）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// 入出力ファイルのパス
const CAROUSEL_DIR = path.join(PROJECT_ROOT, "content/carousel");
const REVIEW_MD_FILE = path.join(CAROUSEL_DIR, "review.md");
const REVIEW_JSON_FILE = path.join(CAROUSEL_DIR, "review.json");

const BREAKDOWN_KEYS = [
  "cover",
  "empathy",
  "mistake",
  "success",
  "cta",
  "readability",
];

const BREAKDOWN_LABELS = {
  cover: "表紙の強さ",
  empathy: "共感性",
  mistake: "失敗例の具体性",
  success: "成功例の説得力",
  cta: "CTAの強さ",
  readability: "文字量・可読性",
};

const BREAKDOWN_MAX = {
  cover: 20,
  empathy: 20,
  mistake: 15,
  success: 15,
  cta: 20,
  readability: 10,
};

// 品質ゲートの最低点
const QUALITY_GATE_THRESHOLDS = {
  cover: 18,
  empathy: 18,
  mistake: 13,
  success: 13,
  cta: 18,
  readability: 8,
};

// Gemini に与えるカルーセル品質レビュー用の指示
const SYSTEM_PROMPT = `あなたはSNSマーケター兼Instagram編集長です。

5枚構成のInstagramストーリー型カルーセルを、100点満点で採点・レビューしてください。

【評価項目】
- 表紙の強さ：20点
- 共感性：20点
- 失敗例の具体性：15点
- 成功例の説得力：15点
- CTAの強さ：20点
- 文字量・可読性：10点

【評価の観点】
- 保存・フォロー・商品販売につながるか
- 1スライド1メッセージになっているか
- 飲食店オーナー・店長に刺さるか
- 3秒で読める短文か
- 表紙→共感→失敗例→成功例→CTA のストーリーがつながっているか

【出力形式】
必ず以下のJSON形式のみで出力してください。説明文は不要です。

{
  "score": 94,
  "breakdown": {
    "cover": 18,
    "empathy": 20,
    "mistake": 15,
    "success": 13,
    "cta": 18,
    "readability": 10
  },
  "strengths": ["良い点1", "良い点2"],
  "improvements": ["改善点1", "改善点2"]
}`;

/**
 * Gemini に渡す入力テキストを組み立てる
 * @param {Array<{ fileName: string, type: string, content: string }>} slides
 * @returns {string}
 */
function buildReviewInput(slides) {
  return slides
    .map(
      (slide) => `### ${slide.fileName}（${slide.type}）\n${slide.content}`,
    )
    .join("\n\n");
}

/**
 * 品質ゲートを評価する
 * @param {object} breakdown - 各項目の点数
 * @returns {{ passed: boolean, thresholds: object, failedItems: string[] }}
 */
function evaluateQualityGate(breakdown) {
  const failedItems = BREAKDOWN_KEYS.filter(
    (key) => breakdown[key] < QUALITY_GATE_THRESHOLDS[key],
  );

  return {
    passed: failedItems.length === 0,
    thresholds: { ...QUALITY_GATE_THRESHOLDS },
    failedItems,
  };
}

/**
 * レビュー JSON を正規化する
 * @param {unknown} data - パース済みJSON
 * @returns {object}
 */
function normalizeReviewData(data) {
  const score = Number(data?.score);

  if (Number.isNaN(score)) {
    throw new Error("review.json の score が不正です。");
  }

  const breakdown = data?.breakdown;

  for (const key of BREAKDOWN_KEYS) {
    if (typeof breakdown?.[key] !== "number") {
      throw new Error(`review.json の breakdown.${key} が不正です。`);
    }
  }

  const strengths = Array.isArray(data?.strengths)
    ? data.strengths.map(String)
    : [];
  const improvements = Array.isArray(data?.improvements)
    ? data.improvements.map(String)
    : [];

  const qualityGate = evaluateQualityGate(breakdown);
  const scorePassed = score >= PASSING_SCORE;
  const passed = scorePassed && qualityGate.passed;

  return {
    score,
    passed,
    breakdown,
    strengths,
    improvements,
    status: passed ? "合格" : "改善が必要",
    qualityGate,
  };
}

/**
 * Gemini のレスポンスからレビュー JSON を抽出する
 * @param {string} text - APIレスポンス本文
 * @returns {object}
 */
function parseReviewJson(text) {
  try {
    return extractJsonFromText(text);
  } catch {
    throw new Error("Gemini API のレスポンスをJSONとして解析できませんでした。");
  }
}

/**
 * review.json から review.md を生成する
 * @param {object} review - 正規化済みレビューデータ
 * @returns {string}
 */
function buildReviewMarkdown(review) {
  const breakdownLines = BREAKDOWN_KEYS.map(
    (key) =>
      `- ${BREAKDOWN_LABELS[key]}：${review.breakdown[key]} / ${BREAKDOWN_MAX[key]}点`,
  ).join("\n");

  const strengthsLines =
    review.strengths.length > 0
      ? review.strengths.map((item) => `- ${item}`).join("\n")
      : "- なし";

  const improvementsLines =
    review.improvements.length > 0
      ? review.improvements.map((item) => `- ${item}`).join("\n")
      : "- なし";

  const qualityGateStatus = review.qualityGate.passed ? "合格" : "改善が必要";
  const failedItemsLines =
    review.qualityGate.failedItems.length > 0
      ? review.qualityGate.failedItems
          .map(
            (key) =>
              `- ${BREAKDOWN_LABELS[key]}（${key}）: ${review.breakdown[key]} / 最低点 ${QUALITY_GATE_THRESHOLDS[key]}点`,
          )
          .join("\n")
      : "- なし";

  return `# カルーセル品質レビュー

## 総合点
${review.score} / 100点

## 判定
${review.status}

## 品質ゲート
- 結果：${qualityGateStatus}
- 未達項目：
${failedItemsLines}

## 各項目の点数
${breakdownLines}

## 良い点
${strengthsLines}

## 改善点
${improvementsLines}
`;
}

/**
 * メイン処理
 */
async function main() {
  // スライドファイルを読み込む
  const slides = await loadSlides(CAROUSEL_DIR);
  const reviewInput = buildReviewInput(slides);

  const cacheInputFiles = SLIDE_FILES.map((fileName) =>
    path.join(CAROUSEL_DIR, fileName),
  );

  // Gemini でカルーセル品質を採点
  const responseText = await generateWithRetry({
    contents: reviewInput,
    systemInstruction: SYSTEM_PROMPT,
    cacheKey: "carousel-review",
    cacheInputFiles,
  });

  const parsed = parseReviewJson(responseText);
  const review = normalizeReviewData(parsed);

  // レビュー結果を保存
  try {
    await fs.writeFile(REVIEW_MD_FILE, `${buildReviewMarkdown(review)}\n`, "utf-8");
    await fs.writeFile(
      REVIEW_JSON_FILE,
      `${JSON.stringify(review, null, 2)}\n`,
      "utf-8",
    );
  } catch (error) {
    throw new Error(`レビュー結果の保存に失敗しました: ${error.message}`);
  }

  console.log("Carousel review completed:");
  console.log("content/carousel/review.md");
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
