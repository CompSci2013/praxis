---
id: feature-flags
domain: cross-cutting
category: build-deploy
depends_on:
  - environment-configuration
  - ci-cd-pipelines
related:
  - semantic-versioning
  - testing-pyramid
anti_pattern_of: null
severity: recommended
---

# Feature Flags

## Definition
Feature flags (also called feature toggles) are runtime switches that control whether a feature is active for users -- enabling you to deploy code to production without exposing it, roll out features gradually, and kill a broken feature instantly without a revert and redeploy.

## Why It Matters
Without feature flags, deploying code and releasing a feature are the same event. This means a half-finished feature cannot be merged to main without being visible to users, which leads to long-lived feature branches that diverge from main and create painful merge conflicts. It means you cannot deploy a risky change to 1% of users first to validate it -- you either deploy to everyone or no one. It means a broken feature requires a full revert-and-redeploy cycle, which takes 10-30 minutes, during which all users are affected. Feature flags decouple deployment from release: code is deployed continuously, features are enabled deliberately.

## The Anti-Pattern
A self-taught developer uses long-lived feature branches to isolate work-in-progress. The branch runs for weeks, diverging from main. When it is finally merged, it causes merge conflicts and introduces bugs because the code was developed against an outdated version of main. Alternatively, they hardcode feature visibility with commented-out code or boolean variables that require a code change and deploy to toggle:

```javascript
// "Feature flag" via commented-out code
function Dashboard() {
  return (
    <div>
      <UserStats />
      <RecentOrders />
      {/* TODO: uncomment when ready */}
      {/* <NewRecommendationEngine /> */}
    </div>
  );
}

// "Feature flag" via hardcoded boolean -- requires deploy to change
const ENABLE_NEW_CHECKOUT = false;  // Change to true and deploy when ready

function CheckoutPage() {
  if (ENABLE_NEW_CHECKOUT) {
    return <NewCheckout />;
  }
  return <OldCheckout />;
}
```

Toggling the feature requires a code change, a commit, a CI run, and a deploy -- a 15-minute minimum operation that cannot be performed during an incident without access to the codebase.

## Recognition Signal
- Long-lived feature branches (weeks or months) with painful merges
- Commented-out code blocks with notes like "enable when ready" or "uncomment for v2"
- Hardcoded boolean constants used to toggle features, requiring a deploy to change
- All-or-nothing releases: every user gets the feature simultaneously, with no gradual rollout
- Reverting a broken feature requires a git revert and a full deployment cycle
- No runtime configuration system for enabling/disabling features per user, per environment, or per percentage
- Product managers cannot control feature visibility without developer involvement

## Related Concepts
**Environment configuration** provides the mechanism for feature flags -- flags are a specific type of runtime configuration that controls feature visibility. **CI/CD pipelines** make feature flags practical: frequent deployments mean code behind flags reaches production quickly, and the flag controls when users see it. **Semantic versioning** interacts with feature flags in library code: a new feature behind a flag ships in a minor version, and enabling the flag does not require a version bump. **The testing pyramid** should include tests for both flag states -- a feature behind a flag needs tests for the flag-on and flag-off paths.
