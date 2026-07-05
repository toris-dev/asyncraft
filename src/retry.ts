import { RetryError, abortError } from './errors.js';
import { sleep } from './sleep.js';

export interface RetryOptions {
  /** Maximum number of retries after the initial attempt. Default: `3`. */
  retries?: number;
  /** Delay before the first retry, in milliseconds. Default: `100`. */
  minDelay?: number;
  /** Upper bound for any single delay, in milliseconds. Default: `10_000`. */
  maxDelay?: number;
  /** Exponential growth factor between delays. Default: `2`. */
  factor?: number;
  /**
   * Randomize each delay to avoid thundering-herd retries.
   * When `true`, each delay is multiplied by a random value in `[0.5, 1)`.
   * Default: `true`.
   */
  jitter?: boolean;
  /** Abort retrying (and any in-flight delay) via AbortSignal. */
  signal?: AbortSignal | undefined;
  /**
   * Decide whether an error is retryable. Return `false` to rethrow
   * immediately without further attempts. Default: retry everything.
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Observe each failed attempt before the next delay. */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

/**
 * Call `fn` until it resolves, retrying with exponential backoff.
 *
 * The attempt number (starting at 1) is passed to `fn`. When every attempt
 * fails, a {@link RetryError} is thrown with the last error as `cause`.
 *
 * ```ts
 * const user = await retry(() => fetchUser(id), {
 *   retries: 5,
 *   shouldRetry: (err) => err instanceof HttpError && err.status >= 500,
 * });
 * ```
 */
export async function retry<T>(
  fn: (attempt: number) => T | Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    retries = 3,
    minDelay = 100,
    maxDelay = 10_000,
    factor = 2,
    jitter = true,
    signal,
    shouldRetry,
    onRetry,
  } = options;

  const maxAttempts = retries + 1;

  for (let attempt = 1; ; attempt++) {
    if (signal?.aborted) throw abortError(signal);

    try {
      return await fn(attempt);
    } catch (error) {
      if (shouldRetry && !shouldRetry(error, attempt)) throw error;
      if (attempt >= maxAttempts) throw new RetryError(error, attempt);

      const exponential = minDelay * factor ** (attempt - 1);
      const capped = Math.min(exponential, maxDelay);
      const delay = jitter ? capped * (0.5 + Math.random() * 0.5) : capped;

      onRetry?.(error, attempt, delay);
      await sleep(delay, { signal });
    }
  }
}
