---
id: observables-and-subscriptions
domain: frontend
category: reactive-programming
depends_on:
  - reactive-programming-intro
related:
  - subscription-management
  - hot-vs-cold-observables
  - cleanup-on-destroy
anti_pattern_of: null
severity: important
---

# Observables and Subscriptions

## Definition
An observable is a lazy producer of multiple values over time, and a subscription is the act of a consumer connecting to that producer — the observable does nothing until something subscribes to it, and the subscription is the handle used to disconnect.

## Why It Matters
Understanding the producer/consumer contract is essential for avoiding two classes of bugs. First: if you don't understand that observables are lazy, you'll create them and wonder why nothing happens (no subscriber = no execution). Second: if you don't understand that the subscription is a resource that must be managed, you'll create memory leaks (subscriptions that outlive their components keep callbacks alive, processing data for UI that no longer exists). Every RxJS operator, every Angular HTTP call, every event stream follows this contract.

## The Anti-Pattern
The developer treats observables like promises — "fire and forget." They call `.subscribe()` and discard the return value (the subscription object), making it impossible to cancel later. They subscribe to the same observable multiple times without realizing each subscription creates an independent execution (for cold observables), doubling HTTP requests. They put logic in an observable pipeline but forget to subscribe, and the logic never runs.

```
// Fire-and-forget subscription — no way to cancel
ngOnInit() {
  this.dataService.getUpdates().subscribe(data => {
    this.data = data; // Still runs after component is destroyed
  });
  // The Subscription object is discarded. Cannot unsubscribe.
}

// Observable created but never subscribed — nothing happens
const request$ = this.http.get('/api/data').pipe(
  tap(data => console.log('Got data:', data)),
  map(data => this.transform(data))
);
// Developer wonders why the console.log never fires.
// Missing: request$.subscribe()

// Accidental double subscription
const data$ = this.http.get('/api/expensive-query');
data$.subscribe(d => this.chartData = d);   // HTTP request #1
data$.subscribe(d => this.tableData = d);    // HTTP request #2 (duplicate!)
// Fix: share() the observable, or subscribe once and assign both
```

## Recognition Signal
Look for `.subscribe()` calls whose return value is not stored in a variable. Look for `.subscribe()` calls in `ngOnInit` without corresponding unsubscribe in `ngOnDestroy`. Look for HTTP observables subscribed to more than once (search for the same `http.get` call appearing in multiple `.subscribe()` chains). Look for observables that are created but never subscribed to — a pipeline that ends without `.subscribe()`, `| async` pipe, or `toPromise()`.

## Related Concepts
**Subscription management** is the discipline of tracking and cleaning up subscriptions — it's the "what to do about it" answer to the problems described here. **Hot vs cold observables** determines whether multiple subscriptions share one execution or each get their own — critical for understanding the duplicate HTTP request problem. **Cleanup on destroy** is the component lifecycle hook where subscription cleanup must happen.
