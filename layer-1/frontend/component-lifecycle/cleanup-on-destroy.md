---
id: cleanup-on-destroy
domain: frontend
category: component-lifecycle
depends_on:
  - component-lifecycle
related:
  - subscription-management
  - memory-leak-prevention
  - observables-and-subscriptions
anti_pattern_of: null
severity: critical
---

# Cleanup on Destroy

## Definition
Every resource a component acquires during its lifetime — event listeners, subscriptions, timers, WebSocket connections, DOM references — must be explicitly released when that component is destroyed.

## Why It Matters
Failure to clean up is the single most common source of memory leaks in frontend applications. Each time a user navigates away from a view and back, the leaked resources accumulate. After 20 navigation cycles, you have 20 orphaned WebSocket connections, 20 `setInterval` timers firing into the void, and 20 event listeners attached to `window`. The application gets progressively slower, consumes more memory, and eventually the browser tab crashes. Worse, callbacks from destroyed components can try to update state that no longer exists, causing runtime errors.

## The Anti-Pattern
The developer sets up a `setInterval`, an event listener, or a WebSocket connection when the component mounts, but never writes the cleanup code. They might not even know cleanup is possible. The component "works" in development because the developer rarely navigates away during testing. The leak only manifests after sustained use by real users.

```
// React: no cleanup
useEffect(() => {
  const interval = setInterval(fetchNotifications, 30000);
  window.addEventListener('online', handleOnline);
  const ws = new WebSocket('wss://api.example.com/feed');
  // No return function. All three leak on unmount.
}, []);

// Angular: no ngOnDestroy
export class DashboardComponent implements OnInit {
  ngOnInit() {
    this.dataService.stream$.subscribe(data => this.data = data);
    // Subscription never unsubscribed
  }
}
```

## Recognition Signal
Search for `addEventListener` without a corresponding `removeEventListener`. Search for `setInterval` or `setTimeout` without `clearInterval` or `clearTimeout`. Search for `.subscribe(` without a corresponding unsubscribe mechanism. Look for components that lack a destroy/unmount hook entirely. In React, look for `useEffect` callbacks that don't return a cleanup function. In Angular, look for components that subscribe to observables but don't implement `OnDestroy`. In the browser DevTools, check if the number of event listeners grows as you navigate between pages.

## Related Concepts
**Subscription management** is the reactive programming equivalent of this principle — every `subscribe` needs an `unsubscribe`. **Memory leak prevention** is the cross-cutting concern that this principle directly addresses. **Observables and subscriptions** provide the abstraction that makes cleanup easier when used correctly (operators like `takeUntil` can automate teardown).
