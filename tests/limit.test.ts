import { describe, expect, it } from 'vitest';
import { createLimit, sleep } from '../src/index.js';

describe('createLimit', () => {
  it('rejects invalid concurrency', () => {
    expect(() => createLimit(0)).toThrow(TypeError);
    expect(() => createLimit(1.5)).toThrow(TypeError);
    expect(() => createLimit(-1)).toThrow(TypeError);
  });

  it('never runs more than `concurrency` tasks at once', async () => {
    const limit = createLimit(2);
    let running = 0;
    let peak = 0;

    const task = async (): Promise<void> => {
      running++;
      peak = Math.max(peak, running);
      await sleep(10);
      running--;
    };

    await Promise.all(Array.from({ length: 8 }, () => limit(task)));
    expect(peak).toBe(2);
  });

  it('returns task results', async () => {
    const limit = createLimit(2);
    const results = await Promise.all([1, 2, 3].map((n) => limit(() => Promise.resolve(n * 10))));
    expect(results).toEqual([10, 20, 30]);
  });

  it('propagates task errors without blocking the queue', async () => {
    const limit = createLimit(1);
    const boom = new Error('boom');

    const failed = limit(() => Promise.reject(boom));
    const ok = limit(() => Promise.resolve('ok'));

    await expect(failed).rejects.toBe(boom);
    await expect(ok).resolves.toBe('ok');
  });

  it('reports activeCount and pendingCount', async () => {
    const limit = createLimit(1);

    const first = limit(() => sleep(20));
    const second = limit(() => sleep(20));

    // First task starts synchronously-ish; second waits in the queue.
    await sleep(5);
    expect(limit.activeCount).toBe(1);
    expect(limit.pendingCount).toBe(1);

    await Promise.all([first, second]);
    expect(limit.activeCount).toBe(0);
    expect(limit.pendingCount).toBe(0);
  });

  it('clearQueue drops queued tasks but keeps running ones', async () => {
    const limit = createLimit(1);
    let secondRan = false;

    const first = limit(() => sleep(20));
    void limit(() => {
      secondRan = true;
    });

    limit.clearQueue();
    await first;
    await sleep(10);

    expect(secondRan).toBe(false);
    expect(limit.pendingCount).toBe(0);
  });
});
