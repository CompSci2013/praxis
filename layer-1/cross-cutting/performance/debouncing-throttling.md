---
id: debouncing-throttling
domain: cross-cutting
category: performance
depends_on: []
related:
  - virtualization
  - lazy-loading-assets
  - metrics
anti_pattern_of: null
severity: important
---

# Debouncing and Throttling

## Definition
Debouncing delays execution of a function until a burst of calls stops (waiting for the user to finish typing), while throttling limits execution to at most once per time interval (firing at most every 200ms during continuous scrolling).

## Why It Matters
Without rate control, high-frequency events create catastrophic performance problems. A search input fires `onChange` on every keystroke. If each keystroke triggers an API call, typing "javascript" sends 10 requests in under 2 seconds -- 9 of which are immediately useless because the next character changed the query. Multiply by the number of concurrent users and you are DDoS-ing your own search endpoint. Scroll and resize events fire 60+ times per second. A scroll handler that recalculates layout on every event causes visible jank (dropped frames) because the browser cannot compute layout 60 times per second and still render smoothly. Debouncing and throttling are the difference between a responsive interface and one that freezes under normal use.

## The Anti-Pattern
A self-taught developer wires event handlers directly to expensive operations with no rate limiting:

```javascript
// API call on every keystroke -- fires 10 times for "javascript"
function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleChange = async (e) => {
    setQuery(e.target.value);
    // This fires on EVERY keystroke
    const res = await fetch(`/api/search?q=${e.target.value}`);
    const data = await res.json();
    setResults(data);
    // Race condition: results from "java" might arrive after results from "javascript"
  };

  return <input onChange={handleChange} />;
}

// Layout recalculation on every scroll event -- 60 calls/second
window.addEventListener('scroll', () => {
  // This runs 60+ times per second during scrolling
  const rect = element.getBoundingClientRect();
  element.style.transform = `translateY(${rect.top * 0.5}px)`;
  // The browser drops frames trying to keep up
});
```

The fix with debouncing:

```javascript
const debouncedSearch = useMemo(
  () => debounce(async (q) => {
    const res = await fetch(`/api/search?q=${q}`);
    setResults(await res.json());
  }, 300),  // Wait 300ms after the user stops typing
  []
);
```

## Recognition Signal
- `fetch()` or API calls inside `onChange` handlers on text inputs
- Scroll or resize handlers with no throttling that call `getBoundingClientRect()`, `offsetHeight`, or style mutations
- The Network tab shows rapid-fire identical API requests while typing
- The browser DevTools performance panel shows long tasks during scrolling
- `addEventListener('scroll', ...)` or `addEventListener('resize', ...)` with no wrapping function
- Users report the UI "stutters" or "freezes" during typing or scrolling
- API rate limit errors in production logs correlated with search or autocomplete features

## Related Concepts
**Virtualization** often needs throttling for its scroll handler -- the calculation of which items are visible during scrolling should be throttled to avoid layout thrashing. **Lazy loading assets** triggers on scroll events and benefits from throttled Intersection Observer callbacks. **Metrics** collection in the browser (tracking user interactions, measuring performance) should be debounced or batched to avoid generating excessive telemetry data that slows the client.
