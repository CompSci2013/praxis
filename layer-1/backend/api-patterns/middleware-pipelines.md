---
id: middleware-pipelines
domain: backend
category: api-patterns
depends_on:
  - separation-of-concerns
related:
  - api-gateway-pattern
  - request-response-transformation
  - error-boundaries
anti_pattern_of: null
severity: critical
---

# Middleware Pipelines

## Definition
A chain of composable processing steps that a request passes through before reaching your handler -- and that the response passes through on the way back out -- each step responsible for exactly one concern like authentication, logging, error handling, or input transformation.

## Why It Matters
Without middleware, every route handler must independently validate auth tokens, log request details, catch errors, parse input, set security headers, and handle CORS. This means every new endpoint is an opportunity to forget one of those steps. Authentication gets skipped on one route. Error responses have different shapes depending on who wrote the handler. Logging is inconsistent. Security headers appear on 90% of responses. Middleware makes these guarantees structural rather than relying on developer discipline.

## The Anti-Pattern
A self-taught developer typically inlines all cross-cutting logic at the top of every route handler. The same try/catch block, the same token verification, the same logging call -- copied and slightly modified in each handler. When a bug is found in the auth check, it gets fixed in the handler someone is looking at but not in the other fifteen.

```python
# Every handler repeats the same boilerplate
@app.route('/orders', methods=['GET'])
def get_orders():
    # Auth check (copy-pasted everywhere)
    token = request.headers.get('Authorization')
    if not token:
        return {'error': 'Unauthorized'}, 401
    try:
        user = verify_jwt(token)
    except InvalidToken:
        return {'error': 'Bad token'}, 401

    # Logging (copy-pasted everywhere)
    logger.info(f'{user.id} GET /orders')

    try:
        # Actual business logic -- the only unique part
        orders = db.query(Order).filter_by(user_id=user.id).all()
        return {'orders': [o.to_dict() for o in orders]}
    except Exception as e:
        # Error handling (copy-pasted everywhere, inconsistent format)
        logger.error(f'Error: {e}')
        return {'error': 'Something went wrong'}, 500

# 30 more handlers with the same 15 lines of boilerplate before the real logic
```

Compare to the middleware approach:
```python
# Each concern handled once, applied globally
app.use(cors_middleware)
app.use(auth_middleware)       # Rejects 401 before any handler runs
app.use(request_logger)        # Logs every request consistently
app.use(error_handler)         # Catches all unhandled errors, formats response

@app.route('/orders', methods=['GET'])
def get_orders():
    # Only business logic remains
    orders = db.query(Order).filter_by(user_id=request.user.id).all()
    return {'orders': [o.to_dict() for o in orders]}
```

## Recognition Signal
- The same 5-15 lines of boilerplate appear at the top of every route handler
- Auth checks exist in handlers but not in middleware -- meaning a missing check is a security hole
- Error responses have different JSON shapes depending on which handler threw the error
- Logging is inconsistent: some routes log request/response, others don't
- Adding a new cross-cutting requirement (like request ID tracking) means touching every handler
- Security headers are set manually in some handlers and forgotten in others

## Related Concepts
**Separation of concerns** is the principle that middleware embodies -- each middleware handles exactly one concern. **API gateway pattern** uses middleware pipelines as its internal mechanism for processing requests. **Request-response transformation** is often implemented as a middleware step that reshapes data between boundaries. **Error boundaries** are closely related: a well-placed error-handling middleware acts as the final catch-all that ensures no unhandled exception leaks raw stack traces to clients.
