---
id: deep-linking
domain: frontend
category: routing
depends_on:
  - url-as-source-of-truth
  - url-as-state
related:
  - declarative-routing
  - route-resolvers
anti_pattern_of: null
severity: important
---

# Deep Linking

## Definition
Every meaningful state of the application has a unique, shareable URL that, when navigated to directly, reproduces that exact state — including the page, selected entity, active filters, open tab, pagination position, and any other user-relevant context.

## Why It Matters
Deep linking is what separates a web application from a desktop application. The web's fundamental superpower is the ability to link to anything. When deep linking breaks, users can't bookmark their work, can't share a specific view with colleagues, can't paste a URL into a support ticket, and can't right-click to open in a new tab. Every time a user has to say "go to the dashboard, then click settings, then scroll down to notifications" instead of pasting a URL, the application has failed at being a web application.

## The Anti-Pattern
The developer treats the application as a single "page" that the user interacts with sequentially. Modal dialogs, tab selections, filter states, and detail views are all managed by JavaScript state with no URL representation. The URL bar shows `/app` regardless of what the user is looking at. Navigation within the app is performed by clicking buttons that call functions, not by navigating to URLs. The developer doesn't think about URLs because "it's a single-page app." But single-page does not mean single-URL.

```
// Single URL for everything — no deep linking
// URL: /app (always, regardless of what's displayed)
function App() {
  const [view, setView] = useState('list');
  const [selectedId, setSelectedId] = useState(null);
  const [filters, setFilters] = useState({});

  // User is looking at a specific order with specific filters applied
  // URL still shows: /app
  // They can't share this view, can't bookmark it, can't refresh it
}

// Deep linking: every meaningful state has a URL
// URL: /orders/12345?status=pending&page=3&tab=details
function App() {
  return (
    <Routes>
      <Route path="/orders" element={<OrderList />} />
      <Route path="/orders/:id" element={<OrderDetail />} />
    </Routes>
  );
}

function OrderList() {
  const [params] = useSearchParams();
  // Filters, pagination, sorting all from URL params
  // Share URL → colleague sees exact same view
}
```

## Recognition Signal
Try to share what you're looking at. Copy the URL. Open it in a new browser. If you see something different from what you were looking at, deep linking is broken. Specifically test: detail views (does the URL include the entity ID?), filtered lists (does the URL include filter parameters?), tabbed interfaces (does the URL include the active tab?), paginated content (does the URL include the page number?), and modal dialogs (can a direct URL open the modal?). If any of these require multi-step navigation to reach, they need deep linking.

## Related Concepts
**URL as source of truth** is the architectural principle that makes deep linking possible — if the URL drives the view, then providing the right URL reproduces the right view. **URL as state** covers which pieces of application state belong in the URL. **Declarative routing** provides the mechanism for mapping deep links to components. **Route resolvers** ensure that navigating directly to a deep link loads the required data before rendering.
