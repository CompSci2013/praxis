---
id: api-error-contracts
domain: architecture
category: api-design
depends_on:
  - rest-principles
  - encapsulation
related:
  - interface-segregation
  - layered-architecture
  - error-boundaries
  - idempotency
anti_pattern_of: null
severity: important
---

# API Error Contracts

## Definition
Every API should return errors in a consistent, typed shape that clients can parse programmatically -- the error format is a contract just as important as the success format.

## Why It Matters
When error responses are inconsistent, every client must handle errors with special-case logic per endpoint. One endpoint returns `{"error": "Not found"}`, another returns `{"message": "Resource not found", "code": 404}`, a third returns `{"errors": [{"field": "email", "msg": "invalid"}]}`. The frontend developer writes three different error handlers, misses edge cases, and the user sees raw JSON error objects in the UI or -- worse -- the app crashes silently on an error shape it did not expect.

Consistent error contracts make client code reliable and maintainable. The client has one error handler that works for every endpoint. Validation errors include field names so forms can highlight the right input. Rate limit errors include retry-after headers so clients can back off. Internal errors include correlation IDs so support tickets can be traced.

## The Anti-Pattern
Self-taught developers typically return whatever the framework or library gives them by default, with no standardization across endpoints.

```python
# Endpoint 1: Returns a string
@app.route('/api/users/<id>')
def get_user(id):
    user = db.get_user(id)
    if not user:
        return "User not found", 404

# Endpoint 2: Returns a different object shape
@app.route('/api/orders', methods=['POST'])
def create_order():
    try:
        order = process_order(request.json)
        return jsonify(order), 201
    except ValueError as e:
        return jsonify({"msg": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500
        # ^ Leaks internal stack traces to clients

# Endpoint 3: Returns yet another shape
@app.route('/api/products')
def search_products():
    if not request.args.get('q'):
        return jsonify({"errors": [{"param": "q", "message": "required"}]}), 422
```

Three endpoints, three different error shapes. Also note: endpoint 2 leaks stack traces to clients, which is both a security vulnerability and useless to the consumer.

**A consistent error contract looks like this:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields failed validation",
    "details": [
      { "field": "email", "message": "Must be a valid email address" },
      { "field": "age", "message": "Must be at least 18" }
    ],
    "request_id": "req_abc123"
  }
}
```

Every error, from every endpoint, follows this shape. The `code` is machine-readable (clients can switch on it). The `message` is human-readable (for logging and debugging). The `details` array is present only for validation errors. The `request_id` correlates to server logs. HTTP status codes are used correctly (400 for client errors, 500 for server errors).

## Recognition Signal
- Frontend code with endpoint-specific error handling: `if (endpoint === '/users') { /* handle this shape */ }`
- Error responses that include stack traces, internal class names, or database error messages
- Clients that show raw error strings to users because they cannot reliably extract a display message
- No machine-readable error codes -- only human-readable messages, which break when wording changes
- Error shapes that differ between validation errors, auth errors, and not-found errors within the same API
- No `request_id` or correlation ID -- support cannot trace a user's complaint to a specific server log entry
- Tests that only test success paths because error shapes are too unpredictable to assert on

## Related Concepts
**REST principles** define the HTTP status codes used alongside error responses. Status codes and error bodies work together: the status code tells the client *what category* of error (4xx client, 5xx server), the body tells it *what specifically happened*. **Encapsulation** applies to errors: the client should see a clean error shape, never raw internal exceptions or database errors. **Interface segregation** informs error design: different error consumers (frontend UI, monitoring, support) need different error fields, but a well-designed error shape serves all three. **Layered architecture** determines where errors are translated: business exceptions from the domain layer are caught and mapped to API error responses in the presentation layer. **Error boundaries** are the frontend counterpart -- they catch JavaScript exceptions and present clean error UI. **Idempotency** interacts with errors: when a request fails, the error response should tell the client whether it is safe to retry.
