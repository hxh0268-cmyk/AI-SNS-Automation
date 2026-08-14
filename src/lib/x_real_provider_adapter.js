/**
 * X Real Provider Adapter — X1.
 * Authorized by ADR-0025: POST /2/tweets only; OAuth 1.0a; kill-switch gated.
 * No real network in X1 — transport must be injected for any invocation to succeed.
 *
 * Interface: { providerId, providerVersion, capability, executionMode, policy, invoke(req) }
 * invoke() is async (transport I/O is inherently async; fake transport works synchronously).
 */

import { CAPABILITY, EXECUTION_MODE } from "./text_post_capability.js";
import { TEXT_POST_ERROR_KIND } from "./text_post_lifecycle.js";
import { buildNormalizedError } from "./normalized_provider_contract.js";
import { loadXCredentials } from "./x_credential_loader.js";
import { createXApiClient } from "./x_oauth_client.js";

export const PROVIDER_ID = "x-real-provider";
export const PROVIDER_VERSION = "1.0.0";

/** Policy flags — ADR-0025 §8 / X0 Planning §8. */
export const policy = Object.freeze({
  executionMode: "live",
  networkAccess: true,
  endpointAllowlist: ["POST /2/tweets"],
  credentialAccess: true,
  filesystemAccess: false,
  realProvider: true,
  externalIOEnabled: true,
  automaticPublishing: false,
});

/** Fields forbidden in the normalized request (credential leakage defense). */
const FORBIDDEN_REQUEST_FIELDS = new Set([
  "credential", "secret", "token", "password", "apiKey",
  "oauth", "accessToken", "refreshToken", "runtime", "network",
]);

/**
 * Create the X Real Provider Adapter.
 *
 * @param {{
 *   transport?: (url: string, opts: object) => ({ status: number, body: string } | Promise<{ status: number, body: string }>),
 *   credentialLoader?: () => { apiKey: string, apiSecret: string, accessToken: string, accessTokenSecret: string },
 *   killSwitch?: { isEnabled: () => boolean } | null,
 * }} [deps]
 *   - transport: inject fake for offline tests; inject real https client for X2 smoke test only
 *   - credentialLoader: inject stub for tests that don't need real credentials
 *   - killSwitch: inject to test kill-switch rejection; null skips adapter-level check
 */
export function createXRealProviderAdapter(deps = {}) {
  const credentialLoader = deps.credentialLoader ?? loadXCredentials;
  const killSwitch = deps.killSwitch ?? null;

  return {
    providerId: PROVIDER_ID,
    providerVersion: PROVIDER_VERSION,
    capability: CAPABILITY.PUBLISH_TEXT,
    executionMode: EXECUTION_MODE.LIVE,
    policy,

    /**
     * Invoke the X Real Provider.
     * Returns Promise<NormalizedProviderResult | NormalizedProviderError>.
     *
     * @param {{
     *   normalizedText: string,
     *   correlationId: string,
     *   idempotencyKey: string,
     *   requestedAt?: string,
     * }} normalizedRequest
     */
    async invoke(normalizedRequest) {
      // 1. Kill-switch (defense-in-depth; primary check is at Service level)
      if (killSwitch !== null && !killSwitch.isEnabled()) {
        return {
          ok: false,
          providerId: PROVIDER_ID,
          providerVersion: PROVIDER_VERSION,
          capability: CAPABILITY.PUBLISH_TEXT,
          error: { kind: TEXT_POST_ERROR_KIND.KILL_SWITCH_DISABLED, message: "kill switch is disabled" },
        };
      }

      // 2. Input type check
      if (!normalizedRequest || typeof normalizedRequest !== "object" || Array.isArray(normalizedRequest)) {
        return buildNormalizedError(PROVIDER_ID, PROVIDER_VERSION, CAPABILITY.PUBLISH_TEXT, {
          kind: TEXT_POST_ERROR_KIND.PROVIDER_REJECTED,
          message: "normalizedRequest must be a plain object",
        });
      }

      // 3. Forbidden field check (credential leakage defense)
      for (const key of Object.keys(normalizedRequest)) {
        if (FORBIDDEN_REQUEST_FIELDS.has(key)) {
          return buildNormalizedError(PROVIDER_ID, PROVIDER_VERSION, CAPABILITY.PUBLISH_TEXT, {
            kind: TEXT_POST_ERROR_KIND.PROVIDER_REJECTED,
            message: `forbidden field in request: ${key}`,
          });
        }
      }

      const { normalizedText, correlationId, idempotencyKey } = normalizedRequest;

      // 4. Field validation
      if (typeof normalizedText !== "string" || normalizedText.length === 0) {
        return buildNormalizedError(PROVIDER_ID, PROVIDER_VERSION, CAPABILITY.PUBLISH_TEXT, {
          kind: TEXT_POST_ERROR_KIND.PROVIDER_REJECTED,
          message: "normalizedText is required",
        });
      }

      if (normalizedText.length > 280) {
        return buildNormalizedError(PROVIDER_ID, PROVIDER_VERSION, CAPABILITY.PUBLISH_TEXT, {
          kind: TEXT_POST_ERROR_KIND.PROVIDER_REJECTED,
          message: `normalizedText exceeds 280 chars (${normalizedText.length})`,
        });
      }

      if (typeof correlationId !== "string" || correlationId.length === 0) {
        return buildNormalizedError(PROVIDER_ID, PROVIDER_VERSION, CAPABILITY.PUBLISH_TEXT, {
          kind: TEXT_POST_ERROR_KIND.PROVIDER_REJECTED,
          message: "correlationId is required",
        });
      }

      if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
        return buildNormalizedError(PROVIDER_ID, PROVIDER_VERSION, CAPABILITY.PUBLISH_TEXT, {
          kind: TEXT_POST_ERROR_KIND.PROVIDER_REJECTED,
          message: "idempotencyKey is required",
        });
      }

      // 5. Transport required — no transport = no network (X1 safe default)
      if (!deps.transport) {
        return buildNormalizedError(PROVIDER_ID, PROVIDER_VERSION, CAPABILITY.PUBLISH_TEXT, {
          kind: TEXT_POST_ERROR_KIND.INTERNAL_ERROR,
          message: "no transport configured — inject real transport for X2 smoke test only",
        });
      }

      // 6. Credential loading (env-only; values never logged)
      let creds;
      try {
        creds = credentialLoader();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "credential unavailable";
        return buildNormalizedError(PROVIDER_ID, PROVIDER_VERSION, CAPABILITY.PUBLISH_TEXT, {
          kind: TEXT_POST_ERROR_KIND.PROVIDER_AUTHENTICATION_FAILED,
          message: msg,
        });
      }

      // 7. POST /2/tweets via injected transport
      const client = createXApiClient({ transport: deps.transport });
      const clientResult = await client.postTweet(normalizedText, creds, correlationId);

      if (!clientResult.ok) {
        return buildNormalizedError(PROVIDER_ID, PROVIDER_VERSION, CAPABILITY.PUBLISH_TEXT, clientResult.error);
      }

      return {
        ok: true,
        providerId: PROVIDER_ID,
        providerVersion: PROVIDER_VERSION,
        capability: CAPABILITY.PUBLISH_TEXT,
        executionMode: EXECUTION_MODE.LIVE,
        result: {
          status: "published",
          xPostId: clientResult.xPostId,
          normalizedText,
          correlationId,
          idempotencyKey,
          publishedAt: new Date().toISOString(),
        },
      };
    },
  };
}
