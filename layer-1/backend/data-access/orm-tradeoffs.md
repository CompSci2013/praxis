---
id: orm-tradeoffs
domain: backend
category: data-access
depends_on:
  - repository-pattern
  - query-builders
related:
  - unit-of-work
  - request-response-transformation
  - bulk-operations
  - search-engine-as-datastore
anti_pattern_of: null
severity: important
---

# ORM Tradeoffs

## Definition
Object-Relational Mappers translate between database rows and programming language objects, providing convenience at the cost of control -- and understanding when that tradeoff helps versus hurts is critical to building systems that perform well.

## Why It Matters
ORMs are not inherently good or bad. They are a tradeoff. The danger is not using one -- it's using one without understanding what it does. A developer who doesn't understand SQL will write ORM code that generates catastrophic queries and have no idea why the page takes 30 seconds to load. A developer who writes everything in raw SQL will spend weeks reimplementing transaction management, connection pooling, and migration tooling that an ORM provides for free. The skill is knowing where the ORM helps (CRUD, migrations, connection management) and where it hurts (complex reporting, bulk operations, performance-critical paths).

## The Anti-Pattern
Two opposite anti-patterns exist, and both are common:

**Anti-pattern 1: ORM Everywhere.** The developer uses the ORM for everything, including complex reports and bulk operations. They've never opened a SQL console. They don't know what query the ORM generates. Performance problems are mysterious.

```python
# N+1 query problem -- the ORM's most famous trap
def get_order_summaries():
    orders = Order.query.all()  # 1 query: SELECT * FROM orders
    summaries = []
    for order in orders:
        # Each access triggers a new query -- 1 per order
        customer_name = order.customer.name   # SELECT * FROM customers WHERE id = ?
        item_count = len(order.items)          # SELECT * FROM order_items WHERE order_id = ?
        summaries.append({
            'id': order.id,
            'customer': customer_name,
            'items': item_count
        })
    return summaries
    # For 500 orders: 1 + 500 + 500 = 1,001 queries instead of 1 JOIN query
```

**Anti-pattern 2: Raw SQL Everywhere.** The developer avoids the ORM entirely, writing raw SQL for every operation including simple CRUD. They manually manage connections, hand-code migrations, and build their own parameter binding.

```python
# Reimplementing what the ORM gives you for free
def create_user(name, email):
    conn = get_connection()  # Manual connection management
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (name, email, created_at) VALUES (%s, %s, NOW()) RETURNING id",
            (name, email)
        )
        user_id = cursor.fetchone()[0]
        conn.commit()
        return {'id': user_id, 'name': name, 'email': email}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()  # Hope you never forget this
```

## Recognition Signal
- **ORM overuse**: Page loads take seconds; adding `.prefetch_related()` or `.joinedload()` fixes them dramatically. Nobody on the team can explain what SQL the ORM generates. The Django Debug Toolbar shows 200+ queries per page.
- **ORM avoidance**: Manual connection open/close in every function. Hand-written SQL for simple CRUD operations (insert a row, fetch by ID). No migration tooling -- schema changes are applied by running SQL scripts manually. Transaction management reimplemented in every function.
- **General**: No awareness that both approaches exist. The developer either trusts the ORM blindly or fears it entirely, rather than choosing the right tool for each situation.

## Related Concepts
**Repository pattern** sits above the ORM and is where you make the choice: use the ORM for simple queries, drop to raw SQL (or a query builder) for complex ones. The repository hides this decision from the rest of the code. **Query builders** are the middle ground -- they give you parameterization and composition without the full object-mapping overhead, and many ORMs include a query-builder layer you can use independently. **Bulk operations** are where ORMs typically hurt most: inserting 50,000 rows through ORM objects is orders of magnitude slower than a bulk insert. **Unit of work** is often provided by the ORM's session or context object, meaning avoiding the ORM means reimplementing this yourself. **Request-response transformation** interacts with the ORM because returning ORM objects directly as API responses is the root of many data-leakage problems.
