---
id: declarative-routing
domain: frontend
category: routing
depends_on:
  - separation-of-concerns
related:
  - route-guards
  - route-resolvers
  - lazy-loading-routes
  - url-as-source-of-truth
  - url-as-state
anti_pattern_of: null
severity: important
---

# Declarative Routing

## Definition
Route configuration is expressed as a data structure that maps URL patterns to components, rather than as imperative code that manually inspects the URL and conditionally renders views.

## Why It Matters
When routing is declarative, the entire navigation structure of the application is visible in one place — a configuration file or route table. A new developer can open it and understand every page the app has, what URL reaches it, and what guards or resolvers apply. When routing is imperative (if/else chains checking `window.location`), the navigation logic is scattered across components, invisible in aggregate, and fragile to change. Adding a new route requires understanding the entire chain of conditional rendering to ensure the new route doesn't accidentally shadow an existing one.

## The Anti-Pattern
The developer builds a "router" by checking `window.location.pathname` in a top-level component and rendering different children based on string matching. Nested routes require nested if/else chains. Adding authentication checks means wrapping each branch in another conditional. The "route configuration" is the shape of the if/else tree, which nobody can read as a whole. Route changes during development require editing deeply nested conditionals and hoping you don't break adjacent routes.

```
// Imperative routing — scattered and fragile
function App() {
  const path = window.location.pathname;

  if (path === '/') return <Home />;
  if (path === '/login') return <Login />;
  if (path.startsWith('/dashboard')) {
    if (!isLoggedIn) {
      window.location.href = '/login'; // Imperative redirect
      return null;
    }
    if (path === '/dashboard/settings') return <Settings />;
    if (path === '/dashboard/profile') return <Profile />;
    return <Dashboard />;
  }
  return <NotFound />;
}

// Declarative routing — configuration as data
const routes = [
  { path: '/', component: Home },
  { path: '/login', component: Login },
  {
    path: '/dashboard',
    component: DashboardLayout,
    canActivate: [AuthGuard],
    children: [
      { path: 'settings', component: Settings },
      { path: 'profile', component: Profile },
      { path: '', component: Dashboard }
    ]
  },
  { path: '**', component: NotFound }
];
```

## Recognition Signal
Look for `window.location` checks in component render logic. Look for conditional rendering based on URL strings scattered across multiple components. Look for route-like logic that doesn't use the framework's router (Angular Router, React Router, Vue Router). If adding a new page requires editing more than one file (other than the route config and the new component), routing is likely imperative.

## Related Concepts
**Route guards** are a declarative mechanism that attaches access control to route configuration entries. **Route resolvers** attach data-fetching to routes declaratively. **Lazy loading routes** splits code at route boundaries — only possible when routes are declared as configuration. **URL as source of truth** is the principle that declarative routing enforces: the URL determines the view, not the other way around. **URL as state** from state management is the data-flow perspective on the same idea.
