---
id: environment-configuration
domain: cross-cutting
category: build-deploy
depends_on:
  - separation-of-concerns
related:
  - ci-cd-pipelines
  - auth-token-storage
  - feature-flags
anti_pattern_of: null
severity: critical
---

# Environment Configuration

## Definition
Environment configuration is the practice of externalizing all settings that differ between environments (development, staging, production) -- database URLs, API keys, feature toggles, log levels -- so that the same code artifact runs in every environment with different configuration injected at runtime.

## Why It Matters
When configuration is hardcoded, you end up with one of two disasters. First: a production database URL in your source code, which means every developer's machine connects to the production database during development (one wrong test run deletes real user data). Second: `if (process.env.NODE_ENV === 'production')` blocks scattered throughout the codebase, creating divergent code paths that behave differently in development and production -- the very thing environments are supposed to prevent. Proper environment configuration means the same built artifact deploys everywhere, configured only by external variables. This makes deployments predictable and secrets secure.

## The Anti-Pattern
A self-taught developer hardcodes configuration values and uses conditional branches based on environment names:

```javascript
// Hardcoded configuration -- secrets in source control
const db = new Database({
  host: 'prod-db.us-east-1.rds.amazonaws.com',  // Production database URL in code
  password: 'supersecret123',                     // Password committed to git
  port: 5432
});

// Environment-based conditionals scattered through the code
function getApiUrl() {
  if (process.env.NODE_ENV === 'production') {
    return 'https://api.myapp.com';
  } else if (process.env.NODE_ENV === 'staging') {
    return 'https://staging-api.myapp.com';
  } else {
    return 'http://localhost:3000';
  }
}

// A .env file committed to the repository
// .gitignore does NOT include .env
```

The production password is now in the git history forever. Every developer has production credentials on their laptop. A leaked laptop means a compromised database.

## Recognition Signal
- Database passwords, API keys, or secrets visible in source files or git history
- `.env` files committed to the repository (check `git log --all -- .env`)
- `if (NODE_ENV === 'production')` or similar conditionals in application logic (not build configuration)
- Different code paths for different environments that are never tested together
- The application cannot be pointed at a different database without changing code and rebuilding
- New developers must ask someone for "the real credentials" to run the app locally
- A single configuration file with commented-out sections for different environments

## Related Concepts
**CI/CD pipelines** consume environment configuration -- the pipeline injects environment-specific variables at each stage (staging secrets for the staging deploy, production secrets for the production deploy). **Auth token storage** on the server side means storing JWT signing secrets and API keys as environment variables, not in source code. **Feature flags** are a form of environment configuration that controls feature availability without code changes, and they benefit from the same externalization pattern.
