---
id: metrics
domain: cross-cutting
category: observability
depends_on: []
related:
  - structured-logging
  - distributed-tracing
  - ci-cd-pipelines
anti_pattern_of: null
severity: important
---

# Metrics

## Definition
Metrics are numerical measurements of system behavior collected over time -- request counts, error rates, response latencies, queue depths, memory usage, and business-level indicators like signups per hour or revenue per minute.

## Why It Matters
Without metrics, you discover problems when users complain. By then, the issue has been affecting users for minutes or hours. With metrics, you discover problems within seconds of their onset: a spike in error rate, a climb in response latency, a drop in throughput. Metrics enable alerting ("page me when error rate exceeds 5%"), capacity planning ("we need more database connections by next month at this growth rate"), and deployment validation ("latency doubled after the last deploy -- roll back"). They turn operations from reactive firefighting into proactive monitoring. They also answer business questions: "How many users completed checkout today?" is a metric, not a log query.

## The Anti-Pattern
A self-taught developer relies entirely on logs for operational visibility. They have no dashboards, no alerts, no time-series data. When something seems slow, they add `console.time()` temporarily. When they want to know the error rate, they count log lines with `grep`. They find out about outages from user reports in a support channel:

```javascript
// "Metrics" via console.time -- ephemeral, local, and invisible to monitoring
app.get('/api/products', async (req, res) => {
  console.time('products-query');
  const products = await db.query('SELECT * FROM products');
  console.timeEnd('products-query');  // Prints to stdout, lost forever
  res.json(products);
});

// "Alerting" via checking Twitter for user complaints
// "Dashboard" via tailing production logs in a terminal
// "Capacity planning" via waiting until the server runs out of memory
```

No histograms tracking response time distribution. No counters tracking request volume. No gauges tracking active connections. No way to answer "is the system healthy right now?" without SSH-ing into production.

## Recognition Signal
- No monitoring dashboard for the application (Grafana, Datadog, CloudWatch -- nothing)
- The team discovers outages from user reports rather than automated alerts
- Performance questions are answered by running one-off log queries rather than checking a graph
- `console.time` / `console.timeEnd` used as the performance measurement strategy
- No time-series database (Prometheus, InfluxDB, CloudWatch Metrics) in the infrastructure
- Deploy decisions are made without checking any metrics before or after
- The only health check is "can I load the homepage in my browser?"

## Related Concepts
**Structured logging** provides the event-level detail that complements metrics. Metrics tell you *that* the error rate spiked; structured logs tell you *which* errors and *why*. **Distributed tracing** adds request-level visibility across services, filling the gap between per-service metrics and per-event logs. **CI/CD pipelines** should integrate with metrics for automated deployment validation: if error rate increases after deploy, the pipeline can automatically roll back.
