/** @typedef {"TEXT" | "LAYOUT" | "PROMPT" | "STYLE" | "OTHER"} RootCause */

/** @typedef {{ rootCause: RootCause, reason: string, matchedKeywords: string[] }} RootCauseResult */

/** 優先順位（高いほど先に採用） */
const CATEGORY_PRIORITY = ["TEXT", "LAYOUT", "PROMPT", "STYLE", "OTHER"];

/** カテゴリごとのキーワードと理由テンプレート */
const CATEGORY_RULES = {
  TEXT: {
    keywords: [
      "誤字",
      "脱字",
      "日本語崩れ",
      "文字崩れ",
      "文字欠け",
      "文字が欠",
      "不自然な表現",
      "文言が長",
      "文字数が多",
      "致命的なエラー",
      "typo",
      "misspell",
      "misspelling",
      "garbled text",
      "garbled",
      "missing character",
      "broken character",
      "corrupted text",
      "incorrect text",
      "wrong character",
      "character corruption",
      "text corruption",
    ],
    reason: "誤字・日本語崩れの指摘があるため",
  },
  LAYOUT: {
    keywords: [
      "重な",
      "重なる",
      "overlap",
      "overlapping",
      "余白",
      "margin",
      "padding",
      "safe zone",
      "中央",
      "中央揃え",
      "配置",
      "alignment",
      "align",
      "centered",
      "center",
      "可読性",
      "readability",
      "コントラスト",
      "contrast",
      "視認性",
      "visibility",
      "読みにく",
      "legibility",
      "左に寄",
      "右に寄",
      "レイアウト",
      "layout",
    ],
    reason: "配置・可読性に関する指摘があるため",
  },
  PROMPT: {
    keywords: [
      "指示不足",
      "exact text",
      "EXACT text",
      "プロンプト",
      "prompt",
      "文字エリア",
      "text area",
      "instruction",
      "指定不足",
      "specification",
      "生成指示",
      "generation instruction",
    ],
    reason: "プロンプト指示不足に関する指摘があるため",
  },
  STYLE: {
    keywords: [
      "色味",
      "配色",
      "color palette",
      "color scheme",
      "tone",
      "ブランド",
      "統一感",
      "unified",
      "consistency",
      "シリーズ",
      "series",
      "アイコン",
      "icon",
      "デザイン",
      "design",
      "雰囲気",
      "atmosphere",
      "トーン",
      "テクスチャ",
      "texture",
      "インパクト",
      "visual element",
      "保存率",
      "brand",
    ],
    reason: "デザイン・統一感に関する指摘があるため",
  },
};

const NO_ISSUE_PATTERNS = [
  /^特になし\.?$/u,
  /^なし\.?$/u,
  /^問題なし\.?$/u,
  /^none\.?$/iu,
  /^no issues?\.?$/iu,
  /^nothing\.?$/iu,
];

/**
 * 文字列配列フィールドを安全に取り出す
 * @param {unknown} value
 * @returns {string[]}
 */
function extractTextList(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

/**
 * 「特になし」など、実質的な指摘がない文言か判定する
 * @param {string} text
 * @returns {boolean}
 */
function isNoIssueText(text) {
  return NO_ISSUE_PATTERNS.some((pattern) => pattern.test(text.trim()));
}

/**
 * スライドレビューから分類対象テキストを収集する
 * @param {object | null | undefined} slideReview
 * @returns {string[]}
 */
function collectClassificationTexts(slideReview) {
  if (!slideReview || typeof slideReview !== "object") {
    return [];
  }

  const fields = ["improvements", "notes", "issues"];
  const texts = fields.flatMap((field) => extractTextList(slideReview[field]));
  const actionable = texts.filter((text) => !isNoIssueText(text));

  if (actionable.length > 0) {
    return actionable;
  }

  return extractTextList(slideReview.strengths).filter(
    (text) => !isNoIssueText(text),
  );
}

/**
 * テキスト内でキーワードに一致するものを返す
 * @param {string} combinedText
 * @param {string[]} keywords
 * @returns {string[]}
 */
function matchKeywords(combinedText, keywords) {
  const lowerText = combinedText.toLowerCase();
  const matched = [];

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    if (
      combinedText.includes(keyword) ||
      lowerText.includes(lowerKeyword)
    ) {
      matched.push(keyword);
    }
  }

  return matched;
}

/**
 * カテゴリごとの一致結果を集計する
 * @param {string} combinedText
 * @returns {Record<Exclude<RootCause, "OTHER">, string[]>}
 */
function collectCategoryMatches(combinedText) {
  /** @type {Record<Exclude<RootCause, "OTHER">, string[]>} */
  const matches = {
    TEXT: [],
    LAYOUT: [],
    PROMPT: [],
    STYLE: [],
  };

  for (const cause of CATEGORY_PRIORITY) {
    if (cause === "OTHER") {
      continue;
    }

    const rule = CATEGORY_RULES[cause];
    matches[cause] = matchKeywords(combinedText, rule.keywords);
  }

  return matches;
}

/**
 * image_review.json のスライドレビューから rootCause を判定する
 * @param {object | null | undefined} slideReview
 * @returns {RootCauseResult}
 */
export function classifyRootCause(slideReview) {
  const texts = collectClassificationTexts(slideReview);

  if (texts.length === 0) {
    return {
      rootCause: "OTHER",
      reason: "分類できる指摘が見つからないため",
      matchedKeywords: [],
    };
  }

  const combinedText = texts.join("\n");
  const categoryMatches = collectCategoryMatches(combinedText);

  for (const cause of CATEGORY_PRIORITY) {
    if (cause === "OTHER") {
      continue;
    }

    const matchedKeywords = categoryMatches[cause];
    if (matchedKeywords.length > 0) {
      return {
        rootCause: cause,
        reason: CATEGORY_RULES[cause].reason,
        matchedKeywords,
      };
    }
  }

  return {
    rootCause: "OTHER",
    reason: "上記カテゴリに当てはまる指摘がないため",
    matchedKeywords: [],
  };
}
