---
id: layered-architecture
domain: architecture
category: module-design
depends_on:
  - separation-of-concerns
  - dependency-inversion
  - module-boundaries
related:
  - cohesion-coupling
  - encapsulation
  - rest-principles
  - api-error-contracts
  - testing-pyramid
anti_pattern_of: null
severity: critical
---

# Layered Architecture

## Definition
Organize code into horizontal layers of responsibility -- typically presentation, business logic, data access, and persistence -- where each layer only depends on the layer directly below it, never above or sideways.

## Why It Matters
Without layers, business logic gets embedded in UI code and database queries get scattered through API handlers. This means you cannot change your database without rewriting your business rules. You cannot swap a REST API for a CLI without duplicating logic. You cannot test business rules without spinning up a web server and a database.

Layers give you replaceability and testability. The business logic layer does not know whether it is being called by a REST API, a GraphQL resolver, a CLI command, or a test harness. The data access layer does not know whether it is talking to PostgreSQL, MongoDB, or an in-memory fake. Each layer can be developed, tested, and replaced independently.

The rule is strict: dependencies flow *downward only*. The presentation layer calls the business layer. The business layer calls the data access layer. Never the reverse. Never skipping layers (presentation directly calling the database).

## The Anti-Pattern
Self-taught developers typically have no layers at all. The route handler *is* the business logic *is* the database access. Everything lives in the controller.

```javascript
// Express route handler that IS the entire application
app.post('/api/orders', async (req, res) => {
  // Validation (should be presentation layer)
  if (!req.body.items?.length) {
    return res.status(400).json({ error: 'No items' });
  }

  // Business logic (should be its own layer)
  let total = 0;
  for (const item of req.body.items) {
    // Database access (should be data access layer)
    const product = await db.query('SELECT * FROM products WHERE id = $1', [item.id]);
    if (product.rows[0].stock < item.qty) {
      return res.status(400).json({ error: `${product.rows[0].name} out of stock` });
    }
    total += product.rows[0].price * item.qty;
  }

  // More business logic mixed with persistence
  if (total > 10000) total *= 0.9;
  const order = await db.query(
    'INSERT INTO orders (total, user_id) VALUES ($1, $2) RETURNING *',
    [total, req.user.id]
  );

  // Side effects mixed with response
  await sendgrid.send({ to: req.user.email, subject: 'Order confirmed' });
  res.status(201).json(order.rows[0]);
});
```

This cannot be tested without a running database, a web server, and a mocked email service. The business logic (bulk discount, stock validation) cannot be reused in a CLI tool or a background job. Changing the database schema requires editing the API handler. Changing the email provider requires editing the API handler.

The layered version separates these:
- **Presentation**: Parses HTTP request, calls service, formats HTTP response
- **Business logic**: Validates stock, calculates pricing, orchestrates the operation
- **Data access**: Translates between domain objects and database queries
- **Infrastructure**: Database connections, email clients, file storage

## Recognition Signal
- Route handlers or controller methods longer than 20 lines
- SQL queries or ORM calls appearing in files that also handle HTTP request/response
- Business rules that cannot be invoked without an HTTP context
- Test files that start a web server or connect to a database to test business logic
- Duplicated logic between a REST endpoint and a background worker that do "the same thing"
- You cannot answer "where does the discount logic live?" -- it is spread across multiple route handlers

## Related Concepts
**Separation of concerns** is the principle; layered architecture is a specific strategy for implementing it. **Dependency inversion** makes the layers flexible: the business layer defines repository interfaces, and the data access layer implements them. This means the business layer does not depend on the database -- the database depends on the business layer's abstractions. **Module boundaries** apply within layers too: the business logic layer may contain multiple modules (orders, users, billing) with their own boundaries. **REST principles** define the conventions of the presentation layer for HTTP APIs. **API error contracts** standardize how the presentation layer communicates failures. **Testing pyramid** becomes achievable: unit tests exercise the business layer with fake data access, integration tests verify data access against a real database, and end-to-end tests verify the full stack.
