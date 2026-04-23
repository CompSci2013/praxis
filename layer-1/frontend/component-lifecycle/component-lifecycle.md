---
id: component-lifecycle
domain: frontend
category: component-lifecycle
depends_on: []
related:
  - cleanup-on-destroy
  - initialization-timing
  - local-component-state
  - subscription-management
anti_pattern_of: null
severity: critical
---

# Component Lifecycle

## Definition
Every UI component goes through a predictable sequence of phases — creation, rendering, updating, and destruction — and each phase has specific responsibilities that must be handled correctly.

## Why It Matters
When you don't understand the lifecycle, you put logic in the wrong phase. You fetch data before the DOM exists. You register event listeners that never get removed. You trigger state updates during rendering, causing infinite loops. The result is components that work in demos but break under real conditions: race conditions on navigation, memory leaks from abandoned subscriptions, and UI that flickers because updates happen out of order.

## The Anti-Pattern
A self-taught developer typically puts everything in the constructor or the top of the component function. Data fetching, DOM manipulation, event listener registration, and state initialization all happen in one undifferentiated block. When something breaks, they add `setTimeout` calls or boolean flags to "wait for things to be ready" rather than using the correct lifecycle hook. Another common pattern: triggering a state update inside the render method, causing the component to re-render itself in an infinite loop.

```
// Everything jammed into one place
function UserProfile({ userId }) {
  // DOM manipulation before DOM exists
  document.title = `User ${userId}`;

  // Data fetch on every render, not just mount
  fetch(`/api/users/${userId}`).then(r => r.json()).then(setUser);

  // Event listener added on every render, never removed
  window.addEventListener('resize', handleResize);

  return <div>...</div>;
}
```

## Recognition Signal
Look for: `setTimeout` used to "wait for the DOM," event listeners registered without corresponding removal, API calls that fire on every render instead of on mount or dependency change, components that flicker or flash content, console warnings about state updates on unmounted components, and boolean flags like `isMounted` used to suppress errors rather than fix the underlying timing issue.

## Related Concepts
**Cleanup on destroy** is the most commonly neglected lifecycle phase — everything acquired during mount must be released during destroy. **Initialization timing** addresses the specific question of when data and DOM references become available. **Local component state** interacts with the lifecycle because state updates trigger the update phase. **Subscription management** from reactive programming is a lifecycle concern — subscriptions created during mount must be torn down during destroy.
