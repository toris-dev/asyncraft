import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { asyncMap, createLimit, retry } from '../src/index.js';

/**
 * Property-based suite (fast-check): instead of hand-picked examples, these
 * assert invariants over hundreds of generated inputs. Shrunk counterexamples
 * are printed on failure — paste the reported seed into `fc.assert(..., {seed})`
 * to reproduce deterministically.
 */
describe('asyncMap properties', () => {
  it('preserves input order for any array and concurrency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer(), { maxLength: 50 }),
        fc.integer({ min: 1, max: 8 }),
        async (items, concurrency) => {
          const results = await asyncMap(
            items,
            async (n) => {
              // Random-ish completion order via microtask churn.
              for (let i = 0; i < Math.abs(n) % 5; i++) await Promise.resolve();
              return n * 2;
            },
            { concurrency },
          );
          expect(results).toEqual(items.map((n) => n * 2));
        },
      ),
      { numRuns: 50 },
    );
  });

  it('settled mode never rejects and reports every item', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer(), { maxLength: 30 }), async (items) => {
        const results = await asyncMap(
          items,
          (n) => (n % 2 === 0 ? Promise.resolve(n) : Promise.reject(new Error(String(n)))),
          { concurrency: 4, settled: true },
        );
        expect(results).toHaveLength(items.length);
        results.forEach((r, i) => {
          const n = items[i]!;
          expect(r.status).toBe(n % 2 === 0 ? 'fulfilled' : 'rejected');
        });
      }),
      { numRuns: 50 },
    );
  });
});

describe('retry properties', () => {
  it('an always-failing fn is called exactly retries + 1 times', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 5 }), async (retries) => {
        let calls = 0;
        await retry(
          () => {
            calls++;
            throw new Error('always');
          },
          { retries, minDelay: 0, jitter: false },
        ).catch(() => undefined);
        expect(calls).toBe(retries + 1);
      }),
      { numRuns: 30 },
    );
  });

  it('backoff delays without jitter are non-decreasing and capped at maxDelay', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 5, max: 20 }),
        fc.double({ min: 1, max: 3, noNaN: true }),
        async (minDelay, maxDelay, factor) => {
          const delays: number[] = [];
          await retry(
            () => {
              throw new Error('always');
            },
            {
              retries: 3,
              minDelay,
              maxDelay,
              factor,
              jitter: false,
              onRetry: (_e, _a, delay) => {
                delays.push(delay);
              },
            },
          ).catch(() => undefined);

          for (let i = 0; i < delays.length; i++) {
            expect(delays[i]).toBeLessThanOrEqual(maxDelay);
            if (i > 0) expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]!);
          }
        },
      ),
      { numRuns: 30 },
    );
  });

  it('jittered delays stay within [cap/2, cap]', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 10 }), async (minDelay) => {
        const delays: number[] = [];
        await retry(
          () => {
            throw new Error('always');
          },
          {
            retries: 2,
            minDelay,
            maxDelay: minDelay * 8,
            factor: 2,
            jitter: true,
            onRetry: (_e, attempt, delay) => {
              delays.push(delay / (minDelay * 2 ** (attempt - 1)));
            },
          },
        ).catch(() => undefined);

        for (const ratio of delays) {
          expect(ratio).toBeGreaterThanOrEqual(0.5);
          expect(ratio).toBeLessThanOrEqual(1);
        }
      }),
      { numRuns: 30 },
    );
  });
});

describe('createLimit properties', () => {
  it('peak concurrency never exceeds the limit for any workload', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 1, max: 40 }),
        async (concurrency, tasks) => {
          const limit = createLimit(concurrency);
          let running = 0;
          let peak = 0;

          await Promise.all(
            Array.from({ length: tasks }, () =>
              limit(async () => {
                running++;
                peak = Math.max(peak, running);
                await Promise.resolve();
                running--;
              }),
            ),
          );

          expect(peak).toBeLessThanOrEqual(concurrency);
          expect(limit.activeCount).toBe(0);
          expect(limit.pendingCount).toBe(0);
        },
      ),
      { numRuns: 50 },
    );
  });
});
