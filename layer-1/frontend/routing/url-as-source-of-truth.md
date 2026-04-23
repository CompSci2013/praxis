---
id: url-as-source-of-truth
domain: frontend
category: routing
depends_on:
  - declarative-routing
related:
  - url-as-state
  - deep-linking
  - unidirectional-data-flow
anti_pattern_of: null
severity: critical
---

# URL as Source of Truth

## Definition
The URL determines what the application displays — the application reads the URL and renders accordingly, rather than the application deciding what to show and then updating the URL as an afterthought.

## Why It Matters
When the URL drives the application, the browser's native navigation works correctly: back, forward, refresh, bookmark, and link sharing all behave as users expect. When the application drives the URL, these behaviors break in subtle ways. The user clicks back and nothing happens (or the wrong thing happens). They refresh and land on a different page than what they were viewing. They share a link and the recipient sees the home page instead of the specific view. These failures erode user trust and make the application feel unreliable compared to traditional server-rendered pages.

## The Anti-Pattern
The developer builds navigation as a state machine inside the application: clicking a link calls a function that sets a state variable, which conditionally renders a new component, which then calls `history.pushState` to update the URL as a cosmetic concern. The URL is a mirror of application state, not the source of it. The problems appear when the URL is accessed independently of the state machine — direct navigation via the address bar, refresh, or back button. Since the state machine didn't run, the application doesn't know what to render.

```
// Anti-pattern: application state drives the URL
function App() {
  const [currentPage, setCurrentPage] = useState('home');

  const navigate = (page) => {
    setCurrentPage(page);                    // State changes first
    window.history.pushState({}, '', `/${page}`);  // URL updated as afterthought
  };

  // On refresh: currentPage defaults to 'home', regardless of URL
  // Back button: URL changes but currentPage doesn't update
  switch (currentPage) {
    case 'home': return <Home />;
    case 'dashboard': return <Dashboard />;
  }
}

// Correct: URL drives the application
function App() {
  // Router reads the URL and renders the matching component
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
  // Refresh works. Back works. Bookmarks work. Links work.
}
```

## Recognition Signal
Test the app by navigating to a page, then refreshing. If the app resets to the home page or shows the wrong content, the URL is not the source of truth. Test the back button after navigating through 3 pages — if it doesn't work or skips pages, the application is managing history incorrectly. Look for `window.history.pushState` or `window.history.replaceState` calls that happen after state changes rather than before — the URL should cause the state change, not follow it.

## Related Concepts
**URL as state** in the state management section covers the same principle from the data perspective — here we focus on how routing architecture should be structured. **Deep linking** is the practical outcome of getting this right. **Unidirectional data flow** applies: the URL is the source, the rendered view is the derived output, and user actions produce navigation events that change the URL (which then flows down to re-render).
