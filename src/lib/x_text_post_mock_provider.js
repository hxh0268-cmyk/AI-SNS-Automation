/**
 * X Text Post Mock Provider — Stage A.
 *
 * Fake provider that follows the same contract pattern as mock_provider.js and
 * image_generation_mock_provider.js. Produces deterministic dry-run results.
 * No network access. No credentials. No real posting.
 *
 * Catalog registration: NOT registered in Stage A (separate catalog governance required).
 */

export const providerId = "x-text-post-mock-provider";
export const providerVersion = "0.1.0";
export const capability = "text_post_dry_run";

export const policy = {
  executionMode: "mock",
  networkAccess: false,
  filesystemAccess: false,
  credentialAccess: false,
  secretAccess: false,
  runtimeIntegration: false,
  workflowIntegration: false,
  eventIntegration: false,
  schedulerIntegration: false,
  automationIntegration: false,
  publishingIntegration: false,
  humanApprovalGateBypass: false,
  realProvider: false,
  externalIOEnabled: false,
  automaticPublishing: false,
};

const ALLOWED_INPUT_FIELDS = ["capability", "applicationContract"];

const FORBIDDEN_INPUT_FIELDS = [
  "credential",
  "secret",
  "token",
  "password",
  "apiKey",
  "oauth",
  "accessToken",
  "refreshToken",
  "runtime",
  "scheduler",
  "adapter",
  "workflow",
  "automation",
  "publishing",
  "network",
  "http",
  "socket",
];

/**
 * Error kind strings that the provider can simulate for tests.
 * These allow tests to inject known failure modes without using real network.
 */
const SIMULATE_ERROR_MAP = {
  simulate_rate_limit: "PROVIDER_RATE_LIMITED",
  simulate_auth_failure: "PROVIDER_AUTHENTICATION_FAILED",
  simulate_authz_failure: "PROVIDER_AUTHORIZATION_FAILED",
  simulate_transient: "PROVIDER_TRANSIENT_FAILURE",
  simulate_permanent: "PROVIDER_PERMANENT_FAILURE",
  simulate_rejected: "PROVIDER_REJECTED",
  simulate_unknown: "__UNKNOWN_PROVIDER_ERROR__",
};

function buildError(kind, message) {
  return { ok: false, providerId, providerVersion, capability, error: { kind, message } };
}

function buildSuccess(normalizedText, requestedAt) {
  return {
    ok: true,
    providerId,
    providerVersion,
    capability,
    result: {
      status: "dry_run_accepted",
      // Deterministic when caller injects requestedAt; never "published".
      simulatedAt: requestedAt ?? "1970-01-01T00:00:00.000Z",
      requestedAt: requestedAt ?? null,
      normalizedText,
    },
  };
}

/**
 * Invoke the mock X text post provider.
 * Validates input structure, rejects forbidden fields, supports error simulation.
 *
 * @param {unknown} request
 * @returns {object} provider result (never throws)
 */
export function invokeMockTextPost(request) {
  try {
    if (!request || typeof request !== "object" || Array.isArray(request)) {
      return buildError("PROVIDER_REJECTED", "request must be a plain object");
    }

    for (const key of Object.keys(request)) {
      if (!ALLOWED_INPUT_FIELDS.includes(key)) {
        return buildError("PROVIDER_REJECTED", `unknown top-level field: ${key}`);
      }
    }

    if (request.capability !== capability) {
      return buildError("PROVIDER_REJECTED", `unsupported capability: ${request.capability}`);
    }

    const contract = request.applicationContract;
    if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
      return buildError("PROVIDER_REJECTED", "applicationContract must be a plain object");
    }

    for (const key of Object.keys(contract)) {
      if (FORBIDDEN_INPUT_FIELDS.includes(key)) {
        return buildError("PROVIDER_REJECTED", `forbidden field in applicationContract: ${key}`);
      }
    }

    // Error simulation (for tests only — safe to include; requires explicit opt-in)
    if (typeof contract.simulateError === "string") {
      const kind = SIMULATE_ERROR_MAP[contract.simulateError];
      if (!kind) {
        return buildError("PROVIDER_REJECTED", `unknown simulation key: ${contract.simulateError}`);
      }
      return buildError(kind, `${contract.simulateError} (simulated by mock provider)`);
    }

    if (typeof contract.normalizedText !== "string" || contract.normalizedText.length === 0) {
      return buildError("PROVIDER_REJECTED", "applicationContract.normalizedText is required");
    }

    return buildSuccess(contract.normalizedText, contract.requestedAt);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unexpected mock provider failure";
    return buildError("PROVIDER_REJECTED", message);
  }
}
