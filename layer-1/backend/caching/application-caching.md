---
id: application-caching
domain: backend
category: caching
depends_on:
  - separation-of-concerns
related:
  - http-caching
  - cache-invalidation
  - repository-pattern
  - background-jobs
anti_pattern_of: null
severity: important
---

# Application Caching

## Definition
Storing the results of expensive computations or frequently accessed data in a fast-access layer (in-process memory, Redis, Memcached) so that subsequent requests can be served without repeating the work -- trading memory for speed.

## Why It Matters
Some operations are inherently expensive: joining across five tables, calling an external API with 200ms latency, computing a recommendation score for 10,000 products. Without caching, every request pays the full cost. The first user waits 800ms. The thousandth user also waits 800ms. With application caching, the first request does the work and stores the result. The next 999 requests get the answer in 1-2ms from cache. The difference between a site that feels sluggish and one that feels instant is often just a few well-placed caches. But caching done poorly is worse than no caching -- stale data, cache stampedes, and memory leaks create bugs that are harder to diagnose than slow queries.

## The Anti-Pattern
A self-taught developer typically does one of two things:

**No caching at all.** The database is hit for every request, even for data that changes once a day. The product catalog, the site configuration, the navigation menu -- all queried fresh on every page load. Performance problems are addressed by adding database indexes or upgrading hardware rather than eliminating unnecessary work.

**Naive caching without a strategy.** The developer adds a dictionary or global variable as a cache, with no TTL, no eviction, and no invalidation. The cache grows forever, consuming memory. Stale data is served indefinitely. Or they cache at the wrong level -- caching individual database rows when they should cache the computed result, or caching entire pages when only one component is expensive.

```python
# Naive cache -- no TTL, no eviction, no invalidation
_cache = {}

def get_product_recommendations(user_id):
    if user_id in _cache:
        return _cache[user_id]  # Stale forever once cached

    # Expensive computation: ~500ms
    recommendations = compute_recommendations(user_id)
    _cache[user_id] = recommendations  # Memory grows forever
    return recommendations
    # After 100K users, this dict consumes gigabytes
    # Recommendations never update even after new purchases
    # Server restart loses everything -- cold start storm

# Wrong caching level -- caching too granularly
def get_dashboard():
    user = cache.get(f'user:{user_id}') or db.get(user_id)       # 1 cache check
    orders = cache.get(f'orders:{user_id}') or db.get_orders()    # 1 cache check
    stats = cache.get(f'stats:{user_id}') or compute_stats()      # 1 cache check
    alerts = cache.get(f'alerts:{user_id}') or get_alerts()       # 1 cache check
    # 4 cache round-trips instead of caching the assembled dashboard once
```

Better approach with TTL, eviction, and appropriate granularity:
```python
import redis

cache = redis.Redis()

def get_product_recommendations(user_id):
    cache_key = f'recs:{user_id}'
    cached = cache.get(cache_key)
    if cached:
        return json.loads(cached)

    recommendations = compute_recommendations(user_id)
    cache.setex(cache_key, 3600, json.dumps(recommendations))  # TTL: 1 hour
    return recommendations

def invalidate_recommendations(user_id):
    """Call this when user makes a purchase or rates a product."""
    cache.delete(f'recs:{user_id}')
```

## Recognition Signal
- The same expensive query or computation runs on every request with identical inputs
- Response times are consistently slow even for frequently accessed, rarely-changing data
- A global dictionary or module-level variable is used as a cache with no size limit or TTL
- Server memory grows steadily over time until the process is restarted
- Users see stale data but the developer doesn't know how to trigger cache refresh
- No caching library (Redis, Memcached) is in the tech stack -- everything is in-process or uncached
- Cache keys are inconsistent or hand-crafted strings that are easy to get wrong

## Related Concepts
**HTTP caching** works at the client level and prevents requests from reaching the server. Application caching works at the server level and prevents expensive work once the request arrives. They are different layers of the same optimization strategy. **Cache invalidation** is the hard problem that makes application caching tricky -- you need a strategy for knowing when cached data is stale. **Repository pattern** is often where caching logic lives: the repository checks the cache before hitting the database, keeping caching concerns out of business logic. **Background jobs** can proactively warm caches by pre-computing expensive results on a schedule, rather than making the first user pay the computation cost.
