---
id: url-as-state
domain: frontend
category: state-management
depends_on:
  - state-management-patterns
related:
  - url-as-source-of-truth
  - deep-linking
  - declarative-routing
  - global-application-state
anti_pattern_of: null
severity: important
---

# URL as State

## Definition
URL parameters (path segments, query strings, fragments) are a form of application state — the current page, active filters, search queries, selected tabs, and pagination cursors should be reflected in and driven by the URL.

## Why It Matters
The URL is the only state that survives a page refresh, can be bookmarked, shared via link, and navigated with browser back/forward buttons. When application state lives only in JavaScript memory, users lose their place on refresh, can't share what they're looking at, and the back button breaks. This frustrates users in ways they can't articulate — they just know the app "feels broken" compared to traditional websites. Search engines also can't index state that isn't in the URL.

## The Anti-Pattern
The developer stores navigation-relevant state in component state or a global store, and the URL stays static. The user applies filters on a product listing page — the store updates, the UI updates, but the URL remains `/products`. They refresh the page and all filters are gone. They copy the URL to share with a colleague and the colleague sees a different view. They click the back button expecting to undo their last filter change, but instead they navigate to the previous page entirely.

```
// State stored only in memory — URL is ignored
function ProductList() {
  const [filters, setFilters] = useState({ color: 'red', size: 'L' });
  const [page, setPage] = useState(3);
  const [sort, setSort] = useState('price-asc');
  // URL shows: /products
  // Should show: /products?color=red&size=L&page=3&sort=price-asc

  // On refresh: filters, page, and sort reset to defaults. User loses context.
}

// Correct: URL is the source of truth
function ProductList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = { color: searchParams.get('color'), size: searchParams.get('size') };
  const page = parseInt(searchParams.get('page') || '1');
  const sort = searchParams.get('sort') || 'relevance';
  // URL shows: /products?color=red&size=L&page=3&sort=price-asc
  // Refresh, bookmark, share — all work. Back button undoes filter changes.
}
```

## Recognition Signal
Navigate to a filtered or paginated view. Refresh the page. If the filters reset, page number resets, or view changes, the state is not in the URL. Click the browser back button after changing filters — if it doesn't undo the last change, the URL isn't being used as state. Copy the URL and open it in an incognito window — if you see a different view, state is trapped in memory.

## Related Concepts
**URL as source of truth** in the routing section addresses the same principle from the routing perspective — how the URL drives which components render. This concept focuses on the state management angle: how to synchronize URL parameters with application behavior. **Deep linking** is the end result of doing this correctly — every meaningful state has a shareable URL. **Declarative routing** provides the framework for mapping URL patterns to component trees. **Global application state** competes with the URL — routing-related state should live in the URL, not the store.
