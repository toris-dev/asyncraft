import { TimeoutError, abortError } from './errors.js';

export interface WithTimeoutOptions {
  /** Custom message for the {@link TimeoutError}. */
  message?: string;
  /** Abort waiting early. The returned promise rejects with the abort reason. */
  signal?: AbortSignal | undefined;
}

/**
 * Reject with a {@link TimeoutError} if the promise does not settle within
 * `ms` milliseconds.
 *
 * Accepts either a promise or a promise-returning function. Passing a
 * function lets `withTimeout` forward an AbortSignal that fires on timeout,
 * so the underlying work can actually be cancelled:
 *
 * ```ts
 * const res = await withTimeout(
 *   (signal) => fetch(url, { signal }),
 *   5000,
 * );
 * ```
 */
export async function withTimeout<T>(
  input: Promise<T> | ((signal: AbortSignal) => Promise<T>),
  ms: number,
  options: WithTimeoutOptions = {},
): Promise<T> {
  const { message, signal } = options;

  if (signal?.aborted) throw abortError(signal);

  const timeoutController = new AbortController();
  const promise = typeof input === 'function' ? input(timeoutController.signal) : input;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let onOuterAbort: (() => void) | undefined;

  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new TimeoutError(message ?? `Operation timed out after ${ms}ms`);
      timeoutController.abort(error);
      reject(error);
    }, ms);

    if (signal) {
      onOuterAbort = () => {
        const error = abortError(signal);
        timeoutController.abort(error);
        reject(error);
      };
      signal.addEventListener('abort', onOuterAbort, { once: true });
    }
  });

  try {
    return await Promise.race([promise, guard]);
  } finally {
    clearTimeout(timer);
    if (signal && onOuterAbort) signal.removeEventListener('abort', onOuterAbort);
  }
}
