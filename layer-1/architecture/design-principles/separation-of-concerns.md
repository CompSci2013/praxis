---
id: separation-of-concerns
domain: architecture
category: design-principles
depends_on: []
related:
  - single-responsibility
  - cohesion-coupling
  - module-boundaries
  - layered-architecture
anti_pattern_of: null
severity: critical
---

# Separation of Concerns

## Definition
Each module, class, or function should address exactly one concern -- one axis of change, one reason to exist, one job to do well.

## Why It Matters
When concerns are tangled, changing one thing breaks another. A function that fetches data, transforms it, validates it, and renders it means you cannot change your data source without risking your rendering logic. Every bug fix becomes a game of whack-a-mole. Testing becomes nearly impossible because you cannot isolate the thing you want to verify. Onboarding new developers takes longer because understanding any one behavior requires understanding all of them simultaneously.

## The Anti-Pattern
The classic shape is a 400-line function or a "god component" that does everything. A self-taught developer typically writes a React component that:
- Fetches data with `useEffect`
- Contains business logic (price calculation, validation rules)
- Handles error states inline
- Renders the UI
- Manages its own local state that should be shared

Or in backend code, a single route handler that validates input, queries the database, applies business rules, formats the response, sends emails, and logs analytics -- all in one function body.

```python
# Everything jammed into one route handler
@app.route('/orders', methods=['POST'])
def create_order(request):
    # Validation (concern 1)
    if not request.json.get('items'):
        return {'error': 'No items'}, 400
    if not request.json.get('email'):
        return {'error': 'No email'}, 400

    # Business logic (concern 2)
    total = 0
    for item in request.json['items']:
        product = db.query(Product).get(item['id'])
        if product.stock < item['qty']:
            return {'error': f'{product.name} out of stock'}, 400
        total += product.price * item['qty']
    if total > 10000:
        total *= 0.9  # bulk discount

    # Persistence (concern 3)
    order = Order(total=total, email=request.json['email'])
    db.add(order)
    db.commit()

    # Notification (concern 4)
    send_email(request.json['email'], f'Order {order.id} confirmed')

    # Response formatting (concern 5)
    return {'id': order.id, 'total': total, 'status': 'confirmed'}, 201
```

## Recognition Signal
- Functions longer than ~40 lines that do multiple distinct things
- A single file that imports from every layer of your stack (database, HTTP, email, templating)
- You find yourself saying "this function also..." when describing what it does
- Changing a UI label requires touching the same file as changing a database query
- Test files that need extensive mocking because the code under test touches everything
- Comments that section off a function: `# --- validation ---`, `# --- database ---`, `# --- response ---`

## Related Concepts
**Single responsibility** is the class-level expression of this principle -- separation of concerns is the broader architectural idea, SRP is how it manifests in OOP. **Cohesion and coupling** measure whether you achieved good separation: high cohesion means each module's internals belong together, low coupling means modules don't leak into each other. **Module boundaries** define where you draw the lines. **Layered architecture** is one specific strategy for separating concerns by technical responsibility (presentation, logic, data).
