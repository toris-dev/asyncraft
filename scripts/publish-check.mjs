import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const canonical = "https://github.com/torisKR/asyncraft";
const checks = [];
const log = [];

function expect(condition, message) {
  if (condition) {
    log.push(`[ok] ${message}`);
    return;
  }
  checks.push(`[fail] ${message}`);
}

expect(
  pkg.repository?.url === `git+${canonical}.git`,
  `repository.url is canonical (got ${pkg.repository?.url})`
);
expect(
  pkg.bugs?.url === `${canonical}/issues`,
  `bugs.url is canonical (got ${pkg.bugs?.url})`
);
expect(
  pkg.homepage === `${canonical}#readme`,
  `homepage is canonical (got ${pkg.homepage})`
);

const token = process.env.NPM_TOKEN;
expect(!!token, "NPM_TOKEN is set");

if (token) {
  try {
    const userResponse = await fetch("https://registry.npmjs.org/-/npm/v1/user", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!userResponse.ok) {
      if (userResponse.status === 403) {
        checks.push(
          "[fail] NPM token verification failed (403). Use an Automation/Public/Publish token (not read-only) and retry."
        );
      } else {
        checks.push(
          `[fail] NPM token verification failed (HTTP ${userResponse.status} ${userResponse.statusText})`
        );
      }
    } else {
      const user = await userResponse.json();
      log.push(`[ok] npm token resolves to ${user.name}`);
      if (pkg.name) {
        try {
          const latest = execSync(`npm view ${pkg.name} dist-tags.latest --json`, {
            encoding: "utf8",
          }).trim();
          log.push(`[ok] npm latest tag is ${latest}`);
        } catch (e) {
          checks.push(`[fail] cannot read npm dist-tags for ${pkg.name}`);
        }
      }
      try {
        const version = execSync(`npm view ${pkg.name}@${pkg.version} version --json`, {
          encoding: "utf8",
        }).trim();
        if (version.includes(pkg.version)) {
          checks.push(
            `[fail] version ${pkg.version} already exists on npm registry (${pkg.name})`
          );
        }
      } catch (e) {
        log.push(`[ok] version ${pkg.version} does not yet exist on npm`);
      }
    }
  } catch (error) {
    checks.push(`[fail] NPM token verification command failed: ${error.message}`);
  }
}

for (const row of log) {
  console.log(row);
}
for (const row of checks) {
  console.error(row);
}

if (checks.length > 0) {
  console.error(`[publish-check] failed with ${checks.length} issue(s).`);
  process.exit(1);
}

console.log("[publish-check] ready to publish.");
