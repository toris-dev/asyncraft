import { TimeoutError, abortError } from './errors.js';

export interface WithTimeoutOptions {
  /** Custom message for the {@link TimeoutError}. */
  message?: string;
  /** Abort waiting early. The returned promise rejects with the abort reason. */
  signal?: AbortSignal | undefined;
}

/**
 * Reject with a {@link TimeoutError} if the operation does not settle within
 * `ms` milliseconds.
 *
 * @param input - Either a promise, or a function that receives an
 *   `AbortSignal` and returns a promise. Prefer the function form: the signal
 *   fires on timeout (and on `options.signal` abort), so the underlying work
 *   is actually cancelled instead of racing on unobserved.
 * @param ms - Time budget in milliseconds.
 * @param options - Custom timeout message and an outer abort signal.
 * @returns The resolved value of the operation when it settles in time.
 * @throws {@link TimeoutError} when `ms` elapses first.
 * @throws The abort reason when `options.signal` aborts first.
 * @throws Whatever the operation itself rejects with, unwrapped.
 *
 * @remarks
 * Stability guarantees:
 * - The guard timer is always cleared once the race settles — no timer leaks,
 *   nothing keeps the event loop alive.
 * - The listener added to `options.signal` is always removed after settling,
 *   so a long-lived signal can be reused across many calls without listener
 *   accumulation.
 *
 * @example
 * ```ts
 * const res = await withTimeout((signal) => fetch(url, { signal }), 5000);
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
