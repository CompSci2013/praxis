---
id: error-propagation
domain: cross-cutting
category: error-handling
depends_on:
  - separation-of-concerns
  - error-boundaries
related:
  - error-typing
  - user-vs-developer-errors
  - structured-logging
anti_pattern_of: null
severity: critical
---

# Error Propagation

## Definition
Error propagation is how errors travel from the point where they occur through the layers of an application to the point where they are handled -- and the decisions you make about transforming, wrapping, or enriching them along the way.

## Why It Matters
An error that occurs three layers deep (a database constraint violation inside a repository called by a service called by a controller) must travel through each layer to reach the user. If you swallow it in the middle, the caller has no idea something went wrong. If you let raw database errors leak to the API response, you expose implementation details and confuse your users. If you re-throw without adding context, the developer debugging the error at 2am has a stack trace that says "null is not an object" with no clue which of 47 database calls produced it. Propagation strategy determines whether errors are debuggable, secure, and actionable.

## The Anti-Pattern
A self-taught developer typically does one of three things. First: swallowing errors silently, usually with an empty catch block or a catch that only logs. The calling code never knows the operation failed. Second: letting raw errors bubble unchanged, so a Postgres `unique_violation` error with table names and column details ends up in an API response. Third: catching and re-throwing a new generic error that destroys all context:

```python
# Context destruction -- the original error is gone
def get_user(user_id):
    try:
        return db.query(User).filter_by(id=user_id).one()
    except Exception:
        raise Exception("Failed to get user")  # Which user? Why? What was the original error?

# Silent swallowing -- caller assumes success
def update_inventory(product_id, quantity):
    try:
        db.execute("UPDATE products SET stock = %s WHERE id = %s", (quantity, product_id))
    except Exception as e:
        logger.error(e)  # Logged but not propagated. Caller thinks the update worked.
```

## Recognition Signal
- Empty catch blocks or catch blocks that only log
- API responses exposing database error messages, table names, or SQL fragments
- Error messages that say "something went wrong" with no way to trace back to the cause
- Re-thrown errors that discard the original error's message or stack trace
- The same error logged multiple times as it passes through each layer (log-and-rethrow at every level)
- Debugging sessions that require adding temporary `console.log` statements because the error chain provides no context

## Related Concepts
**Error boundaries** are the destinations where propagated errors arrive -- propagation is the journey, boundaries are the destination. **Error typing** enables intelligent propagation: a typed error can carry structured context (which user, which operation, which constraint) instead of just a string message. **User vs developer errors** determines the transformation at the boundary: the raw propagated error becomes either a user-facing message or a developer diagnostic. **Structured logging** is how you capture the full propagation chain for later debugging without leaking it to the user.
