export const providerId = "image-generation-mock-provider";
export const providerVersion = "1.0.0";
export const capability = "image_generation";

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
  "event",
  "automation",
  "publishing",
];

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isStrictPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * @param {string} key
 * @returns {boolean}
 */
function isCanonicalArrayIndex(key) {
  if (typeof key !== "string") {
    return false;
  }

  if (key === "0") {
    return true;
  }

  if (key.length === 0 || !/^[0-9]+$/.test(key)) {
    return false;
  }

  const numeric = Number(key);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric >= 2 ** 32 - 1) {
    return false;
  }

  return String(numeric) === key;
}

/**
 * @param {string} basePath
 * @param {string | symbol} key
 * @returns {string}
 */
function formatPath(basePath, key) {
  if (typeof key === "symbol") {
    const label = key.description ? `Symbol(${key.description})` : "Symbol()";
    return basePath ? `${basePath}[${label}]` : `[${label}]`;
  }

  return basePath ? `${basePath}.${key}` : key;
}

/**
 * @param {string} kind
 * @param {string} message
 * @param {string | null} [requestCapability]
 * @returns {object}
 */
function buildProviderError(kind, message, requestCapability = null) {
  return {
    ok: false,
    providerId,
    providerVersion,
    capability: requestCapability,
    error: {
      kind,
      message,
    },
  };
}

/**
 * @param {unknown} value
 * @param {string} path
 * @param {WeakSet<object>} [seen]
 * @returns {string | null}
 */
function validateNodeShape(value, path, seen = new WeakSet()) {
  if (isStrictPlainObject(value)) {
    return validateOwnPropertyShape(value, path, seen);
  }

  if (Array.isArray(value)) {
    return validateArrayOwnPropertyShape(value, path, seen);
  }

  return null;
}

/**
 * @param {object} value
 * @param {string} path
 * @param {WeakSet<object>} seen
 * @returns {string | null}
 */
function validateOwnPropertyShape(value, path, seen) {
  if (seen.has(value)) {
    return path;
  }

  seen.add(value);

  for (const key of Reflect.ownKeys(value)) {
    const childPath = formatPath(path, key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);

    if (descriptor === undefined) {
      seen.delete(value);
      return childPath;
    }

    if (typeof key === "symbol") {
      seen.delete(value);
      return childPath;
    }

    if (descriptor.enumerable === false) {
      seen.delete(value);
      return childPath;
    }

    if (descriptor.get !== undefined || descriptor.set !== undefined) {
      seen.delete(value);
      return childPath;
    }

    if ("value" in descriptor && typeof descriptor.value === "function") {
      seen.delete(value);
      return childPath;
    }

    const child = descriptor.value;
    if (child !== null && typeof child === "object") {
      const nested = validateNodeShape(child, childPath, seen);
      if (nested !== null) {
        seen.delete(value);
        return nested;
      }
    }
  }

  seen.delete(value);
  return null;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @param {WeakSet<object>} seen
 * @returns {string | null}
 */
function validateArrayOwnPropertyShape(value, path, seen) {
  if (!Array.isArray(value)) {
    return path;
  }

  if (seen.has(value)) {
    return path;
  }

  seen.add(value);

  const keys = Reflect.ownKeys(value);
  let lengthValue = null;
  const presentIndices = new Set();

  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    const childPath =
      key === "length"
        ? formatPath(path, key)
        : isCanonicalArrayIndex(key)
          ? `${path}[${key}]`
          : formatPath(path, key);

    if (descriptor === undefined) {
      seen.delete(value);
      return childPath;
    }

    if (typeof key === "symbol") {
      seen.delete(value);
      return childPath;
    }

    if (key === "length") {
      if (descriptor.get !== undefined || descriptor.set !== undefined) {
        seen.delete(value);
        return childPath;
      }

      if (descriptor.enumerable !== false) {
        seen.delete(value);
        return childPath;
      }

      if (descriptor.configurable !== false) {
        seen.delete(value);
        return childPath;
      }

      if (typeof descriptor.value !== "number") {
        seen.delete(value);
        return childPath;
      }

      if (
        !Number.isInteger(descriptor.value) ||
        descriptor.value < 0 ||
        !Number.isFinite(descriptor.value)
      ) {
        seen.delete(value);
        return childPath;
      }

      lengthValue = descriptor.value;
      continue;
    }

    if (!isCanonicalArrayIndex(key)) {
      seen.delete(value);
      return childPath;
    }

    if (descriptor.enumerable === false) {
      seen.delete(value);
      return childPath;
    }

    if (descriptor.get !== undefined || descriptor.set !== undefined) {
      seen.delete(value);
      return childPath;
    }

    if (typeof descriptor.value === "function") {
      seen.delete(value);
      return childPath;
    }

    presentIndices.add(Number(key));

    const child = descriptor.value;
    if (child !== null && typeof child === "object") {
      const nested = validateNodeShape(child, `${path}[${key}]`, seen);
      if (nested !== null) {
        seen.delete(value);
        return nested;
      }
    }
  }

  if (lengthValue === null) {
    seen.delete(value);
    return `${path}.length`;
  }

  for (let index = 0; index < lengthValue; index += 1) {
    if (!presentIndices.has(index)) {
      seen.delete(value);
      return `${path}[${index}]`;
    }
  }

  for (const index of presentIndices) {
    if (index >= lengthValue) {
      seen.delete(value);
      return `${path}[${index}]`;
    }
  }

  seen.delete(value);
  return null;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {string | null}
 */
function findForbiddenFieldSafe(value, path = "") {
  if (isStrictPlainObject(value)) {
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        descriptor.enumerable === false ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined
      ) {
        continue;
      }

      const childPath = path ? `${path}.${key}` : key;

      if (FORBIDDEN_INPUT_FIELDS.includes(key)) {
        return childPath;
      }

      const nested = findForbiddenFieldSafe(descriptor.value, childPath);
      if (nested !== null) {
        return nested;
      }
    }
  } else if (Array.isArray(value)) {
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (lengthDescriptor === undefined) {
      return path;
    }

    const length = lengthDescriptor.value;

    for (let index = 0; index < length; index += 1) {
      const key = String(index);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined) {
        continue;
      }

      const childPath = `${path}[${index}]`;
      const nested = findForbiddenFieldSafe(descriptor.value, childPath);
      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @param {WeakSet<object>} seen
 * @returns {string | null}
 */
function validateSerializableData(value, path, seen) {
  if (value === null) {
    return null;
  }

  if (typeof value === "boolean" || typeof value === "string") {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return path;
    }

    return null;
  }

  if (typeof value !== "object") {
    return path;
  }

  if (seen.has(value)) {
    return path;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (lengthDescriptor === undefined) {
      seen.delete(value);
      return path;
    }

    const length = lengthDescriptor.value;

    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined) {
        seen.delete(value);
        return `${path}[${index}]`;
      }

      const nested = validateSerializableData(
        descriptor.value,
        `${path}[${index}]`,
        seen,
      );
      if (nested !== null) {
        seen.delete(value);
        return nested;
      }
    }

    seen.delete(value);
    return null;
  }

  if (!isStrictPlainObject(value)) {
    seen.delete(value);
    return path;
  }

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      descriptor.enumerable === false ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      continue;
    }

    const nested = validateSerializableData(
      descriptor.value,
      `${path}.${key}`,
      seen,
    );
    if (nested !== null) {
      seen.delete(value);
      return nested;
    }
  }

  seen.delete(value);
  return null;
}

/**
 * @param {object} applicationContract
 * @returns {string}
 */
function deriveDeterministicMetadata(applicationContract) {
  return JSON.stringify(applicationContract);
}

/**
 * @param {unknown} request
 * @returns {object}
 */
export function invoke(request) {
  try {
    if (!isStrictPlainObject(request)) {
      return buildProviderError("validation_error", "request must be an object");
    }

    for (const key of Reflect.ownKeys(request)) {
      if (typeof key !== "string") {
        return buildProviderError(
          "validation_error",
          `unknown field: ${String(key)}`,
        );
      }

      if (!ALLOWED_INPUT_FIELDS.includes(key)) {
        return buildProviderError("validation_error", `unknown field: ${key}`);
      }
    }

    if (!("capability" in request)) {
      return buildProviderError("validation_error", "missing required field: capability");
    }

    if (typeof request.capability !== "string") {
      return buildProviderError("validation_error", "invalid field type: capability");
    }

    if (request.capability !== capability) {
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

    if (!isStrictPlainObject(request.applicationContract)) {
      return buildProviderError(
        "validation_error",
        "invalid field type: applicationContract",
        request.capability,
      );
    }

    const shapeError = validateNodeShape(
      request.applicationContract,
      "applicationContract",
    );
    if (shapeError !== null) {
      return buildProviderError(
        "validation_error",
        `non-serializable property: ${shapeError}`,
        request.capability,
      );
    }

    const forbiddenField = findForbiddenFieldSafe(request.applicationContract, "applicationContract");
    if (forbiddenField !== null) {
      return buildProviderError(
        "validation_error",
        `forbidden field: ${forbiddenField}`,
        request.capability,
      );
    }

    const serializableError = validateSerializableData(
      request.applicationContract,
      "applicationContract",
      new WeakSet(),
    );
    if (serializableError !== null) {
      return buildProviderError(
        "validation_error",
        `non-serializable value: ${serializableError}`,
        request.capability,
      );
    }

    return {
      ok: true,
      providerId,
      providerVersion,
      capability,
      result: {
        metadata: deriveDeterministicMetadata(request.applicationContract),
      },
    };
  } catch {
    return buildProviderError("validation_error", "unexpected provider failure");
  }
}
