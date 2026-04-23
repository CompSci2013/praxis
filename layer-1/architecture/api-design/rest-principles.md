---
id: rest-principles
domain: architecture
category: api-design
depends_on:
  - separation-of-concerns
  - layered-architecture
related:
  - api-error-contracts
  - api-versioning
  - idempotency
  - pagination-strategies
  - module-boundaries
anti_pattern_of: null
severity: critical
---

# REST Principles

## Definition
REST (Representational State Transfer) is an architectural style for networked APIs built around resources identified by URLs, manipulated through standard HTTP verbs, with stateless interactions between client and server.

## Why It Matters
REST provides a shared vocabulary that every developer, tool, and framework understands. When your API follows REST conventions, consumers can predict behavior without reading documentation. `GET /users/123` fetches a user. `DELETE /users/123` removes one. `POST /users` creates one. This predictability reduces onboarding time, decreases bugs in client code, and makes your API compatible with every HTTP tool, library, and browser ever built.

When you ignore REST conventions, every endpoint becomes a snowflake. Consumers must read documentation for every call, and that documentation is always slightly out of date. Caching breaks because your GET requests have side effects. Retry logic breaks because your POST requests are not distinguished from PUT requests. API gateways, load balancers, and CDNs cannot optimize traffic because they cannot infer behavior from HTTP verbs.

## The Anti-Pattern
Self-taught developers typically build RPC-style APIs over HTTP -- using POST for everything and encoding the action in the URL or request body. The API looks like a list of function calls, not a set of resources.

```
# RPC-style (what self-taught developers build)
POST /api/getUser          { "userId": 123 }
POST /api/createUser       { "name": "Alice" }
POST /api/updateUser       { "userId": 123, "name": "Bob" }
POST /api/deleteUser       { "userId": 123 }
POST /api/getUserOrders    { "userId": 123 }
POST /api/searchUsers      { "query": "alice" }
POST /api/activateUser     { "userId": 123 }
POST /api/deactivateUser   { "userId": 123 }

# REST-style (resources + HTTP verbs)
GET    /api/users/123
POST   /api/users                    { "name": "Alice" }
PUT    /api/users/123                { "name": "Bob" }
DELETE /api/users/123
GET    /api/users/123/orders
GET    /api/users?q=alice
PATCH  /api/users/123                { "status": "active" }
PATCH  /api/users/123                { "status": "inactive" }
```

Other common REST violations:
- GET requests that modify data (bookmarks and crawlers will trigger side effects)
- No consistent URL structure (some use plural, some singular, some use query params, some use path segments)
- HTTP 200 for every response, with the actual status in the body (`{"status": "error", "code": 404}`)
- Deeply nested URLs that model the database schema: `/companies/1/departments/2/teams/3/members/4/tasks/5`
- Verbs in URLs when HTTP verbs already express the action: `POST /users/123/delete`

## Key REST Constraints

1. **Resources, not actions**: URLs identify nouns (`/users`, `/orders`), not verbs (`/createUser`)
2. **HTTP verbs for actions**: GET reads, POST creates, PUT replaces, PATCH updates partially, DELETE removes
3. **Statelessness**: Each request contains all information needed to process it. No server-side session state between requests
4. **Standard status codes**: 200 (OK), 201 (Created), 204 (No Content), 400 (Bad Request), 404 (Not Found), 409 (Conflict), 422 (Unprocessable Entity), 500 (Internal Error)
5. **Consistent pluralization**: `/users` (collection), `/users/123` (individual resource)
6. **Meaningful relationships**: `/users/123/orders` (orders belonging to user 123)

## Recognition Signal
- URLs containing verbs: `/api/getUser`, `/api/deleteOrder`
- All endpoints use POST regardless of operation
- Every response returns HTTP 200 with a custom status in the body
- No consistent pluralization (`/user` vs `/orders` vs `/product-catalog`)
- GET endpoints that modify state
- Response shapes change unpredictably between endpoints
- No HATEOAS or even basic link relations -- clients hard-code all URLs

## Related Concepts
**API error contracts** standardize the error response format within a REST API, making error handling as predictable as success handling. **API versioning** addresses how to evolve REST endpoints over time without breaking existing clients. **Idempotency** determines which operations are safe to retry -- GET, PUT, and DELETE should be idempotent; POST generally is not. **Pagination strategies** handle the problem of returning large collections via GET endpoints. **Layered architecture** places REST endpoints in the presentation layer -- they should delegate to a business logic layer, not contain business rules themselves. **Module boundaries** apply to API design: related endpoints should be grouped into cohesive modules (user endpoints, order endpoints, billing endpoints).
