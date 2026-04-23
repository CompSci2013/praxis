---
id: backpressure
domain: frontend
category: reactive-programming
depends_on:
  - reactive-programming-intro
  - observables-and-subscriptions
related:
  - subscription-management
  - hot-vs-cold-observables
anti_pattern_of: null
severity: recommended
---

# Backpressure

## Definition
Backpressure is the condition where a data producer emits values faster than the consumer can process them, and the strategy chosen to handle the overflow — buffering, dropping, sampling, or throttling.

## Why It Matters
Frontend applications encounter backpressure constantly: mouse move events fire 60+ times per second, WebSocket feeds from financial APIs emit hundreds of messages per second, and window resize events fire continuously during a drag. If each event triggers a DOM update, layout recalculation, or API call, the browser's main thread saturates, the UI freezes, and the application becomes unresponsive. Backpressure strategies (debounce, throttle, sample, buffer) control the flow rate without losing important data.

## The Anti-Pattern
The developer attaches a handler directly to a high-frequency event and performs expensive work on every emission. A `mousemove` handler recalculates a tooltip position and re-renders a component 60 times per second. A `scroll` handler fires an analytics event on every pixel scrolled. A `resize` handler re-measures and re-lays-out the entire dashboard continuously. The developer notices the UI is janky and starts adding `requestAnimationFrame` calls or `setTimeout(..., 0)` hacks without understanding the underlying backpressure problem.

```
// No backpressure: expensive work on every mouse move
document.addEventListener('mousemove', (e) => {
  // This fires 60+ times per second
  const elements = document.elementsFromPoint(e.clientX, e.clientY);
  const tooltip = calculateTooltipContent(elements); // Expensive
  renderTooltip(tooltip);                             // DOM update
});

// With backpressure: sample at reasonable rate
fromEvent(document, 'mousemove').pipe(
  throttleTime(100),  // At most once per 100ms (10 fps — plenty for tooltips)
  map(e => document.elementsFromPoint(e.clientX, e.clientY)),
  map(elements => calculateTooltipContent(elements))
).subscribe(renderTooltip);

// Search input: debounce to wait for typing pause
fromEvent(searchInput, 'input').pipe(
  debounceTime(300),          // Wait 300ms after last keystroke
  map(e => e.target.value),
  distinctUntilChanged(),     // Don't re-fetch for same query
  switchMap(query => search(query))  // Cancel previous request
).subscribe(showResults);
```

## Recognition Signal
Open the browser's Performance tab and record while scrolling, resizing, or moving the mouse. If the flame chart shows dense, continuous blocks of JavaScript execution during these interactions, there's a backpressure problem. Look for event handlers on `scroll`, `resize`, `mousemove`, `input`, `keydown` that perform non-trivial work without debounce or throttle. Look for network tabs showing rapid-fire API calls triggered by user input.

## Related Concepts
**Subscription management** interacts with backpressure — a buffering strategy that accumulates data without bound is itself a memory leak. **Hot vs cold observables** is relevant because backpressure primarily affects hot observables (event streams, WebSockets) that emit regardless of whether anyone is ready to consume.
