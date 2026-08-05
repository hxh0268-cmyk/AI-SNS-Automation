import { TEXT_POST_ERROR_KIND, TextPostError } from "./text_post_lifecycle.js";

/**
 * In-memory idempotency store for Stage A (not persistent across restarts by design).
 *
 * Tracks both by idempotency key and by content digest for two distinct checks:
 *   - Same key + same content → cache hit (returns stored result)
 *   - Same key + different content → IDEMPOTENCY_CONFLICT
 *   - Different key + same content (already processed) → DUPLICATE_REQUEST
 */
export function createInMemoryIdempotencyStore() {
  const byKey = new Map();     // idempotencyKey → { contentDigest, result }
  const byDigest = new Map();  // contentDigest → idempotencyKey (first key that processed it)

  return {
    /**
     * @param {string} key
     * @returns {{ contentDigest: string, result: object } | null}
     */
    get(key) {
      return byKey.get(key) ?? null;
    },

    /**
     * @param {string} digest
     * @returns {string | null} idempotencyKey that first processed this digest
     */
    getKeyForDigest(digest) {
      return byDigest.get(digest) ?? null;
    },

    /**
     * @param {string} key
     * @param {string} digest
     * @param {object} result
     */
    set(key, digest, result) {
      byKey.set(key, { contentDigest: digest, result });
      if (!byDigest.has(digest)) {
        byDigest.set(digest, key);
      }
    },

    size() {
      return byKey.size;
    },
  };
}

/**
 * Check idempotency before invoking provider.
 *
 * @param {ReturnType<typeof createInMemoryIdempotencyStore>} store
 * @param {string} idempotencyKey
 * @param {string} digest - SHA-256 of normalized content
 * @returns {{ ok: boolean, cached?: object | null, error?: TextPostError }}
 */
export function checkIdempotency(store, idempotencyKey, digest) {
  if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0) {
    return {
      ok: false,
      error: new TextPostError(
        TEXT_POST_ERROR_KIND.INVALID_CONTENT,
        "idempotency key is required and must be a non-empty string",
      ),
    };
  }

  const existing = store.get(idempotencyKey);

  if (existing) {
    if (existing.contentDigest === digest) {
      // Same key, same content → cache hit
      return { ok: true, cached: existing.result };
    }
    // Same key, different content → conflict
    return {
      ok: false,
      error: new TextPostError(
        TEXT_POST_ERROR_KIND.IDEMPOTENCY_CONFLICT,
        "idempotency key already used with different content",
      ),
    };
  }

  // New key — check for content-based duplicate (same content processed by different key)
  const priorKey = store.getKeyForDigest(digest);
  if (priorKey !== null) {
    return {
      ok: false,
      error: new TextPostError(
        TEXT_POST_ERROR_KIND.DUPLICATE_REQUEST,
        "identical content already processed (use same idempotency key to retrieve result)",
      ),
    };
  }

  return { ok: true, cached: null };
}
