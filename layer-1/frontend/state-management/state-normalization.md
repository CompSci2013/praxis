---
id: state-normalization
domain: frontend
category: state-management
depends_on:
  - state-management-patterns
  - global-application-state
related:
  - derived-state
  - unidirectional-data-flow
anti_pattern_of: null
severity: recommended
---

# State Normalization

## Definition
State normalization is the practice of storing data in flat lookup tables keyed by ID, with relationships expressed as ID references rather than nested objects — the same principle as database normalization applied to client-side state.

## Why It Matters
Nested data structures create two problems. First, duplication: if a user appears in 10 different comment objects, updating that user's avatar means finding and updating 10 different nested copies. Miss one, and the UI shows stale data in one place. Second, access complexity: to find a specific comment, you might need to traverse `posts[i].comments[j]`, requiring you to know the post index to access a comment. Normalized state gives you `comments[commentId]` — direct access regardless of where it appears in the UI.

## The Anti-Pattern
The developer stores API responses exactly as the server sent them — deeply nested JSON. A blog post contains an array of comments, each comment contains a user object, and the user object contains their profile. When the user updates their avatar, the developer either re-fetches the entire post (wasteful) or writes a brittle deep-update function that navigates 4 levels into the tree to find every occurrence of that user.

```
// Nested: API response shape stored directly
{
  posts: [
    {
      id: 1,
      author: { id: 10, name: 'Alice', avatar: '...' },
      comments: [
        {
          id: 100,
          author: { id: 10, name: 'Alice', avatar: '...' }, // Duplicate
          text: 'Great post'
        },
        {
          id: 101,
          author: { id: 11, name: 'Bob', avatar: '...' },
          text: 'Thanks'
        }
      ]
    }
  ]
}

// Normalized: flat tables with ID references
{
  posts: { byId: { 1: { id: 1, authorId: 10, commentIds: [100, 101] } }, allIds: [1] },
  comments: { byId: { 100: { id: 100, authorId: 10, text: 'Great post' }, 101: { id: 101, authorId: 11, text: 'Thanks' } }, allIds: [100, 101] },
  users: { byId: { 10: { id: 10, name: 'Alice', avatar: '...' }, 11: { id: 11, name: 'Bob', avatar: '...' } }, allIds: [10, 11] }
}
```

## Recognition Signal
Look for deeply nested `map` calls in templates — `posts.map(p => p.comments.map(c => ...))`. Look for spread operators 3+ levels deep in reducers: `{ ...state, posts: { ...state.posts, [id]: { ...state.posts[id], comments: ... } } }`. Look for data duplication: the same entity (user, product) appearing as a full object in multiple places in the store. Look for stale data bugs where updating an entity fixes it in one view but not another.

## Related Concepts
**Derived state** is the companion skill — once data is normalized, you derive the nested shapes needed for display (e.g., "post with its comments and their authors") using selectors. You store flat, you display nested. **Unidirectional data flow** benefits from normalization because updates to a single entity flow predictably to all views that reference it. **Global application state** is where normalization matters most, since shared entity caches are the primary candidate for this treatment.
