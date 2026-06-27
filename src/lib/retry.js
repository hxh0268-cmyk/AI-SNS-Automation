/**
 * 指定ミリ秒待機する
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Promise にタイムアウトを付与する
 * @template T
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @returns {Promise<T>}
 */
export function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(`Operation timed out after ${timeoutMs}ms`);
      error.name = "TimeoutError";
      reject(error);
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * エラーメッセージを文字列化する
 * @param {unknown} error
 * @returns {string}
 */
function toErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error ?? "");
}

/**
 * HTTP ステータスコードをエラーから取得する
 * @param {unknown} error
 * @returns {number | null}
 */
function getErrorStatus(error) {
  if (error && typeof error === "object") {
    if ("status" in error && typeof error.status === "number") {
      return error.status;
    }
    if ("statusCode" in error && typeof error.statusCode === "number") {
      return error.statusCode;
    }
  }

  const message = toErrorMessage(error);
  const match = message.match(/\b(429|500|502|503|504)\b/);
  return match ? Number(match[1]) : null;
}

/**
 * 429 + limit:0 のクォータエラーか判定する
 * @param {unknown} error
 * @returns {boolean}
 */
export function isLimitZeroError(error) {
  const message = toErrorMessage(error);
  const status = getErrorStatus(error);
  const has429 = status === 429 || message.includes("429");
  const hasLimitZero = /limit:\s*0\b/i.test(message);
  return has429 && hasLimitZero;
}

/**
 * リトライ可能なエラーか判定する
 * @param {unknown} error
 * @returns {boolean}
 */
export function isRetryableError(error) {
  if (isLimitZeroError(error)) {
    return false;
  }

  if (error instanceof Error && error.name === "TimeoutError") {
    return false;
  }

  const status = getErrorStatus(error);
  if (status === 429) {
    return true;
  }

  if (status !== null && status >= 500 && status <= 504) {
    return true;
  }

  return false;
}

/**
 * エラーに retry メタデータを付与する
 * @param {unknown} error
 * @param {string} provider
 * @param {{ retryable?: boolean, limitZeroDetected?: boolean }} meta
 * @returns {Error}
 */
function enrichError(error, provider, meta = {}) {
  const base =
    error instanceof Error ? error : new Error(toErrorMessage(error));
  const enriched = new Error(base.message);
  enriched.name = base.name;
  enriched.cause = base;
  enriched.provider = provider;
  enriched.retryable = meta.retryable ?? isRetryableError(base);
  enriched.limitZeroDetected = meta.limitZeroDetected ?? isLimitZeroError(base);
  return enriched;
}

/**
 * 共通 retry ラッパー
 * @param {object} options
 * @param {string} options.provider
 * @param {() => Promise<unknown>} options.fn
 * @param {number} [options.maxAttempts=3]
 * @param {number} [options.timeoutMs=60000]
 * @param {number} [options.backoffMs=1000]
 * @param {(ctx: { attempt: number, provider: string }) => void | Promise<void>} [options.onAttempt]
 * @param {(ctx: { attempt: number, provider: string, error: Error, limitZeroDetected: boolean }) => void | Promise<void>} [options.onFailure]
 * @returns {Promise<{ success: true, result: unknown, attempts: number, provider: string, limitZeroDetected: false } | { success: false, error: Error, attempts: number, provider: string, limitZeroDetected: boolean, retryable: boolean }>}
 */
export async function withRetry({
  provider,
  fn,
  maxAttempts = 3,
  timeoutMs = 60000,
  backoffMs = 1000,
  onAttempt,
  onFailure,
}) {
  let lastError = enrichError(new Error("Unknown error"), provider, {
    retryable: false,
    limitZeroDetected: false,
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (onAttempt) {
      await onAttempt({ attempt, provider });
    }

    try {
      const result = await withTimeout(fn(), timeoutMs);
      return {
        success: true,
        result,
        attempts: attempt,
        provider,
        limitZeroDetected: false,
      };
    } catch (error) {
      const limitZeroDetected = isLimitZeroError(error);
      const retryable = limitZeroDetected ? false : isRetryableError(error);
      lastError = enrichError(error, provider, { retryable, limitZeroDetected });

      if (limitZeroDetected) {
        if (onFailure) {
          await onFailure({
            attempt,
            provider,
            error: lastError,
            limitZeroDetected: true,
          });
        }

        return {
          success: false,
          error: lastError,
          attempts: attempt,
          provider,
          limitZeroDetected: true,
          retryable: false,
        };
      }

      if (!retryable || attempt >= maxAttempts) {
        if (onFailure) {
          await onFailure({
            attempt,
            provider,
            error: lastError,
            limitZeroDetected: false,
          });
        }

        return {
          success: false,
          error: lastError,
          attempts: attempt,
          provider,
          limitZeroDetected: false,
          retryable,
        };
      }

      const delay = backoffMs * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: maxAttempts,
    provider,
    limitZeroDetected: false,
    retryable: lastError.retryable ?? false,
  };
}
