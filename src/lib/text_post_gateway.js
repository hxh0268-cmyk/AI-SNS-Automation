/**
 * Text Post Gateway — P2B+.
 *
 * Single entry point from the Core Service to the Provider layer.
 * No provider-specific knowledge here: Gateway knows capabilities and modes,
 * not provider names or APIs.
 *
 * Responsibilities:
 *   1. Capability validation (only allowed capabilities pass)
 *   2. Authorization state check (prohibited → reject)
 *   3. Execution mode enforcement (only MOCK allowed in P2B+)
 *   4. NoNetworkGuard (External IO remains impossible)
 *   5. Resolver delegation (provider selection is Resolver's job)
 *   6. Adapter invocation and result propagation
 *   7. Real-publish status block (defense-in-depth)
 *
 * Not Gateway's responsibility:
 *   - Audit storage (Service owns)
 *   - Idempotency (Service owns)
 *   - Kill switch (Service owns)
 *   - Retry orchestration (Service owns; Adapter must not retry)
 *   - Credential resolution (future P2C/P2D)
 */

import { CAPABILITY, EXECUTION_MODE, AUTHORIZATION_STATE } from "./text_post_capability.js";
import { TEXT_POST_ERROR_KIND, TextPostError } from "./text_post_lifecycle.js";
import { createNoNetworkGuard } from "./text_post_kill_switch.js";
import {
  createProviderResolver,
  ProviderResolutionError,
  RESOLVER_ERROR,
} from "./text_post_provider_resolver.js";

/** Capabilities the Gateway accepts. */
const ALLOWED_CAPABILITIES = new Set([CAPABILITY.PUBLISH_TEXT]);

/** Result statuses that indicate real publication. */
const LIVE_PUBLISH_STATUSES = new Set(["published", "live_published"]);

/**
 * Create the Text Post Gateway.
 *
 * @param {{
 *   resolver?: ReturnType<typeof createProviderResolver>,
 *   noNetworkGuard?: ReturnType<typeof createNoNetworkGuard>,
 *   realProviderEnabled?: boolean,
 * }} [deps]
 *   - realProviderEnabled: true unlocks LIVE execution mode (kill-switch gated at adapter).
 *     Defaults to REAL_PUBLISH_ENABLED env var. ADR-0025 prototype scope.
 */
export function createTextPostGateway(deps = {}) {
  const realProviderEnabled =
    deps.realProviderEnabled ?? (process.env.REAL_PUBLISH_ENABLED === "true");
  const resolver = deps.resolver ?? createProviderResolver({ realProviderEnabled });
  const noNetworkGuard = deps.noNetworkGuard ?? createNoNetworkGuard();

  const ALLOWED_EXECUTION_MODES = realProviderEnabled
    ? new Set([EXECUTION_MODE.MOCK, EXECUTION_MODE.LIVE])
    : new Set([EXECUTION_MODE.MOCK]);

  return {
    /**
     * Invoke a provider capability through the normalized boundary.
     * Core Service calls this; it must never be bypassed.
     *
     * @param {{
     *   capability: string,
     *   executionMode: string,
     *   authorizationState: string,
     *   applicationContract: {
     *     normalizedText: string,
     *     requestedAt?: string,
     *     correlationId?: string,
     *     simulateError?: string,
     *   }
     * }} req
     * @returns {{ ok: boolean, [key: string]: unknown }}
     */
    invoke(req) {
      // 1. Capability check
      if (!req?.capability || !ALLOWED_CAPABILITIES.has(req.capability)) {
        return {
          ok: false,
          error: new TextPostError(
            TEXT_POST_ERROR_KIND.INTERNAL_ERROR,
            `gateway: unsupported capability: ${String(req?.capability)}`,
          ),
        };
      }

      // 2. Authorization state check
      if (req.authorizationState === AUTHORIZATION_STATE.PROHIBITED) {
        return {
          ok: false,
          error: new TextPostError(
            TEXT_POST_ERROR_KIND.INTERNAL_ERROR,
            `gateway: capability ${req.capability} is prohibited`,
          ),
        };
      }

      // 3. Execution mode enforcement
      if (!ALLOWED_EXECUTION_MODES.has(req.executionMode)) {
        return {
          ok: false,
          error: new TextPostError(
            TEXT_POST_ERROR_KIND.INTERNAL_ERROR,
            `gateway: execution mode not allowed in P2B+: ${String(req.executionMode)}`,
          ),
        };
      }

      // 4. NoNetworkGuard — External IO remains impossible
      try {
        noNetworkGuard.assertNoNetwork(req.applicationContract?.hostname ?? null);
      } catch (err) {
        if (err instanceof TextPostError) return { ok: false, error: err };
        return {
          ok: false,
          error: new TextPostError(TEXT_POST_ERROR_KIND.INTERNAL_ERROR, "gateway: no-network guard failure"),
        };
      }

      // 5. Resolver delegation — provider selection is Resolver's sole responsibility
      let adapter;
      try {
        adapter = resolver.resolve(req.capability, req.executionMode, req.authorizationState);
      } catch (err) {
        if (err instanceof ProviderResolutionError) {
          const isRealProviderBlocked = err.kind === RESOLVER_ERROR.REAL_PROVIDER_NOT_AUTHORIZED;
          return {
            ok: false,
            error: new TextPostError(
              TEXT_POST_ERROR_KIND.INTERNAL_ERROR,
              err.message,
              { resolverError: err.kind, realProviderBlocked: isRealProviderBlocked },
            ),
          };
        }
        return {
          ok: false,
          error: new TextPostError(TEXT_POST_ERROR_KIND.INTERNAL_ERROR, "gateway: resolver failure"),
        };
      }

      // 6. Adapter invocation — provider-specific translation is Adapter's job
      const normalizedRequest = {
        normalizedText: req.applicationContract?.normalizedText,
        requestedAt: req.applicationContract?.requestedAt ?? new Date().toISOString(),
        correlationId: req.applicationContract?.correlationId,
        simulateError: req.applicationContract?.simulateError,
      };

      const adapterResult = adapter.invoke(normalizedRequest);

      // 7. Block real-publish statuses in MOCK mode (defense-in-depth; LIVE mode allows "published")
      if (adapterResult?.ok === true && req.executionMode !== EXECUTION_MODE.LIVE) {
        const status = adapterResult.result?.status;
        if (LIVE_PUBLISH_STATUSES.has(status)) {
          return {
            ok: false,
            error: new TextPostError(
              TEXT_POST_ERROR_KIND.INTERNAL_ERROR,
              "gateway: real published status is prohibited outside LIVE mode",
            ),
          };
        }
      }

      return adapterResult;
    },
  };
}
