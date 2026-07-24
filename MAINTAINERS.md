# Maintainers

asyncraft follows a lightweight governance model to keep decisions transparent and review speed high.

## Current maintainer

- **Lead maintainer**: `toris` (`https://github.com/toris-dev`)
  - Contacts: `ironjustlikethat@gmail.com`
  - Primary responsibility: final decision-making for releases, API surface changes, and security responses.

## Contributor roles

- **Triager (maintainer or delegated contributor)**
  - Triage incoming issues and discussions.
  - Apply labels (`bug`, `enhancement`, etc.) and request clarifications.
  - Keep bug reports within scope and reproducible.

- **Reviewer**
  - Review PRs for correctness, API consistency, test coverage, and docs impact.
  - Confirm behavior alignment with TypeScript definitions and `CONTRIBUTING.md`.
  - Approve only focused and maintainable patches.

- **Integrator**
  - Merge approved PRs and handle release preparation.
  - Resolve conflicts when maintainer consensus is required.

- **Documentation maintainer**
  - Curate and update user-facing docs, including [README](./README.md), `SUPPORT.md`, and [CONTRIBUTING.md](./CONTRIBUTING.md).
  - Publish practical guidance for recurring questions.

## Decision process

1. New bug reports and feature requests are opened in [GitHub Issues](https://github.com/toris-dev/asyncraft/issues).
2. A triager verifies reproducibility, scope, and missing information.
3. Reviewers evaluate impact and implementation effort.
4. Lead maintainer approves release timing and merge strategy.

## Acceptance criteria for PRs

To reduce review friction and improve merge quality:

- PRs should be behavior-focused and minimal.
- Public API changes must include tests and docs updates.
- Breaking changes require explicit rationale in the PR body and review notes.
- Security-sensitive changes must follow [SECURITY.md](./SECURITY.md).

## Contribution expectations

Anyone can propose changes; maintainers only enforce the standards above and protect project stability.

For contributor workflows, see [CONTRIBUTING.md](./CONTRIBUTING.md).
