---
id: lazy-loading-routes
domain: frontend
category: routing
depends_on:
  - declarative-routing
related:
  - route-resolvers
  - route-guards
  - separation-of-concerns
anti_pattern_of: null
severity: important
---

# Lazy Loading Routes

## Definition
Lazy loading splits the application's JavaScript into separate chunks that are loaded on demand when the user navigates to a route, rather than bundling all code into a single file loaded on the initial page visit.

## Why It Matters
A single-page application with 50 routes ships all 50 routes' code to every user on their first visit, even though they might only visit 3 pages. The initial bundle can grow to several megabytes, taking 10+ seconds to load on mobile networks. Users see a blank screen until the entire bundle downloads, parses, and executes. Lazy loading means the initial load includes only the code for the first page (and shared infrastructure), and subsequent pages load their code on-demand. This can reduce initial load time from 10 seconds to 2 seconds — the difference between a user who stays and one who leaves.

## The Anti-Pattern
The developer imports every component at the top of the route configuration file with static `import` statements. The bundler has no choice but to include everything in one chunk. As features are added, the bundle grows monotonically. The developer might notice performance degradation and try to optimize by tree-shaking or minifying, but the fundamental problem is that code for routes the user hasn't visited is still being downloaded and parsed. The fix requires changing static imports to dynamic imports, which means understanding the module system and the router's lazy-loading API.

```
// Eager loading: everything in one bundle
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { Reports } from './pages/Reports';
import { AdminPanel } from './pages/AdminPanel';
// All 5 pages are in the initial bundle, even if user only visits Home

const routes = [
  { path: '/', component: Home },
  { path: '/dashboard', component: Dashboard },
  { path: '/settings', component: Settings },
  { path: '/reports', component: Reports },
  { path: '/admin', component: AdminPanel }
];

// Lazy loading: each route loads on demand
const routes = [
  { path: '/', component: Home },  // Only this loads initially
  { path: '/dashboard', loadComponent: () => import('./pages/Dashboard') },
  { path: '/settings', loadComponent: () => import('./pages/Settings') },
  { path: '/reports', loadComponent: () => import('./pages/Reports') },
  { path: '/admin', loadComponent: () => import('./pages/AdminPanel') }
];
// Dashboard code downloads only when user navigates to /dashboard
```

## Recognition Signal
Run a bundle analysis tool (webpack-bundle-analyzer, source-map-explorer). If the main bundle contains code for pages the user hasn't visited, those routes should be lazy-loaded. Check the route configuration: if every route uses static component references (no `loadComponent`, `loadChildren`, `React.lazy`, or dynamic `import()`), nothing is lazy-loaded. Measure Time to Interactive in Lighthouse — if it's over 3 seconds on a simulated mobile connection and the bundle is over 500KB, lazy loading will help.

## Related Concepts
**Declarative routing** enables lazy loading — the route configuration is the natural place to specify which routes load eagerly and which load lazily. **Route resolvers** can run in parallel with lazy loading: while the chunk downloads, the resolver fetches data, so the user waits once instead of twice. **Route guards** still apply to lazy routes — the guard runs before the chunk is downloaded, so unauthorized users don't even trigger the download. **Separation of concerns** is the architectural principle: each feature is a self-contained module that the build system can split apart.
