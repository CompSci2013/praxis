---
id: unit-testing
domain: cross-cutting
category: testing
depends_on:
  - testing-pyramid
  - separation-of-concerns
related:
  - integration-testing
  - test-boundaries
  - single-responsibility
anti_pattern_of: null
severity: critical
---

# Unit Testing

## Definition
A unit test verifies a single function, method, or class in complete isolation from external systems -- no database, no network, no filesystem, no other services.

## Why It Matters
Unit tests are the fastest feedback loop a developer has. They run in milliseconds, so you can run them after every change. They are deterministic -- no network timeouts, no database state to set up, no race conditions. When a unit test fails, it points to exactly one thing that broke. This speed and precision compound over time: a codebase with strong unit tests lets developers refactor fearlessly because they know within seconds whether they broke something. Without unit tests, developers avoid changing working code even when it is poorly structured, because they have no safety net.

## The Anti-Pattern
A self-taught developer typically conflates "unit tests" with "tests I write with a test framework." They write a test that spins up a database, seeds it with data, calls a function that queries the database, and asserts on the result. This is an integration test wearing a unit test's name. It is slow, requires infrastructure, and fails for reasons unrelated to the logic under test (database connection timeout, seed data drift, port conflicts):

```python
# This is not a unit test -- it depends on a real database
def test_calculate_discount():
    db.connect('localhost:5432/test_db')
    db.seed('fixtures/products.sql')
    product = ProductService.get_by_id(42)      # Hits the database
    discount = product.calculate_discount(100)    # This is the actual logic we want to test
    assert discount == 15
    db.teardown()
```

The logic `calculate_discount(100) == 15` can be tested in microseconds with no database at all. The database dependency is incidental, not essential, to verifying the discount calculation.

```python
# This is a unit test -- isolated, fast, deterministic
def test_calculate_discount():
    product = Product(price=100, category='electronics', tier='gold')
    assert product.calculate_discount(100) == 15
```

## Recognition Signal
- "Unit tests" that require Docker, a database, or network access to run
- Test setup that takes more lines than the assertion itself
- Tests that fail when another developer's test changes shared database state
- A test suite that takes minutes when it should take seconds
- Tests that cannot run offline or on a fresh machine without infrastructure setup
- Logic that *could* be tested in isolation but is buried inside a database call or API handler, making isolation impossible without extraction

## Related Concepts
**Integration testing** is the correct name for tests that involve real external dependencies -- understanding the difference prevents the common mistake of slow "unit" tests. **Test boundaries** helps you decide which functions deserve unit tests (pure logic, calculations, transformations) versus which behaviors are better verified at the integration level. **Single responsibility** and **separation of concerns** are prerequisites for effective unit testing: you can only test a function in isolation if it *does* one thing in isolation. Code that tangles logic with I/O is untestable at the unit level without mocking everything.
