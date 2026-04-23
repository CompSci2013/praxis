---
id: angular-route-guards
layer1_parent: route-guards
angular_version: "14"
module: "@angular/router"
---

# Angular Route Guards

## How Angular Implements This

Angular 14 uses **class-based guards** — services that implement one of the guard interfaces: `CanActivate`, `CanActivateChild`, `CanDeactivate`, `CanLoad`, or `Resolve`. The router calls these guards during navigation and uses their return value to decide whether to proceed, redirect, or cancel.

Each guard is a standard Angular `@Injectable` service. It has access to dependency injection — it can inject `AuthService`, `Router`, `Store`, or anything else. This is the key advantage over simple boolean checks: guards are fully-featured services with access to the entire application.

Guards return `boolean | UrlTree | Observable<boolean | UrlTree> | Promise<boolean | UrlTree>`. Returning a `UrlTree` (created via `router.createUrlTree()`) causes a redirect rather than a simple block. This is preferred over returning `false` and manually calling `router.navigate()`, because `UrlTree` integrates correctly with the router's navigation lifecycle.

Guard execution order: `CanLoad` runs first (before the lazy module is fetched), then `CanActivate` on each route segment from root to child, then `CanActivateChild` on the parent when a child route activates.

## The Correct Way

```typescript
// auth.guard.ts
import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
  UrlTree
} from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    return this.authService.isAuthenticated$.pipe(
      take(1),  // Complete after first emission — don't keep the guard subscription alive
      map(isAuthenticated => {
        if (isAuthenticated) {
          return true;
        }
        // Return a UrlTree to redirect — do NOT call router.navigate() here
        return this.router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url }
        });
      })
    );
  }
}
```

```typescript
// role.guard.ts — checks for specific roles
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
    const requiredRole = route.data['role'] as string;

    return this.authService.currentUser$.pipe(
      take(1),
      map(user => {
        if (user?.roles.includes(requiredRole)) {
          return true;
        }
        return this.router.createUrlTree(['/forbidden']);
      })
    );
  }
}
```

```typescript
// unsaved-changes.guard.ts — CanDeactivate
import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { Observable } from 'rxjs';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

@Injectable({ providedIn: 'root' })
export class UnsavedChangesGuard implements CanDeactivate<HasUnsavedChanges> {
  canDeactivate(component: HasUnsavedChanges): boolean {
    if (component.hasUnsavedChanges()) {
      return confirm('You have unsaved changes. Leave this page?');
    }
    return true;
  }
}
```

```typescript
// can-load.guard.ts — prevents lazy module from even being fetched
import { Injectable } from '@angular/core';
import { CanLoad, Route, UrlSegment, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class CanLoadAdminGuard implements CanLoad {
  constructor(private authService: AuthService, private router: Router) {}

  canLoad(route: Route, segments: UrlSegment[]): Observable<boolean | UrlTree> {
    return this.authService.isAdmin$.pipe(
      take(1),
      map(isAdmin => isAdmin || this.router.createUrlTree(['/forbidden']))
    );
  }
}
```

```typescript
// Route configuration using guards
const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule),
    canLoad: [CanLoadAdminGuard],      // Prevents fetching the chunk if not admin
    canActivate: [AuthGuard]           // Prevents activation if not authenticated
  },
  {
    path: 'editor',
    component: EditorComponent,
    canActivate: [AuthGuard, RoleGuard],  // Multiple guards — ALL must return true
    canDeactivate: [UnsavedChangesGuard],
    data: { role: 'editor' }              // Passed to RoleGuard via route.data
  }
];
```

## The Anti-Pattern in Angular

```typescript
// WRONG: Using router.navigate() instead of returning UrlTree
canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
  return this.authService.isAuthenticated$.pipe(
    take(1),
    map(isAuthenticated => {
      if (!isAuthenticated) {
        this.router.navigate(['/login']);  // Race condition with the router
        return false;
      }
      return true;
    })
  );
}
// This creates a race: the router is already in the middle of a navigation,
// and you start a second one. It usually works but causes subtle bugs with
// multiple guards or nested routes. UrlTree is the correct redirect mechanism.

// WRONG: Not using take(1) — guard never completes
canActivate(): Observable<boolean> {
  return this.authService.isAuthenticated$;  // BehaviorSubject that never completes
  // Guard subscription stays open forever. If the auth state changes later,
  // the guard re-evaluates and may redirect the user unexpectedly.
}

// WRONG: Checking auth in the component instead of the guard
@Component({ ... })
export class AdminComponent implements OnInit {
  ngOnInit() {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);  // Component already instantiated
      // Template flashes briefly. Resolvers already ran. Side effects already triggered.
    }
  }
}
```

## Common Mistakes

1. **Guard order misunderstanding**: When multiple guards are listed (`canActivate: [AuthGuard, RoleGuard]`), they all run. If any returns `false` or a `UrlTree`, navigation is cancelled/redirected. But they run **concurrently** (not sequentially) if they return observables. If `RoleGuard` depends on `AuthGuard` having run first, you need to combine the logic into a single guard or chain the observables.

2. **`CanLoad` vs `CanActivate`**: `CanLoad` prevents the lazy module from being downloaded at all. `CanActivate` allows the download but prevents activation. Use `CanLoad` when you don't want unauthenticated users to even see the code. Note: `CanLoad` does not receive `ActivatedRouteSnapshot` — it only gets `Route` and `UrlSegment[]`.

3. **Forgetting `take(1)` on observable guards**: If the guard returns an observable from a `BehaviorSubject` (which never completes), the router waits for the first emission and then... keeps the subscription open. Later emissions can cause unexpected behavior. Always use `take(1)` to complete after the first value.

4. **`CanDeactivate` on the wrong component**: The generic type of `CanDeactivate<T>` must match the routed component. If you use `CanDeactivate<any>`, you lose type safety and may call methods that don't exist on the component.

5. **Guard not provided**: If you forget `@Injectable({ providedIn: 'root' })` or don't add the guard to a module's `providers`, you get `NullInjectorError: No provider for AuthGuard!` at navigation time — not at startup.

## Testing This

```typescript
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { BehaviorSubject } from 'rxjs';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let router: Router;
  let authSubject: BehaviorSubject<boolean>;

  beforeEach(() => {
    authSubject = new BehaviorSubject<boolean>(false);

    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        AuthGuard,
        {
          provide: AuthService,
          useValue: { isAuthenticated$: authSubject.asObservable() }
        }
      ]
    });

    guard = TestBed.inject(AuthGuard);
    router = TestBed.inject(Router);
    spyOn(router, 'createUrlTree').and.callThrough();
  });

  it('should return true when authenticated', (done) => {
    authSubject.next(true);
    const result$ = guard.canActivate({} as any, { url: '/admin' } as any);
    result$.subscribe(result => {
      expect(result).toBeTrue();
      done();
    });
  });

  it('should redirect to /login when not authenticated', (done) => {
    authSubject.next(false);
    const result$ = guard.canActivate({} as any, { url: '/admin' } as any);
    result$.subscribe(result => {
      expect(router.createUrlTree).toHaveBeenCalledWith(
        ['/login'],
        { queryParams: { returnUrl: '/admin' } }
      );
      expect(result).toEqual(jasmine.any(Object));  // UrlTree
      done();
    });
  });
});
```

Test guards in isolation by mocking their dependencies. The guard is just a service — inject it, call `canActivate()` with mock snapshots, and assert on the return value. Use `RouterTestingModule` to get a real `Router` for `createUrlTree()` assertions. For `CanDeactivate` guards, pass a mock component as the first argument.
