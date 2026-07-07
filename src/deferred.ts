/** A promise together with the functions that settle it from the outside. */
export interface Deferred<T> {
  /** The promise controlled by this deferred. */
  readonly promise: Promise<T>;
  /** Resolve {@link Deferred.promise}. For a `void` deferred, call with no args. */
  resolve: (value?: T | PromiseLike<T>) => void;
  /** Reject {@link Deferred.promise}. */
  reject: (reason?: unknown) => void;
}

/**
 * Create a promise whose `resolve`/`reject` can be called from elsewhere —
 * the classic "deferred", without hand-rolling the executor each time.
 *
 * @typeParam T - The value the promise resolves to. Defaults to `void`.
 * @returns A {@link Deferred} exposing `promise`, `resolve`, and `reject`.
 *
 * @remarks
 * Handy for bridging event/callback APIs into `async`/`await`, or signaling
 * readiness between two independent code paths without a shared closure.
 *
 * @example
 * ```ts
 * const ready = deferred<void>();
 * server.once('listening', () => ready.resolve());
 * server.once('error', (err) => ready.reject(err));
 * await ready.promise; // resolves when the server is up
 * ```
 */
export function deferred<T = void>(): Deferred<T> {
  let resolve!: (value?: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    // `res` requires an argument, but the public `resolve` allows omitting it
    // for `void` deferreds; forward `undefined` in that case.
    resolve = (value) => {
      res(value as T | PromiseLike<T>);
    };
    reject = rej;
  });

  return { promise, resolve, reject };
}
