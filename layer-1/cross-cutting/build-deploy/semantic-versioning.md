---
id: semantic-versioning
domain: cross-cutting
category: build-deploy
depends_on: []
related:
  - ci-cd-pipelines
  - feature-flags
  - environment-configuration
anti_pattern_of: null
severity: important
---

# Semantic Versioning

## Definition
Semantic versioning (semver) communicates the impact of a change through a three-part version number -- MAJOR.MINOR.PATCH -- where MAJOR signals breaking changes, MINOR signals new backwards-compatible features, and PATCH signals backwards-compatible bug fixes.

## Why It Matters
Without semantic versioning, updating a dependency is a gamble. Is version 2.3 to 2.4 a safe update, or did they rename half the API? Is 1.0.0 to 2.0.0 a complete rewrite, or did someone just feel like incrementing the major version? Semver creates a shared contract between library authors and consumers: a patch update will not break your code, a minor update adds features but will not break existing usage, and a major update may require changes on your end. This contract enables automated dependency updates (Dependabot, Renovate), lock file strategies (`^1.2.3` in package.json means "any compatible 1.x"), and rational decisions about when to update. Without it, every update requires manual testing because the version number carries no semantic information.

## The Anti-Pattern
A self-taught developer either increments version numbers arbitrarily (based on "feels like a big release" rather than change impact) or never versions at all (the API just changes, and consumers discover breakage when their code stops working):

```json
// package.json with meaningless versions
{
  "version": "3.0.0"
  // Was 2.9.0 -> 3.0.0 because "we had enough small changes"
  // No actual breaking change occurred
  // Meanwhile, 2.7.0 -> 2.8.0 renamed a core function (actual breaking change)
  // Consumers who trusted the version scheme got burned
}

// Or: no versions at all
// The "API" is a shared repo that other teams import from main
// Breaking changes appear as surprise test failures in downstream repos
// "Just use the latest commit" is the versioning strategy
```

Another common mistake is breaking the public API in a patch release because the developer does not distinguish between "internal refactor" (patch) and "changed the function signature" (major).

## Recognition Signal
- Version numbers that jump from 1.0 to 2.0 without any breaking changes
- Breaking changes shipped in minor or patch versions
- No CHANGELOG or release notes explaining what changed in each version
- Downstream consumers pinning exact versions (`"dependency": "2.3.1"`) out of fear because minor updates have broken them before
- The version field in package.json is `"1.0.0"` and has never been changed despite 200 commits
- No tags in the git history corresponding to releases
- Internal libraries with no versioning -- consumers import from `main` or `latest`

## Related Concepts
**CI/CD pipelines** can automate version bumping based on commit message conventions (Conventional Commits: `feat:` bumps minor, `fix:` bumps patch, `BREAKING CHANGE:` bumps major) and automatically publish releases with changelogs. **Feature flags** interact with versioning: a new feature behind a flag can ship in a minor version because existing behavior is unchanged until the flag is enabled. **Environment configuration** connects in library distribution: versioned packages allow different environments to pin different versions during migration.
