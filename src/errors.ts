/** Thrown when an operation exceeds its time budget. */
export class TimeoutError extends Error {
  constructor(message = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Thrown by `retry` when all attempts have been exhausted. */
export class RetryError extends Error {
  /** The error thrown by the final attempt. */
  override readonly cause: unknown;
  /** Total number of attempts made (initial call + retries). */
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
