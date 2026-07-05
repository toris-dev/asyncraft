/**
 * Thrown by `withTimeout` when an operation exceeds its time budget.
 *
 * @remarks
 * Distinguish timeouts from other failures with `instanceof`:
 * ```ts
 * try {
 *   await withTimeout(work(), 5000);
 * } catch (err) {
 *   if (err instanceof TimeoutError) scheduleRetryLater();
 *   else throw err;
 * }
 * ```
 */
export class TimeoutError extends Error {
  constructor(message = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Thrown by `retry` when all attempts have been exhausted.
 *
 * @remarks
 * The last attempt's error is preserved on {@link RetryError.cause} (typed
 * `unknown` because thrown values are not guaranteed to be `Error`s), and
 * the total attempt count on {@link RetryError.attempts}.
 */
export class RetryError extends Error {
  /** The error thrown by the final attempt. Inspect with `instanceof`. */
  override readonly cause: unknown;
  /** Total number of attempts made (initial call + retries), always ≥ 1. */
  readonly attempts: number;

  constructor(cause: unknown, attempts: number) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`All ${attempts} attempts failed. Last error: ${reason}`);
    this.name = 'RetryError';
    this.cause = cause;
    this.attempts = attempts;
  }
}

/** Wrap a non-Error abort reason so it is always safe to throw. */
export function abortError(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  if (reason instanceof Error) return reason;
  const message =
    typeof reason === 'string'
      ? reason
      : typeof reason === 'number' || typeof reason === 'boolean' || typeof reason === 'bigint'
        ? String(reason)
        : 'The operation was aborted';
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}
