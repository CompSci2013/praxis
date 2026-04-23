---
id: query-builders
domain: backend
category: data-access
depends_on:
  - repository-pattern
related:
  - orm-tradeoffs
  - unit-of-work
  - search-engine-as-datastore
  - query-dsl
anti_pattern_of: null
severity: important
---

# Query Builders

## Definition
A programmatic API for constructing database queries through method chaining or composition, producing parameterized queries without manual string concatenation -- sitting between raw SQL strings and full ORM abstractions.

## Why It Matters
Raw query strings are the single most common source of SQL injection vulnerabilities. Beyond security, string-concatenated queries are fragile: adding an optional filter means building up a string with conditionals, managing WHERE vs AND placement, and hoping your parentheses are balanced. Query builders solve both problems. They parameterize values automatically (preventing injection), compose cleanly (optional filters are just conditional method calls), and catch structural errors at build time rather than at database execution time.

## The Anti-Pattern
A self-taught developer typically builds queries through string concatenation or f-strings. Optional filters are handled with increasingly tangled if-else blocks that glue SQL fragments together. The resulting code is unreadable, untestable, and vulnerable to injection.

```python
# String concatenation -- SQL injection vulnerability + fragile construction
def search_products(name=None, category=None, min_price=None, max_price=None, in_stock=None):
    query = "SELECT * FROM products WHERE 1=1"

    if name:
        query += f" AND name LIKE '%{name}%'"  # SQL INJECTION
    if category:
        query += f" AND category = '{category}'"  # SQL INJECTION
    if min_price is not None:
        query += f" AND price >= {min_price}"
    if max_price is not None:
        query += f" AND price <= {max_price}"
    if in_stock:
        query += " AND stock > 0"

    query += " ORDER BY price ASC"
    return db.execute(query).fetchall()
    # What if someone passes: category = "'; DROP TABLE products; --"
```

With a query builder:
```python
def search_products(name=None, category=None, min_price=None, max_price=None, in_stock=None):
    q = db.select(Product)

    if name:
        q = q.where(Product.name.ilike(f'%{name}%'))  # Parameterized
    if category:
        q = q.where(Product.category == category)       # Parameterized
    if min_price is not None:
        q = q.where(Product.price >= min_price)
    if max_price is not None:
        q = q.where(Product.price <= max_price)
    if in_stock:
        q = q.where(Product.stock > 0)

    return q.order_by(Product.price.asc()).all()
    # Injection impossible -- values are always bound parameters
```

## Recognition Signal
- f-strings or string concatenation containing SQL keywords (`SELECT`, `WHERE`, `INSERT`)
- Variables interpolated directly into query strings without parameterization
- The `WHERE 1=1` hack to simplify conditional appending
- Complex if-else chains that build up a query string piece by piece
- Queries that break when a value contains an apostrophe ("O'Brien")
- No use of parameterized queries (`?` or `%s` placeholders) anywhere in the codebase
- Difficulty composing queries: reusable scopes or filters don't exist

## Related Concepts
**Repository pattern** is where query builders typically live -- the repository's methods use query builders internally. **ORM tradeoffs** are relevant because ORMs include query builders as part of their feature set; standalone query builders (like Knex.js or SQLAlchemy Core) give you the composition benefits without the full object-mapping overhead. **Search engine query DSLs** are the search-engine equivalent of query builders -- structured JSON objects instead of string-based queries, solving the same composition and safety problems for Elasticsearch that query builders solve for SQL. **Unit of work** coordinates the execution of queries that a query builder constructs.
