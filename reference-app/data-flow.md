# Data Flow

## The Complete Request-Response Cycle

This document traces every step from user action to rendered template, identifying what each layer does, what it must NOT do, and which Praxis concepts govern it.

```
User action (click, type, navigate)
  -> Component emits event / calls router.navigate()
    -> Route change triggers resolver OR component subscribes to route params
      -> Service method called with typed parameters
        -> HttpClient creates request observable
          -> Interceptor pipeline processes request (add headers, log)
            -> API receives HTTP request
              -> API builds Elasticsearch query from request params
                -> Elasticsearch executes query, returns results
              -> API transforms Elasticsearch response to API response shape
            -> Interceptor pipeline processes response (log, handle errors)
          -> HttpClient delivers typed response to service
        -> Service returns Observable to component (optionally updates BehaviorSubject)
      -> Component receives data via async pipe
    -> Template renders with new data
  -> Change detection updates the DOM
```

Each layer below corresponds to one step in this pipeline.

---

## Layer 1: Component (Presentation)

**Responsibility**: Translate user actions into navigation events or service calls. Bind data from observables to the template. Nothing else.

**Governed by**:
- [separation-of-concerns](../layer-1/architecture/design-principles/separation-of-concerns.md) -- the component is the presentation layer; business logic and data access are elsewhere
- [unidirectional-data-flow](../layer-1/frontend/state-management/unidirectional-data-flow.md) -- data flows down through `@Input()`, events flow up through `@Output()`
- [angular-input-output](../layer-2/components/angular-input-output.md) -- Angular's implementation of unidirectional flow
- [angular-async-pipe](../layer-2/rxjs/angular-async-pipe.md) -- subscription management via template binding
- [angular-change-detection](../layer-2/components/angular-change-detection.md) -- OnPush for performance

### What the Component Does

```typescript
// features/catalog/components/product-list/product-list.component.ts
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { CatalogService, CatalogSearchResponse } from '../../services/catalog.service';
import { SearchParams } from '../../models/search-params.model';

@Component({
  selector: 'app-product-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-list.component.html',
})
export class ProductListComponent implements OnInit {
  vm$!: Observable<CatalogSearchResponse & { params: SearchParams }>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private catalogService: CatalogService
  ) {}

  ngOnInit(): void {
    // Step 1: Read URL params (the source of truth).
    // Step 2: Transform into typed SearchParams.
    // Step 3: Call service (switchMap cancels previous in-flight request).
    // Step 4: Combine response with params for the template.
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
          map(response => ({ ...response, params: searchParams }))
        )
      )
    );
  }

  // Event handlers update the URL. The URL change flows back through
  // queryParamMap, which triggers re-search. The component never
  // calls catalogService.search() directly from an event handler.
  onSearch(query: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: query || null, page: 1 },
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
}
```

### What the Component Must NOT Do

| Anti-Pattern | Why It's Wrong | Praxis Reference |
|---|---|---|
| Call `HttpClient` directly | Bypasses the service layer. Business logic (URL construction, response transformation) leaks into presentation. | [layered-architecture](../layer-1/architecture/module-design/layered-architecture.md) |
| Build Elasticsearch query DSL | The component should not know what database backs the API. | [separation-of-concerns](../layer-1/architecture/design-principles/separation-of-concerns.md) |
| Store fetched data in a component property via manual subscribe | Breaks OnPush change detection, creates memory leaks from unmanaged subscriptions. | [angular-async-pipe](../layer-2/rxjs/angular-async-pipe.md) |
| Mutate `@Input()` values received from parent | Breaks unidirectional data flow. Parent state changes without parent knowledge. | [unidirectional-data-flow](../layer-1/frontend/state-management/unidirectional-data-flow.md) |
| Contain business logic (validation rules, price calculation, data transformation) | Not the component's responsibility. Untestable without rendering the component. | [single-responsibility](../layer-1/architecture/design-principles/single-responsibility.md) |

---

## Layer 2: Router (Navigation)

**Responsibility**: Map URLs to component trees. Activate guards and resolvers before rendering. Provide route parameter observables to components.

**Governed by**:
- [url-as-source-of-truth](../layer-1/frontend/routing/url-as-source-of-truth.md) -- the URL drives the application
- [declarative-routing](../layer-1/frontend/routing/declarative-routing.md) -- routes declared as data, not imperative code
- [angular-route-params](../layer-2/routing/angular-route-params.md) -- ActivatedRoute observables
- [angular-route-resolvers](../layer-2/routing/angular-route-resolvers.md) -- data fetching before route activation
- [angular-lazy-loading](../layer-2/routing/angular-lazy-loading.md) -- code splitting at route boundaries

### When to Use Resolvers vs. Component-Level Loading

There are two patterns for fetching data on route change. This architecture uses both, depending on the use case.

**Resolver pattern** (product detail page): The resolver fetches the product BEFORE the route activates. The component renders once with complete data. No loading spinner needed for the primary content.

```typescript
// features/catalog/resolvers/product.resolver.ts
import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot, Router } from '@angular/router';
import { Observable, EMPTY } from 'rxjs';
import { catchError, take } from 'rxjs/operators';
import { CatalogService } from '../services/catalog.service';
import { Product } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductResolver implements Resolve<Product> {
  constructor(
    private catalogService: CatalogService,
    private router: Router
  ) {}

  resolve(route: ActivatedRouteSnapshot): Observable<Product> {
    const id = route.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/catalog']);
      return EMPTY;
    }

    return this.catalogService.getProduct(id).pipe(
      take(1),
      catchError(() => {
        this.router.navigate(['/catalog']);
        return EMPTY;
      })
    );
  }
}
```

```typescript
// features/catalog/components/product-detail/product-detail.component.ts
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Product } from '../../models/product.model';

@Component({
  selector: 'app-product-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *ngIf="product$ | async as product">
      <h1>{{ product.name }}</h1>
      <p class="description">{{ product.description }}</p>
      <span class="price">{{ product.price | currency }}</span>
      <div class="categories">
        <span *ngFor="let cat of product.categories" class="badge">
          {{ cat }}
        </span>
      </div>
    </ng-container>
  `,
})
export class ProductDetailComponent implements OnInit {
  product$!: Observable<Product>;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Data already fetched by resolver. Just read it from route data.
    this.product$ = this.route.data.pipe(
      map(data => data['product'])
    );
  }
}
```

**Component-level loading** (product list / search page): The component subscribes to `queryParamMap` and triggers a fresh API call on every param change. No resolver, because the search results depend on many query params that change frequently without full route navigation.

This decision follows [angular-route-resolvers](../layer-2/routing/angular-route-resolvers.md): use resolvers for data that MUST be present before the page renders (detail views); use component-level loading for data that changes reactively within the same route (search/filter).

### What the Router Must NOT Do

| Anti-Pattern | Why It's Wrong | Praxis Reference |
|---|---|---|
| Use too many resolvers on one route, blocking navigation | Navigation waits for the slowest resolver. Five resolvers that call five APIs mean the page blocks until all five complete. | [angular-route-resolvers](../layer-2/routing/angular-route-resolvers.md) |
| Resolver returns observable that never completes | Navigation hangs forever. No error. No timeout. App appears frozen. | [angular-route-resolvers](../layer-2/routing/angular-route-resolvers.md) |
| Guard contains business logic | Guards check preconditions (is user authorized?), not business rules. | [single-responsibility](../layer-1/architecture/design-principles/single-responsibility.md) |

---

## Layer 3: Service (Business Logic / Data Access)

**Responsibility**: Encapsulate API calls behind typed methods. Translate between front-end models and API contracts. Optionally hold application state in BehaviorSubjects.

**Governed by**:
- [layered-architecture](../layer-1/architecture/module-design/layered-architecture.md) -- services are the business logic / data access layer
- [encapsulation](../layer-1/architecture/module-design/encapsulation.md) -- hide API details from components
- [angular-services](../layer-2/services/angular-services.md) -- injectable singletons via DI
- [angular-httpclient](../layer-2/http/angular-httpclient.md) -- typed HTTP calls
- [angular-services-as-state](../layer-2/services/angular-services-as-state.md) -- BehaviorSubject pattern (when state caching is appropriate)

### Service Implementation

```typescript
// features/catalog/services/catalog.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product } from '../models/product.model';
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

  /**
   * Search products. Translates front-end SearchParams into HttpParams.
   * Does NOT know about Elasticsearch query DSL -- the API handles that.
   */
  search(params: SearchParams): Observable<CatalogSearchResponse> {
    let httpParams = new HttpParams()
      .set('page', params.page.toString())
      .set('pageSize', params.pageSize.toString())
      .set('sort', params.sort);

    if (params.query) {
      httpParams = httpParams.set('q', params.query);
    }
    if (params.category) {
      httpParams = httpParams.set('category', params.category);
    }
    if (params.priceRange) {
      httpParams = httpParams.set('price', params.priceRange);
    }

    return this.http.get<CatalogSearchResponse>('/products/search', {
      params: httpParams,
    });
  }

  getProduct(id: string): Observable<Product> {
    return this.http.get<Product>(`/products/${id}`);
  }

  createProduct(product: Omit<Product, 'id'>): Observable<Product> {
    return this.http.post<Product>('/products', product);
  }

  updateProduct(id: string, product: Partial<Product>): Observable<Product> {
    return this.http.put<Product>(`/products/${id}`, product);
  }

  deleteProduct(id: string): Observable<void> {
    return this.http.delete<void>(`/products/${id}`);
  }
}
```

### What the Service Must NOT Do

| Anti-Pattern | Why It's Wrong | Praxis Reference |
|---|---|---|
| Build Elasticsearch query DSL in the service | The front-end should not know the backend data store. If you migrate from Elasticsearch to Solr, no front-end code should change. | [layered-architecture](../layer-1/architecture/module-design/layered-architecture.md) |
| Subscribe internally and store results without good reason | Creates hidden state. Multiple components may trigger redundant fetches. The service becomes a cache without invalidation strategy. | [angular-httpclient](../layer-2/http/angular-httpclient.md) |
| Handle UI concerns (show toast, open modal, navigate) | The service is the logic layer, not the presentation layer. Navigation and user feedback belong in the component or interceptor. | [separation-of-concerns](../layer-1/architecture/design-principles/separation-of-concerns.md) |
| Accept or return `any` | Loses type safety. Bugs from wrong response shapes are caught at runtime instead of compile time. | [angular-httpclient](../layer-2/http/angular-httpclient.md) |

---

## Layer 4: HttpClient (Transport)

**Responsibility**: Execute HTTP requests and deliver typed responses as observables. Automatically serialize request bodies as JSON and parse response bodies from JSON.

**Governed by**:
- [angular-httpclient](../layer-2/http/angular-httpclient.md) -- typed, observable-based HTTP
- [angular-interceptors](../layer-2/http/angular-interceptors.md) -- middleware pipeline for cross-cutting concerns

### Key Behavior

- **Cold observables**: The request is not sent until `.subscribe()` is called (or the `async` pipe evaluates). Calling `http.get()` without subscribing does nothing.
- **Single emission**: HttpClient observables emit exactly once (the response) and then complete. No subscription cleanup needed for the HTTP call itself.
- **Typed generics**: `http.get<Product>('/products/1')` tells TypeScript the response is `Product`. This is a compile-time assertion only -- Angular does not validate the runtime response shape.

### What HttpClient Must NOT Do

| Anti-Pattern | Why It's Wrong | Praxis Reference |
|---|---|---|
| Be called directly from components | Bypasses the service layer. URL construction, response transformation, and error handling scatter across components. | [layered-architecture](../layer-1/architecture/module-design/layered-architecture.md) |
| Be imported via `HttpClientModule` in feature modules | `HttpClientModule` should be imported once in `AppModule`. Re-importing in feature modules is harmless but misleading -- it suggests the module provides its own `HttpClient` instance (it does not). | [angular-ngmodule-boundaries](../layer-2/modules-di/angular-ngmodule-boundaries.md) |

---

## Layer 5: Interceptor Pipeline (Cross-Cutting)

**Responsibility**: Apply cross-cutting behavior to every HTTP request and response -- error handling, logging, URL prefixing. Interceptors are middleware: they modify the request/response stream without the calling code's knowledge.

**Governed by**:
- [middleware-pipelines](../layer-1/backend/api-patterns/middleware-pipelines.md) -- the pattern of chained handlers
- [angular-interceptors](../layer-2/http/angular-interceptors.md) -- Angular's implementation
- [error-propagation](../layer-1/cross-cutting/error-handling/error-propagation.md) -- how errors flow through the pipeline
- [separation-of-concerns](../layer-1/architecture/design-principles/separation-of-concerns.md) -- cross-cutting concerns separated from business logic

### Interceptor Pipeline for This Architecture

This architecture has no authentication, so there is no auth interceptor. The three interceptors are:

```
Request flow:   ApiPrefix → Logging → Error → Server
Response flow:  Server → Error → Logging → ApiPrefix
```

#### 1. API Prefix Interceptor

Prepends the API base URL to relative paths. Components and services use relative URLs (`/products/search`), and the interceptor resolves them to absolute URLs (`https://api.example.com/products/search`).

```typescript
// core/interceptors/api-prefix.interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable()
export class ApiPrefixInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Only prefix relative URLs (starting with /)
    if (req.url.startsWith('/')) {
      const apiReq = req.clone({
        url: `${environment.apiUrl}${req.url}`,
      });
      return next.handle(apiReq);
    }
    return next.handle(req);
  }
}
```

This follows [environment-configuration](../layer-1/cross-cutting/build-deploy/environment-configuration.md) -- the API URL comes from environment files, not hardcoded in services. See [angular-environments](../layer-2/build-deploy/angular-environments.md) for how Angular replaces environment files at build time.

#### 2. Logging Interceptor

Logs request method, URL, response status, and elapsed time. In production, this would send to a structured logging service. Here it uses `console.log` for simplicity.

```typescript
// core/interceptors/logging.interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpResponse,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    const startTime = Date.now();

    return next.handle(req).pipe(
      tap({
        next: (event) => {
          if (event instanceof HttpResponse) {
            const elapsed = Date.now() - startTime;
            console.log(
              `${req.method} ${req.urlWithParams} -> ${event.status} (${elapsed}ms)`
            );
          }
        },
        error: (error) => {
          const elapsed = Date.now() - startTime;
          console.error(
            `${req.method} ${req.urlWithParams} -> ${error.status} (${elapsed}ms)`
          );
        },
      })
    );
  }
}
```

This follows [structured-logging](../layer-1/cross-cutting/observability/structured-logging.md) -- logs include method, URL, status, and timing.

#### 3. Error Interceptor

Handles HTTP errors globally. Shows user-facing messages for server errors and network failures. Re-throws the error so calling code can also handle it.

```typescript
// core/interceptors/error.interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NotificationService } from '../services/notification.service';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(private notifications: NotificationService) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // User-facing messages for common errors
        if (error.status === 0) {
          this.notifications.show(
            'Network error. Check your connection.',
            'error'
          );
        } else if (error.status >= 500) {
          this.notifications.show(
            'Server error. Please try again later.',
            'error'
          );
        }
        // 4xx errors are not shown globally -- the calling component
        // should handle them (e.g., form validation errors, not-found).

        // Always re-throw so the calling code can also react.
        return throwError(() => error);
      })
    );
  }
}
```

This follows [user-vs-developer-errors](../layer-1/cross-cutting/error-handling/user-vs-developer-errors.md) -- server errors get a user-friendly message; 4xx errors are left to the component because only the component knows the context (is it a form submission? a search? a delete?). It also follows [error-propagation](../layer-1/cross-cutting/error-handling/error-propagation.md) -- errors are caught, logged, and re-thrown so no layer swallows them silently.

### What Interceptors Must NOT Do

| Anti-Pattern | Why It's Wrong | Praxis Reference |
|---|---|---|
| Forget `multi: true` | Without it, each interceptor replaces the previous one. Only the last interceptor runs. The most silent and destructive Angular misconfiguration. | [angular-interceptors](../layer-2/http/angular-interceptors.md) |
| Mutate the request instead of cloning | `HttpRequest` is immutable. `req.headers.set()` returns a new instance. Calling it without capturing the return value does nothing. | [angular-interceptors](../layer-2/http/angular-interceptors.md) |
| Swallow errors (catch without re-throwing) | Downstream code never knows the request failed. The component processes `null` as if it were valid data. | [error-propagation](../layer-1/cross-cutting/error-handling/error-propagation.md) |
| Contain business logic | Interceptors are cross-cutting infrastructure, not domain logic. Putting "if product category is X, add header Y" in an interceptor couples infrastructure to domain. | [separation-of-concerns](../layer-1/architecture/design-principles/separation-of-concerns.md) |

---

## Layer 6: API (Backend)

**Responsibility**: Receive HTTP requests, translate parameters into Elasticsearch queries, execute queries, transform results into the API response contract. The API is the boundary between the front-end's domain model and Elasticsearch's data model.

**Governed by**:
- [layered-architecture](../layer-1/architecture/module-design/layered-architecture.md) -- the API is a distinct layer with its own responsibilities
- [rest-principles](../layer-1/architecture/api-design/rest-principles.md) -- resource-oriented URLs, standard HTTP methods
- [request-response-transformation](../layer-1/backend/api-patterns/request-response-transformation.md) -- transform between external and internal representations
- [api-error-contracts](../layer-1/architecture/api-design/api-error-contracts.md) -- consistent error response format
- [query-dsl](../layer-1/backend/search-engine/query-dsl.md) -- Elasticsearch query construction

### What the API Does

The API translates HTTP query parameters into Elasticsearch query DSL. The front-end sends:

```
GET /products/search?q=wireless+headphones&category=audio&price=50-100&page=1&pageSize=20&sort=relevance
```

The API builds:

```json
{
  "query": {
    "bool": {
      "must": [
        {
          "multi_match": {
            "query": "wireless headphones",
            "fields": ["name^3", "description", "tags"],
            "type": "best_fields",
            "fuzziness": "AUTO"
          }
        }
      ],
      "filter": [
        { "term": { "category": "audio" } },
        { "range": { "price": { "gte": 50, "lte": 100 } } }
      ]
    }
  },
  "aggs": {
    "categories": {
      "terms": { "field": "category", "size": 20 }
    },
    "price_ranges": {
      "range": {
        "field": "price",
        "ranges": [
          { "key": "Under $25", "to": 25 },
          { "key": "$25-$50", "from": 25, "to": 50 },
          { "key": "$50-$100", "from": 50, "to": 100 },
          { "key": "$100+", "from": 100 }
        ]
      }
    }
  },
  "from": 0,
  "size": 20,
  "sort": [{ "_score": "desc" }]
}
```

The API transforms the Elasticsearch response into the front-end's contract:

```json
{
  "hits": [
    {
      "id": "prod-001",
      "name": "Wireless Noise-Cancelling Headphones",
      "description": "Premium audio with active noise cancellation...",
      "price": 79.99,
      "categories": ["audio", "accessories"],
      "imageUrl": "/images/prod-001.jpg"
    }
  ],
  "total": 47,
  "aggregations": {
    "categories": [
      { "key": "audio", "count": 23 },
      { "key": "accessories", "count": 15 }
    ],
    "priceRanges": [
      { "key": "Under $25", "count": 5 },
      { "key": "$25-$50", "count": 12 },
      { "key": "$50-$100", "count": 18 },
      { "key": "$100+", "count": 12 }
    ]
  }
}
```

### Key Design Decision: Front-End Does NOT Know Elasticsearch

The front-end sends `q=wireless+headphones&category=audio`. It does not send Elasticsearch query DSL. It does not know about `multi_match`, `bool`, `aggs`, or `_score`. This follows [layered-architecture](../layer-1/architecture/module-design/layered-architecture.md) -- the data access technology is an implementation detail of the API layer.

**Why this matters**: If you migrate from Elasticsearch to OpenSearch, Solr, or even a relational database with full-text search, only the API changes. No front-end code changes. No service changes. No component changes. The API's response contract is stable regardless of what generates the results.

### What the API Must NOT Do

| Anti-Pattern | Why It's Wrong | Praxis Reference |
|---|---|---|
| Return raw Elasticsearch responses to the front-end | Couples the front-end to Elasticsearch's response format (`_source`, `_score`, `hits.hits[]`). Migration becomes impossible. | [request-response-transformation](../layer-1/backend/api-patterns/request-response-transformation.md) |
| Accept Elasticsearch query DSL from the front-end | Security risk (query injection) and tight coupling. The front-end should not author database queries. | [separation-of-concerns](../layer-1/architecture/design-principles/separation-of-concerns.md), [injection-prevention](../layer-1/cross-cutting/security/injection-prevention.md) |
| Return inconsistent error formats | Some endpoints return `{ error: "..." }`, others `{ message: "..." }`, others just HTTP status. The front-end cannot write a single error handler. | [api-error-contracts](../layer-1/architecture/api-design/api-error-contracts.md) |

---

## Layer 7: Elasticsearch (Data Store)

**Responsibility**: Store documents, execute full-text and filtered queries, compute aggregations, return scored results.

**Governed by**:
- [search-engine-as-datastore](../layer-1/backend/search-engine/search-engine-as-datastore.md) -- understanding the tradeoffs
- [inverted-index-concepts](../layer-1/backend/search-engine/inverted-index-concepts.md) -- why search engines are fast at text search
- [mapping-design](../layer-1/backend/search-engine/mapping-design.md) -- schema design for search engines
- [aggregations](../layer-1/backend/search-engine/aggregations.md) -- faceted search and analytics

### What Elasticsearch Provides in This Architecture

1. **Full-text search with relevance scoring** -- results ranked by how well they match the query, not just filtered
2. **Faceted search via aggregations** -- category counts, price range distributions computed alongside results in a single query
3. **Near-real-time reads** -- documents are searchable within ~1 second of indexing (the refresh interval)
4. **No ACID transactions** -- eventual consistency. A product updated in the admin panel may not appear in search results for up to 1 second

### What Elasticsearch Must NOT Do

| Anti-Pattern | Why It's Wrong | Praxis Reference |
|---|---|---|
| Be queried directly from the front-end | Exposes the entire Elasticsearch API, including destructive operations. No access control. | [layered-architecture](../layer-1/architecture/module-design/layered-architecture.md) |
| Be the sole store for data that needs ACID guarantees | Order transactions, payment records, and user accounts need relational integrity. Elasticsearch is for read-heavy search workloads. | [search-engine-as-datastore](../layer-1/backend/search-engine/search-engine-as-datastore.md) |

---

## Putting It All Together: A Complete Trace

**Scenario**: User is on `/catalog?q=headphones&page=1`. They click the "Audio" category filter.

### Step-by-step flow:

1. **Component** (`FilterPanelComponent`): User clicks "Audio". The `@Output() categoryChange` emits `'audio'`.

2. **Component** (`ProductListComponent`): Handles the event by calling `router.navigate()`:
   ```typescript
   this.router.navigate([], {
     relativeTo: this.route,
     queryParams: { category: 'audio', page: 1 },
     queryParamsHandling: 'merge',
   });
   ```
   URL changes to `/catalog?q=headphones&category=audio&page=1`.

3. **Router**: URL change triggers `ActivatedRoute.queryParamMap` to emit new values. The component's `ngOnInit` subscription fires.

4. **Component**: The `switchMap` in `ngOnInit` cancels any in-flight search and calls `catalogService.search(newParams)`. If the previous search for just "headphones" was still in flight, `switchMap` unsubscribes from it (cancelling the HTTP request) following [angular-higher-order-mapping](../layer-2/rxjs/angular-higher-order-mapping.md).

5. **Service** (`CatalogService`): Builds `HttpParams` from `SearchParams` and calls `http.get<CatalogSearchResponse>('/products/search', { params })`.

6. **HttpClient**: Creates a cold observable. The `async` pipe subscribes, which triggers the request.

7. **Interceptor: ApiPrefix**: Clones the request, prepends `https://api.example.com` to the URL.

8. **Interceptor: Logging**: Records the start time. Passes to next handler.

9. **Interceptor: Error**: Passes to next handler (nothing to do on the request path).

10. **API**: Receives `GET /products/search?q=headphones&category=audio&page=1&pageSize=20&sort=relevance`. Builds Elasticsearch query with `multi_match` for "headphones", `term` filter for "audio" category, and aggregations for categories and price ranges.

11. **Elasticsearch**: Executes the query. Returns scored hits, total count, and aggregation buckets.

12. **API**: Transforms Elasticsearch response (`hits.hits[]._source`, `aggregations.categories.buckets[]`) into the `CatalogSearchResponse` contract. Returns JSON.

13. **Interceptor: Error**: Response is 200. Nothing to do.

14. **Interceptor: Logging**: Logs `GET /products/search?q=headphones&category=audio&page=1&pageSize=20&sort=relevance -> 200 (142ms)`.

15. **HttpClient**: Parses JSON. Delivers typed `CatalogSearchResponse` to the service's observable.

16. **Service**: Returns the observable to the component (no caching, no BehaviorSubject for search results).

17. **Component**: The `map` operator in the pipeline combines the response with the search params into the view model.

18. **Async Pipe**: Receives the new view model. Calls `markForCheck()` on the component (because it is `OnPush`).

19. **Change Detection**: Angular diffs the template bindings. Updates the DOM with new product cards, updated filter panel counts, and paginator.

20. **User sees**: Filtered results for "headphones" in the "Audio" category. The URL bar shows `/catalog?q=headphones&category=audio&page=1`. They can bookmark it, share it, or press back to remove the category filter.

---

## Cross-Cutting Patterns Across All Layers

### Error Handling

Errors propagate upward through the pipeline following [error-propagation](../layer-1/cross-cutting/error-handling/error-propagation.md):

- **Elasticsearch**: Returns error response to API
- **API**: Translates to HTTP error status with consistent error body per [api-error-contracts](../layer-1/architecture/api-design/api-error-contracts.md)
- **Error Interceptor**: Shows user-facing message for 5xx/network errors. Re-throws.
- **Service**: Can `catchError` for service-specific recovery (optional).
- **Component**: Receives error via the observable. Shows error UI via `*ngIf` or `catchError` with fallback value.

No layer swallows errors. Every layer either handles the error and re-throws, or lets it pass through.

### Type Safety

Types flow through the entire pipeline:

- **Model**: `Product` interface defines the shape
- **Service**: `http.get<CatalogSearchResponse>(...)` -- typed response
- **Component**: `vm$: Observable<CatalogSearchResponse & { params: SearchParams }>` -- typed view model
- **Template**: `*ngIf="vm$ | async as vm"` -- template compiler checks `vm.hits`, `vm.total`, etc.

No `any` types. If the API response shape changes, TypeScript catches the mismatch at compile time (at the point where the service maps the response to the front-end model).

### Subscription Management

Every observable subscription in the template uses the `async` pipe per [angular-async-pipe](../layer-2/rxjs/angular-async-pipe.md). No manual `.subscribe()` in components. No `takeUntil` patterns. No `OnDestroy` cleanup for HTTP calls. The `async` pipe subscribes on render and unsubscribes on destroy.

The only place `.subscribe()` appears is in services that perform fire-and-forget operations (like the `NotificationService` auto-dismiss timer) and in event handlers that trigger side effects (like `deleteProduct` followed by a page refresh).
