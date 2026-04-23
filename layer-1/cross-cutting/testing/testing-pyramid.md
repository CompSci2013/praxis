---
id: testing-pyramid
domain: cross-cutting
category: testing
depends_on:
  - separation-of-concerns
related:
  - unit-testing
  - integration-testing
  - e2e-testing
  - test-boundaries
anti_pattern_of: null
severity: critical
---

# Testing Pyramid

## Definition
The testing pyramid is a strategy for distributing tests across three levels -- many fast unit tests at the base, fewer integration tests in the middle, and a small number of end-to-end tests at the top -- to maximize confidence while minimizing feedback time and maintenance cost.

## Why It Matters
Tests that take 45 minutes to run do not get run. Tests that break every time the UI changes get ignored. Tests that never catch real bugs get deleted. Without a deliberate distribution strategy, teams end up with either no tests (moving fast until production breaks) or the wrong tests (a massive e2e suite that is slow, flaky, and expensive to maintain). The pyramid shape exists because each level has a different cost-to-confidence ratio. Unit tests are cheap, fast, and stable. E2e tests are expensive, slow, and brittle. You want the most coverage from the cheapest level and only use expensive tests for things cheap tests cannot verify.

## The Anti-Pattern
A self-taught developer typically writes tests in one of two broken patterns. The "ice cream cone" inverts the pyramid: zero unit tests, a few integration tests, and a massive Cypress/Playwright suite that clicks through every user flow. The suite takes 20 minutes, fails randomly due to timing issues, and nobody trusts the results. Alternatively, the developer writes no tests and relies on manual testing -- clicking through the app after every change, missing edge cases, and shipping regressions.

```
The Ice Cream Cone (inverted pyramid):

    Manual Testing         <-- most effort here
   ████████████████
  ████████████████████     <-- large, slow e2e suite
   ██████████████████
      ████████████         <-- some integration
        ████████
          ████             <-- almost no unit tests
```

The e2e tests duplicate each other heavily (every test logs in, navigates, waits for loading), and when one flakes, it blocks the entire deployment pipeline.

## Recognition Signal
- CI pipeline takes 20+ minutes and most of that time is browser-based tests
- Tests that fail intermittently ("flaky tests") are a normal part of the workflow
- Developers re-run the pipeline hoping for green rather than investigating failures
- No test files adjacent to business logic files -- tests only exist in a top-level `e2e/` or `cypress/` directory
- A single test file that sets up a browser, logs in, and then checks 15 different things in sequence
- Adding a unit test feels impossible because business logic is entangled with UI or database code

## Related Concepts
**Unit testing** forms the pyramid's base -- fast, isolated tests that verify individual functions and classes. **Integration testing** occupies the middle -- verifying that modules work together correctly with real (or realistic) dependencies. **E2e testing** sits at the top -- verifying complete user flows through the running application. **Test boundaries** guides the decision of what belongs at each level: pure logic at the unit level, module interactions at the integration level, and critical user journeys at the e2e level.
