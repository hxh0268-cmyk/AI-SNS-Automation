import fs from "node:fs/promises";
import path from "node:path";
import { extractJsonFromText } from "./json.js";

// スライド構成定義（ストーリー型カルーセル）
export const SLIDE_FILES = [
  "slide01.md",
  "slide02.md",
  "slide03.md",
  "slide04.md",
  "slide05.md",
];

export const SLIDE_TYPES = ["表紙", "共感", "失敗例", "成功例", "CTA"];

// 各スライドの文字数上限
export const SLIDE_MAX_CHARS = [20, 30, 30, 30, 40];

// カルーセル合格基準点
export const PASSING_SCORE = 90;

// カルーセル画像のスライド枚数
export const SLIDE_COUNT = 5;

/**
 * カルーセル画像プロンプトファイル名を生成する
 * @param {number} number - スライド番号
 * @returns {string}
 */
export function getCarouselPromptFileName(number) {
  return `prompt${String(number).padStart(2, "0")}.md`;
}

/**
 * カルーセル出力画像ファイル名を生成する
 * @param {number} number - スライド番号
 * @returns {string}
 */
export function getCarouselOutputImageFileName(number) {
  return `slide${String(number).padStart(2, "0")}.png`;
}

/**
 * カルーセルスライドが存在するか確認する
 * @param {string} carouselContentDir - content/carousel ディレクトリ
 * @returns {Promise<boolean>}
 */
export async function carouselSlidesExist(carouselContentDir) {
  try {
    await fs.access(path.join(carouselContentDir, SLIDE_FILES[0]));
    return true;
  } catch {
    return false;
  }
}

/**
 * Gemini のレスポンスからカルーセル JSON を抽出する
 * @param {string} text - APIレスポンス本文
 * @returns {object}
 */
export function parseCarouselJson(text) {
  try {
    return extractJsonFromText(text);
  } catch {
    throw new Error("Gemini API のレスポンスをJSONとして解析できませんでした。");
  }
}

/**
 * スライド本文の文字数を数える（改行・空白を除く）
 * @param {string} text - スライド本文
 * @returns {number}
 */
export function countSlideChars(text) {
  return text.replace(/\s/g, "").length;
}

/**
 * スライドデータを検証する
 * @param {object} data - パース済みJSON
 * @returns {Array<{ number: number, type: string, content: string }>}
 */
export function validateSlides(data) {
  if (!Array.isArray(data?.slides) || data.slides.length !== 5) {
    throw new Error("スライドが5枚分取得できませんでした。");
  }

  return data.slides.map((slide, index) => {
    const expectedNumber = index + 1;
    const expectedType = SLIDE_TYPES[index];
    const content = slide?.content?.trim() ?? "";

    if (!content) {
      throw new Error(`スライド${expectedNumber}の内容が空です。`);
    }

    if (content.includes("#")) {
      throw new Error(
        `スライド${expectedNumber}にハッシュタグまたはMarkdown記号が含まれています。`,
      );
    }

    if (/^[-*•]|\n[-*•]/.test(content)) {
      throw new Error(`スライド${expectedNumber}に箇条書きが含まれています。`);
    }

    const charCount = countSlideChars(content);
    const maxChars = SLIDE_MAX_CHARS[index];

    if (charCount > maxChars) {
      throw new Error(
        `スライド${expectedNumber}が文字数上限（${maxChars}文字）を超えています: ${charCount}文字`,
      );
    }

    return {
      number: expectedNumber,
      type: expectedType,
      content,
    };
  });
}

/**
 * スライドファイル名を生成する
 * @param {number} number - スライド番号
 * @returns {string}
 */
export function getSlideFileName(number) {
  return `slide${String(number).padStart(2, "0")}.md`;
}

/**
 * スライドファイルから本文を抽出する
 * @param {string} fileContent - スライドファイルの内容
 * @returns {string}
 */
export function extractSlideContent(fileContent) {
  const lines = fileContent.trim().split("\n");
  const bodyStartIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() !== "",
  );

  if (bodyStartIndex === -1) {
    return "";
  }

  return lines.slice(bodyStartIndex).join("\n").trim();
}

/**
 * スライドのMarkdown本文を組み立てる
 * @param {{ number: number, type: string, content: string }} slide
 * @returns {string}
 */
export function buildSlideMarkdown(slide) {
  return `# スライド${slide.number}：${slide.type}

${slide.content}
`;
}

/**
 * content/carousel/ の存在を確認する
 * @param {string} carouselDir - カルーセルディレクトリ
 * @returns {Promise<void>}
 */
export async function ensureCarouselDirExists(carouselDir) {
  try {
    const stat = await fs.stat(carouselDir);
    if (!stat.isDirectory()) {
      throw new Error("content/carousel/ がディレクトリではありません。");
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("content/carousel/ が存在しません。");
    }
    throw error;
  }
}

/**
 * 全スライドファイルを読み込む
 * @param {string} carouselDir - カルーセルディレクトリ
 * @returns {Promise<Array<{ fileName: string, type: string, content: string }>>}
 */
export async function loadSlides(carouselDir) {
  await ensureCarouselDirExists(carouselDir);

  const slides = [];

  for (let index = 0; index < SLIDE_FILES.length; index++) {
    const fileName = SLIDE_FILES[index];
    const filePath = path.join(carouselDir, fileName);

    let fileContent;
    try {
      fileContent = await fs.readFile(filePath, "utf-8");
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(
          `スライドファイルが見つかりません: content/carousel/${fileName}`,
        );
      }
      throw new Error(
        `${fileName} の読み込みに失敗しました: ${error.message}`,
      );
    }

    const content = extractSlideContent(fileContent);

    if (!content) {
      throw new Error(`content/carousel/${fileName} が空です。`);
    }

    slides.push({
      fileName,
      type: SLIDE_TYPES[index],
      content,
    });
  }

  return slides;
}

/**
 * スライドをファイルに保存する
 * @param {string} carouselDir - カルーセルディレクトリ
 * @param {Array<{ number: number, type: string, content: string }>} slides
 * @returns {Promise<void>}
 */
export async function saveSlides(carouselDir, slides) {
  for (const slide of slides) {
    const filePath = path.join(carouselDir, getSlideFileName(slide.number));

    try {
      await fs.writeFile(filePath, buildSlideMarkdown(slide), "utf-8");
    } catch (error) {
      throw new Error(
        `${getSlideFileName(slide.number)} の保存に失敗しました: ${error.message}`,
      );
    }
  }
}
