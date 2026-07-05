import { createLimit } from './limit.js';

export interface AsyncMapOptions {
  /** Maximum number of mappers running at once. Default: `Infinity`-like (all at once). */
  concurrency?: number;
  /**
   * When `true`, a mapper error does not reject the whole call; the error is
   * captured in place of the result (like `Promise.allSettled`).
   * Default: `false` (fail fast, like `Promise.all`).
   */
  settled?: boolean;
}

export type SettledResult<T> =
  { status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown };

/**
 * Map over `items` with an async mapper, at most `concurrency` at a time.
 *
 * @param items - Any iterable; it is materialized once up front.
 * @param mapper - Receives each item and its index. May return a value or a
 *   promise; synchronous throws are treated the same as rejections.
 * @param options - Concurrency bound and failure mode.
 * @returns Results in input order. With `settled: true`, an array of
 *   {@link SettledResult} objects (one per item, never rejects); otherwise
 *   the mapped values, rejecting on the first mapper failure like
 *   `Promise.all`.
 * @throws {TypeError} If `options.concurrency` is not a positive integer.
 *
 * @remarks
 * Stability guarantees:
 * - Result order always matches input order, regardless of completion order.
 * - In `settled` mode every item is processed and reported — one failure
 *   never hides another item's outcome.
 *
 * @example
 * ```ts
 * const pages = await asyncMap(urls, (url) => fetch(url), { concurrency: 4 });
 * ```
 */
export async function asyncMap<T, R>(
  items: Iterable<T>,
  mapper: (item: T, index: number) => R | Promise<R>,
  options?: AsyncMapOptions & { settled?: false },
): Promise<R[]>;
export async function asyncMap<T, R>(
  items: Iterable<T>,
  mapper: (item: T, index: number) => R | Promise<R>,
  options: AsyncMapOptions & { settled: true },
): Promise<SettledResult<R>[]>;
export async function asyncMap<T, R>(
  items: Iterable<T>,
  mapper: (item: T, index: number) => R | Promise<R>,
  options: AsyncMapOptions = {},
): Promise<R[] | SettledResult<R>[]> {
  const { concurrency, settled = false } = options;
  const array = Array.from(items);

  const run =
    concurrency === undefined
      ? <U>(fn: () => Promise<U>): Promise<U> => fn()
      : createLimit(concurrency);

  if (settled) {
    return Promise.all(
      array.map((item, index) =>
        run<SettledResult<R>>(async () => {
          try {
            return { status: 'fulfilled', value: await mapper(item, index) };
          } catch (reason) {
            return { status: 'rejected', reason };
          }
        }),
      ),
    );
  }

  return Promise.all(array.map((item, index) => run(async () => mapper(item, index))));
}
