/**
 * Provider-neutral capability model for the text post publishing domain.
 *
 * Separates WHAT can be done (CAPABILITY) from HOW it runs (EXECUTION_MODE)
 * and WHETHER it is allowed (AUTHORIZATION_STATE).
 *
 * P2B+ implemented target: publish.text / mock / authorized (Fake Adapter only).
 * live / prohibited paths are structurally blocked by the Resolver.
 */

/** Domain capabilities — provider-neutral names. */
export const CAPABILITY = {
  /** Publish textual content to a single SNS Provider. */
  PUBLISH_TEXT: "publish.text",
};

/** How a capability is executed. */
export const EXECUTION_MODE = {
  /** Fake / in-memory provider; no network; no credentials. P2B+ only. */
  MOCK: "mock",
  /** Full pipeline minus real network; dry-run result only. Future: P3+. */
  DRY_RUN: "dry_run",
  /** Live network execution; requires Real Provider authorization. Future: P4+. */
  LIVE: "live",
};

/** Current authorization state of a capability + execution-mode pair. */
export const AUTHORIZATION_STATE = {
  /** Authorized for use in this scope. */
  AUTHORIZED: "authorized",
  /** Planned but not yet authorized. */
  PLANNED: "planned",
  /** Explicitly prohibited; Resolver must reject any invocation. */
  PROHIBITED: "prohibited",
};

/**
 * P2B+ implemented target.
 * Informational record — not an authorization grant.
 */
export const P2B_IMPLEMENTED_TARGET = Object.freeze({
  capability: CAPABILITY.PUBLISH_TEXT,
  executionMode: EXECUTION_MODE.MOCK,
  authorizationState: AUTHORIZATION_STATE.AUTHORIZED,
});
