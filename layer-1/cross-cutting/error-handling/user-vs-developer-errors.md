---
id: user-vs-developer-errors
domain: cross-cutting
category: error-handling
depends_on:
  - error-boundaries
  - error-propagation
related:
  - error-typing
  - structured-logging
  - xss-prevention
anti_pattern_of: null
severity: important
---

# User vs Developer Errors

## Definition
Every error in an application has two audiences -- the end user who needs to know what to do next, and the developer who needs to know what went wrong -- and these audiences require fundamentally different information.

## Why It Matters
When you show developer errors to users, two bad things happen. First, users see "TypeError: Cannot read property 'address' of undefined" and have no idea what to do about it -- they lose trust and leave. Second, you leak implementation details that attackers can use: database table names, file paths, library versions, internal service URLs. When you show user errors to developers, the inverse problem occurs: "Something went wrong, please try again" in your log files tells you nothing about what actually broke. You end up unable to debug production issues because your logs are as vague as your error pages.

## The Anti-Pattern
A self-taught developer typically uses a single error message for both audiences. The raw exception message goes straight to the user interface, or a generic "Something went wrong" message goes to both the user and the log file:

```javascript
// Raw error straight to the user
app.get('/profile', async (req, res) => {
  try {
    const user = await db.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    res.json(user.rows[0]);
  } catch (err) {
    // User sees: "relation \"users\" does not exist" or
    // "connect ECONNREFUSED 10.0.3.42:5432"
    res.status(500).json({ error: err.message });
  }
});

// Or the opposite: same vague message everywhere
app.get('/profile', async (req, res) => {
  try {
    const user = await db.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    res.json(user.rows[0]);
  } catch (err) {
    console.error('Something went wrong');  // Useless in logs
    res.status(500).json({ error: 'Something went wrong' });  // Useless to user
  }
});
```

## Recognition Signal
- API error responses containing stack traces, SQL queries, file paths, or internal IP addresses
- Log files full of generic messages like "error occurred" or "request failed" with no detail
- The same string literal used in both `console.error()` and the HTTP response body
- Users reporting errors by sending you screenshots of technical error messages they do not understand
- No error transformation layer between your business logic and your API responses
- Security audit findings about "information disclosure" or "verbose error messages"

## Related Concepts
**Error typing** is the mechanism that makes the split practical: a typed error carries both a user-safe message ("We couldn't load your profile. Please try again.") and developer-safe details (the original exception, the query that failed, the user ID). **Error boundaries** are where the split happens -- the boundary catches the developer error and emits the user error. **Structured logging** is the channel for developer errors: structured fields with request IDs, user context, and stack traces that never reach the user. **XSS prevention** is relevant because if you do render error messages in the DOM, they must be sanitized -- an attacker-controlled input that triggers an error message containing `<script>` tags is an injection vector.
