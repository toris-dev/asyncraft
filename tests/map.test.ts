import { describe, expect, it } from 'vitest';
import { asyncMap, sleep } from '../src/index.js';

describe('asyncMap', () => {
  it('maps all items and preserves input order', async () => {
    const results = await asyncMap(
      [30, 10, 20],
      async (ms) => {
        await sleep(ms);
        return ms;
      },
      { concurrency: 3 },
    );
    expect(results).toEqual([30, 10, 20]);
  });

  it('respects the concurrency limit', async () => {
    let running = 0;
    let peak = 0;

    await asyncMap(
      Array.from({ length: 10 }, (_, i) => i),
      async () => {
        running++;
        peak = Math.max(peak, running);
        await sleep(5);
        running--;
      },
      { concurrency: 3 },
    );

    expect(peak).toBe(3);
  });

  it('runs everything at once without a concurrency option', async () => {
    let running = 0;
    let peak = 0;

    await asyncMap(
      Array.from({ length: 5 }, (_, i) => i),
      async () => {
        running++;
        peak = Math.max(peak, running);
        await sleep(5);
        running--;
      },
    );

    expect(peak).toBe(5);
  });

  it('passes the index to the mapper', async () => {
    const results = await asyncMap(['a', 'b', 'c'], (item, index) => `${index}:${item}`);
    expect(results).toEqual(['0:a', '1:b', '2:c']);
  });

  it('fails fast by default', async () => {
    const boom = new Error('boom');
    await expect(
      asyncMap([1, 2, 3], (n) => (n === 2 ? Promise.reject(boom) : Promise.resolve(n))),
    ).rejects.toBe(boom);
  });

  it('captures errors per item with settled: true', async () => {
    const boom = new Error('boom');
    const results = await asyncMap(
      [1, 2, 3],
      (n) => (n === 2 ? Promise.reject(boom) : Promise.resolve(n * 10)),
      { settled: true },
    );

    expect(results).toEqual([
      { status: 'fulfilled', value: 10 },
      { status: 'rejected', reason: boom },
      { status: 'fulfilled', value: 30 },
    ]);
  });

  it('accepts any iterable', async () => {
    const results = await asyncMap(new Set(['x', 'y']), (s) => s.toUpperCase());
    expect(results).toEqual(['X', 'Y']);
  });
});
