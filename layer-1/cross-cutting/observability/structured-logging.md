---
id: structured-logging
domain: cross-cutting
category: observability
depends_on:
  - separation-of-concerns
related:
  - metrics
  - distributed-tracing
  - error-propagation
  - user-vs-developer-errors
anti_pattern_of: null
severity: important
---

# Structured Logging

## Definition
Structured logging produces log output as machine-parseable records with consistent, typed fields (JSON objects with keys like `timestamp`, `level`, `service`, `requestId`, `userId`, `duration`) rather than unstructured human-readable strings.

## Why It Matters
When your production service handles 1,000 requests per second and something goes wrong, you need to find the relevant log entries among millions. Unstructured logs like `"Error processing order for user john"` require regex parsing to extract the username, cannot be filtered by field in a log aggregator, and break when someone rephrases the message. Structured logs like `{"level":"error","service":"orders","userId":"john","orderId":"abc123","error":"payment_declined","duration_ms":342}` can be filtered (`userId=john AND level=error`), aggregated (average `duration_ms` grouped by `service`), and alerted on (`error` count > threshold) without any parsing. The difference between "we found the bug in 5 minutes" and "we spent 3 hours grepping through logs" is usually structured vs unstructured logging.

## The Anti-Pattern
A self-taught developer logs by sprinkling `console.log` statements with ad-hoc string formatting. Each log line has a different format. There is no request ID to correlate related log entries. Sensitive data appears in logs because there is no schema controlling what gets logged:

```javascript
// Ad-hoc unstructured logging
app.post('/orders', async (req, res) => {
  console.log('New order request from ' + req.body.email);
  console.log('Items: ' + JSON.stringify(req.body.items));

  try {
    const order = await createOrder(req.body);
    console.log('Order created: ' + order.id);
    // How do you find all logs for this specific order later?
    // How do you correlate this log with the payment processing log?
  } catch (err) {
    console.log('Order failed: ' + err.message);
    // Which user? Which items? What was the request ID?
    // If 50 orders fail simultaneously, which log lines go together?
  }
});
```

Every log line is a snowflake. In a log aggregator, these are just strings -- you cannot filter by userId, orderId, or error type without writing fragile regex patterns.

## Recognition Signal
- `console.log` used as the primary logging mechanism in production code
- Log messages built with string concatenation or template literals
- No consistent fields across log entries (some have timestamps, some do not; some have user IDs, some do not)
- Debugging production issues requires `grep` with complex regex patterns
- No request ID or correlation ID linking related log entries across a request lifecycle
- Sensitive data (passwords, tokens, full credit card numbers) appearing in log files
- Log entries that cannot be parsed by Elasticsearch, Datadog, or any log aggregation tool without custom parsing rules

## Related Concepts
**Metrics** provide numerical summaries (request count, error rate, p95 latency), while structured logs provide detailed records of individual events. They are complementary: metrics tell you something is wrong, logs tell you what specifically went wrong. **Distributed tracing** adds a trace ID that connects structured log entries across multiple services for a single request. **Error propagation** benefits from structured logging because each layer can add structured context (the repository adds the query, the service adds the business context, the controller adds the request ID) as the error propagates upward. **User vs developer errors** defines the audience split: structured logs are the developer channel.
