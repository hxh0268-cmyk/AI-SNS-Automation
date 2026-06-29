import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const ENV_FILE = path.join(PROJECT_ROOT, ".env");

/** pipeline 側が stdout から JSON を抽出するためのマーカー */
export const HEALTH_CHECK_JSON_MARKER = "__HEALTH_CHECK_JSON__:";

const ICON = {
  ok: "✅ OK",
  warning: "⚠ Warning",
  error: "❌ Error",
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
 * 1 件のチェック結果を表示する
 * @param {string} label
 * @param {"ok" | "warning" | "error"} status
 * @param {string} detail
 */
function printResult(label, status, detail) {
  console.log(`${ICON[status]} ${label}`);
  console.log(`   ${detail}`);
}

/**
 * GitHub Actions 実行環境かどうか
 * @returns {boolean}
 */
export function isGitHubActionsEnv() {
  return process.env.GITHUB_ACTIONS === "true";
}

/**
 * JSON 出力モードかどうか
 * @returns {boolean}
 */
function isJsonOutputMode() {
  return (
    process.argv.includes("--json") ||
    process.env.HEALTH_CHECK_JSON === "1"
  );
}

/**
 * メイン処理
 */
async function main() {
  const jsonMode = isJsonOutputMode();

  console.log("========================================");
  console.log("Health Check（動作環境の確認）");
  console.log("========================================");
  console.log("");
  console.log("AI-SNS-Automation が正常に動くために必要な");
  console.log("ファイル・フォルダ・API キーを確認します。");
  console.log("");

  const counts = { ok: 0, warning: 0, error: 0 };
  /** @type {{ status: "ok" | "warning" | "error", label: string, detail: string }[]} */
  const items = [];

  /**
   * @param {"ok" | "warning" | "error"} status
   * @param {string} label
   * @param {string} detail
   */
  function record(status, label, detail) {
    counts[status] += 1;
    items.push({ status, label, detail });
    printResult(label, status, detail);
    console.log("");
  }

  const isGitHubActions = isGitHubActionsEnv();
  const hasEnvFile = await pathExists(ENV_FILE, "file");

  if (hasEnvFile) {
    dotenv.config({ path: ENV_FILE, quiet: true });
    record(
      "ok",
      ".env ファイル",
      "設定ファイルが見つかりました。",
    );
  } else if (isGitHubActions) {
    record(
      "ok",
      ".env ファイル",
      "見つかりませんが、GitHub Actions では Repository Secrets が process.env に注入されるため問題ありません。",
    );
  } else {
    record(
      "error",
      ".env ファイル",
      "見つかりません。.env.example をコピーして .env を作成し、API キーを入力してください。",
    );
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    record(
      "ok",
      "OPENAI_API_KEY",
      "設定されています（画像生成に使用します）。",
    );
  } else if (!hasEnvFile && !isGitHubActions) {
    record(
      "error",
      "OPENAI_API_KEY",
      ".env がないため確認できません。先に .env を作成してください。",
    );
  } else if (isGitHubActions) {
    record(
      "error",
      "OPENAI_API_KEY",
      "未設定です。GitHub Actions では OPENAI_API_KEY Secret が必要です。",
    );
  } else {
    record(
      "error",
      "OPENAI_API_KEY",
      "未設定です。.env に OPENAI_API_KEY=... を追加してください。",
    );
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const nanoBananaKey = process.env.NANO_BANANA_API_KEY?.trim();
  const imageKeyMissingDetail =
    "未設定です。GEMINI_API_KEY または NANO_BANANA_API_KEY のいずれかが必要です。";
  const imageKeyMissingEnvDetail =
    ".env がないため確認できません。先に .env を作成してください。";

  if (geminiKey) {
    record(
      "ok",
      "GEMINI_API_KEY",
      "設定されています（レビュー・カルーセル・画像レビューに使用します）。",
    );
  } else if (nanoBananaKey) {
    record(
      "ok",
      "GEMINI_API_KEY",
      "未設定ですが、NANO_BANANA_API_KEY が設定されているため問題ありません。",
    );
  } else if (!hasEnvFile && !isGitHubActions) {
    record("error", "GEMINI_API_KEY", imageKeyMissingEnvDetail);
  } else if (isGitHubActions) {
    record("error", "GEMINI_API_KEY", imageKeyMissingDetail);
  } else {
    record("error", "GEMINI_API_KEY", imageKeyMissingDetail);
  }

  if (nanoBananaKey) {
    record(
      "ok",
      "NANO_BANANA_API_KEY",
      "設定されています（Nano Banana 画像改善に使用します）。",
    );
  } else if (geminiKey) {
    record(
      "ok",
      "NANO_BANANA_API_KEY",
      "未設定ですが、GEMINI_API_KEY が設定されているため問題ありません。",
    );
  } else if (!hasEnvFile && !isGitHubActions) {
    record("error", "NANO_BANANA_API_KEY", imageKeyMissingEnvDetail);
  } else if (isGitHubActions) {
    record("error", "NANO_BANANA_API_KEY", imageKeyMissingDetail);
  } else {
    record("error", "NANO_BANANA_API_KEY", imageKeyMissingDetail);
  }

  const checks = [
    {
      label: "prompts/ フォルダ",
      path: path.join(PROJECT_ROOT, "prompts"),
      kind: "dir",
      ok: "プロンプト用フォルダがあります。",
      error: "見つかりません。プロジェクトのファイルが不足している可能性があります。",
      level: "error",
    },
    {
      label: "content/ フォルダ",
      path: path.join(PROJECT_ROOT, "content"),
      kind: "dir",
      ok: "投稿データ用フォルダがあります。",
      error: "見つかりません。プロジェクトのファイルが不足している可能性があります。",
      level: "error",
    },
    {
      label: "content/research/ フォルダ",
      path: path.join(PROJECT_ROOT, "content/research"),
      kind: "dir",
      ok: "Genspark リサーチ用フォルダがあります。",
      warning:
        "まだありません。Genspark 連携を使う場合は作成し、調査結果を保存してください（なくても daily は動きます）。",
      level: "warning",
    },
    {
      label: ".cache/ フォルダ",
      path: path.join(PROJECT_ROOT, ".cache"),
      kind: "dir",
      ok: "キャッシュ用フォルダがあります。",
      warning:
        "まだありません。初回実行時に自動作成されます（問題ありません）。",
      level: "warning",
    },
    {
      label: "output/ フォルダ",
      path: path.join(PROJECT_ROOT, "output"),
      kind: "dir",
      ok: "出力用フォルダがあります。",
      warning:
        "まだありません。投稿素材出力時に自動作成されます（問題ありません）。",
      level: "warning",
    },
    {
      label: "logs/ フォルダ",
      path: path.join(PROJECT_ROOT, "logs"),
      kind: "dir",
      ok: "ログ用フォルダがあります。",
      warning:
        "まだありません。npm run daily 実行時に作成されます（問題ありません）。",
      level: "warning",
    },
    {
      label: "package.json",
      path: path.join(PROJECT_ROOT, "package.json"),
      kind: "file",
      ok: "プロジェクト設定ファイルがあります。",
      error: "見つかりません。正しいフォルダで実行しているか確認してください。",
      level: "error",
    },
    {
      label: "node_modules/ フォルダ",
      path: path.join(PROJECT_ROOT, "node_modules"),
      kind: "dir",
      ok: "依存パッケージがインストール済みです。",
      error:
        "見つかりません。ターミナルで npm install を実行してください。",
      level: "error",
    },
    {
      label: "scripts/run_daily.sh",
      path: path.join(PROJECT_ROOT, "scripts/run_daily.sh"),
      kind: "file",
      ok: "一括実行スクリプトがあります。",
      error: "見つかりません。npm run daily が使えません。",
      level: "error",
    },
  ];

  for (const check of checks) {
    const exists = await pathExists(check.path, check.kind);
    if (exists) {
      record("ok", check.label, check.ok);
    } else if (check.level === "warning") {
      record("warning", check.label, check.warning);
    } else {
      record("error", check.label, check.error);
    }
  }

  console.log("========================================");
  console.log("Health Check 完了");
  console.log("========================================");
  console.log(`OK: ${counts.ok} 件`);
  console.log(`Warning: ${counts.warning} 件`);
  console.log(`Error: ${counts.error} 件`);
  console.log("");

  if (counts.error > 0) {
    console.log(
      "❌ Error があります。上のメッセージに従って修正してから npm run daily を実行してください。",
    );
  } else if (counts.warning > 0) {
    console.log(
      "⚠ Warning がありますが、すぐに使えないわけではありません。必要に応じて対応してください。",
    );
  } else {
    console.log("すべて問題ありません。npm run daily を実行できます。");
  }

  if (jsonMode) {
    console.log(
      `${HEALTH_CHECK_JSON_MARKER}${JSON.stringify({
        ok: counts.ok,
        warning: counts.warning,
        error: counts.error,
        items,
      })}`,
    );
  }
}

main().catch((error) => {
  console.error(`予期しないエラー: ${error.message}`);
  process.exit(0);
});
