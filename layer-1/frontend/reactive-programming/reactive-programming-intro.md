---
id: reactive-programming-intro
domain: frontend
category: reactive-programming
depends_on: []
related:
  - observables-and-subscriptions
  - subscription-management
  - backpressure
  - hot-vs-cold-observables
  - unidirectional-data-flow
anti_pattern_of: null
severity: important
---

# Reactive Programming Introduction

## Definition
Reactive programming is a paradigm where you declare relationships between data streams and transformations, and the system automatically propagates changes — instead of writing step-by-step instructions for how to respond to each event.

## Why It Matters
Frontend applications are inherently asynchronous: user clicks, HTTP responses, WebSocket messages, timer ticks, window resizes, and animation frames all happen at unpredictable times. Imperative code for coordinating these events becomes deeply nested callback chains with complex boolean flags tracking which events have fired. Reactive programming provides composable operators (map, filter, merge, debounce, switchMap) that express complex async coordination in declarative pipelines. Without it, developers reinvent these patterns poorly with ad hoc flags and nested callbacks.

## The Anti-Pattern
The developer manages async coordination with nested callbacks, boolean flags, and manual state tracking. A search-as-you-type feature needs to: debounce keystrokes, cancel previous in-flight requests when a new keystroke arrives, handle errors, and ignore results from stale requests. The imperative version has a `timeoutId`, an `abortController`, a `lastRequestId`, and a `try/catch` nested 3 levels deep. Adding a new requirement (e.g., show cached results while fetching) means restructuring the entire flow.

```
// Imperative: search-as-you-type with debounce and cancellation
let timeoutId = null;
let abortController = null;
let requestId = 0;

searchInput.addEventListener('input', (e) => {
  clearTimeout(timeoutId);
  timeoutId = setTimeout(async () => {
    if (abortController) abortController.abort();
    abortController = new AbortController();
    const myRequestId = ++requestId;
    try {
      const res = await fetch(`/search?q=${e.target.value}`, {
        signal: abortController.signal
      });
      if (myRequestId !== requestId) return; // stale
      const data = await res.json();
      renderResults(data);
    } catch (err) {
      if (err.name !== 'AbortError') showError(err);
    }
  }, 300);
});

// Reactive: same behavior in a declarative pipeline
fromEvent(searchInput, 'input').pipe(
  debounceTime(300),
  map(e => e.target.value),
  distinctUntilChanged(),
  switchMap(query => from(fetch(`/search?q=${query}`)).pipe(
    catchError(() => EMPTY)
  ))
).subscribe(renderResults);
```

## Recognition Signal
Look for: multiple `setTimeout`/`clearTimeout` pairs managing debounce logic, boolean flags like `isLoading`, `isStale`, `hasFetched` coordinating async flows, nested `Promise.then` chains or deeply nested `async/await` with manual cancellation, and callback hell where the nesting depth exceeds 3 levels. If the same async coordination pattern (debounce, retry, cancel-previous) is reimplemented in multiple places with slight variations, reactive programming would unify them.

## Related Concepts
**Observables and subscriptions** are the core abstraction that enables this paradigm. **Subscription management** addresses the cleanup obligation that comes with every subscription. **Backpressure** handles the case when reactive streams produce data faster than consumers can process. **Hot vs cold observables** determines whether streams are shared or independent. **Unidirectional data flow** from state management is the same principle applied to component hierarchies — data flows one way, and the system reacts to changes.
