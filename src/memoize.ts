export interface MemoizeOptions<A extends unknown[]> {
  /**
   * How long a resolved result stays cached, in milliseconds. While a call is
   * still in flight it is always shared regardless of `ttl` (single-flight).
   * Default: `Infinity` (cache forever).
   */
  ttl?: number;
  /**
   * Derive the cache key from the arguments. Default: `JSON.stringify(args)`.
   * Provide this when arguments are not JSON-serializable or when only some
   * of them should affect caching.
   */
  key?: (...args: A) => string;
  /**
   * Also cache rejected results. When `false` (default) a failed call is
   * evicted so the next call retries instead of replaying the error.
   */
  cacheRejections?: boolean;
  /** Maximum number of cached keys (LRU eviction). Default: `Infinity`. */
  maxSize?: number;
}

export interface Memoized<A extends unknown[], R> {
  /** Call `fn`, returning a cached or in-flight promise when one is live. */
  (...args: A): Promise<R>;
  /** Drop every cached entry. */
  clear: () => void;
  /** Drop the entry for a specific argument list. Returns whether one existed. */
  delete: (...args: A) => boolean;
}

interface Entry<R> {
  value: Promise<R>;
  /** `false` while in flight (always shared), `true` once resolved. */
  settled: boolean;
  /** When the settled value stops being reusable. Meaningless while pending. */
  expires: number;
}

/**
 * Memoize an async function with **single-flight** de-duplication and optional
 * TTL caching: concurrent calls with the same key share one in-flight promise,
 * and a resolved value is reused until it expires. Turns a thundering herd of
 * identical requests into a single underlying call.
 *
 * @param fn - The function to memoize. May be sync or async.
 * @param options - TTL, key derivation, rejection caching, and size cap.
 * @returns A callable {@link Memoized} with `clear()` and `delete(...args)`.
 * @throws {TypeError} If `options.maxSize` is set to less than 1.
 *
 * @remarks
 * Because in-flight promises are always shared, `memoize` is effective even
 * with `ttl: 0`: it collapses a burst of simultaneous calls into one without
 * caching the settled result afterwards.
 *
 * @example
 * ```ts
 * const getUser = memoize((id: string) => api.fetchUser(id), { ttl: 60_000 });
 * // Ten concurrent getUser('42') calls → one fetch, one shared result.
 * const [a, b] = await Promise.all([getUser('42'), getUser('42')]);
 * ```
 */
export function memoize<A extends unknown[], R>(
  fn: (...args: A) => R | Promise<R>,
  options: MemoizeOptions<A> = {},
): Memoized<A, R> {
  const { ttl = Infinity, key, cacheRejections = false, maxSize = Infinity } = options;

  if (maxSize < 1) {
    throw new TypeError(`Expected maxSize to be at least 1, got ${maxSize}`);
  }

  const cache = new Map<string, Entry<R>>();
  const keyOf = key ?? ((...args: A): string => JSON.stringify(args));

  const memoized = (...args: A): Promise<R> => {
    const k = keyOf(...args);
    const existing = cache.get(k);

    // Reuse a live entry: always while in flight (single-flight), and after
    // it settles until the TTL expires.
    if (existing && (!existing.settled || existing.expires > Date.now())) {
      // Refresh LRU recency.
      cache.delete(k);
      cache.set(k, existing);
      return existing.value;
    }

    const value = Promise.resolve().then(() => fn(...args));
    const entry: Entry<R> = { value, settled: false, expires: Infinity };
    cache.set(k, entry);

    void value.then(
      () => {
        entry.settled = true;
        entry.expires = Date.now() + ttl;
      },
      () => {
        if (cacheRejections) {
          entry.settled = true;
          entry.expires = Date.now() + ttl;
        } else if (cache.get(k) === entry) {
          // Evict only if this exact entry is still the cached one.
          cache.delete(k);
        }
      },
    );

    // Evict least-recently-used entries beyond the cap (Map preserves order).
    while (cache.size > maxSize) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }

    return value;
  };

  Object.defineProperties(memoized, {
    clear: {
      value: () => {
        cache.clear();
      },
    },
    delete: { value: (...args: A) => cache.delete(keyOf(...args)) },
  });

  return memoized as Memoized<A, R>;
}
