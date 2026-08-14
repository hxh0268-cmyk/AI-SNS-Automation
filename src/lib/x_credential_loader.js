/**
 * X Credential Loader — X1.
 * Loads OAuth 1.0a credentials from environment only.
 * Never logs, commits, or stores credential values.
 * ADR-0025 §4: credentials are env-only.
 */

const REQUIRED_ENV_VARS = [
  "X_API_KEY",
  "X_API_SECRET",
  "X_ACCESS_TOKEN",
  "X_ACCESS_TOKEN_SECRET",
];

/**
 * Load X OAuth 1.0a credentials from environment.
 * Throws with sanitized message if any required variable is missing.
 * Never logs or exposes credential values in error output.
 * @returns {{ apiKey: string, apiSecret: string, accessToken: string, accessTokenSecret: string }}
 */
export function loadXCredentials() {
  const missing = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `X credential env vars not set: ${missing.join(", ")} — set in .env (gitignored); never commit values`,
    );
  }
  return {
    apiKey: process.env.X_API_KEY,
    apiSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
  };
}

/**
 * Check whether all required X credentials are present without throwing.
 * @returns {boolean}
 */
export function xCredentialsAvailable() {
  return REQUIRED_ENV_VARS.every((v) => Boolean(process.env[v]));
}
