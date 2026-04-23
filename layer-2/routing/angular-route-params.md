---
id: angular-route-params
layer1_parent: url-as-source-of-truth
angular_version: "14"
module: "@angular/router"
---

# Angular Route Parameters

## How Angular Implements This

Angular treats the URL as the source of truth for navigation state through `ActivatedRoute`, which exposes route parameters, query parameters, fragment, and data as observables. This is the reactive approach: instead of reading parameters once, you subscribe to changes and your component automatically updates when the URL changes.

There are three parameter channels:
- **Path parameters** (`/users/:id`) — accessed via `paramMap` or `params`. These are part of the route definition.
- **Query parameters** (`?page=2&sort=name`) — accessed via `queryParamMap` or `queryParams`. These are global across the URL.
- **Fragment** (`#section`) — accessed via `fragment`.

Each of these is available as both a snapshot (current value) and an observable (stream of values). The observable form is critical when the component is reused — for example, navigating from `/users/1` to `/users/2` does not destroy and recreate the component. The same component instance receives a new parameter emission.

`paramMap` (an `Observable<ParamMap>`) is preferred over `params` (an `Observable<Params>`) because `ParamMap` has methods like `get()`, `getAll()`, and `has()` that handle missing/multiple values correctly. `params` is a plain object where you'd do `params['id']` and hope it exists.

## The Correct Way

```typescript
// user-detail.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Subject, Observable } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { UserService } from '../services/user.service';
import { User } from '../models/user.model';

@Component({
  selector: 'app-user-detail',
  template: `
    <div *ngIf="user$ | async as user">
      <h1>{{ user.name }}</h1>
      <p>{{ user.email }}</p>
    </div>
  `
})
export class UserDetailComponent implements OnInit {
  user$!: Observable<User>;

  constructor(
    private route: ActivatedRoute,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    // Reactive: automatically re-fetches when :id changes
    this.user$ = this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        const id = params.get('id');  // Type-safe — returns string | null
        if (!id) {
          throw new Error('User ID is required');
        }
        return this.userService.getUser(id);
      })
    );
    // async pipe handles subscription and cleanup
  }
}
```

```typescript
// search-results.component.ts — query parameters
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { SearchService } from '../services/search.service';

@Component({
  selector: 'app-search-results',
  template: `
    <input [value]="searchTerm" (input)="onSearch($event)">
    <select (change)="onSortChange($event)">
      <option value="relevance">Relevance</option>
      <option value="date">Date</option>
    </select>
    <div *ngFor="let result of results$ | async">
      {{ result.title }}
    </div>
  `
})
export class SearchResultsComponent implements OnInit {
  results$!: Observable<any[]>;
  searchTerm = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private searchService: SearchService
  ) {}

  ngOnInit(): void {
    // React to query param changes
    this.results$ = this.route.queryParamMap.pipe(
      switchMap(params => {
        this.searchTerm = params.get('q') ?? '';
        const sort = params.get('sort') ?? 'relevance';
        const page = Number(params.get('page') ?? '1');
        return this.searchService.search(this.searchTerm, sort, page);
      })
    );
  }

  onSearch(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    // Update URL — component reacts via queryParamMap subscription
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: query, page: 1 },
      queryParamsHandling: 'merge'  // Preserve other query params (like sort)
    });
  }

  onSortChange(event: Event): void {
    const sort = (event.target as HTMLSelectElement).value;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sort },
      queryParamsHandling: 'merge'
    });
  }
}
```

```typescript
// Listening to router events for loading indicators
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  template: `
    <app-loading-bar *ngIf="isNavigating"></app-loading-bar>
    <router-outlet></router-outlet>
  `
})
export class AppComponent implements OnInit, OnDestroy {
  isNavigating = false;
  private destroy$ = new Subject<void>();

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.router.events.pipe(
      filter(event =>
        event instanceof NavigationStart ||
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ),
      takeUntil(this.destroy$)
    ).subscribe(event => {
      this.isNavigating = event instanceof NavigationStart;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

## The Anti-Pattern in Angular

```typescript
// WRONG: Using snapshot when the component can be reused
ngOnInit(): void {
  const id = this.route.snapshot.paramMap.get('id');
  this.userService.getUser(id!).subscribe(user => this.user = user);
}
// If user navigates from /users/1 to /users/2, ngOnInit does NOT re-run.
// The component shows stale data for user 1.

// WRONG: Subscribing to paramMap and then subscribing to the HTTP call inside
ngOnInit(): void {
  this.route.paramMap.subscribe(params => {
    this.userService.getUser(params.get('id')!).subscribe(user => {
      this.user = user;
    });
  });
}
// Nested subscriptions. Each param change creates a new inner subscription.
// The old inner subscription is never cleaned up. If the HTTP response
// for user 1 arrives after the request for user 2 was sent, user 1's data
// overwrites user 2's data. switchMap solves both problems.

// WRONG: Storing route state in the component instead of reading from URL
onPageChange(page: number): void {
  this.currentPage = page;  // Component state — not reflected in URL
  this.loadData(page);
  // If user refreshes, they're back to page 1. If they share the URL,
  // the recipient sees page 1. The URL is not the source of truth.
}
```

## Common Mistakes

1. **Snapshot vs Observable**: Use `route.snapshot.paramMap` only when you are certain the component will be destroyed and recreated on parameter changes (e.g., the parameter is on a different route segment). If the same component instance handles multiple parameter values (which is the default behavior for same-route navigation), you must use the observable `route.paramMap`.

2. **Nested subscribes instead of `switchMap`**: When a parameter change triggers an HTTP call, use `switchMap` to flatten the observable chain. `switchMap` cancels the previous HTTP request when a new parameter arrives, preventing race conditions where a slow response overwrites a faster one.

3. **`queryParamsHandling: 'merge'` forgotten**: When updating one query parameter, the default behavior replaces all query parameters. `queryParamsHandling: 'merge'` preserves existing query params. Forgetting this means changing the sort order wipes out the search term.

4. **Parsing numbers from params**: `paramMap.get()` always returns `string | null`. Forgetting to parse (`Number(params.get('page'))`) leads to string concatenation bugs: `page + 1` yields `"21"` instead of `3`.

5. **Child route parameter access**: `ActivatedRoute` only exposes parameters for its own route segment. To access a parent route's parameters, use `route.parent.paramMap` or use `route.paramMap` with `paramsInheritanceStrategy: 'always'` in the router config.

## Testing This

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, BehaviorSubject } from 'rxjs';
import { UserDetailComponent } from './user-detail.component';
import { UserService } from '../services/user.service';

describe('UserDetailComponent', () => {
  let component: UserDetailComponent;
  let fixture: ComponentFixture<UserDetailComponent>;
  let paramMapSubject: BehaviorSubject<any>;
  let userService: jasmine.SpyObj<UserService>;

  beforeEach(() => {
    paramMapSubject = new BehaviorSubject(convertToParamMap({ id: '42' }));
    userService = jasmine.createSpyObj('UserService', ['getUser']);
    userService.getUser.and.returnValue(of({ id: '42', name: 'Alice', email: 'a@b.com' }));

    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [UserDetailComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: paramMapSubject.asObservable() }
        },
        { provide: UserService, useValue: userService }
      ]
    });

    fixture = TestBed.createComponent(UserDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should fetch user on init', () => {
    expect(userService.getUser).toHaveBeenCalledWith('42');
  });

  it('should re-fetch when params change', () => {
    paramMapSubject.next(convertToParamMap({ id: '99' }));
    fixture.detectChanges();
    expect(userService.getUser).toHaveBeenCalledWith('99');
  });
});
```

Mock `ActivatedRoute` by providing `paramMap` as a `BehaviorSubject` wrapped in `convertToParamMap()`. Push new values to the subject to simulate parameter changes. Assert that the component reacts correctly — re-fetches data, updates the template, etc. For query params, provide `queryParamMap` the same way.
