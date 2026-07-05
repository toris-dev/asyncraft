export interface LimitFunction {
  /** Schedule a task; it runs once a concurrency slot is free. */
  <T>(fn: () => T | Promise<T>): Promise<T>;
  /** Number of tasks currently running. */
  readonly activeCount: number;
  /** Number of tasks waiting for a free slot. */
  readonly pendingCount: number;
  /** Discard all queued (not yet started) tasks. Their promises never settle. */
  clearQueue: () => void;
}

/**
 * Create a function that limits how many promises run at once.
 *
 * ```ts
 * const limit = createLimit(2);
 * const results = await Promise.all(urls.map((url) => limit(() => fetch(url))));
 * ```
 */
export function createLimit(concurrency: number): LimitFunction {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError(`Expected concurrency to be a positive integer, got ${concurrency}`);
  }

  const queue: (() => void)[] = [];
  let activeCount = 0;

  function next(): void {
    activeCount--;
    queue.shift()?.();
  }

  const limit = <T>(fn: () => T | Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const run = (): void => {
        activeCount++;
        Promise.resolve().then(fn).then(resolve, reject).finally(next);
      };

      if (activeCount < concurrency) run();
      else queue.push(run);
    });
  };

  Object.defineProperties(limit, {
    activeCount: { get: () => activeCount },
    pendingCount: { get: () => queue.length },
    clearQueue: { value: () => void (queue.length = 0) },
  });

  return limit as LimitFunction;
}
