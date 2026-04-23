---
id: pagination-strategies
domain: architecture
category: api-design
depends_on:
  - rest-principles
related:
  - api-versioning
  - api-error-contracts
  - idempotency
anti_pattern_of: null
severity: important
---

# Pagination Strategies

## Definition
Pagination is the practice of breaking large result sets into smaller pages that clients request incrementally, rather than returning all records in a single response.

## Why It Matters
Without pagination, a `GET /users` endpoint that works fine with 50 users becomes a production incident when there are 500,000. The server loads all records into memory, serializes a massive JSON response, and sends it over the network. The server runs out of memory, the client times out, the browser tab crashes, and the mobile app freezes. This is not a theoretical concern -- it is one of the most common scaling failures in web applications.

But pagination is not just about performance. It affects correctness. When data changes between page requests, results can shift: items appear twice or are skipped entirely. The choice of pagination strategy determines how your API handles this fundamental problem.

## The Anti-Pattern
Self-taught developers typically start with no pagination at all, then bolt on offset-based pagination as a quick fix when the endpoint starts timing out.

```python
# Step 1: No pagination (works until it doesn't)
@app.route('/api/products')
def list_products():
    products = db.query(Product).all()  # Loads 500K records into memory
    return jsonify([p.to_dict() for p in products])

# Step 2: Naive offset pagination (common "fix")
@app.route('/api/products')
def list_products():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    products = db.query(Product).offset((page - 1) * per_page).limit(per_page).all()
    return jsonify({
        'data': [p.to_dict() for p in products],
        'page': page,
        'per_page': per_page
    })
    # Missing: total count, next/prev links, and this will silently break
    # when records are inserted/deleted between page requests
```

Offset pagination has a critical flaw at scale: `OFFSET 100000` forces the database to scan and discard 100,000 rows to return rows 100,001-100,020. Page 5,000 is dramatically slower than page 1. It also has a correctness flaw: if a record is deleted between fetching page 3 and page 4, one record on page 4 is skipped entirely.

## Three Main Strategies

### Offset Pagination
```
GET /api/products?page=3&per_page=20
```
- **Pros**: Simple to implement, allows jumping to any page, easy total count
- **Cons**: Slow at high page numbers (`OFFSET` is O(n)), inconsistent when data changes between requests
- **Use when**: Small datasets (<100K), need "jump to page N" UI, data changes infrequently

### Cursor Pagination
```
GET /api/products?after=eyJpZCI6MTAwfQ&limit=20
```
The cursor is an opaque token encoding the last item's sort position (often base64-encoded). The server uses it to query `WHERE id > :last_id LIMIT 20`.
- **Pros**: Consistent performance at any depth, stable results when data changes, works with any dataset size
- **Cons**: No "jump to page N," cannot display total page count without separate query
- **Use when**: Large datasets, infinite scroll UIs, feeds, timelines, any production API at scale

### Keyset (search_after) Pagination
```
GET /api/products?search_after=1709308800,product_xyz&limit=20
```
Like cursor pagination but the sort values are explicit rather than opaque. Common in Elasticsearch.
- **Pros**: Same performance benefits as cursor, transparent and debuggable
- **Cons**: Clients must understand sort field types, multi-column sorts are complex
- **Use when**: Search APIs, Elasticsearch integration, when cursor opacity is unwanted

## Response Shape (any strategy)

```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTIwfQ",
    "has_more": true,
    "limit": 20
  }
}
```

Always include `has_more` (or `next` link). Clients should not have to request the next page to discover there is no next page.

## Recognition Signal
- Endpoints that return unbounded arrays with no limit parameter
- Offset pagination on tables with millions of rows (page 1 is fast, page 1000 is slow)
- No `has_more`, `next`, or total count in paginated responses -- clients guess when to stop
- UI that shows "Page 1 of ???" because the API does not provide total count
- Data duplication or gaps when scrolling through a feed that is being updated in real-time
- `COUNT(*)` queries on large tables for every paginated request (expensive just to show "page 3 of 12,847")
- Tests that only verify page 1 and never test deep pagination performance

## Related Concepts
**REST principles** inform pagination design: paginated endpoints are still resource collections, and pagination metadata should follow consistent conventions. **API error contracts** should cover pagination errors: what happens when a cursor is expired or invalid? A consistent error response prevents client crashes. **API versioning** must account for pagination: changing from offset to cursor pagination is a breaking change. **Idempotency** interacts with pagination: `GET` requests with pagination parameters should be safe to retry without side effects, but cursor-based systems must handle expired cursors gracefully.
