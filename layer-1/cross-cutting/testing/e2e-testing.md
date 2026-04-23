---
id: e2e-testing
domain: cross-cutting
category: testing
depends_on:
  - testing-pyramid
  - integration-testing
related:
  - unit-testing
  - test-boundaries
anti_pattern_of: null
severity: important
---

# End-to-End Testing

## Definition
An end-to-end test drives a complete user flow through the running application exactly as a real user would -- launching a browser, clicking buttons, filling forms, and asserting on the visible result.

## Why It Matters
Unit and integration tests verify that pieces and assemblies work correctly, but they cannot catch problems that only appear when the full system is running: a misconfigured reverse proxy that strips headers, a CORS policy that blocks the frontend from calling the API, a CSS z-index that hides a button behind another element, a race condition between frontend navigation and backend data loading. E2e tests are your last line of defense before the user finds the bug. They verify the contract between your frontend and backend, your deployment configuration, and your infrastructure -- the things no other test level can reach.

## The Anti-Pattern
A self-taught developer typically either skips e2e testing entirely or makes it their only testing strategy. In the latter case, every test starts by logging in, navigating through the app, and performing a long sequence of actions. The tests are slow (minutes each), brittle (breaking when a CSS class or button label changes), and flaky (failing due to animation timing, network latency, or test data interference):

```javascript
// An e2e test that tries to do too much
test('full order workflow', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', 'test@example.com');
  await page.fill('#password', 'password123');
  await page.click('#login-button');
  await page.waitForNavigation();
  await page.goto('/products');
  await page.click('.product-card:first-child .add-to-cart');
  await page.click('.product-card:nth-child(3) .add-to-cart');
  await page.goto('/cart');
  await page.click('#checkout');
  await page.fill('#address', '123 Main St');
  await page.fill('#card-number', '4242424242424242');
  await page.click('#place-order');
  await page.waitForSelector('.order-confirmation');
  // If ANY of the above 15 steps changes, this test breaks
  // If it fails on step 12, you don't know if step 1-11 are the real problem
});
```

## Recognition Signal
- E2e tests that take 30+ minutes to run the full suite
- Tests that fail 10-20% of the time with no code changes ("flaky")
- Every e2e test includes login as the first step, duplicating that flow across dozens of tests
- Tests that assert on implementation details (CSS selectors, specific text) rather than user-visible outcomes
- `waitForTimeout(3000)` scattered through tests to handle timing issues
- The e2e suite is the only test suite -- no unit or integration tests exist
- Developers skip the test suite locally and only run it in CI because it takes too long

## Related Concepts
**Unit testing** and **integration testing** are the foundation that allows e2e tests to stay small -- if your business logic and module interactions are tested at lower levels, e2e tests only need to verify the critical paths through the assembled application. **Test boundaries** provides the framework for deciding which user flows deserve e2e tests (the answer: only the critical ones, typically 5-15 flows for most applications). The testing pyramid principle dictates that you should have the fewest tests at this level, covering only what lower levels cannot.
