import { abortError } from './errors.js';

export interface SleepOptions {
  /** Abort the sleep early. The returned promise rejects with the abort reason. */
  signal?: AbortSignal | undefined;
}

/**
 * Resolve after `ms` milliseconds.
 *
 * @param ms - Duration in milliseconds. `0` yields to the timer queue once.
 * @param options - Optional abort signal to cancel the sleep.
 * @returns A promise that resolves after the duration, or rejects with the
 *   abort reason (wrapped in an `Error` if it is not one) when cancelled.
 *
 * @remarks
 * Stability guarantees:
 * - Aborting clears the underlying timer immediately — a cancelled sleep
 *   does not keep the process alive.
 * - The abort listener is removed when the sleep resolves normally, so a
 *   long-lived signal can be passed to many sleeps without accumulation.
 *
 * @example
 * ```ts
 * await sleep(1000);
 * await sleep(5000, { signal: controller.signal }); // cancellable
 * ```
 */
export function sleep(ms: number, options: SleepOptions = {}): Promise<void> {
  const { signal } = options;
  return new Promise((resolve, reject) => {
    if (!signal) {
      setTimeout(resolve, ms);
      return;
    }

    if (signal.aborted) {
      reject(abortError(signal));
      return;
    }

    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortError(signal));
    };

    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal.addEventListener('abort', onAbort, { once: true });
  });
}
