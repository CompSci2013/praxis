---
id: api-gateway-pattern
domain: backend
category: api-patterns
depends_on:
  - separation-of-concerns
  - middleware-pipelines
related:
  - request-response-transformation
  - http-caching
  - application-caching
anti_pattern_of: null
severity: important
---

# API Gateway Pattern

## Definition
A single entry point that sits between clients and your backend services, handling routing, authentication, rate limiting, request transformation, and response aggregation so that individual services don't have to.

## Why It Matters
Without a gateway, every client must know the address of every backend service, authenticate separately with each one, and handle version differences across them. This couples your frontend directly to your backend topology -- if you split a service in two, every client must update. Rate limiting, logging, and auth checks get duplicated across services, implemented inconsistently, and inevitably forgotten in at least one place. The gateway is the seam where cross-cutting concerns live so your services can focus on business logic.

## The Anti-Pattern
A self-taught developer typically has the frontend call each backend service directly. The React app imports five different base URLs. Authentication tokens get validated in every single route handler across three different Express apps, each with slightly different error responses. When the team adds rate limiting, it goes into two of the three services but not the third. CORS headers are configured in four places with four different policies. The frontend contains routing logic that belongs on the server: "if the user wants orders, call service A; if they want inventory, call service B."

```javascript
// Frontend calling services directly -- scattered knowledge
const orders = await fetch('https://orders-api.example.com/v2/orders', {
  headers: { Authorization: token }
});
const inventory = await fetch('https://inventory.example.com/api/stock', {
  headers: { Authorization: token }  // same auth, different service
});
const user = await fetch('https://users-svc.internal:3001/profile', {
  headers: { Authorization: token }  // and again
});

// Now the frontend assembles data that the backend should compose
const enrichedOrders = orders.map(o => ({
  ...o,
  inStock: inventory.find(i => i.sku === o.sku)?.available,
  buyerName: user.name
}));
```

## Recognition Signal
- Frontend code contains multiple different API base URLs
- Authentication logic is copy-pasted across services with slight variations
- CORS is configured differently in each service
- Rate limiting exists in some services but not others
- Changing your backend topology requires frontend deployments
- You need to aggregate data from multiple services on the client side for a single view
- Service-to-service communication bypasses all the security checks your public API has

## Related Concepts
**Middleware pipelines** are the mechanism a gateway uses internally to process requests through auth, logging, rate limiting, and transformation stages. **Request-response transformation** is the gateway's ability to reshape payloads between what clients send and what services expect. **HTTP caching** and **application caching** become much more effective at the gateway layer because you have a single point to cache responses before they fan out to multiple services.
