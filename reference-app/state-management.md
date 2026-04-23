# State Management

## Governing Principles

State management in this architecture is governed by a strict taxonomy: every piece of state has exactly one correct location, and putting it anywhere else is a bug.

The primary Praxis concepts:

- [state-management-patterns](../layer-1/frontend/state-management/state-management-patterns.md) -- the taxonomy of state types
- [url-as-state](../layer-1/frontend/state-management/url-as-state.md) -- URL parameters are a form of application state
- [url-as-source-of-truth](../layer-1/frontend/routing/url-as-source-of-truth.md) -- the URL drives the application, not the reverse
- [local-component-state](../layer-1/frontend/state-management/local-component-state.md) -- state that belongs to a single component
- [shared-state](../layer-1/frontend/state-management/shared-state.md) -- state shared between components within a feature
- [derived-state](../layer-1/frontend/state-management/derived-state.md) -- values computed from existing state, never stored independently
- [unidirectional-data-flow](../layer-1/frontend/state-management/unidirectional-data-flow.md) -- data flows down through inputs, events flow up through outputs

The Angular implementations:

- [angular-route-params](../layer-2/routing/angular-route-params.md) -- ActivatedRoute observables for reading URL state
- [angular-services-as-state](../layer-2/services/angular-services-as-state.md) -- BehaviorSubject pattern for shared state
- [angular-input-output](../layer-2/components/angular-input-output.md) -- @Input/@Output for parent-child communication
- [angular-async-pipe](../layer-2/rxjs/angular-async-pipe.md) -- async pipe for subscription management and OnPush compatibility

---

## State Taxonomy

| State Type | Location | Survives Refresh | Shareable via URL | Example |
|---|---|---|---|---|
| Navigation state | URL (route params, query params) | Yes | Yes | Current search query, active category filter, selected product ID, current page number |
| UI state | Component local properties | No | No | Sidebar collapsed, modal open, accordion expanded, tooltip visible |
| Application state | Services (BehaviorSubject) | No | No | Loaded product list from last API call, user display preferences, notification queue |
| Server state | HTTP responses (not cached) | No | No | Search results, aggregation facets, product detail from API |

### Why This Taxonomy Matters

The most common state management bug is putting state in the wrong location. Specific symptoms:

- **Navigation state stored in a service instead of the URL**: User applies filters, refreshes the page, filters disappear. User copies the URL to share, recipient sees unfiltered view. Browser back button does not undo filter changes. This violates [url-as-state](../layer-1/frontend/state-management/url-as-state.md).

- **UI state stored in a service instead of the component**: A sidebar's collapsed/expanded state is held in a global service. Now every component that touches the sidebar service is coupled to sidebar behavior. The sidebar state persists when navigating away and back, which may or may not be desired. This violates [local-component-state](../layer-1/frontend/state-management/local-component-state.md) and [single-responsibility](../layer-1/architecture/design-principles/single-responsibility.md).

- **Server state cached in a service when it should be re-fetched**: Search results are stored in a BehaviorSubject. The user navigates away, changes something in admin, navigates back, and sees stale results. The cache has no invalidation strategy. For this reference application (search results from Elasticsearch), the correct default is: do not cache server state. Re-fetch on every route activation.

---

## The URL-First Pattern

This is the single most important state management decision in this architecture. It follows [url-as-source-of-truth](../layer-1/frontend/routing/url-as-source-of-truth.md) and its Angular implementation [angular-route-params](../layer-2/routing/angular-route-params.md).

### The Rule

**Navigation state lives in the URL. Components read from route params, not from services. Data fetching is triggered by route changes, not by component lifecycle.**

The data flow is:

```
User types search query
  → Component calls router.navigate() with query params
    → URL changes to /catalog?q=electronics&page=1&sort=relevance
      → ActivatedRoute.queryParamMap emits new values
        → Component reacts: calls service with new search params
          → Service calls API
            → Results render
```

The URL is the **cause**, not the **effect**. The component does not search and then update the URL. The component updates the URL, and the URL change triggers the search.

### Concrete Implementation

```typescript
// features/catalog/components/product-list/product-list.component.ts
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { CatalogService } from '../../services/catalog.service';
import { Product } from '../../models/product.model';
import { SearchParams } from '../../models/search-params.model';

interface CatalogViewModel {
  products: Product[];
  total: number;
  aggregations: {
    categories: { key: string; count: number }[];
    priceRanges: { key: string; count: number }[];
  };
  params: SearchParams;
}

@Component({
  selector: 'app-product-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *ngIf="vm$ | async as vm; else loading">
      <app-search-bar
        [query]="vm.params.query"
        (search)="onSearch($event)">
      </app-search-bar>

      <div class="catalog-layout">
        <app-filter-panel
          [categories]="vm.aggregations.categories"
          [priceRanges]="vm.aggregations.priceRanges"
          [activeCategory]="vm.params.category"
          (categoryChange)="onCategoryChange($event)"
          (priceRangeChange)="onPriceRangeChange($event)">
        </app-filter-panel>

        <div class="results">
          <app-empty-state
            *ngIf="vm.products.length === 0"
            message="No products match your search.">
          </app-empty-state>

          <app-product-card
            *ngFor="let product of vm.products; trackBy: trackById"
            [product]="product"
            [highlightTerm]="vm.params.query"
            (select)="onProductSelect(product.id)">
          </app-product-card>

          <app-paginator
            [total]="vm.total"
            [page]="vm.params.page"
            [pageSize]="vm.params.pageSize"
            (pageChange)="onPageChange($event)">
          </app-paginator>
        </div>
      </div>
    </ng-container>

    <ng-template #loading>
      <app-loading-spinner></app-loading-spinner>
    </ng-template>
  `,
})
export class ProductListComponent implements OnInit {
  vm$!: Observable<CatalogViewModel>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private catalogService: CatalogService
  ) {}

  ngOnInit(): void {
    // The ENTIRE data pipeline is driven by URL changes.
    // No imperative loading. No ngOnInit fetch. Just reactive routing.
    this.vm$ = this.route.queryParamMap.pipe(
      map(params => ({
        query: params.get('q') ?? '',
        category: params.get('category') ?? null,
        priceRange: params.get('price') ?? null,
        page: Number(params.get('page') ?? '1'),
        pageSize: Number(params.get('pageSize') ?? '20'),
        sort: params.get('sort') ?? 'relevance',
      } as SearchParams)),
      switchMap(searchParams =>
        this.catalogService.search(searchParams).pipe(
          map(response => ({
            products: response.hits,
            total: response.total,
            aggregations: response.aggregations,
            params: searchParams,
          }))
        )
      )
    );
  }

  trackById(index: number, product: Product): string {
    return product.id;
  }

  // --- Every user action updates the URL. The URL change triggers re-search. ---

  onSearch(query: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: query || null, page: 1 },
      queryParamsHandling: 'merge',
    });
  }

  onCategoryChange(category: string | null): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category, page: 1 },
      queryParamsHandling: 'merge',
    });
  }

  onPriceRangeChange(priceRange: string | null): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { price: priceRange, page: 1 },
      queryParamsHandling: 'merge',
    });
  }

  onPageChange(page: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge',
    });
  }

  onProductSelect(productId: string): void {
    this.router.navigate(['/catalog', productId]);
  }
}
```

### What This Achieves

1. **Bookmark any search state**: `/catalog?q=electronics&category=audio&page=2` fully describes what the user sees.
2. **Share the exact view**: Copy the URL, send it to a colleague, they see the same results.
3. **Browser back/forward works**: Each filter change is a URL change, which is a history entry. Back undoes the last filter change.
4. **Refresh preserves state**: The URL survives refresh. On reload, `queryParamMap` emits the same values, the same search runs, the same results appear.
5. **No stale state bugs**: There is no service-level state to go stale. Every URL change triggers a fresh API call.

### Anti-Pattern: Storing Navigation State in a Service

```typescript
// WRONG: Search state lives in a service, not the URL
@Injectable({ providedIn: 'root' })
export class SearchStateService {
  private query$ = new BehaviorSubject<string>('');
  private category$ = new BehaviorSubject<string | null>(null);
  private page$ = new BehaviorSubject<number>(1);

  // User searches, state updates, URL stays at /catalog
  // Refresh: everything resets. Share URL: recipient sees empty search.
  // Back button: navigates away from catalog entirely instead of undoing filter.
}
```

This violates [url-as-state](../layer-1/frontend/state-management/url-as-state.md). Navigation-relevant state must live in the URL.

---

## UI State: Component Local

UI state that has no meaning outside a single component stays in that component as plain TypeScript properties. No service, no URL, no observable.

**Principles**: [local-component-state](../layer-1/frontend/state-management/local-component-state.md) and [single-responsibility](../layer-1/architecture/design-principles/single-responsibility.md).

```typescript
// features/catalog/components/filter-panel/filter-panel.component.ts
import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-filter-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filter-panel" [class.collapsed]="isCollapsed">
      <button (click)="toggleCollapse()">
        {{ isCollapsed ? 'Show Filters' : 'Hide Filters' }}
      </button>

      <div *ngIf="!isCollapsed">
        <h3>Categories</h3>
        <ul>
          <li *ngFor="let cat of categories"
              [class.active]="cat.key === activeCategory"
              (click)="categoryChange.emit(cat.key === activeCategory ? null : cat.key)">
            {{ cat.key }} ({{ cat.count }})
          </li>
        </ul>

        <h3>Price Range</h3>
        <ul>
          <li *ngFor="let range of priceRanges"
              (click)="priceRangeChange.emit(range.key)">
            {{ range.key }} ({{ range.count }})
          </li>
        </ul>
      </div>
    </div>
  `,
})
export class FilterPanelComponent {
  @Input() categories: { key: string; count: number }[] = [];
  @Input() priceRanges: { key: string; count: number }[] = [];
  @Input() activeCategory: string | null = null;
  @Output() categoryChange = new EventEmitter<string | null>();
  @Output() priceRangeChange = new EventEmitter<string | null>();

  // UI state: local to this component. Not in the URL. Not in a service.
  // When the user navigates away and back, the panel resets to expanded.
  // This is correct -- the collapsed state has no meaning outside this component.
  isCollapsed = false;

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
  }
}
```

### What Qualifies as UI State

- Sidebar collapsed/expanded
- Modal open/closed
- Accordion panel expanded
- Tooltip visible
- Drag-in-progress flag
- Form dirty tracking (before submission)
- Menu dropdown open

### The Test: If the User Refreshes, Should This State Persist?

If no, it is UI state. Keep it local to the component.

If yes, it is navigation state. Put it in the URL.

---

## Application State: Services with BehaviorSubject

Application state is data that multiple components need to access and that persists across component lifecycle but does not belong in the URL. In this reference architecture, the primary use case is **loaded data that should persist during a user session** -- for example, user preferences, a recently viewed products list, or notification counts.

**Principles**: [shared-state](../layer-1/frontend/state-management/shared-state.md) and [angular-services-as-state](../layer-2/services/angular-services-as-state.md).

**Important distinction for this architecture**: Search results from Elasticsearch are **server state**, not application state. They should not be cached in a BehaviorSubject by default. Each URL change triggers a fresh API call. Caching search results introduces stale data bugs and complex invalidation logic that is rarely worth the cost. See [cache-invalidation](../layer-1/backend/caching/cache-invalidation.md).

### When Application State Is Appropriate

```typescript
// core/services/notification.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  timestamp: Date;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private notifications$ = new BehaviorSubject<Notification[]>([]);

  // Public read-only observables. Components cannot call .next() on these.
  readonly active$: Observable<Notification[]> = this.notifications$.asObservable();
  readonly count$: Observable<number> = this.notifications$.pipe(
    map(n => n.length)
  );

  show(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    const notification: Notification = {
      id: crypto.randomUUID(),
      message,
      type,
      timestamp: new Date(),
    };
    this.notifications$.next([...this.notifications$.value, notification]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => this.dismiss(notification.id), 5000);
  }

  dismiss(id: string): void {
    this.notifications$.next(
      this.notifications$.value.filter(n => n.id !== id)
    );
  }
}
```

This follows the BehaviorSubject pattern from [angular-services-as-state](../layer-2/services/angular-services-as-state.md):
- Private `BehaviorSubject` -- only the service can push new state
- Public `Observable` -- components can only read
- Mutation methods -- controlled update paths
- Immutable updates -- new arrays/objects on every state change
- [derived-state](../layer-1/frontend/state-management/derived-state.md) -- `count$` is computed from `notifications$`, never stored independently

### When Application State Is Not Appropriate

```typescript
// WRONG: Caching search results in a service
@Injectable({ providedIn: 'root' })
export class CatalogStateService {
  private searchResults$ = new BehaviorSubject<Product[]>([]);

  // Problems:
  // 1. When does this cache invalidate? When a product is updated in admin?
  //    How does this service know about admin changes?
  // 2. The URL says /catalog?q=phones but the BehaviorSubject holds results
  //    for a previous search. Now the URL and the displayed data disagree.
  // 3. Two browser tabs show different results for the same URL.
}

// CORRECT: Let the URL-First pattern handle it.
// Each URL change → fresh API call → fresh results → template renders.
// No cache. No stale data. No invalidation logic.
```

---

## Server State: HTTP Responses

Server state is data that comes from the API and represents the current state of the backend data store. In this architecture, that means Elasticsearch search results, aggregations, and individual document responses.

**The default rule**: Do not cache server state. Let the HTTP call happen on every route activation. Elasticsearch is fast enough that the latency is acceptable, and the alternative (cache invalidation) is one of the hardest problems in computer science.

**Principles**: [request-response-transformation](../layer-1/backend/api-patterns/request-response-transformation.md), [angular-httpclient](../layer-2/http/angular-httpclient.md).

```typescript
// features/catalog/services/catalog.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SearchParams } from '../models/search-params.model';

export interface CatalogSearchResponse {
  hits: Product[];
  total: number;
  aggregations: {
    categories: { key: string; count: number }[];
    priceRanges: { key: string; count: number }[];
  };
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  constructor(private http: HttpClient) {}

  search(params: SearchParams): Observable<CatalogSearchResponse> {
    let httpParams = new HttpParams();
    if (params.query) {
      httpParams = httpParams.set('q', params.query);
    }
    if (params.category) {
      httpParams = httpParams.set('category', params.category);
    }
    if (params.priceRange) {
      httpParams = httpParams.set('price', params.priceRange);
    }
    httpParams = httpParams
      .set('page', params.page.toString())
      .set('pageSize', params.pageSize.toString())
      .set('sort', params.sort);

    return this.http.get<CatalogSearchResponse>('/products/search', {
      params: httpParams,
    });
    // No caching. No BehaviorSubject. Each call returns a fresh observable.
    // The async pipe in the component subscribes and unsubscribes automatically.
  }

  getProduct(id: string): Observable<Product> {
    return this.http.get<Product>(`/products/${id}`);
  }
}
```

**Note on HttpParams immutability**: `HttpParams.set()` returns a new instance -- it does not mutate. Calling `httpParams.set('q', value)` without capturing the return value does nothing. This is one of the most common `HttpClient` mistakes, documented in [angular-httpclient](../layer-2/http/angular-httpclient.md).

---

## Derived State

Derived state is computed from existing state, never stored independently. Storing a derived value alongside its source creates two sources of truth that can disagree.

**Principle**: [derived-state](../layer-1/frontend/state-management/derived-state.md).

In this architecture, derived state appears in two places:

### 1. In Services: Computed Observables

```typescript
// The NotificationService example above demonstrates this:
readonly count$: Observable<number> = this.notifications$.pipe(
  map(n => n.length)
);
// count$ is derived from notifications$. There is no separate counter variable.
// If someone added a separate `private count = 0` and incremented it manually,
// it would inevitably fall out of sync with the actual notifications array.
```

### 2. In Templates: Inline Computation

```typescript
// In the ProductListComponent template:
// vm.products.length === 0 is derived state -- computed from the products array.
// There is no separate `isEmpty` boolean.
<app-empty-state *ngIf="vm.products.length === 0">
```

### Anti-Pattern: Storing Derived State

```typescript
// WRONG: Separate stored values that can disagree
@Injectable({ providedIn: 'root' })
export class CartService {
  private items: CartItem[] = [];
  private total = 0;        // Derived from items, but stored separately
  private itemCount = 0;    // Derived from items, but stored separately

  addItem(item: CartItem): void {
    this.items.push(item);
    this.total += item.price;  // What if this line is accidentally deleted?
    this.itemCount++;          // Or this one? Now total disagrees with items.
  }
}

// CORRECT: Derive from the source
readonly total$: Observable<number> = this.items$.pipe(
  map(items => items.reduce((sum, item) => sum + item.price * item.quantity, 0))
);
```

---

## Summary: Decision Tree

When you need to store state, ask:

1. **Does the user expect this to survive a page refresh?**
   - Yes: URL query params or path params. See [url-as-state](../layer-1/frontend/state-management/url-as-state.md).
   - No: Continue to question 2.

2. **Does more than one component need this data?**
   - No: Component local property. See [local-component-state](../layer-1/frontend/state-management/local-component-state.md).
   - Yes: Continue to question 3.

3. **Is this data from the server that changes independently of the client?**
   - Yes: Do not cache. Re-fetch on route activation. See [angular-httpclient](../layer-2/http/angular-httpclient.md).
   - No: Service with BehaviorSubject. See [angular-services-as-state](../layer-2/services/angular-services-as-state.md).

4. **Can this value be computed from other state?**
   - Yes: Compute it (RxJS `map`, template expression). Never store it. See [derived-state](../layer-1/frontend/state-management/derived-state.md).
