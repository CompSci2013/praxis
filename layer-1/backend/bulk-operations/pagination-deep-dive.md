---
id: pagination-deep-dive
domain: backend
category: bulk-operations
depends_on:
  - query-builders
  - repository-pattern
related:
  - bulk-operations
  - http-caching
  - query-dsl
  - aggregations
anti_pattern_of: null
severity: important
---

# Pagination Deep Dive

## Definition
Strategies for returning large result sets in manageable chunks -- primarily offset-based (`LIMIT/OFFSET`), cursor-based (keyset), and search_after pagination -- each with fundamentally different performance characteristics that determine whether your API stays fast at scale or collapses under its own data.

## Why It Matters
Every growing application eventually has too much data to return in a single response. The default solution -- `LIMIT 20 OFFSET 1000` -- works fine for the first few pages. But offset pagination has a hidden cost: the database must read and discard all rows before the offset. Page 1 reads 20 rows. Page 50 reads 1,000 rows and discards 980. Page 5,000 reads 100,000 rows and discards 99,980. Performance degrades linearly with depth, and for large datasets, deep pages become unusably slow. This isn't a theoretical concern -- it's the reason "page 100" takes 10 seconds on production APIs that were fast during development when they had 500 rows.

## The Anti-Pattern
A self-taught developer typically implements offset pagination exclusively, because it's what SQL tutorials teach and what `?page=5` suggests. They don't know that alternatives exist, and they don't discover the performance problem until the dataset grows large enough to expose it -- which might be months after launch.

```python
# Offset pagination -- simple, but performance degrades with depth
@app.route('/api/products')
def list_products():
    page = int(request.args.get('page', 1))
    per_page = 20
    offset = (page - 1) * per_page

    products = db.execute(
        "SELECT * FROM products ORDER BY created_at DESC LIMIT %s OFFSET %s",
        [per_page, offset]
    ).fetchall()

    return jsonify({
        'data': [p.to_dict() for p in products],
        'page': page,
        'per_page': per_page
    })
    # Page 1:    reads 20 rows.     ~2ms
    # Page 100:  reads 2,000 rows.  ~15ms
    # Page 5000: reads 100,000 rows. ~800ms
    # Page 50000: reads 1,000,000 rows. ~8 seconds

# Also broken: concurrent modifications cause skipped or duplicate items.
# User is on page 3. A new item is inserted at the top.
# Everything shifts by 1. Page 4 repeats the last item from page 3.
```

Cursor-based pagination:
```python
@app.route('/api/products')
def list_products():
    per_page = 20
    cursor = request.args.get('cursor')  # Opaque cursor from previous response

    if cursor:
        # Decode cursor into the last-seen sort values
        last_created, last_id = decode_cursor(cursor)
        products = db.execute("""
            SELECT * FROM products
            WHERE (created_at, id) < (%s, %s)
            ORDER BY created_at DESC, id DESC
            LIMIT %s
        """, [last_created, last_id, per_page]).fetchall()
    else:
        products = db.execute(
            "SELECT * FROM products ORDER BY created_at DESC, id DESC LIMIT %s",
            [per_page]
        ).fetchall()

    next_cursor = None
    if len(products) == per_page:
        last = products[-1]
        next_cursor = encode_cursor(last.created_at, last.id)

    return jsonify({
        'data': [p.to_dict() for p in products],
        'next_cursor': next_cursor  # Client sends this back for next page
    })
    # Every page reads exactly 20 rows. Page 50,000 is as fast as page 1.
    # No skipped or duplicated items from concurrent modifications.
    # Tradeoff: no "jump to page 47" -- must traverse sequentially.
```

## Recognition Signal
- `OFFSET` in SQL queries with no upper bound or safeguard
- API response times degrade as users paginate deeper into results
- Users report missing or duplicate items when browsing paginated lists
- `?page=N` in API design with no cursor alternative
- No discussion of pagination strategy -- the team isn't aware there are options beyond LIMIT/OFFSET
- Total count queries (`SELECT COUNT(*)`) on every paginated request, adding latency for a number most users ignore
- Elasticsearch queries using `from`/`size` beyond 10,000 results (hits the default `index.max_result_window`)

## Related Concepts
**Query builders** should support multiple pagination strategies, making it easy to switch between offset and cursor-based approaches within the repository. **Bulk operations** relate to pagination because processing large datasets in batches (cursor-based iteration) is the bulk equivalent of cursor pagination -- you're solving the same "too much data at once" problem. **HTTP caching** interacts differently with each strategy: offset-based pages can be cached by URL (`?page=5`), but cursor-based pages can't because cursors are opaque and change. **Query DSL** in search engines provides `search_after`, which is the Elasticsearch-native cursor pagination -- using `from`/`size` (offset) beyond shallow pages is explicitly discouraged and eventually blocked. **Aggregations** should consider pagination context: computing a total count as a separate aggregation is cheaper than `SELECT COUNT(*)` in many cases.
