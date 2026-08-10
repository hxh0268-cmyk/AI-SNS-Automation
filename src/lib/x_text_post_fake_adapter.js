/**
 * Fake X Text Post Provider Adapter — P2B+.
 *
 * Translates between the normalized domain contract (NormalizedProviderRequest)
 * and the mock provider's internal calling convention, then normalizes the
 * raw mock response into a NormalizedProviderResult or NormalizedProviderError.
 *
 * Gateway and Service never import x_text_post_mock_provider directly.
 * This adapter is the sole owner of that translation.
 *
 * No network. No credentials. No External IO. No catalog registration in P2B+.
 */

import {
  invokeMockTextPost,
  providerId as MOCK_PROVIDER_ID,
  providerVersion as MOCK_PROVIDER_VERSION,
  capability as MOCK_CAPABILITY_INTERNAL,
} from "./x_text_post_mock_provider.js";
import { CAPABILITY, EXECUTION_MODE } from "./text_post_capability.js";
import { buildNormalizedError } from "./normalized_provider_contract.js";
import { TEXT_POST_ERROR_KIND } from "./text_post_lifecycle.js";

/** Fields forbidden in the normalized request (defense-in-depth). */
const FORBIDDEN_REQUEST_FIELDS = [
  "credential", "secret", "token", "password", "apiKey",
  "oauth", "accessToken", "refreshToken", "runtime", "network",
];

/**
 * Build a NormalizedProviderResult for a successful mock invocation.
 * @param {object} rawResult  — result field from invokeMockTextPost
 * @param {string | undefined} correlationId
 * @returns {object}
 */
function buildSuccess(rawResult, correlationId) {
  const status = rawResult?.status ?? "dry_run_accepted";
  return {
    ok: true,
    providerId: MOCK_PROVIDER_ID,
    providerVersion: MOCK_PROVIDER_VERSION,
    capability: CAPABILITY.PUBLISH_TEXT,
    executionMode: EXECUTION_MODE.MOCK,
    result: {
      status,
      dryRun: true,
      normalizedText: rawResult?.normalizedText ?? null,
      correlationId: correlationId ?? null,
    },
  };
}

/**
 * Create the Fake X Text Post Provider Adapter.
 *
 * Interface (ProviderAdapter):
 *   { providerId, providerVersion, capability, executionMode, invoke(normalizedRequest) }
 *
 * invoke(normalizedRequest):
 *   normalizedRequest: { normalizedText: string, requestedAt?: string,
 *                        correlationId?: string, simulateError?: string }
 *   returns: NormalizedProviderResult | NormalizedProviderError
 */
export function createFakeXProviderAdapter() {
  return {
    providerId: MOCK_PROVIDER_ID,
    providerVersion: MOCK_PROVIDER_VERSION,
    capability: CAPABILITY.PUBLISH_TEXT,
    executionMode: EXECUTION_MODE.MOCK,

    invoke(normalizedRequest) {
      // Structural validation
      if (!normalizedRequest || typeof normalizedRequest !== "object" || Array.isArray(normalizedRequest)) {
        return buildNormalizedError(
          MOCK_PROVIDER_ID, MOCK_PROVIDER_VERSION, CAPABILITY.PUBLISH_TEXT,
          { kind: TEXT_POST_ERROR_KIND.PROVIDER_REJECTED, message: "normalizedRequest must be a plain object" },
        );
      }

      // Forbidden field check (credential leakage defense)
      for (const key of Object.keys(normalizedRequest)) {
        if (FORBIDDEN_REQUEST_FIELDS.includes(key)) {
          return buildNormalizedError(
            MOCK_PROVIDER_ID, MOCK_PROVIDER_VERSION, CAPABILITY.PUBLISH_TEXT,
            { kind: TEXT_POST_ERROR_KIND.PROVIDER_REJECTED, message: `forbidden field in request: ${key}` },
          );
        }
      }

      if (typeof normalizedRequest.normalizedText !== "string" || normalizedRequest.normalizedText.length === 0) {
        return buildNormalizedError(
          MOCK_PROVIDER_ID, MOCK_PROVIDER_VERSION, CAPABILITY.PUBLISH_TEXT,
          { kind: TEXT_POST_ERROR_KIND.PROVIDER_REJECTED, message: "normalizedText is required" },
        );
      }

      // Translate domain contract → mock provider's internal calling convention
      const mockRequest = {
        capability: MOCK_CAPABILITY_INTERNAL,
        applicationContract: {
          normalizedText: normalizedRequest.normalizedText,
          requestedAt: normalizedRequest.requestedAt ?? new Date().toISOString(),
          ...(normalizedRequest.simulateError
            ? { simulateError: normalizedRequest.simulateError }
            : {}),
        },
      };

      const raw = invokeMockTextPost(mockRequest);

      if (!raw || raw.ok !== true) {
        return buildNormalizedError(
          MOCK_PROVIDER_ID, MOCK_PROVIDER_VERSION, CAPABILITY.PUBLISH_TEXT,
          raw?.error,
        );
      }

      // Block real-publish statuses (Adapter-level guard)
      const status = raw.result?.status;
      if (status === "published" || status === "live_published") {
        return buildNormalizedError(
          MOCK_PROVIDER_ID, MOCK_PROVIDER_VERSION, CAPABILITY.PUBLISH_TEXT,
          { kind: TEXT_POST_ERROR_KIND.INTERNAL_ERROR, message: "adapter must not produce real published status" },
        );
      }

      return buildSuccess(raw.result, normalizedRequest.correlationId);
    },
  };
}
