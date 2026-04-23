---
id: ci-cd-pipelines
domain: cross-cutting
category: build-deploy
depends_on: []
related:
  - testing-pyramid
  - environment-configuration
  - feature-flags
  - semantic-versioning
  - bundle-analysis
  - metrics
anti_pattern_of: null
severity: critical
---

# CI/CD Pipelines

## Definition
Continuous Integration (CI) automatically builds and tests code on every push, and Continuous Deployment (CD) automatically delivers validated code to staging or production -- replacing manual build scripts, manual testing, and manual deployment with an automated, repeatable pipeline.

## Why It Matters
Without CI/CD, deployment is a ceremony. Someone runs the build locally, someone else runs the tests (maybe), someone copies files to a server, someone restarts the process, and everyone holds their breath. This process is slow (discouraging frequent releases), error-prone (missing a step causes outages), and unrepeatable (the deployment depends on one person's machine configuration and tribal knowledge). With CI/CD, every push triggers the same sequence: install dependencies, run linters, run tests, build artifacts, deploy to staging, run smoke tests, promote to production. If any step fails, the pipeline stops and notifies the team. Deployments become boring and frequent -- which is exactly what you want.

## The Anti-Pattern
A self-taught developer deploys by SSH-ing into a server and running `git pull && npm install && npm run build && pm2 restart all`. There are no automated tests, or they run locally "when I remember to." The build works on their machine but fails in production because of a different Node version, missing environment variable, or OS-level dependency. There is no rollback strategy -- if the deploy breaks, they SSH in again and try to undo it manually:

```bash
# The "deployment pipeline" -- SSH and pray
ssh production-server
cd /var/www/myapp
git pull origin main
npm install          # What if a dependency broke? What if node_modules is corrupted?
npm run build        # What if the build fails halfway and leaves partial artifacts?
pm2 restart all      # What if the new code crashes on startup?
# "Rollback": git checkout HEAD~1 && npm install && npm run build && pm2 restart all
# Hope you remember which commit was the last good one
```

No one knows which commit is running in production. No one knows if the tests pass. The deployment requires SSH access, which means it cannot be performed by a junior developer or triggered automatically. Deploying on Friday afternoon is terrifying.

## Recognition Signal
- Deployment requires SSH access to a production server
- The deployment process is documented in a wiki or not documented at all
- Only one person knows how to deploy ("bus factor of one")
- Tests are run locally (or not at all) rather than triggered automatically
- No `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, or equivalent in the repository
- "Works on my machine" is a recurring problem
- Deploys happen infrequently (monthly or less) because they are risky and painful
- No way to answer "which commit is running in production right now?"

## Related Concepts
**The testing pyramid** defines what the CI pipeline runs: unit tests first (fast feedback), then integration tests, then a small e2e smoke suite. The pipeline embodies the pyramid. **Environment configuration** is a prerequisite -- the pipeline must inject the correct configuration for each environment (staging, production) without hardcoded secrets in the repository. **Feature flags** enable CI/CD by decoupling deployment from release: you can deploy code to production behind a flag and enable it later, reducing deployment risk. **Semantic versioning** communicates the nature of changes flowing through the pipeline. **Bundle analysis** checks can run in the pipeline to prevent size regressions. **Metrics** feed back into the pipeline for automated deploy validation.
