import fs from "node:fs";
import path from "node:path";
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

/**
 * File-backed idempotency store for cross-session safety (X1/X4).
 * Records are stored as JSON in tmp/publish-records/<jobId>.json.
 * tmp/publish-records/ is gitignored.
 *
 * @param {{ dir?: string }} [opts]
 */
export function createFileBackedIdempotencyStore(opts = {}) {
  const dir = opts.dir ?? path.join(process.cwd(), "tmp", "publish-records");

  function recordPath(jobId) {
    return path.join(dir, `${jobId}.json`);
  }

  function ensureDir() {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  return {
    /**
     * Get the publish record for a jobId, or null if not found.
     * @param {string} jobId
     * @returns {object | null}
     */
    get(jobId) {
      const p = recordPath(jobId);
      if (!fs.existsSync(p)) return null;
      try {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
      } catch {
        return null;
      }
    },

    /**
     * Write a publish record for a jobId.
     * @param {string} jobId
     * @param {object} record
     */
    set(jobId, record) {
      ensureDir();
      fs.writeFileSync(recordPath(jobId), JSON.stringify(record, null, 2), "utf-8");
    },

    /**
     * Check publish status for a jobId.
     * @param {string} jobId
     * @returns {"published" | "unknown_result" | "not_found"}
     */
    checkPublished(jobId) {
      const record = this.get(jobId);
      if (!record) return "not_found";
      if (record.result === "published" && record.xPostId) return "published";
      if (record.result === "unknown_result") return "unknown_result";
      return "not_found";
    },
  };
}
