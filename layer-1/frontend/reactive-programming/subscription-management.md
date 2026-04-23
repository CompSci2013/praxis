---
id: subscription-management
domain: frontend
category: reactive-programming
depends_on:
  - observables-and-subscriptions
  - cleanup-on-destroy
related:
  - component-lifecycle
  - memory-leak-prevention
  - hot-vs-cold-observables
anti_pattern_of: null
severity: critical
---

# Subscription Management

## Definition
Every subscription to an observable must have a defined teardown strategy — either the observable completes naturally, the subscription is explicitly unsubscribed, or a higher-order operator (takeUntil, take, first) automatically terminates it.

## Why It Matters
Unmanaged subscriptions are the most common source of memory leaks in Angular and RxJS-heavy applications. Each leaked subscription holds a reference to its callback closure, which holds references to the component instance, which holds references to all its properties and injected services. After navigating away and back 50 times, you have 50 zombie component instances processing data in the background, consuming CPU and memory, and potentially throwing errors when they try to update destroyed views.

## The Anti-Pattern
The developer subscribes in `ngOnInit` and never unsubscribes. The component works during development because the developer never navigates away. In production, after hours of use, the application slows down. The developer's fix is often to add a boolean guard (`if (this.isAlive)`) inside the callback — which prevents the error but not the leak. The subscription is still active, the callback still fires, and the component is still in memory.

```
// Pattern 1: No management at all
ngOnInit() {
  this.route.params.subscribe(params => this.loadData(params.id));
  this.authService.user$.subscribe(user => this.user = user);
  this.websocket.messages$.subscribe(msg => this.handleMessage(msg));
  // Three subscriptions, zero cleanup. Three leaks per navigation cycle.
}

// Pattern 2: Manual tracking (tedious, error-prone)
private subs: Subscription[] = [];
ngOnInit() {
  this.subs.push(this.route.params.subscribe(...));
  this.subs.push(this.authService.user$.subscribe(...));
  // Easy to forget one
}
ngOnDestroy() {
  this.subs.forEach(s => s.unsubscribe());
}

// Pattern 3: takeUntil (recommended)
private destroy$ = new Subject<void>();
ngOnInit() {
  this.route.params.pipe(takeUntil(this.destroy$)).subscribe(...);
  this.authService.user$.pipe(takeUntil(this.destroy$)).subscribe(...);
  this.websocket.messages$.pipe(takeUntil(this.destroy$)).subscribe(...);
}
ngOnDestroy() {
  this.destroy$.next();
  this.destroy$.complete();
}

// Pattern 4: async pipe (best — framework manages subscription)
// In template: {{ data$ | async }}
```

## Recognition Signal
Search the codebase for `.subscribe(` and check whether the enclosing component has an `ngOnDestroy` (Angular) or cleanup return in `useEffect` (React). Count subscriptions in `ngOnInit` vs. unsubscribe calls in `ngOnDestroy` — if the counts don't match, there are leaks. In browser DevTools, use the Performance or Memory tab: take a heap snapshot, navigate away and back 5 times, take another snapshot, and compare — growing object counts indicate leaked components.

## Related Concepts
**Cleanup on destroy** is the lifecycle principle that subscription management implements — subscriptions are one type of resource that must be released. **Component lifecycle** determines when cleanup happens. **Memory leak prevention** is the cross-cutting outcome. **Hot vs cold observables** matters because hot observables (like WebSocket streams) never complete on their own, making explicit unsubscription mandatory.
