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
 * @param concurrency - Maximum number of tasks running simultaneously.
 * @returns A {@link LimitFunction}: call it with a task to schedule the task,
 *   inspect `activeCount`/`pendingCount`, or `clearQueue()` to drop tasks
 *   that have not started yet.
 * @throws {TypeError} If `concurrency` is not a positive integer.
 *
 * @remarks
 * Stability guarantees:
 * - Queued tasks start in FIFO order; a task is never started before an
 *   earlier-queued task.
 * - A rejecting task frees its slot like any other — one failure cannot
 *   stall the queue.
 * - `activeCount` and `pendingCount` both return to `0` once all scheduled
 *   work settles; the limiter holds no lingering state.
 *
 * @example
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
