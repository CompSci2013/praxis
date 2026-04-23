---
id: virtualization
domain: cross-cutting
category: performance
depends_on: []
related:
  - lazy-loading-assets
  - code-splitting
  - debouncing-throttling
anti_pattern_of: null
severity: recommended
---

# Virtualization

## Definition
Virtualization (or windowing) renders only the items currently visible in the viewport, plus a small buffer, instead of rendering the entire list to the DOM -- even when the underlying data set contains thousands or millions of items.

## Why It Matters
The DOM is expensive. Every element consumes memory, participates in layout calculations, and adds to the browser's rendering work. A list of 10,000 items with each item containing an avatar, name, description, and action buttons creates 50,000+ DOM nodes. The browser must lay out all of them, even though the user can only see ~20 at a time. The result is a page that takes seconds to render initially, janks on every scroll, and uses hundreds of megabytes of memory. On mobile devices, this can crash the browser tab. Virtualization renders only the ~20 visible items (plus ~10 buffer items for smooth scrolling), recycling DOM nodes as the user scrolls. The dataset can be infinite; the DOM stays small.

## The Anti-Pattern
A self-taught developer maps over the entire array and renders every item:

```javascript
function UserList({ users }) {
  // 10,000 users = 10,000 DOM nodes rendered simultaneously
  return (
    <div className="user-list">
      {users.map(user => (
        <div key={user.id} className="user-card">
          <img src={user.avatar} />
          <h3>{user.name}</h3>
          <p>{user.bio}</p>
          <button onClick={() => followUser(user.id)}>Follow</button>
        </div>
      ))}
    </div>
  );
}
```

When this gets slow, they typically try two wrong fixes: pagination (which works but changes the UX from infinite scroll to click-to-load-more) or adding `loading="lazy"` to images (which helps image bandwidth but does not reduce DOM node count -- the browser still renders 10,000 divs).

## Recognition Signal
- A `.map()` call that renders hundreds or thousands of items with no windowing library
- The Elements panel in DevTools shows thousands of nearly identical DOM nodes
- Scrolling through a long list is visibly janky or slow
- Memory usage climbs as the user loads more data (infinite scroll without virtualization)
- The page becomes unresponsive after loading several pages of paginated data (appending without removing)
- Browser tab crashes on mobile when viewing large datasets
- React DevTools shows thousands of component instances for a single list

## Related Concepts
**Lazy loading assets** complements virtualization: virtualization controls which DOM nodes exist, lazy loading controls which assets (images, data) are fetched. Together, they ensure you only render what is visible and only load what is rendered. **Code splitting** applies the same "load only what you need" philosophy at the JavaScript module level. **Debouncing and throttling** is used within virtualization implementations to control how often the visible range is recalculated during rapid scrolling.
