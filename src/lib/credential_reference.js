/**
 * Credential Reference types — P2B+.
 *
 * Defines reference identity shapes and validation only.
 * Secret values are NEVER held in CredentialReference.
 *
 * CredentialResolver implementation is deferred to P2C/P2D.
 * See docs/architecture/SECURITY_CREDENTIAL_BOUNDARY.md for the full spec.
 *
 * Prohibited in P2B+:
 *   - Credential value retrieval
 *   - Secret store access
 *   - OAuth flows
 *   - Environment variable reads for secrets
 */

/** Error kinds for credential validation failures. */
export const CREDENTIAL_ERROR = {
  CREDENTIAL_MISSING: "CREDENTIAL_MISSING",
  CREDENTIAL_INVALID: "CREDENTIAL_INVALID",
  CREDENTIAL_EXPIRED: "CREDENTIAL_EXPIRED",
  ACCOUNT_NOT_ALLOWED: "ACCOUNT_NOT_ALLOWED",
  WRONG_ENVIRONMENT: "WRONG_ENVIRONMENT",
};

/** Recognized deployment environments. */
export const CREDENTIAL_ENVIRONMENT = {
  LOCAL: "local",
  CI: "ci",
  TEST: "test",
  PRODUCTION: "production",
};

/**
 * Fields that must never appear in a CredentialReference object.
 * Presence of any of these indicates a secret value is being stored — forbidden.
 */
const FORBIDDEN_VALUE_FIELDS = [
  "secret", "token", "password", "apiKey", "oauth",
  "accessToken", "refreshToken", "clientSecret", "value", "bearer",
];

/**
 * Validate a CredentialReference shape.
 * Returns { ok: true } if the reference is structurally valid and contains no secret values.
 * Returns { ok: false, error: string } otherwise.
 *
 * @param {unknown} ref
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateCredentialReference(ref) {
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) {
    return { ok: false, error: "CredentialReference must be a plain object" };
  }
  if (typeof ref.refId !== "string" || ref.refId.trim().length === 0) {
    return { ok: false, error: "refId must be a non-empty string" };
  }
  if (typeof ref.providerId !== "string" || ref.providerId.trim().length === 0) {
    return { ok: false, error: "providerId must be a non-empty string" };
  }
  const validEnvs = Object.values(CREDENTIAL_ENVIRONMENT);
  if (!validEnvs.includes(ref.environment)) {
    return { ok: false, error: `environment must be one of: ${validEnvs.join(", ")}` };
  }
  if (typeof ref.accountRef !== "string" || ref.accountRef.trim().length === 0) {
    return { ok: false, error: "accountRef must be a non-empty string" };
  }
  // Secret value leak detection
  for (const key of Object.keys(ref)) {
    if (FORBIDDEN_VALUE_FIELDS.includes(key)) {
      return { ok: false, error: `forbidden field in CredentialReference: ${key}` };
    }
  }
  return { ok: true };
}
