import { TimeoutError } from './errors.js';

/**
 * Create an `AbortSignal` that aborts on its own after `ms` milliseconds,
 * with a {@link TimeoutError} as the abort reason.
 *
 * @param ms - Delay before the signal aborts, in milliseconds.
 * @returns A signal that aborts after the delay. The underlying timer is
 *   unreferenced, so a pending timeout signal never keeps the process alive.
 *
 * @remarks
 * Unlike the built-in `AbortSignal.timeout`, the abort reason is asyncraft's
 * `TimeoutError`, so it reads the same as a `withTimeout` failure.
 *
 * @example
 * ```ts
 * const res = await fetch(url, { signal: timeoutSignal(5000) });
 * ```
 */
export function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new TimeoutError(`Timed out after ${ms}ms`));
  }, ms) as unknown as { unref?: () => void };
  timer.unref?.();
  return controller.signal;
}

/**
 * Combine several `AbortSignal`s into one that aborts as soon as *any* of
 * them aborts (with that signal's reason). `null`/`undefined` entries are
 * ignored, so you can pass optional signals straight through.
 *
 * @param signals - The signals to merge; nullish entries are skipped.
 * @returns A signal that mirrors the first of `signals` to abort.
 *
 * @remarks
 * A drop-in for the not-yet-universal `AbortSignal.any` (Node ≥ 20). Once the
 * combined signal aborts, all internal listeners are removed, so merging a
 * long-lived signal does not accumulate listeners on it.
 *
 * @example
 * ```ts
 * // Abort when the caller cancels OR a 5s deadline passes.
 * const signal = anySignal(req.signal, timeoutSignal(5000));
 * await doWork({ signal });
 * ```
 */
export function anySignal(...signals: (AbortSignal | null | undefined)[]): AbortSignal {
  const controller = new AbortController();
  const present = signals.filter((s): s is AbortSignal => s != null);

  for (const signal of present) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
  }

  const handlers = new Map<AbortSignal, () => void>();
  const cleanup = (): void => {
    for (const [signal, handler] of handlers) {
      signal.removeEventListener('abort', handler);
    }
    handlers.clear();
  };

  for (const signal of present) {
    const handler = (): void => {
      controller.abort(signal.reason);
      cleanup();
    };
    handlers.set(signal, handler);
    signal.addEventListener('abort', handler, { once: true });
  }

  return controller.signal;
}
