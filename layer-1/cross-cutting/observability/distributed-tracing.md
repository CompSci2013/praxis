---
id: distributed-tracing
domain: cross-cutting
category: observability
depends_on:
  - structured-logging
  - metrics
related:
  - error-propagation
  - error-boundaries
anti_pattern_of: null
severity: recommended
---

# Distributed Tracing

## Definition
Distributed tracing assigns a unique trace ID to each incoming request and propagates it through every service, queue, and database call that request touches -- producing a complete timeline of the request's journey through the system.

## Why It Matters
In a system with multiple services, a single user action ("place an order") might involve the API gateway, the order service, the inventory service, the payment service, and the notification service. When that order takes 8 seconds instead of the expected 1 second, which service is slow? With per-service metrics, you can see that the payment service has high latency, but you cannot tell if *this specific request* was affected or which upstream call triggered the slow path. With distributed tracing, you see a waterfall view: API gateway (2ms) -> order service (5ms) -> inventory check (3ms) -> payment service (7800ms) -> notification (50ms). The payment service took 7.8 seconds -- and you can drill into the payment service's span to see it was waiting on a third-party API call. Root cause identified in 30 seconds instead of 30 minutes of log correlation.

## The Anti-Pattern
A self-taught developer either has no request correlation at all (each service logs independently, with no way to connect logs from different services for the same user request), or they implement a half-measure: a request ID generated at the edge that is logged by the first service but not propagated to downstream calls:

```javascript
// Request ID generated but not propagated
app.use((req, res, next) => {
  req.requestId = uuid();
  logger.info({ requestId: req.requestId, msg: 'Request received' });
  next();
});

// Downstream call loses the request ID
async function processOrder(order) {
  // This HTTP call to the payment service has no trace context
  const payment = await fetch('http://payment-service/charge', {
    method: 'POST',
    body: JSON.stringify({ amount: order.total })
    // No X-Request-ID header, no traceparent header
  });
  // The payment service has no idea this call relates to req.requestId
}
```

When the payment call is slow, the order service's logs show "payment call took 8s" but the payment service's logs have no way to find the corresponding request. The developer resorts to timestamp correlation -- "find me a payment service log entry within 500ms of this order service log entry with a similar amount" -- which is brittle and ambiguous.

## Recognition Signal
- No trace ID or request ID in HTTP headers between services
- Debugging cross-service issues requires matching timestamps across separate log streams
- Per-service dashboards exist but no cross-service request flow visualization
- The phrase "I think the slowness is in [service X] but I'm not sure" is common during incidents
- No OpenTelemetry, Jaeger, Zipkin, or equivalent tracing infrastructure
- Log entries from different services cannot be correlated for a single user request
- Incident resolution time is proportional to the number of services involved

## Related Concepts
**Structured logging** is the foundation -- trace IDs are most useful when they appear as structured fields in every log entry, enabling log aggregators to filter by trace. **Metrics** provide the bird's-eye view that tells you *something* is slow; tracing tells you *where* in the request path the slowness occurs. **Error propagation** has a parallel structure: just as errors propagate through application layers, traces propagate through service boundaries. **Error boundaries** in a distributed system are the service boundaries where traces create spans, letting you see exactly where an error originated and how it affected the calling chain.
