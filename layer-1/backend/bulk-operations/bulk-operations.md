---
id: bulk-operations
domain: backend
category: bulk-operations
depends_on:
  - unit-of-work
  - repository-pattern
related:
  - background-jobs
  - pagination-deep-dive
  - orm-tradeoffs
  - aggregations
anti_pattern_of: null
severity: important
---

# Bulk Operations

## Definition
Processing many records in a single operation or batched groups rather than one at a time -- using mechanisms like bulk inserts, batch updates, and set-based operations that minimize round-trips between your application and database.

## Why It Matters
Every database call has overhead: network round-trip, query parsing, transaction management, response serialization. Inserting one row might take 2ms. Inserting 50,000 rows one at a time takes 100 seconds of pure overhead, plus whatever the database does for each insert. A bulk insert of the same 50,000 rows might take 500ms. The difference is not marginal -- it's two orders of magnitude. This applies to updates, deletes, and reads as well. Any time you loop through records and make one database call per iteration, you're paying overhead N times when you could pay it once.

## The Anti-Pattern
A self-taught developer typically processes records in a loop, one database call per iteration. They learned to insert one row, so inserting many rows means inserting one row many times. The code looks clean -- it's a simple loop. But it generates thousands of individual queries when a single bulk operation would suffice.

```python
# One-at-a-time processing -- 10,000 individual INSERT statements
def import_products(csv_rows):
    for row in csv_rows:
        product = Product(
            name=row['name'],
            sku=row['sku'],
            price=float(row['price']),
            category=row['category']
        )
        db.add(product)
        db.commit()  # 10,000 commits = 10,000 transactions
    # Takes 45 seconds. A bulk insert takes 0.3 seconds.

# One-at-a-time API calls -- the network version of the same mistake
def sync_to_elasticsearch(products):
    for product in products:
        es.index(index='products', id=product.id, body=product.to_dict())
    # 10,000 HTTP requests. Elasticsearch's _bulk API does this in one request.

# One-at-a-time updates -- N queries when 1 would do
def apply_discount(product_ids, discount_pct):
    for pid in product_ids:
        product = db.query(Product).get(pid)  # SELECT for each
        product.price *= (1 - discount_pct)
        db.commit()  # UPDATE + COMMIT for each
    # Should be: UPDATE products SET price = price * 0.9 WHERE id IN (...)
```

Bulk approach:
```python
# Bulk insert -- one statement, one transaction
def import_products(csv_rows):
    products = [
        Product(name=r['name'], sku=r['sku'], price=float(r['price']), category=r['category'])
        for r in csv_rows
    ]
    db.bulk_save_objects(products)
    db.commit()  # One transaction for all 10,000 rows

# Bulk Elasticsearch indexing
def sync_to_elasticsearch(products):
    actions = [
        {'_index': 'products', '_id': p.id, '_source': p.to_dict()}
        for p in products
    ]
    helpers.bulk(es, actions, chunk_size=500)  # Batched into 500-doc chunks

# Set-based update -- one query regardless of count
def apply_discount(product_ids, discount_pct):
    db.execute(
        "UPDATE products SET price = price * :factor WHERE id = ANY(:ids)",
        {'factor': 1 - discount_pct, 'ids': product_ids}
    )
    db.commit()
```

## Recognition Signal
- A for-loop containing `db.add()` + `db.commit()` or individual `INSERT` calls
- Import scripts that take minutes or hours for data sets that should take seconds
- Elasticsearch indexing that makes one `es.index()` call per document instead of using `_bulk`
- Database connection pool exhaustion during batch operations (each iteration holds a connection)
- CPU usage is low but wall-clock time is high -- the bottleneck is round-trip overhead, not computation
- UPDATE or DELETE operations that fetch each row individually before modifying it
- ORM code that loads objects into memory just to update a single column on each one

## Related Concepts
**Unit of work** defines the transactional boundary for bulk operations -- all 10,000 inserts should be one transaction, not 10,000 individual commits. **Repository pattern** is where bulk methods should live: `product_repo.bulk_create(products)` alongside `product_repo.create(product)`. **ORM tradeoffs** are sharply exposed by bulk operations: ORMs are typically 10-100x slower for bulk work because they instantiate objects, track state, and generate individual SQL statements. Dropping to raw SQL or a bulk API for large operations is one of the most common reasons to bypass the ORM. **Aggregations** in search engines face the same principle: computing statistics server-side is the bulk equivalent of fetching all records and counting them in application code. **Background jobs** often wrap bulk operations so they don't block the request-response cycle.
