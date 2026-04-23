---
id: loading-error-empty-states
domain: frontend
category: ui-ux
depends_on:
  - component-lifecycle
  - initialization-timing
related:
  - optimistic-updates
  - form-state-machines
  - accessibility-wcag
  - route-resolvers
anti_pattern_of: null
severity: critical
---

# Loading, Error, and Empty States

## Definition
Every view that depends on asynchronous data must handle three states beyond the "happy path" of displaying data: loading (data is being fetched), error (the fetch failed), and empty (the fetch succeeded but returned no data).

## Why It Matters
Self-taught developers build for the happy path — what the UI looks like when the data is perfect and available. But in production, the API is slow (loading state), the server is down (error state), and new users have no data yet (empty state). Without handling these, the user sees: a blank screen while data loads (is it broken? is it loading? should I refresh?), an unhandled exception or white screen when the API fails, and an empty table with column headers and no rows when there's no data (is it broken? is there really nothing?). Each missing state is a moment where the user loses trust in the application.

## The Anti-Pattern
The developer renders the component assuming data exists. During loading, the component either shows nothing (blank space where content should be), shows the previous page's stale data, or throws a runtime error because it tries to map over `undefined`. On error, the app shows a generic browser error or an unhandled promise rejection in the console while the user sees a frozen UI. On empty data, the component renders its layout with no content — an empty table, a chart with no data points, a list with "No items to display" that's indistinguishable from a loading state.

```
// Only handles the happy path
function UserList() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setUsers);
    // No error handling. No loading indicator.
  }, []);

  // During loading: renders empty table (looks broken)
  // On error: silently fails, shows empty table (looks like no users exist)
  // On empty: shows empty table (correct, but indistinguishable from loading/error)
  return (
    <table>
      <thead><tr><th>Name</th><th>Email</th></tr></thead>
      <tbody>{users.map(u => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td></tr>)}</tbody>
    </table>
  );
}

// All three states handled
function UserList() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users')
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setUsers)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton rows={5} />;  // User knows something is happening
  if (error) return <ErrorBanner message="Could not load users" onRetry={retry} />;
  if (users.length === 0) return <EmptyState icon="users" message="No users yet" action="Invite your team" />;
  return <UserTable users={users} />;
}
```

## Recognition Signal
Navigate to a data-driven page on a slow connection (throttle to "Slow 3G" in DevTools). If you see blank space, a flash of empty content, or layout shift when data arrives, the loading state is missing. Disconnect from the network and refresh — if the page shows a white screen or browser error instead of a friendly error message with a retry option, the error state is missing. Check pages that a brand-new user would see — if they see empty tables/charts with no explanation or call to action, the empty state is missing.

## Related Concepts
**Optimistic updates** are an advanced pattern that addresses loading state by updating the UI before the server confirms, but still requires error and empty states. **Form state machines** apply this same principle to forms: submitting, success, and error states. **Accessibility** requires that loading and error states be announced to screen readers (using `aria-live` regions). **Route resolvers** can eliminate the loading state at the route level by fetching data before the component mounts, but in-page data fetching still needs all three states. **Initialization timing** is the lifecycle concern that creates the loading state in the first place.
