---
id: error-boundaries
domain: cross-cutting
category: error-handling
depends_on:
  - separation-of-concerns
related:
  - error-propagation
  - user-vs-developer-errors
  - error-typing
  - component-lifecycle
anti_pattern_of: null
severity: critical
---

# Error Boundaries

## Definition
An error boundary is a designated point in your application where errors are caught, transformed into appropriate responses, and prevented from cascading further.

## Why It Matters
Without explicit error boundaries, a single unexpected null, a failed API call, or a malformed database row crashes the entire application. In a frontend app, one broken component takes down the whole page. In a backend service, one unhandled promise rejection crashes the process and drops every in-flight request. Error boundaries contain the blast radius. A failing product recommendation widget should not prevent the user from checking out. A malformed row in a batch job should not abort processing the other 99,999 rows.

## The Anti-Pattern
A self-taught developer typically does one of two extremes. Either they add no error handling at all, relying on the framework's default behavior (a white screen in React, a 500 page in Express), or they wrap everything in a single top-level try/catch that swallows all errors indiscriminately:

```javascript
// The "catch everything, handle nothing" pattern
app.get('/dashboard', async (req, res) => {
  try {
    const user = await getUser(req.userId);
    const orders = await getOrders(user.id);
    const recommendations = await getRecommendations(user.id);
    const analytics = await getAnalytics(user.id);
    res.json({ user, orders, recommendations, analytics });
  } catch (err) {
    console.log('Something went wrong');
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

If recommendations fail, the user gets nothing -- not even their own order history. There is no boundary between critical data (user, orders) and supplementary data (recommendations, analytics).

## Recognition Signal
- A single try/catch wrapping an entire route handler or component tree
- `catch (err) { console.log(err) }` with no differentiated response
- A frontend where any JavaScript error shows a blank white page
- Backend responses that are always either full success or total failure, with no partial results
- No React Error Boundary components (or framework equivalent) anywhere in the component tree
- The phrase "it works unless..." followed by a scenario where one subsystem failing breaks everything

## Related Concepts
**Error propagation** defines how errors travel from where they occur to where a boundary catches them -- boundaries are meaningless if errors do not flow to them correctly. **User vs developer errors** determines what the boundary *does* with the caught error: show a friendly message, log diagnostics, or both. **Error typing** makes boundaries smarter by letting them distinguish between a "not found" error that should show a 404 and a "database down" error that should trigger an alert. **Component lifecycle** matters because in frontend frameworks, error boundaries must hook into the rendering lifecycle to catch errors during render, not just during event handlers.
