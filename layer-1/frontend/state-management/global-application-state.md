---
id: global-application-state
domain: frontend
category: state-management
depends_on:
  - state-management-patterns
  - shared-state
related:
  - unidirectional-data-flow
  - state-normalization
  - url-as-state
anti_pattern_of: null
severity: important
---

# Global Application State

## Definition
Global state is data that must be accessible from anywhere in the application and whose changes affect behavior across multiple, unrelated features — the authenticated user, permission sets, feature flags, locale/language preference, and theme.

## Why It Matters
Global state is the most powerful and most dangerous tier. It provides a single source of truth that any component can access without prop drilling. But every piece of data you put in the global store increases coupling: any component can depend on it, any component can (if poorly designed) modify it, and changes to the store's shape require auditing every consumer. Misuse of global state is the leading cause of frontend applications that become impossible to refactor because everything depends on everything.

## The Anti-Pattern
The developer treats the global store as a general-purpose database for the entire UI. Server response caches, form states, pagination cursors, modal visibility flags, drag-and-drop coordinates — all global. The store file grows to thousands of lines. Action types number in the hundreds. A new developer can't add a feature without understanding the entire store shape. Performance degrades because changing the drag position of an element triggers re-renders in the notification badge component on the other side of the screen (they share the same store subscription).

```
// Store that has become a junk drawer
{
  auth: { user, token, permissions },     // Legitimately global
  theme: 'dark',                          // Legitimately global
  // Everything below should NOT be here:
  products: { items: [...], page: 2, filters: {...} },
  cart: { items: [...], promoCode: '' },
  checkout: { step: 3, shippingAddress: {...}, paymentMethod: {...} },
  ui: {
    productImageZoomLevel: 1.5,
    cartDrawerOpen: false,
    checkoutFormErrors: {...}
  }
}
```

## Recognition Signal
If you can remove a section of the global store and only one route/feature breaks, it wasn't truly global — it was shared or local state masquerading as global. Count the number of components that read each store key. If a key is read by fewer than 3 components, it probably doesn't belong in the global store. If the store's type definition is longer than 100 lines, it's likely overloaded.

## Related Concepts
**Unidirectional data flow** is critical for global state — without strict rules about how global state changes (actions, dispatchers, reducers), it becomes a free-for-all of mutations that can't be traced. **State normalization** matters most at the global level because global data (like entity caches) tends to be relational and nested. **URL as state** overlaps with global state for navigation concerns — the current route is application-wide, but the URL is often a better owner than the store.
