/**
 * X OAuth 1.0a Client — X1.
 * Constructs HMAC-SHA1 Authorization header and builds POST /2/tweets requests.
 * HTTP transport is injectable: pass fake transport for offline tests; real for X2+.
 *
 * ADR-0025 §2 / §5:
 *   - Only POST /2/tweets on api.x.com:443
 *   - No redirect follow; TLS ON (enforced by real transport in X2)
 *   - Credential values never appear in logs or error messages
 */

import { createHmac } from "node:crypto";

export const X_API_HOST = "api.x.com";
export const X_TWEETS_PATH = "/2/tweets";
export const X_TWEETS_URL = `https://${X_API_HOST}${X_TWEETS_PATH}`;

const OAUTH_SIGNATURE_METHOD = "HMAC-SHA1";
const OAUTH_VERSION = "1.0";

/**
 * RFC 3986 percent-encode (stricter than encodeURIComponent).
 * @param {string} str
 * @returns {string}
 */
function rfc3986Encode(str) {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Build the OAuth 1.0a Authorization header value.
 *
 * @param {{ apiKey: string, apiSecret: string, accessToken: string, accessTokenSecret: string }} creds
 * @param {{ nonce: string, timestamp: string }} oauthMeta
 * @returns {string} Authorization header value (begins with "OAuth ")
 */
export function buildOAuthHeader(creds, { nonce, timestamp }) {
  const oauthParams = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: OAUTH_SIGNATURE_METHOD,
    oauth_timestamp: timestamp,
    oauth_token: creds.accessToken,
    oauth_version: OAUTH_VERSION,
  };

  // Signature base string: OAuth params only.
  // Per RFC 5849 §3.4.1.3.1: entity-body params are included ONLY for
  // application/x-www-form-urlencoded. POST /2/tweets uses application/json,
  // so the JSON body is NOT part of the signature.
  const allParams = { ...oauthParams };
  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${rfc3986Encode(k)}=${rfc3986Encode(allParams[k])}`)
    .join("&");

  const signatureBase = [
    "POST",
    rfc3986Encode(X_TWEETS_URL),
    rfc3986Encode(paramString),
  ].join("&");

  const signingKey = `${rfc3986Encode(creds.apiSecret)}&${rfc3986Encode(creds.accessTokenSecret)}`;
  const signature = createHmac("sha1", signingKey).update(signatureBase).digest("base64");

  const signedParams = { ...oauthParams, oauth_signature: signature };
  const headerValue = Object.keys(signedParams)
    .sort()
    .map((k) => `${k}="${rfc3986Encode(signedParams[k])}"`)
    .join(", ");

  return `OAuth ${headerValue}`;
}

/**
 * Create an X API client with injectable transport.
 *
 * @param {{
 *   transport: (url: string, opts: object) => ({ status: number, body: string } | Promise<{ status: number, body: string }>),
 *   nowSeconds?: () => number,
 *   nonceFactory?: () => string,
 * }} deps
 */
export function createXApiClient({ transport, nowSeconds, nonceFactory } = {}) {
  const _nowSeconds = nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  const _nonce = nonceFactory ?? (
    () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  );

  return {
    /**
     * POST /2/tweets with OAuth 1.0a.
     *
     * @param {string} text         — normalized tweet text (≤ 280 chars)
     * @param {{ apiKey: string, apiSecret: string, accessToken: string, accessTokenSecret: string }} creds
     * @param {string} correlationId
     * @returns {Promise<{ ok: boolean, xPostId?: string, error?: { kind: string, message: string } }>}
     */
    async postTweet(text, creds, correlationId) {
      if (typeof text !== "string" || text.length === 0 || text.length > 280) {
        return {
          ok: false,
          error: { kind: "PROVIDER_REJECTED", message: "text must be 1–280 characters" },
        };
      }

      const timestamp = String(_nowSeconds());
      const nonce = _nonce();
      const authHeader = buildOAuthHeader(creds, { nonce, timestamp });

      const requestOptions = {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          "X-Correlation-Id": correlationId,
          "User-Agent": "AI-SNS-Automation/x1-prototype",
        },
        body: JSON.stringify({ text }),
        followRedirects: false,
      };

      let response;
      try {
        response = await transport(X_TWEETS_URL, requestOptions);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          error: { kind: "PROVIDER_TRANSIENT_FAILURE", message: `transport error: ${msg}` },
        };
      }

      if (response.status === 201) {
        let parsed;
        try {
          parsed = JSON.parse(response.body);
        } catch {
          return { ok: false, error: { kind: "PROVIDER_REJECTED", message: "invalid JSON in response" } };
        }
        const xPostId = parsed?.data?.id;
        if (typeof xPostId !== "string" || xPostId.length === 0) {
          return { ok: false, error: { kind: "PROVIDER_REJECTED", message: "data.id missing in response" } };
        }
        return { ok: true, xPostId };
      }

      if (response.status === 429) {
        return { ok: false, error: { kind: "PROVIDER_RATE_LIMITED", message: "rate limited (HTTP 429)" } };
      }

      if (response.status >= 500) {
        return {
          ok: false,
          error: { kind: "PROVIDER_TRANSIENT_FAILURE", message: `server error (HTTP ${response.status})` },
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          error: { kind: "PROVIDER_AUTHENTICATION_FAILED", message: `auth error (HTTP ${response.status})` },
        };
      }

      return {
        ok: false,
        error: { kind: "PROVIDER_REJECTED", message: `unexpected HTTP ${response.status}` },
      };
    },
  };
}
