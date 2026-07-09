export const MOCK_PROVIDER_ID = "text-generation-mock-provider";
export const MOCK_PROVIDER_VERSION = "1.0";
export const MOCK_PROVIDER_CAPABILITY = "text_generation";

export const MOCK_PROVIDER_SIDE_EFFECT_DECLARATION = "query";

export const MOCK_PROVIDER_CREDENTIAL_REQUIREMENT = false;

export const MOCK_PROVIDER_TIMEOUT_POLICY_DECLARATION = {
  owner: "declaration-only",
  execution: false,
};

export const MOCK_PROVIDER_RETRY_POLICY_DECLARATION = {
  owner: "declaration-only",
  execution: false,
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
];

/**
 * @returns {{ providerId: string, providerVersion: string }}
 */
export function getMockProviderIdentity() {
  return {
    providerId: MOCK_PROVIDER_ID,
    providerVersion: MOCK_PROVIDER_VERSION,
  };
}

/**
 * @returns {string[]}
 */
export function getMockProviderCapabilities() {
  return [MOCK_PROVIDER_CAPABILITY];
}

/**
 * @returns {{
 *   credentialRequirement: boolean,
 *   sideEffectDeclaration: string,
 *   timeoutPolicyDeclaration: object,
 *   retryPolicyDeclaration: object,
 * }}
 */
export function getMockProviderPolicyDeclarations() {
  return {
    credentialRequirement: MOCK_PROVIDER_CREDENTIAL_REQUIREMENT,
    sideEffectDeclaration: MOCK_PROVIDER_SIDE_EFFECT_DECLARATION,
    timeoutPolicyDeclaration: { ...MOCK_PROVIDER_TIMEOUT_POLICY_DECLARATION },
    retryPolicyDeclaration: { ...MOCK_PROVIDER_RETRY_POLICY_DECLARATION },
  };
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {Record<string, unknown>} object
 * @param {string} path
 * @returns {string | null}
 */
function findForbiddenField(object, path = "") {
  for (const [key, value] of Object.entries(object)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (FORBIDDEN_INPUT_FIELDS.includes(key)) {
      return currentPath;
    }

    if (isPlainObject(value)) {
      const nested = findForbiddenField(value, currentPath);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

/**
 * @param {string} kind
 * @param {string} message
 * @param {string | null} [capability]
 * @returns {object}
 */
function buildProviderError(kind, message, capability = null) {
  return {
    ok: false,
    providerId: MOCK_PROVIDER_ID,
    providerVersion: MOCK_PROVIDER_VERSION,
    capability,
    error: {
      kind,
      message,
    },
  };
}

/**
 * @param {object} applicationContract
 * @returns {string}
 */
function deriveDeterministicMockText(applicationContract) {
  return JSON.stringify(applicationContract);
}

/**
 * @param {unknown} request
 * @returns {object}
 */
export function invokeMockProvider(request) {
  try {
    if (!isPlainObject(request)) {
      return buildProviderError("validation_error", "request must be an object");
    }

    for (const key of Object.keys(request)) {
      if (!ALLOWED_INPUT_FIELDS.includes(key)) {
        return buildProviderError("validation_error", `unknown field: ${key}`);
      }
    }

    const forbiddenField = findForbiddenField(request);
    if (forbiddenField) {
      return buildProviderError(
        "validation_error",
        `forbidden field: ${forbiddenField}`,
      );
    }

    if (!("capability" in request)) {
      return buildProviderError("validation_error", "missing required field: capability");
    }

    if (typeof request.capability !== "string") {
      return buildProviderError("validation_error", "invalid field type: capability");
    }

    if (request.capability !== MOCK_PROVIDER_CAPABILITY) {
      return buildProviderError(
        "unsupported_capability",
        `unsupported capability: ${request.capability}`,
        request.capability,
      );
    }

    if (!("applicationContract" in request)) {
      return buildProviderError(
        "validation_error",
        "missing required field: applicationContract",
        request.capability,
      );
    }

    if (!isPlainObject(request.applicationContract)) {
      return buildProviderError(
        "validation_error",
        "invalid field type: applicationContract",
        request.capability,
      );
    }

    return {
      ok: true,
      providerId: MOCK_PROVIDER_ID,
      providerVersion: MOCK_PROVIDER_VERSION,
      capability: MOCK_PROVIDER_CAPABILITY,
      result: {
        text: deriveDeterministicMockText(request.applicationContract),
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unexpected provider failure";

    return buildProviderError("validation_error", message);
  }
}
