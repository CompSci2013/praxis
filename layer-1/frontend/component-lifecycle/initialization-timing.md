---
id: initialization-timing
domain: frontend
category: component-lifecycle
depends_on:
  - component-lifecycle
related:
  - loading-error-empty-states
  - local-component-state
  - route-resolvers
anti_pattern_of: null
severity: important
---

# Initialization Timing

## Definition
During component creation, different resources become available at different times — constructor runs before render, render runs before DOM insertion, and external data arrives asynchronously after all of the above.

## Why It Matters
When you assume everything is available immediately, you get null reference errors, blank screens, and race conditions. A component that tries to measure its DOM element's width before it's inserted into the page gets zero. A component that reads props passed from a parent that hasn't finished its own data fetch gets undefined. A component that assumes an API response is ready on first render skips the loading state and shows broken UI or empty tables that look like bugs to users.

## The Anti-Pattern
The developer treats component initialization as a single atomic moment. They access DOM elements in the constructor. They assume props will always contain data (not null or undefined). They don't account for the async gap between "component rendered" and "data arrived." When things break, they add defensive checks scattered throughout the template (`data && data.items && data.items.length > 0 && ...`) rather than designing for the loading state as a first-class concern.

```
// Accessing DOM before it exists
class ChartComponent {
  constructor() {
    // This element doesn't exist yet
    this.canvas = document.getElementById('chart');
    this.canvas.getContext('2d'); // null reference error
  }
}

// Assuming data exists on first render
function OrderList({ orders }) {
  // Crashes when orders is undefined during parent's loading state
  return (
    <table>
      {orders.map(order => <Row key={order.id} order={order} />)}
    </table>
  );
}
```

## Recognition Signal
Look for: optional chaining chains longer than two levels deep (`data?.user?.profile?.avatar?.url`), which suggest the developer is working around data that hasn't arrived yet instead of handling the loading state. Look for `document.getElementById` or `document.querySelector` in constructors or component function bodies (outside effects). Look for components that flash empty content before data loads. Look for race conditions where navigating quickly between pages shows data from the previous page.

## Related Concepts
**Loading, error, and empty states** is the UI pattern that correctly handles the async gap — every data-driven view needs all three. **Local component state** is where loading/error flags live during initialization. **Route resolvers** are one strategy for eliminating the async gap entirely by ensuring data is available before the component mounts.
