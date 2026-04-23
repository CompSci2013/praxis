---
id: cache-invalidation
domain: backend
category: caching
depends_on:
  - application-caching
  - http-caching
related:
  - unit-of-work
  - background-jobs
  - search-engine-as-datastore
anti_pattern_of: null
severity: critical
---

# Cache Invalidation

## Definition
The problem of determining when cached data no longer reflects the source of truth, and the strategies for updating or removing stale entries -- famously described as one of the two hard problems in computer science (along with naming things and off-by-one errors).

## Why It Matters
Every cache is a lie waiting to happen. The moment you store a copy of data, you've created a synchronization problem. The source changes, the cache doesn't know, and users see stale data. The consequences range from mildly confusing (old product description) to catastrophic (stale inventory showing items as in-stock when they're sold out, stale auth tokens granting access after permissions were revoked, stale prices causing revenue loss). The difficulty isn't adding a cache -- it's knowing when to remove or update entries. Most caching bugs are invalidation bugs.

## The Anti-Pattern
A self-taught developer typically caches data without any invalidation strategy. The cache is write-once: once a value is stored, it's served until the server restarts or memory pressure forces eviction. When they do attempt invalidation, they invalidate in some code paths but not others -- the "update product" API clears the cache, but the bulk import job doesn't, and the admin CSV upload doesn't, and the inventory sync from the warehouse doesn't.

```python
# Cache set in one place, modified data in five places -- only one remembers to invalidate

def get_product(product_id):
    cached = cache.get(f'product:{product_id}')
    if cached:
        return cached
    product = db.query(Product).get(product_id)
    cache.set(f'product:{product_id}', product.to_dict())
    return product.to_dict()

# API update -- remembers to invalidate
def update_product(product_id, data):
    product = db.query(Product).get(product_id)
    product.update(**data)
    db.commit()
    cache.delete(f'product:{product_id}')  # Good

# Bulk import -- forgets to invalidate
def bulk_import_products(csv_file):
    for row in csv_file:
        db.execute("UPDATE products SET price = %s WHERE sku = %s", [row.price, row.sku])
    db.commit()
    # Cache still has old prices. Users see $29.99, actual price is $24.99.

# Inventory sync -- doesn't even know the cache exists
def sync_inventory_from_warehouse(api_data):
    for item in api_data:
        db.execute("UPDATE products SET stock = %s WHERE sku = %s", [item.qty, item.sku])
    db.commit()
    # "In stock" badge shows for sold-out items until cache expires or server restarts

# Price scheduled change -- runs at midnight via cron
def apply_scheduled_price_changes():
    db.execute("UPDATE products SET price = scheduled_price WHERE scheduled_date <= NOW()")
    db.commit()
    # Prices change in the database but the cache serves yesterday's prices all day
```

## Recognition Signal
- Users report seeing old data that only fixes itself "after a while" or "after refreshing a lot"
- Data is correct in the database but wrong in the API response
- Some update paths invalidate the cache, others don't -- the bug is intermittent depending on how data was changed
- `cache.set` calls exist but `cache.delete` calls are rare or absent
- No TTL on cached entries -- data lives in cache indefinitely
- Cache and database writes are not in the same transaction, creating a window where they can diverge
- The team's fix for stale data is "restart the server" or "clear all caches"
- There's no way to invalidate a group of related cache entries (e.g., all products in a category after a category change)

## Related Concepts
**Application caching** is where cached data lives; cache invalidation is the hard problem you inherit by adopting it. You can't discuss caching strategy without an invalidation strategy. **HTTP caching** has built-in invalidation mechanisms (ETag validation, `max-age` expiry) that are simpler than application-level invalidation, but only work for client-side caches. **Unit of work** suggests that cache invalidation should happen within the same transactional boundary as database writes -- if the database write rolls back, the cache shouldn't be invalidated. **Background jobs** are often used to implement invalidation strategies: a job that runs every N minutes and rebuilds the cache from the database, accepting bounded staleness. **Search engine as datastore** involves the same fundamental problem: the search index is a cache of your relational data, and keeping it in sync is cache invalidation at the infrastructure level.
