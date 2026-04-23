---
id: angular-route-resolvers
layer1_parent: route-resolvers
angular_version: "14"
module: "@angular/router"
---

# Angular Route Resolvers

## How Angular Implements This

A resolver is a service that implements the `Resolve<T>` interface. The router calls it **before** activating the route — the target component is not instantiated until the resolver completes. The resolved data is then available on `ActivatedRoute.data`.

This solves the "empty state flash" problem: without a resolver, the component renders immediately with no data, shows a loading spinner, then re-renders when the HTTP response arrives. With a resolver, the navigation itself waits for the data, so the component renders once with everything it needs.

Resolvers return `Observable<T> | Promise<T> | T`. If they return an observable, the router subscribes and waits for the first emission. The observable **must complete** (or emit at least once) — if it never emits, the navigation hangs forever.

Resolvers are declared in the route configuration via the `resolve` property, which maps keys to resolver services. The component accesses resolved data via `route.data` (observable) or `route.snapshot.data` (snapshot).

## The Correct Way

```typescript
// user.resolver.ts
import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot, Router } from '@angular/router';
import { Observable, EMPTY } from 'rxjs';
import { catchError, take } from 'rxjs/operators';
import { UserService } from '../services/user.service';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserResolver implements Resolve<User> {
  constructor(
    private userService: UserService,
    private router: Router
  ) {}

  resolve(route: ActivatedRouteSnapshot): Observable<User> {
    const id = route.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/not-found']);
      return EMPTY;
    }

    return this.userService.getUser(id).pipe(
      take(1),  // Ensure the observable completes
      catchError(() => {
        this.router.navigate(['/not-found']);
        return EMPTY;  // EMPTY completes immediately — cancels navigation
      })
    );
  }
}
```

```typescript
// Route configuration
const routes: Routes = [
  {
    path: 'users/:id',
    component: UserDetailComponent,
    resolve: {
      user: UserResolver  // Key 'user' maps to the resolver
    }
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    resolve: {
      stats: DashboardStatsResolver,
      recentActivity: RecentActivityResolver  // Multiple resolvers — run in parallel
    }
  }
];
```

```typescript
// user-detail.component.ts — consuming resolved data
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { User } from '../models/user.model';

@Component({
  selector: 'app-user-detail',
  template: `
    <div *ngIf="user$ | async as user">
      <h1>{{ user.name }}</h1>
      <p>{{ user.email }}</p>
      <p>Member since {{ user.createdAt | date }}</p>
    </div>
  `
})
export class UserDetailComponent implements OnInit {
  user$!: Observable<User>;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Reactive — updates if same component is reused with different params
    this.user$ = this.route.data.pipe(
      map(data => data['user'])  // Key matches the 'user' in resolve config
    );
  }
}
```

```typescript
// dashboard-stats.resolver.ts — resolver with error handling and timeout
import { Injectable } from '@angular/core';
import { Resolve } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { DashboardService } from '../services/dashboard.service';
import { DashboardStats } from '../models/dashboard-stats.model';

@Injectable({ providedIn: 'root' })
export class DashboardStatsResolver implements Resolve<DashboardStats | null> {
  constructor(private dashboardService: DashboardService) {}

  resolve(): Observable<DashboardStats | null> {
    return this.dashboardService.getStats().pipe(
      timeout(5000),  // Don't let slow APIs block navigation forever
      catchError(() => of(null))  // Return null — let the component show fallback UI
    );
  }
}
```

## The Anti-Pattern in Angular

```typescript
// WRONG: Resolver returns an observable that never completes
@Injectable({ providedIn: 'root' })
export class BrokenResolver implements Resolve<User[]> {
  constructor(private store: Store) {}

  resolve(): Observable<User[]> {
    return this.store.select(selectUsers);  // Store selectors NEVER complete
    // Navigation hangs forever. No error. No timeout. Just a frozen app.
  }
}
// Fix: pipe(take(1)) or pipe(first()) to complete after the first emission.

// WRONG: Fetching data in the component that the resolver already fetched
@Component({ ... })
export class UserDetailComponent implements OnInit {
  user!: User;

  constructor(
    private route: ActivatedRoute,
    private userService: UserService  // Why is this injected?
  ) {}

  ngOnInit(): void {
    // The resolver already fetched this!
    const id = this.route.snapshot.paramMap.get('id');
    this.userService.getUser(id!).subscribe(user => this.user = user);
    // Now you have two HTTP calls for the same data, and the resolver's
    // result sits unused on route.data.
  }
}

// WRONG: Using resolvers for everything
const routes: Routes = [
  {
    path: 'dashboard',
    component: DashboardComponent,
    resolve: {
      user: UserResolver,
      notifications: NotificationResolver,
      projects: ProjectResolver,
      analytics: AnalyticsResolver,
      preferences: PreferencesResolver
    }
  }
];
// Five resolvers that ALL must complete before the dashboard renders.
// If analytics takes 3 seconds, the user stares at a blank page for 3 seconds.
// Only resolve what's needed for the initial render. Load the rest in the component.
```

## Common Mistakes

1. **Observable never completes**: This is the most dangerous mistake. If a resolver returns a long-lived observable (like a store selector or a BehaviorSubject without `take(1)`), the navigation hangs indefinitely. The user sees the old route, no error is thrown, and the app appears frozen. Always ensure resolvers complete: use `take(1)`, `first()`, or return an HTTP call (which completes naturally after one response).

2. **Too many resolvers blocking navigation**: Each resolver must complete before the route activates. Multiple resolvers run in parallel, but navigation waits for the slowest one. If one resolver calls a slow API, the entire page load is delayed. Resolve only critical above-the-fold data. Load secondary data in the component after render.

3. **Error handling that breaks navigation**: If a resolver throws an unhandled error, the entire navigation fails silently. The user stays on the current page with no feedback. Always use `catchError()` — either redirect to an error page (return `EMPTY` after `router.navigate()`) or return a fallback value (like `null`) and let the component handle the empty state.

4. **Snapshot vs Observable for resolved data**: If the same component handles multiple route parameter values (e.g., `/users/1` then `/users/2`), use `route.data` (the observable) not `route.snapshot.data`. The resolver re-runs on parameter change, but the component must subscribe to `route.data` to see the new value.

5. **Resolver not provided**: Forgetting `@Injectable({ providedIn: 'root' })` or not adding the resolver to a module's providers causes `NullInjectorError` when navigation triggers it.

## Testing This

```typescript
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { UserResolver } from './user.resolver';
import { UserService } from '../services/user.service';

describe('UserResolver', () => {
  let resolver: UserResolver;
  let userService: jasmine.SpyObj<UserService>;
  let router: Router;

  beforeEach(() => {
    userService = jasmine.createSpyObj('UserService', ['getUser']);

    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        UserResolver,
        { provide: UserService, useValue: userService }
      ]
    });

    resolver = TestBed.inject(UserResolver);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
  });

  it('should resolve the user', (done) => {
    const mockUser = { id: '42', name: 'Alice', email: 'a@b.com' };
    userService.getUser.and.returnValue(of(mockUser));

    const route = { paramMap: { get: (key: string) => '42' } } as any as ActivatedRouteSnapshot;
    resolver.resolve(route).subscribe(user => {
      expect(user).toEqual(mockUser as any);
      expect(userService.getUser).toHaveBeenCalledWith('42');
      done();
    });
  });

  it('should navigate to not-found on error', (done) => {
    userService.getUser.and.returnValue(throwError(() => new Error('Not found')));

    const route = { paramMap: { get: (key: string) => '999' } } as any as ActivatedRouteSnapshot;
    resolver.resolve(route).subscribe({
      complete: () => {
        expect(router.navigate).toHaveBeenCalledWith(['/not-found']);
        done();
      }
    });
  });

  it('should navigate to not-found when id is missing', () => {
    const route = { paramMap: { get: (key: string) => null } } as any as ActivatedRouteSnapshot;
    resolver.resolve(route);
    expect(router.navigate).toHaveBeenCalledWith(['/not-found']);
  });
});
```

Test resolvers as plain services. Mock the `ActivatedRouteSnapshot` with the parameters you need, mock the data services, and subscribe to the resolver's return value. Assert on both the happy path (correct data returned) and error paths (redirect happens, EMPTY returned). For timeout testing, use `fakeAsync` and `tick(5001)`.
