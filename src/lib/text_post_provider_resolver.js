/**
 * Provider Resolver Boundary — P2B+.
 *
 * Responsibility: select the correct ProviderAdapter for a given
 * (capability, executionMode, authorizationState) triple.
 * Gateway calls this; Service never calls this directly.
 *
 * P2B+ implementation: SingleFakeProviderResolver
 *   - publish.text / mock  → FakeXProviderAdapter
 *   - publish.text / live  → REAL_PROVIDER_NOT_AUTHORIZED (structurally blocked)
 *   - any other capability → UNSUPPORTED_CAPABILITY
 *
 * Extensibility seam: when a second Provider is needed, replace
 * SingleFakeProviderResolver with a RegistryBackedProviderResolver.
 * Gateway and Service are unchanged by that substitution.
 *
 * Provider Registry is NOT implemented in P2B+ (YAGNI).
 */

import { CAPABILITY, EXECUTION_MODE, AUTHORIZATION_STATE } from "./text_post_capability.js";
import { createFakeXProviderAdapter } from "./x_text_post_fake_adapter.js";
import { createXRealProviderAdapter } from "./x_real_provider_adapter.js";

/** Error kinds for resolution failures. */
export const RESOLVER_ERROR = {
  REAL_PROVIDER_NOT_AUTHORIZED: "REAL_PROVIDER_NOT_AUTHORIZED",
  UNSUPPORTED_CAPABILITY: "UNSUPPORTED_CAPABILITY",
  UNSUPPORTED_EXECUTION_MODE: "UNSUPPORTED_EXECUTION_MODE",
};

/** Typed error thrown by the Resolver when selection fails. */
export class ProviderResolutionError extends Error {
  /**
   * @param {string} kind  — one of RESOLVER_ERROR values
   * @param {string} message
   */
  constructor(kind, message) {
    super(message);
    this.name = "ProviderResolutionError";
    this.kind = kind;
  }
}

/**
 * Create a Provider Resolver.
 *
 * Interface:
 *   { resolve(capability, executionMode, authorizationState) → ProviderAdapter }
 *
 * @param {{
 *   realProviderEnabled?: boolean,
 * }} [config]
 *   - realProviderEnabled: true unlocks LIVE → x-real-provider routing (ADR-0025 prototype scope).
 *     Defaults to REAL_PUBLISH_ENABLED env var. Without it, LIVE mode always throws (P2B+ behavior).
 * @returns {{ resolve: (capability: string, executionMode: string, authorizationState: string) => object }}
 */
export function createProviderResolver(config = {}) {
  const realProviderEnabled =
    config.realProviderEnabled ?? (process.env.REAL_PUBLISH_ENABLED === "true");
  const fakeAdapter = createFakeXProviderAdapter();

  return {
    /**
     * Resolve capability + mode to a ProviderAdapter.
     * Throws ProviderResolutionError if no adapter is available.
     */
    resolve(capability, executionMode, authorizationState) {
      if (capability !== CAPABILITY.PUBLISH_TEXT) {
        throw new ProviderResolutionError(
          RESOLVER_ERROR.UNSUPPORTED_CAPABILITY,
          `unsupported capability: ${String(capability)}`,
        );
      }

      if (executionMode === EXECUTION_MODE.LIVE) {
        if (realProviderEnabled && authorizationState === AUTHORIZATION_STATE.AUTHORIZED) {
          // ADR-0025: X Real Provider authorized at prototype scope.
          // Adapter requires transport injection for any network call (X1 safe default: no transport).
          return createXRealProviderAdapter();
        }
        // Structural block: LIVE without REAL_PUBLISH_ENABLED + AUTHORIZED (P2B+ default preserved).
        throw new ProviderResolutionError(
          RESOLVER_ERROR.REAL_PROVIDER_NOT_AUTHORIZED,
          realProviderEnabled
            ? "live execution requires AUTHORIZED state (ADR-0025 prototype scope)"
            : "live execution requires Real Provider authorization (set REAL_PUBLISH_ENABLED=true with ADR-0025 scope)",
        );
      }

      if (executionMode !== EXECUTION_MODE.MOCK) {
        throw new ProviderResolutionError(
          RESOLVER_ERROR.UNSUPPORTED_EXECUTION_MODE,
          `unsupported execution mode in P2B+: ${String(executionMode)}`,
        );
      }

      return fakeAdapter;
    },
  };
}
