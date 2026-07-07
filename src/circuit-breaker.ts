import { CircuitOpenError } from './errors.js';

/** Circuit breaker lifecycle state. */
export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Consecutive failures that trip a closed circuit to open. Default: `5`. */
  failureThreshold?: number;
  /** How long the circuit stays open before a trial call, in ms. Default: `30_000`. */
  resetTimeout?: number;
  /** Successful trial calls in half-open needed to close again. Default: `1`. */
  successThreshold?: number;
  /**
   * Decide whether an error counts toward tripping the circuit. Return `false`
   * to let an error propagate without opening the breaker (e.g. 4xx client
   * errors that a retry would not fix). Default: every error counts.
   */
  shouldTrip?: (error: unknown) => boolean;
  /** Observe every state transition. */
  onStateChange?: (state: CircuitState, previous: CircuitState) => void;
}

export interface CircuitBreaker<A extends unknown[], R> {
  /** Call the wrapped function, subject to the circuit's current state. */
  (...args: A): Promise<R>;
  /** The circuit's current state (reads reflect a due open→half-open flip). */
  readonly state: CircuitState;
  /** Consecutive tripping failures counted while closed. */
  readonly failures: number;
  /** Force the circuit back to a clean closed state. */
  reset: () => void;
}

/**
 * Wrap an async function with the circuit-breaker pattern: after too many
 * consecutive failures the circuit "opens" and calls reject immediately with
 * a {@link CircuitOpenError} — giving a failing dependency time to recover
 * instead of hammering it. After `resetTimeout` a single trial call is allowed
 * (half-open); success closes the circuit, failure reopens it.
 *
 * @param fn - The async function to protect.
 * @param options - Threshold, timing, and observability tuning.
 * @returns A callable {@link CircuitBreaker} with `state`, `failures`, and
 *   `reset()`.
 * @throws {@link CircuitOpenError} from calls made while the circuit is open.
 * @throws Whatever `fn` throws, unwrapped, for calls that are allowed through.
 *
 * @remarks
 * Pairs naturally with `retry`: retry handles transient blips, the breaker
 * handles a dependency that is down, so retries don't pile onto it.
 *
 * @example
 * ```ts
 * const call = circuitBreaker((id: string) => api.fetchUser(id), {
 *   failureThreshold: 3,
 *   resetTimeout: 10_000,
 * });
 *
 * try {
 *   const user = await call('123');
 * } catch (err) {
 *   if (err instanceof CircuitOpenError) return cachedUser;
 *   throw err;
 * }
 * ```
 */
export function circuitBreaker<A extends unknown[], R>(
  fn: (...args: A) => R | Promise<R>,
  options: CircuitBreakerOptions = {},
): CircuitBreaker<A, R> {
  const {
    failureThreshold = 5,
    resetTimeout = 30_000,
    successThreshold = 1,
    shouldTrip,
    onStateChange,
  } = options;

  let state: CircuitState = 'closed';
  let failures = 0;
  let successes = 0;
  let openedAt = 0;

  const setState = (next: CircuitState): void => {
    if (next === state) return;
    const previous = state;
    state = next;
    onStateChange?.(next, previous);
  };

  /** Resolve the effective state, flipping open→half-open once the reset window has passed. */
  const currentState = (): CircuitState => {
    if (state === 'open' && Date.now() - openedAt >= resetTimeout) {
      successes = 0;
      setState('half-open');
    }
    return state;
  };

  const trip = (): void => {
    openedAt = Date.now();
    setState('open');
  };

  const onSuccess = (): void => {
    if (state === 'half-open') {
      successes++;
      if (successes >= successThreshold) {
        failures = 0;
        setState('closed');
      }
    } else {
      failures = 0;
    }
  };

  const onFailure = (): void => {
    if (state === 'half-open') {
      trip();
      return;
    }
    failures++;
    if (failures >= failureThreshold) trip();
  };

  const breaker = async (...args: A): Promise<R> => {
    if (currentState() === 'open') {
      throw new CircuitOpenError();
    }

    try {
      const result = await fn(...args);
      onSuccess();
      return result;
    } catch (error) {
      if (shouldTrip ? shouldTrip(error) : true) onFailure();
      throw error;
    }
  };

  Object.defineProperties(breaker, {
    state: { get: currentState },
    failures: { get: () => failures },
    reset: {
      value: () => {
        failures = 0;
        successes = 0;
        openedAt = 0;
        setState('closed');
      },
    },
  });

  return breaker as CircuitBreaker<A, R>;
}
