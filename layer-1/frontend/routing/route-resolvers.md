---
id: route-resolvers
domain: frontend
category: routing
depends_on:
  - declarative-routing
  - route-guards
related:
  - initialization-timing
  - loading-error-empty-states
  - lazy-loading-routes
anti_pattern_of: null
severity: recommended
---

# Route Resolvers

## Definition
A route resolver is a function that fetches data required by a route's component before the component is created — ensuring the component always receives its data on initialization rather than needing to handle an initial loading state.

## Why It Matters
Without resolvers, every data-driven component must handle three states: loading (data not yet available), error (data fetch failed), and success (data arrived). This is correct and necessary for many cases, but for top-level page components, it means the user sees a loading spinner, then the page layout shifts as data arrives. With a resolver, navigation itself pauses until data is ready, and the component always has data when it mounts. The tradeoff is that navigation feels slower (no visual feedback during the fetch), which is why resolvers are best combined with a global navigation progress indicator.

## The Anti-Pattern
The developer puts an identical data-fetching pattern in every route component: `useEffect(() => { setLoading(true); fetch(...).then(setData).catch(setError).finally(() => setLoading(false)); }, [])`. Every component independently implements loading/error states with slightly different behavior — some show spinners, some show skeleton screens, some show nothing. When the API shape changes, every component's fetch logic must be updated. The developer doesn't know that the router can centralize this concern.

```
// Every component fetches its own data
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchUser(userId)
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <ProfileView user={user} />;
}

// With a resolver: data is ready when component mounts
const routes = [
  {
    path: '/users/:id',
    component: UserProfile,
    resolve: { user: UserResolver }  // Fetches before component loads
  }
];

// Component receives resolved data — no loading state needed
function UserProfile() {
  const { user } = useRouteData();  // Always available
  return <ProfileView user={user} />;
}
```

## Recognition Signal
Look for the `useState(null)` + `useEffect(fetch)` + loading/error pattern repeated across every route-level component. If the loading state and error handling look identical but are written independently in each component, a resolver (or at least a shared hook) would centralize this. Note: resolvers are a tradeoff, not always better. If the page has meaningful content to show before data arrives (a form layout, navigation elements), showing that immediately and loading data in the background is better UX. Resolvers are best for pages that are meaningless without their data.

## Related Concepts
**Initialization timing** is the problem resolvers solve — they guarantee data exists when the component initializes. **Loading, error, and empty states** are still needed for inline data fetching within a page, but resolvers can eliminate them at the route level. **Lazy loading routes** interacts with resolvers: the code for the route's component can load in parallel with the resolver's data fetch, making both optimizations complementary.
