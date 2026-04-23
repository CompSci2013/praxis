---
id: idempotency
domain: architecture
category: api-design
depends_on:
  - rest-principles
related:
  - api-error-contracts
  - api-versioning
  - state-management-patterns
anti_pattern_of: null
severity: critical
---

# Idempotency

## Definition
An operation is idempotent if performing it multiple times produces the same result as performing it once -- the system ends up in the same state regardless of how many times the request is sent.

## Why It Matters
Networks are unreliable. Requests time out. Clients retry. Load balancers re-send. Mobile apps double-tap. Browsers resubmit forms. If your API is not idempotent where it should be, these routine events create duplicate records, double charges, multiple emails, and inconsistent state. These are not edge cases -- they are the normal operating conditions of distributed systems.

A customer places an order, the request times out, the client retries, and two orders are created with two credit card charges. This is a real bug that costs real money, and it happens because the `POST /orders` endpoint is not idempotent. The fix is not "make the client smarter about retries." The fix is making the server tolerate duplicate requests safely.

## The Anti-Pattern
Self-taught developers typically treat every request as unique, with no consideration for what happens when the same request arrives twice.

```python
# Non-idempotent: every call creates a new order
@app.route('/api/orders', methods=['POST'])
def create_order():
    order = Order(
        user_id=request.json['user_id'],
        items=request.json['items'],
        total=calculate_total(request.json['items'])
    )
    db.add(order)
    db.commit()
    charge_credit_card(order.total, request.json['payment_token'])
    send_confirmation_email(order)
    return jsonify(order.to_dict()), 201
```

If this request times out and the client retries:
- Two orders exist in the database
- The credit card is charged twice
- Two confirmation emails are sent

**The idempotent version uses an idempotency key:**

```python
@app.route('/api/orders', methods=['POST'])
def create_order():
    idempotency_key = request.headers.get('Idempotency-Key')
    if not idempotency_key:
        return jsonify({"error": "Idempotency-Key header required"}), 400

    # Check if we already processed this request
    existing = db.query(Order).filter_by(idempotency_key=idempotency_key).first()
    if existing:
        return jsonify(existing.to_dict()), 200  # Return same result, no side effects

    order = Order(
        idempotency_key=idempotency_key,
        user_id=request.json['user_id'],
        items=request.json['items'],
        total=calculate_total(request.json['items'])
    )
    db.add(order)
    db.commit()
    charge_credit_card(order.total, request.json['payment_token'])
    send_confirmation_email(order)
    return jsonify(order.to_dict()), 201
```

Now the client includes `Idempotency-Key: <uuid>` with every request. If the request is retried (same key), the server returns the original result without re-executing side effects.

## HTTP Verb Idempotency

| Verb   | Idempotent? | Why |
|--------|-------------|-----|
| GET    | Yes         | Reads state, never modifies it |
| PUT    | Yes         | Sets resource to specified state (same state every time) |
| DELETE | Yes         | Resource is gone; deleting again is a no-op |
| PATCH  | Depends     | Idempotent if "set X to 5", not if "increment X by 1" |
| POST   | No          | Creates new resource each time (must add idempotency key for safety) |

## Recognition Signal
- Duplicate records in the database with identical data but different IDs and timestamps seconds apart
- Customer complaints about double charges or duplicate emails
- Form submissions that create duplicates when the user clicks the button twice
- No `Idempotency-Key` header in POST/PATCH endpoints that have side effects
- PATCH operations that use relative changes (`increment by 1`) instead of absolute state (`set to 5`)
- Race conditions where two requests for the same operation both succeed
- `POST` used for operations that should be `PUT` (updating a resource to a known state)
- Background job queues that process the same job multiple times under load

## Related Concepts
**REST principles** define which HTTP verbs should be idempotent by default: GET, PUT, and DELETE are inherently idempotent when implemented correctly. POST is the one that needs explicit idempotency handling. **API error contracts** interact with idempotency: when a duplicate request is detected, should the server return 200 (success, same result) or 409 (conflict)? The answer should be in your error contract. **State management patterns** apply on the client side: if the client tracks request state (pending, succeeded, failed), it can avoid sending duplicates in the first place -- but the server must still be safe because clients cannot be trusted. **API versioning** should preserve idempotency guarantees across versions -- removing idempotency from a previously idempotent endpoint is a breaking change.
