---
id: integration-testing
domain: cross-cutting
category: testing
depends_on:
  - testing-pyramid
  - unit-testing
related:
  - e2e-testing
  - test-boundaries
  - error-boundaries
anti_pattern_of: null
severity: important
---

# Integration Testing

## Definition
An integration test verifies that multiple components work together correctly when connected to their real (or realistic) dependencies -- a real database, a real message queue, a real filesystem -- without driving the test through the full user interface.

## Why It Matters
Unit tests verify that individual pieces work in isolation. But software fails at the seams. The function that builds the SQL query works perfectly. The function that parses the result set works perfectly. But the query returns columns in a different order than the parser expects, and production breaks. Integration tests catch these boundary failures: schema mismatches between layers, serialization bugs, transaction isolation surprises, connection pool exhaustion under load, and the hundred other ways that components fail when composed. Skipping integration tests means your first integration test is production.

## The Anti-Pattern
A self-taught developer typically skips this level entirely. They have unit tests (or what they call unit tests) and maybe some e2e tests, but nothing in between. When they do write integration tests, they mock the very thing they should be testing:

```javascript
// "Integration" test that mocks the database -- this tests nothing useful
describe('UserRepository', () => {
  it('should find a user by email', async () => {
    const mockDb = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 1, email: 'a@b.com' }] })
    };
    const repo = new UserRepository(mockDb);
    const user = await repo.findByEmail('a@b.com');
    expect(user.email).toBe('a@b.com');
    expect(mockDb.query).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE email = $1', ['a@b.com']
    );
  });
});
```

This test verifies that `findByEmail` calls `query` with a specific string. It does not verify that the SQL actually works, that the column names match the entity fields, or that the query plan is efficient. If someone renames a column in the database, this test still passes while production breaks.

## Recognition Signal
- A mocked database in a test named "integration" -- the integration is the point, mocking it defeats the purpose
- Zero tests that actually connect to a database, even a test-specific one
- Bugs that consistently appear at module boundaries (data shape mismatches, encoding issues, transaction failures) despite good unit test coverage
- "It works in tests but fails in staging" as a recurring complaint
- No `docker-compose.test.yml` or test container setup anywhere in the project
- Tests that verify mock call signatures rather than actual behavior

## Related Concepts
**Unit testing** covers isolated logic; integration testing covers composed behavior. The boundary between them is whether external systems are real or faked. **E2e testing** goes further by testing through the UI; integration tests exercise the same backend paths but skip the browser overhead. **Test boundaries** guides which behaviors belong at the integration level: anything where the correctness depends on the interaction between two components rather than the logic of either one alone. **Error boundaries** are especially important to integration-test because error propagation across component boundaries is where many bugs hide.
