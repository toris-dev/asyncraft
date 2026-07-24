# Security Policy

If you discover a security issue in asyncraft, please report it privately and do not file it publicly.

## Reporting a vulnerability

- Open a [GitHub Security Advisory](https://github.com/torisKR/asyncraft/security/advisories/new) if you have a GitHub account.
- If you cannot use advisories, email `ironjustlikethat@gmail.com`.

Please include:

- Affected version(s)
- Affected environment (`node`/runtime version, OS, package manager)
- Steps to reproduce
- Minimal proof of concept
- Impact and severity estimate

## Supported versions for security fixes

We only provide security fixes for versions that are in the active maintenance line.

- **Current line:** `0.2.x`
- **Policy:** security fixes are published on the latest patch version of the active line.
- Versions outside the active line are not guaranteed fixes unless a maintainer decides to provide a backport.

## Response and handling timeline

- Acknowledgement: within **5 business days**.
- Initial triage and severity assessment: within **10 business days**.
- Fix window: prioritized by severity; we release the smallest stable patch for the active line as soon as validation is complete.

When a report is accepted, we may ask you to keep details private until the release and advisory are ready.

## Safe disclosure

Please do not post potential vulnerabilities on public issue trackers before a fix is released.
