import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Type-level tests run alongside unit tests on every `vitest run`.
    typecheck: {
      enabled: true,
      include: ['tests/types/**/*.test-d.ts'],
      tsconfig: './tsconfig.json',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // Gate: fails `npm run test:coverage` (and CI) when coverage regresses.
      // Not a flat 100 because v8 counts the unreachable closing brace of
      // retry's infinite for-loop as an uncovered line.
      thresholds: {
        statements: 98,
        branches: 95,
        functions: 100,
        lines: 98,
      },
    },
  },
});
