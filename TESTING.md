# Testing & TDD guide

This repo ships a four-layer test harness. Every layer runs in CI and gates
publishing (`prepublishOnly`), so a red harness can never reach npm.

## The TDD loop

```sh
npm run tdd
```

Starts vitest in watch mode **with live coverage**. The intended rhythm:

1. **Red** — write a failing test first. Pick the layer that matches the claim
   you are making (see below). Watch mode re-runs on save.
2. **Green** — implement the minimum in `src/` that makes it pass.
3. **Refactor** — clean up with the suite still green. The coverage gate and
   type tests catch anything you break along the way.

One-shot equivalents: `npm test` (unit + property + type tests) and
`npm run test:coverage` (same, plus the coverage gate — what CI runs).

## The four layers

| Layer           | Where                          | What it pins down                                                                                                                                                                                           |
| --------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests      | `tests/*.test.ts` (per module) | Observable behavior of each API: return values, error types, abort semantics, backoff arithmetic.                                                                                                           |
| Stability tests | `tests/stability.test.ts`      | Runtime guarantees: listener/timer cleanup, abort-reason wrapping, queue integrity under failures, 500–1000-task stress runs, edge cases (`sleep(0)`, empty iterables, sync throws).                        |
| Property tests  | `tests/property.test.ts`       | Invariants over generated inputs (fast-check): order preservation for any array/concurrency, exact attempt counts, backoff monotonicity, jitter bounds, concurrency never exceeding its limit.              |
| Type tests      | `tests/types/*.test-d.ts`      | The public type surface: generic inference, overload resolution (`settled: true` → `SettledResult[]`), readonly fields, rejected invalid options. Compiled, not executed — a loosened type fails the build. |

### Choosing a layer when adding a feature

- "Given X it returns/throws Y" → **unit test**.
- "It never leaks / always cleans up / survives N tasks" → **stability test**.
- "For _any_ input, P holds" → **property test**. Prefer this over piles of
  hand-picked examples; on failure fast-check prints a shrunk counterexample
  and a seed you can pass back via `fc.assert(prop, { seed })` to reproduce.
- "Consumers should infer/see this type" → **type test**. Use
  `expectTypeOf` for positive claims and `// @ts-expect-error` for things
  that must not compile.

## Coverage gate

`npm run test:coverage` enforces thresholds set in `vitest.config.ts`
(98% statements/lines, 95% branches, 100% functions). They are calibrated to
the current suite — if you add code, add tests that cover it, and feel free to
raise the bar. The only known-unreachable line is the closing brace of
`retry`'s infinite loop, which v8 coverage miscounts.

## CI

`.github/workflows/ci.yml` runs typecheck, lint, format check, the full test
harness with the coverage gate, and the build on Node 18/20/22. The release
workflow (`release.yml`) repeats all of it via `prepublishOnly` before
publishing to npm.
