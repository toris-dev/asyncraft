# Contributing to asyncraft

Thank you for contributing to asyncraft. This project is intentionally small and strict, so clear and minimal patches are easier to review.

## Ground rules

- Keep PRs focused on one behavior change.
- Prefer readable, simple implementations over clever abstractions.
- Every behavior change should include tests.
- Prefer TypeScript signatures and exported types for public APIs.
- Run the full checks locally before opening a PR.

## Development setup

```sh
npm install
npm run ci
```

`npm run ci` runs lint, typecheck, coverage tests, and build.

## Code style

- `strict` TypeScript settings are required.
- Keep `no`/`true` defaults explicit.
- Add JSDoc comments for public exports.
- Avoid adding dependencies unless they are impossible to avoid for clear value.

## Testing

```sh
npm test
npm run test:coverage
```

If a test depends on timing, keep delays short and deterministic when possible.

## Pull requests

- Include a short explanation and rationale.
- Link to related issues or discussions.
- List changes in behavior, tests, and possible risks.
- Update docs in `README.md` for any API changes.

## Labels for reviews

- `good first issue` for onboarding-friendly tasks.
- `help wanted` when additional domain knowledge is useful.

## Reporting bugs

Open an issue with:

- Reproduction steps
- Expected vs actual behavior
- Environment (`node` version, package version)
- Minimal code sample

## Code of conduct

Please read [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).
