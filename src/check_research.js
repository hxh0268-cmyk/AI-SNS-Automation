import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const RESEARCH_DIR = path.join(PROJECT_ROOT, "content/research");
const RESEARCH_MD_FILE = path.join(RESEARCH_DIR, "latest.md");
const RESEARCH_JSON_FILE = path.join(RESEARCH_DIR, "latest.json");
const METADATA_FILE = path.join(RESEARCH_DIR, "metadata.json");

/**
 * ファイルが存在するか確認する
 * @param {string} filePath - ファイルパス
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
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
 * scoreBreakdown を表示用テキストに変換する
 * @param {object | undefined} scoreBreakdown
 * @returns {string}
 */
function formatScoreBreakdown(scoreBreakdown) {
  if (!scoreBreakdown || typeof scoreBreakdown !== "object") {
    return "  - なし";
  }

  const labels = {
    novelty: "新しさ（novelty）",
    savePotential: "保存されやすさ（savePotential）",
    restaurantFit: "飲食店への適合度（restaurantFit）",
    beginnerFriendly: "初心者向け度（beginnerFriendly）",
  };

  return Object.entries(labels)
    .map(([key, label]) => `  - ${label}: ${scoreBreakdown[key] ?? "なし"}`)
    .join("\n");
}

/**
 * latest.json を読み込んでパースする
 * @returns {Promise<{ data: object | null, parseFailed: boolean }>}
 */
async function readResearchJson() {
  try {
    const content = await fs.readFile(RESEARCH_JSON_FILE, "utf-8");

    if (!content.trim()) {
      return { data: null, parseFailed: true };
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
      `latest.json の読み込みに失敗しました: ${error.message}`,
    );
  }
}

/**
 * metadata.json を読み込んでパースする
 * @returns {Promise<{ data: object | null, parseFailed: boolean }>}
 */
async function readMetadataJson() {
  try {
    const content = await fs.readFile(METADATA_FILE, "utf-8");

    if (!content.trim()) {
      return { data: null, parseFailed: true };
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
      `metadata.json の読み込みに失敗しました: ${error.message}`,
    );
  }
}

/**
 * 投稿生成で使われるモードを表示する
 * @param {object} options
 */
function printGenerationMode({ hasMarkdown, hasValidJson, jsonParseFailed }) {
  console.log("");
  console.log("【投稿生成で使われる情報】");

  if (!hasMarkdown && !hasValidJson) {
    console.log("現在はGensparkリサーチなし。固定テーマで投稿生成されます。");
    return;
  }

  if (jsonParseFailed) {
    if (hasMarkdown) {
      console.log("- latest.md の内容を参考情報として使用");
      console.log("- latest.json は読み込めないため、JSON の最優先テーマは使われません");
    }
    return;
  }

  if (hasValidJson) {
    console.log("- latest.json の最優先投稿テーマを優先して使用");
  }

  if (hasMarkdown) {
    console.log("- latest.md の内容を参考情報として使用");
  }

  if (!hasValidJson && hasMarkdown) {
    console.log("- latest.json がないため、Markdown の推奨テーマを参考にします");
  }
}

/**
 * メイン処理
 */
async function main() {
  console.log("========================================");
  console.log("Genspark リサーチ状態チェック");
  console.log("========================================");
  console.log("");

  const hasMarkdown = await fileExists(RESEARCH_MD_FILE);
  const hasJsonFile = await fileExists(RESEARCH_JSON_FILE);
  const hasMetadataFile = await fileExists(METADATA_FILE);

  console.log("【ファイルの有無】");
  console.log(`- latest.md: ${hasMarkdown ? "あり" : "なし"}`);
  console.log(`- latest.json: ${hasJsonFile ? "あり" : "なし"}`);
  console.log(`- metadata.json: ${hasMetadataFile ? "あり" : "なし"}`);

  let hasValidJson = false;
  let jsonParseFailed = false;

  if (hasJsonFile) {
    console.log("");
    console.log("【latest.json の内容】");

    const { data: researchJson, parseFailed } = await readResearchJson();

    if (parseFailed) {
      jsonParseFailed = true;
      console.log("latest.json の読み込みに失敗しました");
      console.log("");
      console.log("【latest.md の有無】");
      console.log(`- latest.md: ${hasMarkdown ? "あり" : "なし"}`);
    } else if (researchJson) {
      hasValidJson = true;
      const topics = Array.isArray(researchJson.topics) ? researchJson.topics : [];
      const topTopic = selectTopTopic(topics);

      console.log(`- recommendedTheme: ${researchJson.recommendedTheme ?? "なし"}`);
      console.log(`- topTopic: ${researchJson.topTopic ?? "なし"}`);
      console.log(`- topics 件数: ${topics.length}`);

      if (topTopic) {
        console.log("");
        console.log("【最優先投稿テーマ（postValueScore 最高）】");
        console.log(`- title: ${topTopic.title ?? "なし"}`);
        console.log(`- postValueScore: ${topTopic.postValueScore ?? "なし"}`);
        console.log("- scoreBreakdown:");
        console.log(formatScoreBreakdown(topTopic.scoreBreakdown));
        console.log(`- competitionGap: ${topTopic.competitionGap ?? "なし"}`);
        console.log(`- personalAngle: ${topTopic.personalAngle ?? "なし"}`);
        console.log(
          `- restaurantApplication: ${topTopic.restaurantApplication ?? "なし"}`,
        );
      } else {
        console.log("- 最優先投稿テーマ: topics が空のため選定できません");
      }
    }
  }

  if (hasMetadataFile) {
    console.log("");
    console.log("【metadata.json の内容】");

    const { data: metadata, parseFailed } = await readMetadataJson();

    if (parseFailed) {
      console.log("metadata.json の読み込みに失敗しました");
    } else if (metadata) {
      console.log(`- createdAt: ${metadata.createdAt ?? "なし"}`);
      console.log(`- source: ${metadata.source ?? "なし"}`);
      console.log(`- version: ${metadata.version ?? "なし"}`);
      console.log(`- topicCount: ${metadata.topicCount ?? "なし"}`);

      if (Array.isArray(metadata.searchKeywords)) {
        console.log("- searchKeywords:");
        for (const keyword of metadata.searchKeywords) {
          console.log(`  - ${keyword}`);
        }
      } else {
        console.log("- searchKeywords: なし");
      }
    }
  }

  printGenerationMode({ hasMarkdown, hasValidJson, jsonParseFailed });
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
});
