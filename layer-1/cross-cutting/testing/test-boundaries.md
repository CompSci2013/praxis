---
id: test-boundaries
domain: cross-cutting
category: testing
depends_on:
  - testing-pyramid
  - unit-testing
  - integration-testing
related:
  - e2e-testing
  - separation-of-concerns
  - single-responsibility
anti_pattern_of: null
severity: important
---

# Test Boundaries

## Definition
Test boundaries define what is worth testing and at which level -- the discipline of writing tests that catch real bugs without creating a maintenance burden that makes the team abandon testing entirely.

## Why It Matters
Writing the wrong tests is often worse than writing no tests. Tests that verify implementation details (how the code works internally) break every time you refactor, even when behavior is unchanged. This creates a perverse incentive: refactoring becomes expensive because it breaks dozens of tests that were testing internal wiring rather than outcomes. Developers stop refactoring. Code quality degrades. Eventually the team decides "tests slow us down" and abandons them. Good test boundaries prevent this by focusing tests on behavior (what the code does for its callers) rather than implementation (how it does it internally).

## The Anti-Pattern
A self-taught developer typically tests one of two wrong things. First, they test implementation details: asserting that a function was called with specific arguments, that a private method ran in a certain order, or that an internal data structure has a specific shape. Second, they test trivial getters and setters that cannot possibly be wrong, inflating test counts without catching bugs:

```javascript
// Testing implementation details -- this test will break on every refactor
describe('ShoppingCart', () => {
  it('should add item to internal array', () => {
    const cart = new ShoppingCart();
    cart.addItem({ id: 1, price: 10 });
    // Testing internal structure, not behavior
    expect(cart._items).toHaveLength(1);
    expect(cart._items[0]).toEqual({ id: 1, price: 10 });
  });
});

// Testing trivial code -- this test catches nothing
describe('User', () => {
  it('should set name', () => {
    const user = new User();
    user.setName('Alice');
    expect(user.getName()).toBe('Alice');
  });
});

// What should actually be tested: behavior and edge cases
describe('ShoppingCart', () => {
  it('should calculate total with quantity discounts', () => {
    const cart = new ShoppingCart();
    cart.addItem({ id: 1, price: 10, qty: 5 });
    // Behavior: the discount kicks in at qty >= 3
    expect(cart.getTotal()).toBe(45); // 5 * 10 * 0.9
  });
});
```

## Recognition Signal
- Tests that break when you refactor code without changing its behavior
- Tests that assert on private fields, internal arrays, or method call counts
- Test names that describe implementation ("should call `calculateTax` with `rate`") rather than behavior ("should apply 8% tax to orders in California")
- Near-100% code coverage but bugs still reaching production regularly
- Tests for trivial code (plain getters/setters, simple pass-through functions) while complex business logic has no tests
- Developers saying "I need to update 30 tests" after a straightforward refactor that did not change any external behavior

## Related Concepts
**The testing pyramid** provides the vertical axis of test boundaries (which level), while this concept provides the horizontal axis (what to test at each level). **Separation of concerns** and **single responsibility** make good test boundaries possible -- when logic is separated from I/O, you can test the logic at the unit level and the I/O integration at the integration level. **Unit testing**, **integration testing**, and **e2e testing** each have different boundary rules: unit tests should test pure logic and edge cases, integration tests should test component interactions and data flow, and e2e tests should test critical user journeys only.
