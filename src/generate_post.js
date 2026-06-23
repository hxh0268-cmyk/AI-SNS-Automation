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

  // Claude Code CLI で投稿を生成
  const generatedPost = await generateWithClaude(systemPrompt, userPrompt);

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
