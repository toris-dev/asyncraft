import { deferred, type Deferred } from './deferred.js';

export interface DebounceOptions {
  /** Quiet period, in milliseconds, before the trailing call fires. */
  wait: number;
}

export interface DebouncedFunction<A extends unknown[], R> {
  /** Schedule a trailing call; returns a promise for its eventual result. */
  (...args: A): Promise<R>;
  /** Cancel a pending call. Every awaiting promise rejects with `reason`. */
  cancel: (reason?: unknown) => void;
  /** Whether a trailing call is currently scheduled. */
  readonly pending: boolean;
}

interface Batch<A extends unknown[], R> {
  args: A;
  deferreds: Deferred<R>[];
}

/**
 * Debounce an async function on the trailing edge: rapid calls collapse into a
 * single invocation that runs `wait` ms after the last call, using that last
 * call's arguments. Every caller in the window receives the result of that one
 * invocation.
 *
 * @param fn - The function to debounce.
 * @param options - The `wait` quiet period in milliseconds.
 * @returns A {@link DebouncedFunction} with `cancel()` and a `pending` flag.
 *
 * @remarks
 * Ideal for collapsing bursts — autosave on keystroke, refetch on rapid filter
 * changes — into one call while still giving every caller an awaitable result.
 *
 * @example
 * ```ts
 * const save = debounceAsync((doc: Doc) => api.save(doc), { wait: 500 });
 * editor.on('change', (doc) => save(doc)); // one save 500ms after typing stops
 * ```
 */
export function debounceAsync<A extends unknown[], R>(
  fn: (...args: A) => R | Promise<R>,
  options: DebounceOptions,
): DebouncedFunction<A, R> {
  const { wait } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let batch: Batch<A, R> | undefined;

  const fire = (): void => {
    const current = batch;
    batch = undefined;
    timer = undefined;
    if (!current) return;

    Promise.resolve()
      .then(() => fn(...current.args))
      .then(
        (value) => {
          for (const d of current.deferreds) d.resolve(value);
        },
        (reason: unknown) => {
          for (const d of current.deferreds) d.reject(reason);
        },
      );
  };

  const debounced = (...args: A): Promise<R> => {
    batch ??= { args, deferreds: [] };
    batch.args = args;
    const d = deferred<R>();
    batch.deferreds.push(d);

    if (timer) clearTimeout(timer);
    timer = setTimeout(fire, wait);
    return d.promise;
  };

  Object.defineProperties(debounced, {
    cancel: {
      value: (reason?: unknown) => {
        if (timer) clearTimeout(timer);
        timer = undefined;
        const current = batch;
        batch = undefined;
        if (!current) return;
        const error =
          reason ??
          Object.assign(new Error('Debounced call cancelled'), {
            name: 'AbortError',
          });
        for (const d of current.deferreds) d.reject(error);
      },
    },
    pending: { get: () => batch !== undefined },
  });

  return debounced as DebouncedFunction<A, R>;
}
