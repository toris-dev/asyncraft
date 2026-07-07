import { describe, expect, it } from 'vitest';
import { deferred } from '../src/index.js';

describe('deferred', () => {
  it('resolves from the outside', async () => {
    const d = deferred<number>();
    setTimeout(() => {
      d.resolve(42);
    }, 5);
    await expect(d.promise).resolves.toBe(42);
  });

  it('rejects from the outside', async () => {
    const d = deferred<number>();
    const boom = new Error('boom');
    setTimeout(() => {
      d.reject(boom);
    }, 5);
    await expect(d.promise).rejects.toBe(boom);
  });

  it('supports a void deferred resolved with no argument', async () => {
    const d = deferred();
    d.resolve();
    await expect(d.promise).resolves.toBeUndefined();
  });

  it('adopts a thenable passed to resolve', async () => {
    const d = deferred<string>();
    d.resolve(Promise.resolve('via thenable'));
    await expect(d.promise).resolves.toBe('via thenable');
  });

  it('ignores settle calls after the first', async () => {
    const d = deferred<number>();
    d.resolve(1);
    d.resolve(2);
    d.reject(new Error('late'));
    await expect(d.promise).resolves.toBe(1);
  });
});
