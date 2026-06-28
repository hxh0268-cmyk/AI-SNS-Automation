import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_PIPELINE_STATE_DIR, PROJECT_ROOT } from "./pipeline_state.js";

/** latest 退避先のベースディレクトリ（プロジェクト相対） */
export const DEFAULT_PIPELINE_ARCHIVE_DIR = "reports/quality-pipeline/archive";

/**
 * アーカイブ用タイムスタンプ（YYYY-MM-DD-HHmmss）
 * @param {Date} [date]
 * @returns {string}
 */
export function formatArchiveTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * @param {string} outputDir
 * @returns {string}
 */
function resolveAbsoluteDir(outputDir) {
  return path.isAbsolute(outputDir)
    ? path.normalize(outputDir)
    : path.join(PROJECT_ROOT, outputDir);
}

/**
 * ディレクトリにファイルがあるか
 * @param {string} absoluteDir
 * @returns {Promise<boolean>}
 */
async function dirHasContent(absoluteDir) {
  try {
    const entries = await fs.readdir(absoluteDir);
    return entries.length > 0;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

/**
 * reports/quality-pipeline/latest を削除する
 * @param {string} [outputDir]
 * @returns {Promise<{ cleaned: boolean, path: string }>}
 */
export async function cleanLatestOutput(outputDir = DEFAULT_PIPELINE_STATE_DIR) {
  const absoluteDir = resolveAbsoluteDir(outputDir);
  await fs.rm(absoluteDir, { recursive: true, force: true });
  return { cleaned: true, path: outputDir };
}

/**
 * latest を timestamp ディレクトリへ退避する（中身がある場合のみ）
 * @param {string} [outputDir]
 * @param {string} [archiveBaseDir]
 * @returns {Promise<{ archived: boolean, reason?: string, path: string | null }>}
 */
export async function archiveLatestOutput(
  outputDir = DEFAULT_PIPELINE_STATE_DIR,
  archiveBaseDir = DEFAULT_PIPELINE_ARCHIVE_DIR,
) {
  const absoluteDir = resolveAbsoluteDir(outputDir);
  const hasContent = await dirHasContent(absoluteDir);

  if (!hasContent) {
    return { archived: false, reason: "empty_or_missing", path: null };
  }

  const timestamp = formatArchiveTimestamp();
  const archiveRelative = path.join(archiveBaseDir, timestamp);
  const archiveAbsolute = path.join(PROJECT_ROOT, archiveRelative);

  await fs.mkdir(path.dirname(archiveAbsolute), { recursive: true });
  await fs.cp(absoluteDir, archiveAbsolute, { recursive: true });

  return {
    archived: true,
    path: archiveRelative.split(path.sep).join("/"),
  };
}

/**
 * 実行前の workspace 準備（--clean-latest または archive）
 * @param {object} config
 * @param {boolean} [config.cleanLatest]
 * @param {string} [outputDir]
 * @returns {Promise<{ action: "cleaned" | "archived" | "none", archivePath: string | null }>}
 */
export async function preparePipelineWorkspace(
  config,
  outputDir = DEFAULT_PIPELINE_STATE_DIR,
) {
  if (config.cleanLatest) {
    await cleanLatestOutput(outputDir);
    return { action: "cleaned", archivePath: null };
  }

  const archive = await archiveLatestOutput(outputDir);
  if (archive.archived) {
    return { action: "archived", archivePath: archive.path };
  }

  return { action: "none", archivePath: null };
}
