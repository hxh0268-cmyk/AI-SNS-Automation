import { createHash } from "node:crypto";
import { TEXT_POST_ERROR_KIND, TextPostError } from "./text_post_lifecycle.js";

// Planning baseline: 280 chars (standard X post without URL surcharge).
// Stage A: configurable via opts.maxLength; not permanently hard-coded in core.
const DEFAULT_MAX_LENGTH = 280;

const NULL_BYTE = "\x00";

const UNSUPPORTED_FEATURE_KEYS = [
  "media",
  "poll",
  "reply",
  "quotePostId",
  "repostId",
];

/**
 * Deterministic normalized text: trim only.
 * No silent truncation — length enforcement is a separate validation step.
 * @param {unknown} rawText
 * @returns {string}
 */
export function normalizePostText(rawText) {
  if (typeof rawText !== "string") return "";
  return rawText.trim();
}

/**
 * Stable SHA-256 digest of normalized text. Used for approval binding and deduplication.
 * @param {string} normalizedText
 * @returns {string} hex string
 */
export function contentDigest(normalizedText) {
  return createHash("sha256").update(normalizedText, "utf8").digest("hex");
}

/**
 * Validate and normalize post text.
 * @param {unknown} rawText
 * @param {{ maxLength?: number }} [opts]
 * @returns {{ ok: true, content: { normalizedText: string, digest: string, charCount: number } }
 *          |{ ok: false, error: TextPostError }}
 */
export function validatePostContent(rawText, opts = {}) {
  const maxLength = opts.maxLength ?? DEFAULT_MAX_LENGTH;

  if (typeof rawText !== "string") {
    return {
      ok: false,
      error: new TextPostError(
        TEXT_POST_ERROR_KIND.INVALID_CONTENT,
        "content must be a string",
      ),
    };
  }

  // Reject null bytes (U+0000)
  if (rawText.includes(NULL_BYTE)) {
    return {
      ok: false,
      error: new TextPostError(
        TEXT_POST_ERROR_KIND.INVALID_CONTENT,
        "content must not contain null bytes",
      ),
    };
  }

  // Reject control characters below U+0020 except U+000A (newline)
  for (let i = 0; i < rawText.length; i++) {
    const code = rawText.charCodeAt(i);
    if (code < 0x0020 && code !== 0x000a) {
      return {
        ok: false,
        error: new TextPostError(
          TEXT_POST_ERROR_KIND.INVALID_CONTENT,
          `content contains forbidden control character (U+${code.toString(16).padStart(4, "0")}) at position ${i}`,
        ),
      };
    }
  }

  const normalizedText = normalizePostText(rawText);

  if (normalizedText.length === 0) {
    return {
      ok: false,
      error: new TextPostError(
        TEXT_POST_ERROR_KIND.INVALID_CONTENT,
        "content must not be empty or whitespace-only",
      ),
    };
  }

  if (normalizedText.length > maxLength) {
    return {
      ok: false,
      error: new TextPostError(
        TEXT_POST_ERROR_KIND.INVALID_CONTENT,
        `content exceeds maximum length of ${maxLength} characters (got ${normalizedText.length})`,
      ),
    };
  }

  return {
    ok: true,
    content: {
      normalizedText,
      digest: contentDigest(normalizedText),
      charCount: normalizedText.length,
    },
  };
}

/**
 * Reject unsupported Stage A features.
 * @param {Record<string, unknown>} featureMap
 * @returns {{ ok: true } | { ok: false, error: TextPostError }}
 */
export function validateNoUnsupportedFeatures(featureMap) {
  for (const key of UNSUPPORTED_FEATURE_KEYS) {
    if (featureMap[key] !== undefined && featureMap[key] !== null && featureMap[key] !== false) {
      return {
        ok: false,
        error: new TextPostError(
          TEXT_POST_ERROR_KIND.UNSUPPORTED_FEATURE,
          `feature not supported in Stage A: ${key}`,
        ),
      };
    }
  }
  return { ok: true };
}
