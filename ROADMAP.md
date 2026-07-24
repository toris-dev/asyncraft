# Roadmap

## Mission

asyncraft aims to make resilient async patterns easy to adopt in production by providing small, composable primitives with predictable behavior and clear TypeScript types.

## Why this matters for the open-source community

- Reduce duplicate concurrency/retry/timeout logic across projects.
- Improve reliability of small and medium-size teams through shared, reviewed primitives.
- Make operational async behavior easier to audit and test.

## Short-term goals (0.2.x)

- Expand docs with migration examples from raw Promise patterns to asyncraft.
- Add examples for rate-limited APIs and queue workloads.
- Improve troubleshooting guides for retry tuning and cancellation.

## Medium-term goals (0.3.x)

- Publish a minimal API policy for backward-compatible evolution.
- Add observability-friendly hooks (structured retry logs and callback context).
- Add benchmark notes around common workloads (IO-bound vs CPU-bound).

## Long-term vision (1.x)

- Keep API surface stable while adding convenience helpers for common async orchestration patterns.
- Create a small plugin surface for custom retry/cancel policies.
- Build a public contribution working group for RFC-style proposals.
