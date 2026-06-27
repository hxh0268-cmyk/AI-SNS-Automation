import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// プロジェクトルートを取得（このスクリプトは src/ 配下にある前提）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// プロンプトファイルのパス
const SYSTEM_PROMPT_FILE = path.join(
  PROJECT_ROOT,
  "prompts/instagram/system.md",
);
const USER_PROMPT_FILE = path.join(
  PROJECT_ROOT,
  "prompts/instagram/user.md",
);
const RESEARCH_MD_FILE = path.join(PROJECT_ROOT, "content/research/latest.md");
const RESEARCH_JSON_FILE = path.join(
  PROJECT_ROOT,
  "content/research/latest.json",
);

// 出力先
const DRAFT_DIR = path.join(PROJECT_ROOT, "content/draft");
const OUTPUT_FILE = path.join(DRAFT_DIR, "post.md");

/**
 * プロンプトファイルを読み込む
 * @param {string} filePath - 読み込むファイルのパス
 * @returns {Promise<string>}
 */
async function readPromptFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`プロンプトファイルが見つかりません: ${filePath}`);
    }
    throw new Error(`プロンプトファイルの読み込みに失敗しました: ${error.message}`);
  }
}

/**
 * Genspark リサーチ Markdown を読み込む
 * @returns {Promise<string | null>}
 */
async function readResearchMarkdown() {
  try {
    const content = await fs.readFile(RESEARCH_MD_FILE, "utf-8");
    return content.trim() ? content : null;
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw new Error(
      `リサーチ Markdown の読み込みに失敗しました: ${error.message}`,
    );
  }
}

/**
 * Genspark リサーチ JSON を読み込む
 * @returns {Promise<{ data: object | null, parseFailed: boolean }>}
 */
async function readResearchJson() {
  try {
    const content = await fs.readFile(RESEARCH_JSON_FILE, "utf-8");

    if (!content.trim()) {
      return { data: null, parseFailed: false };
    }

    try {
      return { data: JSON.parse(content), parseFailed: false };
    } catch {
      return { data: null, parseFailed: true };
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      return { data: null, parseFailed: false };
    }
    throw new Error(
      `リサーチ JSON の読み込みに失敗しました: ${error.message}`,
    );
  }
}

/**
 * postValueScore が最も高い topic を選ぶ
 * @param {unknown} topics - topics 配列
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
 * scoreBreakdown を Markdown 箇条書きに変換する
 * @param {object | undefined} scoreBreakdown
 * @returns {string}
 */
function formatScoreBreakdown(scoreBreakdown) {
  if (!scoreBreakdown || typeof scoreBreakdown !== "object") {
    return "- なし";
  }

  const labels = {
    novelty: "新しさ（novelty）",
    savePotential: "保存されやすさ（savePotential）",
    restaurantFit: "飲食店への適合度（restaurantFit）",
    beginnerFriendly: "初心者向け度（beginnerFriendly）",
  };

  return Object.entries(labels)
    .map(([key, label]) => `- ${label}: ${scoreBreakdown[key] ?? "なし"}`)
    .join("\n");
}

/**
 * carouselIdea を Markdown に変換する
 * @param {object | undefined} carouselIdea
 * @returns {string}
 */
function formatCarouselIdea(carouselIdea) {
  if (!carouselIdea || typeof carouselIdea !== "object") {
    return "- なし";
  }

  const slides = [
    ["slide01", "表紙"],
    ["slide02", "共感"],
    ["slide03", "失敗例"],
    ["slide04", "成功例"],
    ["slide05", "CTA"],
  ];

  return slides
    .map(([key, label]) => `- ${label}: ${carouselIdea[key] ?? "なし"}`)
    .join("\n");
}

/**
 * hashtags を Markdown に変換する
 * @param {unknown} hashtags
 * @returns {string}
 */
function formatHashtags(hashtags) {
  if (!Array.isArray(hashtags) || hashtags.length === 0) {
    return "- なし";
  }

  return hashtags.map((tag) => `- ${tag}`).join("\n");
}

/**
 * JSON リサーチ結果をユーザープロンプトに追加する
 * @param {string} userPrompt - 基本ユーザープロンプト
 * @param {object} researchJson - latest.json の内容
 * @param {object} topTopic - 最優先 topic
 * @returns {string}
 */
function buildUserPromptWithResearchJson(userPrompt, researchJson, topTopic) {
  return `${userPrompt}

---

# Genspark Research JSON（最優先テーマ）

以下の JSON リサーチ結果に基づき、**最優先投稿テーマ**を中心に Instagram 投稿を作成してください。

## recommendedTheme
${researchJson.recommendedTheme ?? "なし"}

## topTopic
${researchJson.topTopic ?? "なし"}

## 最優先投稿テーマ
${topTopic.title ?? "なし"}

### postValueScore
${topTopic.postValueScore ?? "なし"}

### scoreBreakdown
${formatScoreBreakdown(topTopic.scoreBreakdown)}

### competitionGap
${topTopic.competitionGap ?? "なし"}

### personalAngle
${topTopic.personalAngle ?? "なし"}

### restaurantApplication
${topTopic.restaurantApplication ?? "なし"}

### carouselIdea
${formatCarouselIdea(topTopic.carouselIdea)}

### hashtags
${formatHashtags(topTopic.hashtags)}`;
}

/**
 * リサーチ Markdown をユーザープロンプトに追加する
 * @param {string} userPrompt - 基本ユーザープロンプト
 * @param {string} researchContent - Genspark リサーチ結果
 * @returns {string}
 */
function buildUserPromptWithResearchMarkdown(userPrompt, researchContent) {
  return `${userPrompt}

---

# Genspark Research（参考情報）

以下は Genspark で調査したリサーチ結果です。
この内容を参考に、今日の Instagram 投稿を作成してください。
特に「推奨する投稿テーマ」があれば優先してください。

${researchContent}`;
}

/**
 * Claude Code CLI で投稿を生成する
 * @param {string} systemPrompt - システムプロンプト
 * @param {string} userPrompt - ユーザープロンプト
 * @returns {Promise<string>}
 */
async function generateWithClaude(systemPrompt, userPrompt) {
  try {
    const { stdout } = await execFileAsync(
      "claude",
      ["--print", "--system-prompt", systemPrompt, userPrompt],
      {
        cwd: PROJECT_ROOT,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const output = stdout.trim();

    if (!output) {
      throw new Error("Claude CLI から有効な出力が返されませんでした。");
    }

    return output;
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "claude コマンドが見つかりません。Claude Code CLI がインストールされているか確認してください。",
      );
    }
    if (error.stderr) {
      throw new Error(`Claude CLI エラー: ${error.stderr.trim()}`);
    }
    throw error;
  }
}

/**
 * メイン処理
 */
async function main() {
  // プロンプトファイルを読み込む
  const systemPrompt = await readPromptFile(SYSTEM_PROMPT_FILE);
  const userPrompt = await readPromptFile(USER_PROMPT_FILE);

  if (!systemPrompt.trim()) {
    throw new Error("system.md が空です。");
  }

  if (!userPrompt.trim()) {
    throw new Error("user.md が空です。");
  }

  const researchContent = await readResearchMarkdown();
  const { data: researchJson, parseFailed } = await readResearchJson();

  let finalUserPrompt = userPrompt;
  let usingResearch = false;

  if (parseFailed) {
    console.log(
      "Research JSON parse failed. Using Markdown or default prompt.",
    );
  }

  if (researchJson) {
    const topTopic = selectTopTopic(researchJson.topics);

    if (topTopic) {
      console.log("Research JSON found.");
      console.log("Using priority theme from JSON.");
      finalUserPrompt = buildUserPromptWithResearchJson(
        finalUserPrompt,
        researchJson,
        topTopic,
      );
      usingResearch = true;
    }
  }

  if (researchContent) {
    console.log("Research file found.");
    console.log("Using Genspark research.");
    finalUserPrompt = buildUserPromptWithResearchMarkdown(
      finalUserPrompt,
      researchContent,
    );
    usingResearch = true;
  }

  if (!usingResearch) {
    console.log("Research file not found.");
    console.log("Using default prompt.");
  }

  // Claude Code CLI で投稿を生成
  const generatedPost = await generateWithClaude(systemPrompt, finalUserPrompt);

  // content/draft/ が存在しなければ作成
  await fs.mkdir(DRAFT_DIR, { recursive: true });

  // 生成結果を保存
  try {
    await fs.writeFile(OUTPUT_FILE, generatedPost, "utf-8");
  } catch (error) {
    throw new Error(`投稿の保存に失敗しました: ${error.message}`);
  }

  console.log("Post generated: content/draft/post.md");
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
