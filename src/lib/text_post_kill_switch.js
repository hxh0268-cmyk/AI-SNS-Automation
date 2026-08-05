import { TEXT_POST_ERROR_KIND, TextPostError } from "./text_post_lifecycle.js";

// Known X API hostnames. Listed for documentation; never used in network calls in Stage A.
const KNOWN_REAL_PROVIDER_HOSTS = [
  "api.x.com",
  "twitter.com",
  "api.twitter.com",
  "t.co",
];

/**
 * Kill switch: controls whether the fake provider may be invoked.
 * Default: disabled (safe). Must be explicitly enabled.
 *
 * @param {{ enabled?: boolean }} [opts]
 * @returns {{ isEnabled: () => boolean, enable: () => void, disable: () => void }}
 */
export function createKillSwitch({ enabled = false } = {}) {
  let _enabled = Boolean(enabled);

  return {
    isEnabled() {
      return _enabled;
    },
    enable() {
      _enabled = true;
    },
    disable() {
      _enabled = false;
    },
  };
}

/**
 * No-network guard for Stage A. Throws TextPostError if any external hostname is supplied.
 * Exists to make accidental network escapes fail loudly rather than silently.
 *
 * @returns {{ assertNoNetwork: (hostname?: string | null) => void,
 *             getForbiddenHosts: () => string[] }}
 */
export function createNoNetworkGuard() {
  return {
    /**
     * @param {string | null} [hostname]
     */
    assertNoNetwork(hostname = null) {
      if (!hostname || typeof hostname !== "string" || hostname.length === 0) {
        return;
      }
      const normalized = hostname.trim().toLowerCase();
      const forbidden = KNOWN_REAL_PROVIDER_HOSTS.some(
        (h) => normalized === h || normalized.endsWith(`.${h}`),
      );
      // Any external hostname attempt is rejected in Stage A (network disabled).
      throw new TextPostError(
        TEXT_POST_ERROR_KIND.INTERNAL_ERROR,
        forbidden
          ? `Network access to real provider host is prohibited in Stage A: ${hostname}`
          : `Network access is prohibited in Stage A: ${hostname}`,
      );
    },

    getForbiddenHosts() {
      return [...KNOWN_REAL_PROVIDER_HOSTS];
    },
  };
}
