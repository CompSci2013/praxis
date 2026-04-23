---
id: http-caching
domain: backend
category: caching
depends_on:
  - middleware-pipelines
related:
  - application-caching
  - cache-invalidation
  - api-gateway-pattern
anti_pattern_of: null
severity: important
---

# HTTP Caching

## Definition
The built-in caching mechanism of the HTTP protocol, controlled by response headers (Cache-Control, ETag, Last-Modified) that tell browsers, CDNs, and proxy servers whether they can reuse a response without asking the server again -- eliminating requests entirely rather than just making them faster.

## Why It Matters
HTTP caching is the highest-leverage performance optimization most web applications never implement. When it works, the request doesn't reach your server at all. The browser has the response cached and serves it instantly. No server CPU, no database query, no network latency. For APIs serving the same data to many users (product catalogs, configuration, public content), a single Cache-Control header can eliminate 90% of your traffic. Without it, every navigation, every page refresh, every repeated API call hits your server at full cost, even when the response hasn't changed in days.

## The Anti-Pattern
A self-taught developer typically ignores HTTP caching entirely. Every API response is served with implicit `no-cache` behavior. The developer might add application-level caching (Redis, in-memory) to speed up responses, while completely ignoring that the browser already has a built-in cache that could prevent the request from being made at all. Or worse, they set aggressive cache headers without understanding them, and users see stale data for hours with no way to force a refresh.

```python
# No caching headers -- browser fetches this fresh on every single request
@app.route('/api/products')
def get_products():
    products = db.query(Product).filter_by(active=True).all()
    return jsonify([p.to_dict() for p in products])
    # This data changes maybe once a day.
    # It's fetched 10,000 times per hour.
    # Every single request hits the database.

# Or the opposite mistake -- aggressive caching without validation
@app.route('/api/user/profile')
def get_profile():
    user = get_current_user()
    response = jsonify(user.to_dict())
    response.headers['Cache-Control'] = 'max-age=86400'  # Cache for 24 hours
    return response
    # User changes their name. Still sees the old name for a day.
    # No ETag, no way to validate. Must wait for cache to expire.
```

The correct approach uses appropriate headers for each resource type:
```python
# Public, rarely-changing data: cache aggressively with validation
@app.route('/api/products')
def get_products():
    products = db.query(Product).filter_by(active=True).all()
    data = [p.to_dict() for p in products]
    etag = hashlib.md5(json.dumps(data).encode()).hexdigest()

    if request.headers.get('If-None-Match') == etag:
        return '', 304  # "Nothing changed, use your cached copy"

    response = jsonify(data)
    response.headers['Cache-Control'] = 'public, max-age=300'  # 5 min without checking
    response.headers['ETag'] = etag  # After 5 min, validate before reusing
    return response

# Private, user-specific data: short cache with must-revalidate
@app.route('/api/user/profile')
def get_profile():
    user = get_current_user()
    response = jsonify(user.to_dict())
    response.headers['Cache-Control'] = 'private, no-cache'  # Always validate
    response.headers['ETag'] = user.updated_at.isoformat()
    return response
```

## Recognition Signal
- No `Cache-Control`, `ETag`, or `Last-Modified` headers on any API response
- Network tab shows 200 responses for unchanged resources that should return 304
- Application-layer caching (Redis) exists but no HTTP caching -- the request still hits the server every time
- `Cache-Control: no-store` applied blanket to everything because "caching causes bugs"
- CDN is in front of the API but nothing is cached because no cache headers are set
- Static assets (JS, CSS, images) served without cache headers, causing full re-downloads on every page load
- Users report stale data but the developer doesn't know how to use ETags for conditional requests

## Related Concepts
**Application caching** happens at the server level (Redis, in-memory) and speeds up response generation, while HTTP caching prevents the request from reaching the server at all. They are complementary layers: application caching makes your server faster, HTTP caching makes the server unnecessary for repeated requests. **Cache invalidation** is simpler with HTTP caching's built-in mechanisms (ETags, `max-age` expiry) than with application caches, but still requires thought about what constitutes "changed." **API gateway pattern** is a natural place to implement HTTP caching centrally, adding cache headers to responses from multiple services. **Middleware pipelines** often include a caching middleware that handles ETag generation and 304 responses automatically.
