import { abortError } from './errors.js';

export interface SleepOptions {
  /** Abort the sleep early. The returned promise rejects with the abort reason. */
  signal?: AbortSignal | undefined;
}

/**
 * Resolve after `ms` milliseconds.
 *
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
