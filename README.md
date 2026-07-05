# asyncraft

[![npm version](https://img.shields.io/npm/v/asyncraft?logo=npm)](https://www.npmjs.com/package/asyncraft)
[![CI](https://github.com/toris-dev/asyncraft/actions/workflows/ci.yml/badge.svg)](https://github.com/toris-dev/asyncraft/actions/workflows/ci.yml)
[![npm downloads](https://img.shields.io/npm/dm/asyncraft)](https://www.npmjs.com/package/asyncraft)
[![bundle size](https://img.shields.io/bundlephobia/minzip/asyncraft)](https://bundlephobia.com/package/asyncraft)
[![types](https://img.shields.io/npm/types/asyncraft)](https://www.npmjs.com/package/asyncraft)
[![license](https://img.shields.io/npm/l/asyncraft)](./LICENSE)

> Zero-dependency async utilities: retry with backoff, timeout, concurrency limit, and async pool — fully typed, `AbortSignal`-aware.

Instead of installing `p-retry` + `p-timeout` + `p-limit` + `p-map` separately, get the four things every project eventually needs in one tiny, tree-shakeable package.

- **Zero dependencies** — nothing else lands in your `node_modules`.
- **TypeScript-first** — strict types, no `any`, full inference.
- **`AbortSignal` everywhere** — every wait is cancellable.
- **ESM + CJS** — works in modern and legacy setups, Node ≥ 18.

## Install

```sh
npm install asyncraft
```

## Usage

### `retry(fn, options?)`

Call a function until it succeeds, with exponential backoff and jitter.

```ts
import { retry } from 'asyncraft';

const user = await retry(() => fetchUser(id), {
  retries: 5, // extra attempts after the first (default 3)
  minDelay: 100, // ms before first retry (default 100)
  maxDelay: 10_000, // cap for any single delay (default 10s)
  factor: 2, // exponential growth (default 2)
  jitter: true, // randomize delays to avoid thundering herds (default true)
  shouldRetry: (err) => err instanceof HttpError && err.status >= 500,
  onRetry: (err, attempt, delay) => console.warn(`attempt ${attempt} failed, waiting ${delay}ms`),
});
```

When every attempt fails, a `RetryError` is thrown with the last error as `.cause` and the attempt count as `.attempts`. Pass a `signal` to abort retrying (including mid-delay).

### `withTimeout(promiseOrFn, ms, options?)`

Reject with `TimeoutError` if something takes too long. Pass a function to receive an `AbortSignal` that fires on timeout, so the underlying work is actually cancelled:

```ts
import { withTimeout, TimeoutError } from 'asyncraft';

// simple: race a promise against the clock
const data = await withTimeout(loadData(), 5000);

// better: cancel the underlying work too
const res = await withTimeout((signal) => fetch(url, { signal }), 5000);
```

### `createLimit(concurrency)`

A minimal `p-limit`: run at most N promises at once.

```ts
import { createLimit } from 'asyncraft';

const limit = createLimit(4);
const pages = await Promise.all(urls.map((url) => limit(() => fetch(url))));

limit.activeCount; // running now
limit.pendingCount; // waiting in queue
limit.clearQueue(); // drop everything not yet started
```

### `asyncMap(items, mapper, options?)`

Map over an iterable with bounded concurrency. Results always come back in input order.

```ts
import { asyncMap } from 'asyncraft';

const pages = await asyncMap(urls, (url) => fetch(url), { concurrency: 4 });

// don't fail fast — collect errors per item, like Promise.allSettled
const results = await asyncMap(urls, (url) => fetch(url), { concurrency: 4, settled: true });
for (const r of results) {
  if (r.status === 'fulfilled') use(r.value);
  else report(r.reason);
}
```

### `sleep(ms, options?)`

A cancellable delay.

```ts
import { sleep } from 'asyncraft';

await sleep(1000);
await sleep(60_000, { signal: controller.signal }); // rejects on abort
```

### Composing

The pieces are designed to combine:

```ts
import { asyncMap, retry, withTimeout } from 'asyncraft';

const results = await asyncMap(
  urls,
  (url) =>
    retry(() => withTimeout((signal) => fetch(url, { signal }), 5000), {
      retries: 3,
    }),
  { concurrency: 8, settled: true },
);
```

## API summary

| Export                    | Purpose                                       |
| ------------------------- | --------------------------------------------- |
| `retry(fn, opts?)`        | Exponential-backoff retry with jitter         |
| `withTimeout(p, ms, o?)`  | Time-bound a promise, cancel underlying work  |
| `createLimit(n)`          | Concurrency limiter (`p-limit` style)         |
| `asyncMap(items, fn, o?)` | Ordered async map with bounded concurrency    |
| `sleep(ms, opts?)`        | Cancellable delay                             |
| `TimeoutError`            | Thrown by `withTimeout`                       |
| `RetryError`              | Thrown by `retry` when attempts are exhausted |

## Stability guarantees

These behaviors are pinned by a dedicated test suite (unit + stress +
property-based + type-level; see [TESTING.md](./TESTING.md)) — a change that
breaks any of them fails CI and cannot be published:

- **No timer or listener leaks.** Every `setTimeout` is cleared and every
  `AbortSignal` listener removed once an operation settles or is aborted. A
  long-lived signal can be reused across thousands of calls, and a cancelled
  delay never keeps the process alive.
- **Abort reasons are always throwable.** If `signal.reason` is an `Error` it
  is rethrown as-is; strings and other primitives are wrapped in an `Error`
  named `AbortError` with a readable message.
- **Deterministic retry accounting.** `retry` calls your function exactly
  `retries + 1` times in the worst case. Without jitter, delays follow
  `min(minDelay · factor^(n-1), maxDelay)` and never decrease; with jitter
  each delay stays within `[50%, 100%]` of that value.
- **Order preservation.** `asyncMap` results always match input order, for any
  input and any concurrency (verified with property-based tests).
- **Failure isolation.** A rejecting task frees its `createLimit` slot like
  any other, and `asyncMap`'s `settled` mode reports every item — one failure
  never stalls the queue or hides another result.
- **Typed error surface.** Timeouts throw `TimeoutError`, exhausted retries
  throw `RetryError` (with `.cause` and `.attempts`) — both `instanceof`-able.

All public APIs carry full TSDoc (`@param`, `@throws`, `@remarks`,
`@example`), so the same documentation appears in your editor's IntelliSense.

## Development

```sh
npm install
npm run tdd           # TDD loop: vitest watch mode + live coverage
npm test              # unit + property + type tests
npm run test:coverage # same, plus the coverage gate CI enforces
npm run lint          # eslint (type-checked)
npm run typecheck     # tsc --noEmit
npm run build         # tsup → dist/ (ESM + CJS + d.ts)
```

See [TESTING.md](./TESTING.md) for the TDD workflow and the test-harness
layers (unit / stability / property-based / type tests).

## License

MIT
