---
id: route-guards
domain: frontend
category: routing
depends_on:
  - declarative-routing
related:
  - route-resolvers
  - global-application-state
  - separation-of-concerns
anti_pattern_of: null
severity: important
---

# Route Guards

## Definition
Route guards are functions that run before a route activates (or before leaving a route), evaluating conditions like authentication, authorization, or unsaved changes, and either allowing navigation to proceed, redirecting to another route, or cancelling navigation entirely.

## Why It Matters
Without guards, access control is scattered inside each component. Every protected page has its own authentication check in `ngOnInit` or `useEffect`, each implemented slightly differently. Some redirect to login, some show a blank screen, some flash the protected content for a frame before redirecting. When authentication logic changes (say, adding multi-factor), you have to find and update every component. With guards, the access control logic is centralized and declared in the route configuration — impossible to forget when adding a new protected page.

## The Anti-Pattern
The developer adds an auth check at the top of every protected component. The component mounts, makes a brief appearance in the DOM, then the check runs and redirects to login. Users see a flash of protected content. Some components check for admin role, others check for any authenticated user, and the logic is slightly different in each. A new developer adds a route and forgets the auth check entirely — the page is silently unprotected. Another common pattern: the developer checks auth in the component but doesn't handle the "can deactivate" case — the user navigates away from a form with unsaved changes without any warning.

```
// Anti-pattern: auth check inside every component
function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !user.isAdmin) {
      navigate('/login');  // Flash of admin content before redirect
    }
  }, [user]);

  // Component renders before the redirect fires
  return <div>Secret admin stuff visible for one frame</div>;
}

// With a route guard: component never mounts if unauthorized
const routes = [
  {
    path: '/admin',
    component: AdminPanel,
    canActivate: [AdminGuard]  // Evaluated before component loads
  }
];

// Guard implementation (Angular-style)
function AdminGuard() {
  const user = inject(AuthService).currentUser;
  if (user?.isAdmin) return true;
  return inject(Router).createUrlTree(['/login']);
}
```

## Recognition Signal
Look for `useEffect` or `ngOnInit` blocks that check authentication/authorization and redirect. If multiple components have similar-looking auth checks at the top, those should be guards. Look for route configurations that have no `canActivate` or equivalent — those routes are unguarded, which is fine for public pages but is a security concern for protected ones. Test by navigating directly to a protected URL while logged out — if you see content flash before the redirect, the guard runs too late (inside the component).

## Related Concepts
**Route resolvers** run after guards succeed and before the component mounts — guards decide "can you go here?" and resolvers provide "what data do you need?" **Global application state** is where the guard reads from (authentication status, user roles). **Separation of concerns** is the principle at work — access control is a routing concern, not a component concern.
