import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_MODEL = "gemini-2.5-flash";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const CACHE_DIR = path.join(PROJECT_ROOT, ".cache/gemini");

/**
 * 強制再生成モードかどうか
 * @returns {boolean}
 */
export function isForceAi() {
  return process.env.FORCE_AI === "1";
}

/**
 * 入力ファイル群からハッシュを生成する
 * @param {string[]} filePaths - 入力ファイルの絶対パス
 * @returns {Promise<string>}
 */
export async function hashInputFiles(filePaths) {
  const hash = crypto.createHash("sha256");

  for (const filePath of [...filePaths].sort()) {
    hash.update(filePath);
    hash.update("\0");
    hash.update(await fs.readFile(filePath));
    hash.update("\0");
  }

  return hash.digest("hex");
}

/**
 * キャッシュキー用ハッシュを生成する
 * @param {object} options
 * @param {string} options.cacheKey - 処理種別
 * @param {string[]} options.inputFiles - 入力ファイルの絶対パス
 * @param {string} [options.systemInstruction] - システムプロンプト
 * @param {string} [options.model] - 使用モデル
 * @returns {Promise<string>}
 */
export async function buildCacheHash({
  cacheKey,
  inputFiles,
  systemInstruction = "",
  model = DEFAULT_MODEL,
}) {
  const hash = crypto.createHash("sha256");
  hash.update(cacheKey);
  hash.update("\0");
  hash.update(model);
  hash.update("\0");
  hash.update(systemInstruction);
  hash.update("\0");
  hash.update(await hashInputFiles(inputFiles));
  return hash.digest("hex");
}

/**
 * キャッシュファイルのパスを返す
 * @param {string} cacheKey - 処理種別
 * @param {string} hash - 入力ハッシュ
 * @returns {string}
 */
export function getCacheFilePath(cacheKey, hash) {
  return path.join(CACHE_DIR, cacheKey, `${hash}.txt`);
}

/**
 * Gemini キャッシュを読み込む
 * @param {string} cacheKey - 処理種別
 * @param {string} hash - 入力ハッシュ
 * @returns {Promise<string | null>}
 */
export async function readGeminiCache(cacheKey, hash) {
  const cacheFile = getCacheFilePath(cacheKey, hash);

  try {
    const content = await fs.readFile(cacheFile, "utf-8");
    return content.trim() ? content : null;
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw new Error(`Gemini キャッシュの読み込みに失敗しました: ${error.message}`);
  }
}

/**
 * Gemini キャッシュを保存する
 * @param {string} cacheKey - 処理種別
 * @param {string} hash - 入力ハッシュ
 * @param {string} response - API レスポンス
 * @returns {Promise<void>}
 */
export async function writeGeminiCache(cacheKey, hash, response) {
  const cacheFile = getCacheFilePath(cacheKey, hash);
  await fs.mkdir(path.dirname(cacheFile), { recursive: true });
  await fs.writeFile(cacheFile, response, "utf-8");
}
