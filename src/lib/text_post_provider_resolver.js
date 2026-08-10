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

import { CAPABILITY, EXECUTION_MODE } from "./text_post_capability.js";
import { createFakeXProviderAdapter } from "./x_text_post_fake_adapter.js";

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
 * Create a Provider Resolver (SingleFakeProviderResolver in P2B+).
 *
 * Interface:
 *   { resolve(capability, executionMode, authorizationState) → ProviderAdapter }
 *
 * @param {object} [_config]  Reserved for future Registry-backed configuration.
 * @returns {{ resolve: (capability: string, executionMode: string, authorizationState: string) => object }}
 */
export function createProviderResolver(_config = {}) {
  const fakeAdapter = createFakeXProviderAdapter();

  return {
    /**
     * Resolve capability + mode to a ProviderAdapter.
     * Throws ProviderResolutionError if no adapter is available or if the
     * request would require a Real Provider (prohibited in P2B+).
     */
    resolve(capability, executionMode, _authorizationState) {
      if (capability !== CAPABILITY.PUBLISH_TEXT) {
        throw new ProviderResolutionError(
          RESOLVER_ERROR.UNSUPPORTED_CAPABILITY,
          `unsupported capability: ${String(capability)}`,
        );
      }

      if (executionMode === EXECUTION_MODE.LIVE) {
        // Structural block: Real Provider is prohibited until separately authorized (P4+).
        throw new ProviderResolutionError(
          RESOLVER_ERROR.REAL_PROVIDER_NOT_AUTHORIZED,
          "live execution requires a Real Provider which is not authorized in P2B+",
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
