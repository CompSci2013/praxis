---
id: hot-vs-cold-observables
domain: frontend
category: reactive-programming
depends_on:
  - observables-and-subscriptions
related:
  - subscription-management
  - backpressure
  - reactive-programming-intro
anti_pattern_of: null
severity: recommended
---

# Hot vs Cold Observables

## Definition
A cold observable creates a new, independent execution for each subscriber (like a function call — each invocation runs from the start), while a hot observable shares a single execution among all subscribers (like a live broadcast — you get whatever is currently playing when you tune in).

## Why It Matters
Misunderstanding this distinction causes two major bugs. First: accidentally duplicating side effects. An HTTP GET observable is cold — subscribing twice makes two HTTP requests. If the developer subscribes once to display data and once to log it, the server receives two identical requests and the responses might differ. Second: missing data from hot observables. A WebSocket stream is hot — if you subscribe after it emits a critical message, that message is gone. Without understanding this, developers wonder why their late-subscribing component shows incomplete data.

## The Anti-Pattern
The developer creates an HTTP observable and subscribes to it in multiple places, unknowingly making duplicate requests. Or they create a WebSocket observable and expect a new subscriber to receive all historical messages (it won't — hot observables don't replay). They work around duplicate requests by adding caching layers or deduplication logic instead of using `share()` or `shareReplay()` to multicast the cold observable. They work around missed messages by adding polling to supplement the WebSocket instead of using `ReplaySubject` or `shareReplay(1)` to buffer the last value.

```
// Problem: cold observable subscribed twice = two HTTP requests
const user$ = this.http.get('/api/user/123');
user$.subscribe(user => this.headerName = user.name);   // Request #1
user$.subscribe(user => this.profileData = user);        // Request #2

// Fix: share the execution
const user$ = this.http.get('/api/user/123').pipe(
  shareReplay(1)  // Cache last value, share among subscribers
);
user$.subscribe(user => this.headerName = user.name);   // Request #1
user$.subscribe(user => this.profileData = user);        // Same result, no extra request

// Problem: hot observable, late subscriber misses data
const ws$ = new WebSocketSubject('wss://api.example.com/feed');
// First message arrives at T=0
// Component subscribes at T=1 — first message is lost

// Fix: buffer recent values
const ws$ = new WebSocketSubject('wss://api.example.com/feed').pipe(
  shareReplay(10)  // New subscribers get last 10 messages
);
```

## Recognition Signal
Check the Network tab: if the same API endpoint is called multiple times simultaneously with identical parameters, a cold observable is being subscribed to more than once. Look for observables stored in variables and subscribed to in multiple places without `share()` or `shareReplay()`. Look for components that show stale or missing data after late initialization — they may be subscribing to hot observables after critical emissions.

## Related Concepts
**Subscription management** applies to both hot and cold, but hot observables have an additional concern: they may emit data between the time a subscriber is created and the time it subscribes. **Backpressure** primarily affects hot observables because they emit on their own schedule regardless of consumer readiness. **Reactive programming intro** covers the foundational concepts that hot/cold builds upon.
