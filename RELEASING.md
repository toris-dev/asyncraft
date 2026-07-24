# Release Process

This project uses manual, tag-based releases.

## Pre-release checks

1. Create a release PR from a dedicated branch.
2. Update [`CHANGELOG.md`](./CHANGELOG.md) under a new version heading.
3. Update docs and examples if user-visible behavior changed.
4. Run local checks before merging:

- `npm run lint`
- `npm run typecheck`
- `npm run test:coverage`
- `npm run build`

## Release steps

1. Merge the release PR to `main`.
2. Create a git tag using the package version (for example `v0.1.1`) on `main`.
3. Create a GitHub Release with release notes that mirror the `CHANGELOG` section.
4. Publish the GitHub Release to trigger automatic publishing (`workflow_dispatch` can also be used).

## Post-release

1. Verify npm package metadata and files published from `files` field.
2. Confirm the new badge/build status is healthy in `[README](./README.md)`.
3. If regressions are found, open a hotfix PR and prepare an immediate patch release.

## Release permissions

- `NPM_TOKEN` must be available as repository secret for `npm publish`.
- `id-token: write` is required for `--provenance`.
