---
id: background-jobs
domain: backend
category: bulk-operations
depends_on:
  - separation-of-concerns
  - middleware-pipelines
related:
  - bulk-operations
  - cache-invalidation
  - application-caching
  - unit-of-work
anti_pattern_of: null
severity: critical
---

# Background Jobs

## Definition
Long-running or resource-intensive work that executes outside the request-response cycle -- queued and processed asynchronously so that the user gets an immediate response while the heavy lifting happens in the background.

## Why It Matters
An HTTP request should respond in under a few hundred milliseconds. But some operations take seconds or minutes: sending emails, generating reports, processing file uploads, syncing data to external systems, resizing images. Without background jobs, the user stares at a spinner while the server does all this work synchronously. If the connection drops, the work is lost. If the server restarts, in-flight operations disappear. If three users request large exports simultaneously, the web server becomes unresponsive for everyone. Background jobs decouple "accepting the work" from "doing the work," making your application responsive and your processing resilient.

## The Anti-Pattern
A self-taught developer typically does everything inline in the request handler. The user clicks "Export CSV" and waits 30 seconds while the server queries a million records, formats them, writes the file, and streams it back. The user clicks "Send Notification" and waits 5 seconds while the server calls the email API, which might timeout. If the email service is slow, every request that sends email is slow. If it's down, those requests fail.

```python
@app.route('/api/reports/generate', methods=['POST'])
def generate_report():
    # This takes 45 seconds. The user stares at a spinner.
    # If they close the tab, the report is lost.
    # If another user requests a report, both are slow.

    data = db.execute("""
        SELECT ... FROM orders
        JOIN products ON ...
        JOIN customers ON ...
        WHERE date >= %s
        GROUP BY ...
    """, [request.json['start_date']]).fetchall()  # 15 seconds

    csv_content = format_as_csv(data)  # 10 seconds for 500K rows
    upload_to_s3(csv_content)          # 5 seconds (network I/O)
    send_email(                        # 3 seconds (external API)
        to=request.user.email,
        subject='Your report is ready',
        attachment=csv_content
    )

    return jsonify({'status': 'done'})  # 33 seconds later

# If the email service is down, this entire endpoint fails.
# If 10 users request reports, the web server has 10 threads blocked for 30+ seconds.
```

With background jobs:
```python
@app.route('/api/reports/generate', methods=['POST'])
def generate_report():
    job = report_queue.enqueue(
        generate_report_task,
        user_id=request.user.id,
        start_date=request.json['start_date']
    )
    return jsonify({'job_id': job.id, 'status': 'queued'}), 202  # Immediate response

@app.route('/api/reports/status/<job_id>')
def report_status(job_id):
    job = report_queue.fetch_job(job_id)
    return jsonify({'status': job.get_status(), 'result': job.result})

# This runs in a separate worker process, not the web server
def generate_report_task(user_id, start_date):
    data = db.execute(...).fetchall()
    csv_content = format_as_csv(data)
    url = upload_to_s3(csv_content)
    send_email(to=get_user_email(user_id), subject='Report ready', body=url)
    return {'url': url}
    # If it fails, the job framework retries automatically.
    # If the server restarts, the job is still in the queue.
```

## Recognition Signal
- Request timeouts on endpoints that do heavy processing (report generation, file processing, batch emails)
- Users complain about long waits for operations that could be "we'll email you when it's done"
- External API failures (email, payment, SMS) make your own API endpoints fail
- No job queue library (Celery, Sidekiq, Bull, RQ) in the tech stack
- The web server's thread/worker count is the bottleneck during peak hours because threads are blocked on slow operations
- "Fire and forget" operations that call external APIs without retry logic -- if it fails, it fails silently
- Cron jobs that should be proper queued jobs (no retry, no monitoring, no concurrency control)

## Related Concepts
**Separation of concerns** is the principle: accepting work is one concern, doing work is another. The web server's job is to respond to HTTP requests. The worker's job is to process tasks. **Bulk operations** are a primary use case for background jobs -- importing 100,000 records should happen in a worker, not during an HTTP request. **Cache invalidation** and **application caching** interact with background jobs through cache warming: a background job can pre-compute expensive results and populate the cache before any user requests the data. **Unit of work** applies within background jobs too: a failed job should roll back cleanly, and the job framework should handle retries without creating duplicate work. **Middleware pipelines** in the web layer handle request validation and quick rejection, while background jobs handle the actual heavy processing.
