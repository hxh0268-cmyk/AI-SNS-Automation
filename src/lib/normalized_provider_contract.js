/**
 * Normalized Provider Contract — result and error shapes returned by Provider Adapters.
 *
 * Adapters translate provider-specific responses into these shapes so that
 * Gateway and Service never depend on provider-specific response formats.
 *
 * NormalizedProviderResult.result.status must never be "published" or "live_published"
 * in P2B+ (mock execution only).
 */

import { TEXT_POST_ERROR_KIND } from "./text_post_lifecycle.js";

/** Required fields in a successful normalized result. */
const REQUIRED_RESULT_FIELDS = ["ok", "providerId", "providerVersion", "capability", "executionMode", "result"];

/** Statuses that indicate real publication — blocked in mock/dry-run modes. */
const LIVE_PUBLISH_STATUSES = new Set(["published", "live_published"]);

/**
 * Validate a NormalizedProviderResult shape.
 * @param {unknown} r
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateNormalizedResult(r) {
  if (!r || typeof r !== "object" || Array.isArray(r)) {
    return { ok: false, error: "NormalizedProviderResult must be a plain object" };
  }
  if (r.ok !== true) {
    return { ok: false, error: "NormalizedProviderResult.ok must be true" };
  }
  for (const f of REQUIRED_RESULT_FIELDS) {
    if (!(f in r)) return { ok: false, error: `missing required field: ${f}` };
  }
  if (typeof r.providerId !== "string" || r.providerId.length === 0) {
    return { ok: false, error: "providerId must be a non-empty string" };
  }
  if (!r.result || typeof r.result !== "object") {
    return { ok: false, error: "result must be a plain object" };
  }
  if (typeof r.result.status !== "string") {
    return { ok: false, error: "result.status must be a string" };
  }
  if (LIVE_PUBLISH_STATUSES.has(r.result.status)) {
    return { ok: false, error: `result.status '${r.result.status}' is prohibited in mock/dry-run mode` };
  }
  return { ok: true };
}

/**
 * Validate a NormalizedProviderError shape.
 * @param {unknown} e
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateNormalizedError(e) {
  if (!e || typeof e !== "object" || Array.isArray(e)) {
    return { ok: false, error: "NormalizedProviderError must be a plain object" };
  }
  if (e.ok !== false) {
    return { ok: false, error: "NormalizedProviderError.ok must be false" };
  }
  if (!e.error || typeof e.error !== "object") {
    return { ok: false, error: "error field must be a plain object" };
  }
  if (typeof e.error.kind !== "string" || e.error.kind.length === 0) {
    return { ok: false, error: "error.kind must be a non-empty string" };
  }
  if (typeof e.error.message !== "string") {
    return { ok: false, error: "error.message must be a string" };
  }
  return { ok: true };
}

/**
 * Build a NormalizedProviderError from a raw provider error, mapping unknown kinds
 * to PROVIDER_PERMANENT_FAILURE to prevent raw provider internals from leaking.
 *
 * @param {string} providerId
 * @param {string} providerVersion
 * @param {string} capability
 * @param {{ kind?: string, message?: string } | null | undefined} rawError
 * @returns {object}
 */
export function buildNormalizedError(providerId, providerVersion, capability, rawError) {
  const SAFE_KINDS = new Set([
    TEXT_POST_ERROR_KIND.PROVIDER_REJECTED,
    TEXT_POST_ERROR_KIND.PROVIDER_RATE_LIMITED,
    TEXT_POST_ERROR_KIND.PROVIDER_AUTHENTICATION_FAILED,
    TEXT_POST_ERROR_KIND.PROVIDER_AUTHORIZATION_FAILED,
    TEXT_POST_ERROR_KIND.PROVIDER_TRANSIENT_FAILURE,
    TEXT_POST_ERROR_KIND.PROVIDER_PERMANENT_FAILURE,
    TEXT_POST_ERROR_KIND.INTERNAL_ERROR,
  ]);
  const rawKind = rawError && typeof rawError.kind === "string" ? rawError.kind : "";
  const kind = SAFE_KINDS.has(rawKind) ? rawKind : TEXT_POST_ERROR_KIND.PROVIDER_PERMANENT_FAILURE;
  return {
    ok: false,
    providerId,
    providerVersion,
    capability,
    error: { kind, message: `provider error: ${kind}` },
  };
}
