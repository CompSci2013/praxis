---
id: error-typing
domain: cross-cutting
category: error-handling
depends_on:
  - error-boundaries
  - error-propagation
related:
  - user-vs-developer-errors
  - structured-logging
anti_pattern_of: null
severity: important
---

# Error Typing

## Definition
Error typing means representing errors as structured, typed objects with specific fields and categories rather than as generic exceptions or bare strings.

## Why It Matters
When all errors are the same type -- a generic `Error` with a message string -- your error handling code cannot make intelligent decisions. Is this error a "user not found" that should return a 404, or a "database connection failed" that should return a 503 and page someone? With string-only errors, you end up parsing error messages with string matching (`if (err.message.includes('not found'))`), which breaks the moment someone rephrases the message. With typed errors, your error boundaries can use the type system to route errors correctly, your API layer can map error types to HTTP status codes automatically, and your logging layer knows which fields to extract.

## The Anti-Pattern
A self-taught developer typically throws bare strings or generic Error objects with ad-hoc message formats. Error handling then devolves into string parsing:

```javascript
// Throwing strings or generic errors
function getUser(id) {
  const user = db.findById(id);
  if (!user) throw new Error('User not found');         // Which user? What context?
  if (user.banned) throw new Error('User is banned');   // Same Error type, different meaning
  return user;
}

// Handling by parsing message strings -- fragile and error-prone
app.get('/users/:id', async (req, res) => {
  try {
    const user = await getUser(req.params.id);
    res.json(user);
  } catch (err) {
    if (err.message.includes('not found')) {
      res.status(404).json({ error: 'Not found' });
    } else if (err.message.includes('banned')) {
      res.status(403).json({ error: 'Forbidden' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});
```

If someone changes "User not found" to "No user with that ID" the 404 logic silently breaks and returns a 500 instead. The string matching is invisible coupling.

## Recognition Signal
- `if (err.message.includes(...))` or regex matching on error messages
- All thrown errors are `new Error('some string')` with no subclasses or error codes
- HTTP status codes determined by inspecting error message text
- Catch blocks with long `if/else` chains trying to distinguish error types
- Error messages that are phrased for humans rather than structured for code ("Unable to find user John in the database")
- No custom error classes or error code enums anywhere in the codebase

## Related Concepts
**Error boundaries** become much more powerful when errors are typed -- a boundary can catch `NotFoundError` and return 404, catch `ValidationError` and return 400, and catch everything else as 500, all without string parsing. **Error propagation** benefits because typed errors can carry structured context (the entity type, the ID that was not found, the validation rules that failed) through the propagation chain. **User vs developer errors** is naturally modeled by typed errors: the type determines the user-facing message template, while the structured fields provide developer diagnostics. **Structured logging** pairs with error typing because typed error fields map directly to structured log fields.
