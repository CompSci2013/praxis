# Testing Strategy

This document defines what gets tested at each level of the [testing-pyramid](../layer-1/cross-cutting/testing/testing-pyramid.md) in the reference application. Every test has a clear boundary -- per [test-boundaries](../layer-1/cross-cutting/testing/test-boundaries.md), if you cannot name what is inside the test boundary and what is outside, the test is poorly scoped.

The reference application is a product catalog and document search UI backed by Elasticsearch, with an Angular 14 front-end.

---

## Testing Levels Overview

| Level | What to Test | What NOT to Test | Tool |
|---|---|---|---|
| Unit | Service logic, pipes, validators, query builders, error transformations | DOM rendering, HTTP calls, template bindings | Jasmine + mocked dependencies |
| Component | Input/output contracts, template bindings, user interactions, view state derivation | Service internals, HTTP calls, Elasticsearch query format | TestBed + ComponentHarness |
| Integration | Service + HttpClient (real HTTP flow with mocked backend) | UI rendering, component lifecycle | TestBed + HttpClientTestingModule |
| E2E | Critical user flows: search, navigate, filter, paginate | Every permutation of inputs, CSS layout, animation timing | Playwright (or Protractor) |

---

## Unit Tests

Unit tests are the base of the pyramid. They test a single unit of logic in isolation. Per [unit-testing](../layer-1/cross-cutting/testing/unit-testing.md), a unit test has three properties: it runs without external dependencies, it tests one behavior per test, and it fails for exactly one reason.

In the reference application, unit tests cover:
- **QueryBuilderService**: Does the builder produce correct Elasticsearch query JSON?
- **Error transformation logic**: Does the interceptor map HTTP status codes correctly?
- **Pipes**: Does a custom pipe format data as expected?
- **Validators**: Do form validators accept/reject the right inputs?

### Testing the Query Builder

The `QueryBuilderService` is a pure function wrapper -- no HTTP, no DOM, no side effects. It takes a `SearchRequest` and returns a query body. Per [angular-service-testing](../layer-2/testing/angular-service-testing.md), services with no dependencies can be tested without TestBed.

```typescript
// services/query-builder.service.spec.ts

import { QueryBuilderService } from './query-builder.service';
import { SearchRequest } from '../models/search-request.model';

describe('QueryBuilderService', () => {
  let service: QueryBuilderService;

  beforeEach(() => {
    service = new QueryBuilderService();  // No TestBed needed -- no dependencies
  });

  it('should build a match_all query when search term is empty', () => {
    const request: SearchRequest = {
      query: '',
      filters: {},
      sort: { field: '_score', order: 'desc' },
      pagination: { size: 20 }
    };

    const result = service.buildProductSearch(request) as any;

    expect(result.query.bool.must).toEqual([{ match_all: {} }]);
    expect(result.size).toBe(20);
  });

  it('should build a multi_match query with boosted fields', () => {
    const request: SearchRequest = {
      query: 'wireless keyboard',
      filters: {},
      sort: { field: '_score', order: 'desc' },
      pagination: { size: 20 }
    };

    const result = service.buildProductSearch(request) as any;
    const multiMatch = result.query.bool.must[0].multi_match;

    expect(multiMatch.query).toBe('wireless keyboard');
    expect(multiMatch.fields).toContain('name^3');
    expect(multiMatch.fields).toContain('tags^2');
    expect(multiMatch.fuzziness).toBe('AUTO');
  });

  it('should add category filter as keyword term', () => {
    const request: SearchRequest = {
      query: 'keyboard',
      filters: { category: 'Electronics' },
      sort: { field: '_score', order: 'desc' },
      pagination: { size: 20 }
    };

    const result = service.buildProductSearch(request) as any;
    const filters = result.query.bool.filter;

    expect(filters).toContain(
      jasmine.objectContaining({ term: { 'category.keyword': 'Electronics' } })
    );
  });

  it('should add price range filter', () => {
    const request: SearchRequest = {
      query: '',
      filters: { priceRange: { min: 10, max: 50 } },
      sort: { field: 'price', order: 'asc' },
      pagination: { size: 20 }
    };

    const result = service.buildProductSearch(request) as any;
    const filters = result.query.bool.filter;

    expect(filters).toContain(
      jasmine.objectContaining({ range: { price: { gte: 10, lte: 50 } } })
    );
  });

  it('should include search_after for deep pagination', () => {
    const request: SearchRequest = {
      query: 'keyboard',
      filters: {},
      sort: { field: '_score', order: 'desc' },
      pagination: { size: 20, searchAfter: [0.85, 'abc123'] }
    };

    const result = service.buildProductSearch(request) as any;

    expect(result.search_after).toEqual([0.85, 'abc123']);
  });

  it('should always include _id tiebreaker in sort', () => {
    const request: SearchRequest = {
      query: '',
      filters: {},
      sort: { field: 'price', order: 'asc' },
      pagination: { size: 20 }
    };

    const result = service.buildProductSearch(request) as any;
    const lastSort = result.sort[result.sort.length - 1];

    expect(lastSort).toEqual({ _id: { order: 'asc' } });
  });

  it('should combine multiple filters with bool.filter', () => {
    const request: SearchRequest = {
      query: 'desk',
      filters: {
        category: 'Furniture',
        inStock: true,
        tags: ['ergonomic', 'adjustable']
      },
      sort: { field: '_score', order: 'desc' },
      pagination: { size: 10 }
    };

    const result = service.buildProductSearch(request) as any;
    const filters = result.query.bool.filter;

    expect(filters.length).toBe(3);  // category + inStock + tags
  });
});
```

### Testing a Pipe

```typescript
// pipes/highlight.pipe.spec.ts

import { HighlightPipe } from './highlight.pipe';

describe('HighlightPipe', () => {
  let pipe: HighlightPipe;

  beforeEach(() => {
    pipe = new HighlightPipe();
  });

  it('should wrap matching text in <mark> tags', () => {
    const result = pipe.transform('wireless keyboard', 'keyboard');
    expect(result).toBe('wireless <mark>keyboard</mark>');
  });

  it('should be case-insensitive', () => {
    const result = pipe.transform('Wireless Keyboard', 'wireless');
    expect(result).toBe('<mark>Wireless</mark> Keyboard');
  });

  it('should return original text when no match', () => {
    const result = pipe.transform('wireless keyboard', 'mouse');
    expect(result).toBe('wireless keyboard');
  });

  it('should handle empty search term', () => {
    const result = pipe.transform('wireless keyboard', '');
    expect(result).toBe('wireless keyboard');
  });

  it('should escape regex special characters in search term', () => {
    const result = pipe.transform('price is $10.00', '$10.00');
    expect(result).toBe('price is <mark>$10.00</mark>');
  });
});
```

### Testing Error Transformation

```typescript
// interceptors/error.interceptor.spec.ts (unit-level, transform only)

import { ErrorInterceptor } from './error.interceptor';
import { ErrorService } from '../services/error.service';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorCode } from '../models/app-error.model';

describe('ErrorInterceptor (transform logic)', () => {
  let interceptor: ErrorInterceptor;
  let errorService: jasmine.SpyObj<ErrorService>;

  beforeEach(() => {
    errorService = jasmine.createSpyObj('ErrorService', ['handleError']);
    interceptor = new ErrorInterceptor(errorService);
  });

  it('should map status 0 to NETWORK_OFFLINE', () => {
    // Access private method via any -- acceptable in unit tests for logic extraction
    const result = (interceptor as any).transformError(
      new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' })
    );

    expect(result.code).toBe(ErrorCode.NETWORK_OFFLINE);
    expect(result.message).toContain('network');
  });

  it('should map normalized API error body', () => {
    const result = (interceptor as any).transformError(
      new HttpErrorResponse({
        status: 400,
        error: { code: 'SEARCH_FAILED', message: 'Query parse error', details: 'shard failure' }
      })
    );

    expect(result.code).toBe(ErrorCode.SEARCH_FAILED);
    expect(result.message).toBe('Query parse error');
    expect(result.detail).toBe('shard failure');
  });

  it('should fallback to status-based mapping for non-standard errors', () => {
    const result = (interceptor as any).transformError(
      new HttpErrorResponse({ status: 503, error: 'Service Unavailable' })
    );

    expect(result.code).toBe(ErrorCode.SERVER_ERROR);
    expect(result.message).toContain('unavailable');
  });
});
```

---

## Component Tests

Component tests verify the contract between the component class and its template. Per [angular-component-testing](../layer-2/testing/angular-component-testing.md), these are integration tests: they test the TypeScript class, the HTML template, and Angular's change detection together.

What to test:
- **Inputs/outputs**: Does the component render correctly given specific inputs? Does it emit the right events?
- **Template bindings**: Does `*ngIf` show/hide the correct elements? Does `*ngFor` render the right number of items?
- **User interactions**: Does clicking a button call the right method? Does typing trigger the right observable?

What NOT to test:
- Service internals (mock them)
- HTTP calls (the service mock returns canned data)
- CSS styling (visual regression tools cover this)

### Testing the Search Results Component

```typescript
// components/search-results/search-results.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BehaviorSubject, of } from 'rxjs';
import { SearchResultsComponent } from './search-results.component';
import { SearchService } from '../../services/search.service';
import { Product } from '../../models/product.model';
import { AppError, ErrorCode } from '../../models/app-error.model';
import { Component, Input } from '@angular/core';

// Stub child component to isolate the unit under test
@Component({ selector: 'app-product-card', template: '' })
class ProductCardStubComponent {
  @Input() product!: Product;
}

@Component({ selector: 'app-spinner', template: '' })
class SpinnerStubComponent {}

describe('SearchResultsComponent', () => {
  let fixture: ComponentFixture<SearchResultsComponent>;
  let component: SearchResultsComponent;

  // Mock service state as BehaviorSubjects for test control
  let mockResults$: BehaviorSubject<Product[]>;
  let mockError$: BehaviorSubject<AppError | null>;
  let mockLoading$: BehaviorSubject<boolean>;
  let mockRetryLastSearch: jasmine.Spy;

  const mockProducts: Product[] = [
    {
      name: 'Wireless Keyboard', description: 'Bluetooth keyboard',
      category: 'Electronics', price: 49.99, in_stock: true,
      tags: ['wireless', 'bluetooth'], created_at: '2025-01-15T00:00:00Z'
    },
    {
      name: 'USB Mouse', description: 'Ergonomic mouse',
      category: 'Electronics', price: 29.99, in_stock: true,
      tags: ['wired', 'ergonomic'], created_at: '2025-01-16T00:00:00Z'
    }
  ];

  beforeEach(async () => {
    mockResults$ = new BehaviorSubject<Product[]>([]);
    mockError$ = new BehaviorSubject<AppError | null>(null);
    mockLoading$ = new BehaviorSubject<boolean>(false);
    mockRetryLastSearch = jasmine.createSpy('retryLastSearch');

    await TestBed.configureTestingModule({
      declarations: [
        SearchResultsComponent,
        ProductCardStubComponent,
        SpinnerStubComponent
      ],
      providers: [
        {
          provide: SearchService,
          useValue: {
            results$: mockResults$.asObservable(),
            error$: mockError$.asObservable(),
            loading$: mockLoading$.asObservable(),
            retryLastSearch: mockRetryLastSearch
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SearchResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should show loading state', () => {
    mockLoading$.next(true);
    fixture.detectChanges();

    const spinner = fixture.debugElement.query(By.css('app-spinner'));
    expect(spinner).toBeTruthy();

    const productCards = fixture.debugElement.queryAll(By.css('app-product-card'));
    expect(productCards.length).toBe(0);
  });

  it('should render product cards when results arrive', () => {
    mockResults$.next(mockProducts);
    fixture.detectChanges();

    const productCards = fixture.debugElement.queryAll(By.css('app-product-card'));
    expect(productCards.length).toBe(2);
  });

  it('should show empty state when no results', () => {
    mockResults$.next([]);
    fixture.detectChanges();

    const emptyState = fixture.debugElement.query(By.css('.empty-state'));
    expect(emptyState).toBeTruthy();
    expect(emptyState.nativeElement.textContent).toContain('No results found');
  });

  it('should show error state with message and retry button', () => {
    const error: AppError = {
      code: ErrorCode.SEARCH_FAILED,
      message: 'Your search could not be completed.',
      timestamp: new Date()
    };
    mockError$.next(error);
    fixture.detectChanges();

    const errorCard = fixture.debugElement.query(By.css('.error-state'));
    expect(errorCard).toBeTruthy();
    expect(errorCard.nativeElement.textContent).toContain('Your search could not be completed.');

    const retryButton = fixture.debugElement.query(By.css('.error-state button'));
    expect(retryButton).toBeTruthy();
  });

  it('should call retryLastSearch when retry button clicked', () => {
    mockError$.next({
      code: ErrorCode.SEARCH_FAILED,
      message: 'Search failed.',
      timestamp: new Date()
    });
    fixture.detectChanges();

    const retryButton = fixture.debugElement.query(By.css('.error-state button'));
    retryButton.nativeElement.click();

    expect(mockRetryLastSearch).toHaveBeenCalled();
  });

  it('should transition from loading to results', () => {
    mockLoading$.next(true);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('app-spinner'))).toBeTruthy();

    mockLoading$.next(false);
    mockResults$.next(mockProducts);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('app-spinner'))).toBeFalsy();
    expect(fixture.debugElement.queryAll(By.css('app-product-card')).length).toBe(2);
  });
});
```

Key patterns:
- **Stub child components** to isolate the component under test. `ProductCardStubComponent` has the same selector but an empty template. Per [test-boundaries](../layer-1/cross-cutting/testing/test-boundaries.md), the boundary includes the component and its template, not its children.
- **BehaviorSubject mocks** give test control over reactive state. Calling `mockResults$.next(mockProducts)` simulates the service emitting new data.
- **`fixture.detectChanges()`** triggers Angular's change detection manually. Without it, template bindings do not update.

### Using Component Harness

For reusable components tested across many specs, a [angular-component-harness](../layer-2/testing/angular-component-harness.md) encapsulates DOM queries:

```typescript
// components/product-card/product-card.harness.ts

import { ComponentHarness } from '@angular/cdk/testing';

export class ProductCardHarness extends ComponentHarness {
  static hostSelector = 'app-product-card';

  private getNameElement = this.locatorFor('.product-name');
  private getPriceElement = this.locatorFor('.product-price');
  private getStockBadge = this.locatorForOptional('.stock-badge');

  async getName(): Promise<string> {
    return (await this.getNameElement()).text();
  }

  async getPrice(): Promise<string> {
    return (await this.getPriceElement()).text();
  }

  async isInStock(): Promise<boolean> {
    const badge = await this.getStockBadge();
    if (!badge) { return false; }
    const text = await badge.text();
    return text.includes('In Stock');
  }
}
```

```typescript
// Usage in a test
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ProductCardHarness } from './product-card.harness';

it('should display product name and price', async () => {
  const loader = TestbedHarnessEnvironment.loader(fixture);
  const cards = await loader.getAllHarnesses(ProductCardHarness);

  expect(await cards[0].getName()).toBe('Wireless Keyboard');
  expect(await cards[0].getPrice()).toContain('49.99');
  expect(await cards[0].isInStock()).toBeTrue();
});
```

---

## Integration Tests

Integration tests verify that two or more units work together correctly. In the reference application, the most valuable integration test is: **service + HttpClient**. The service builds a query, sends it via HttpClient, and transforms the response. Per [integration-testing](../layer-1/cross-cutting/testing/integration-testing.md) and [angular-http-testing](../layer-2/testing/angular-http-testing.md), use `HttpClientTestingModule` to intercept requests and flush canned responses.

### Testing SearchService + HttpClient

```typescript
// services/search.service.spec.ts (integration)

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SearchService } from './search.service';
import { QueryBuilderService } from './query-builder.service';
import { ErrorService } from './error.service';
import { Product } from '../models/product.model';

describe('SearchService (integration)', () => {
  let service: SearchService;
  let httpMock: HttpTestingController;

  const mockEsResponse = {
    hits: {
      total: { value: 2, relation: 'eq' as const },
      hits: [
        {
          _id: 'prod-1',
          _index: 'products',
          _score: 1.5,
          _source: {
            name: 'Wireless Keyboard',
            description: 'Bluetooth keyboard',
            category: 'Electronics',
            price: 49.99,
            in_stock: true,
            tags: ['wireless'],
            created_at: '2025-01-15T00:00:00Z'
          },
          sort: [1.5, 'prod-1']
        },
        {
          _id: 'prod-2',
          _index: 'products',
          _score: 1.2,
          _source: {
            name: 'USB Mouse',
            description: 'Ergonomic mouse',
            category: 'Electronics',
            price: 29.99,
            in_stock: true,
            tags: ['wired'],
            created_at: '2025-01-16T00:00:00Z'
          },
          sort: [1.2, 'prod-2']
        }
      ]
    },
    aggregations: {
      categories: {
        buckets: [
          { key: 'Electronics', doc_count: 42 },
          { key: 'Furniture', doc_count: 18 }
        ]
      },
      avg_price: { value: 39.99 },
      in_stock_count: { doc_count: 55 }
    }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        SearchService,
        QueryBuilderService,
        ErrorService
      ]
    });

    service = TestBed.inject(SearchService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();  // Ensure no unexpected HTTP calls
  });

  it('should send search request and return mapped products', (done) => {
    service.search('keyboard');

    // Subscribe to results -- the scan operator accumulates, so we get the
    // array after the response flushes
    service.results$.subscribe(products => {
      if (products.length > 0) {
        expect(products.length).toBe(2);
        expect(products[0].name).toBe('Wireless Keyboard');
        expect((products[0] as any)._id).toBe('prod-1');
        done();
      }
    });

    // Flush the HTTP request with mock response
    const req = httpMock.expectOne('/api/search/products');
    expect(req.request.method).toBe('POST');

    // Verify the request body contains the query
    const body = req.request.body as any;
    expect(body.query.bool.must[0].multi_match.query).toBe('keyboard');

    req.flush(mockEsResponse);
  });

  it('should update hasMore based on response size', (done) => {
    service.search('keyboard');

    service.hasMore$.subscribe(hasMore => {
      // Response has 2 hits but default page size is 20, so no more pages
      if (hasMore === false) {
        done();
      }
    });

    const req = httpMock.expectOne('/api/search/products');
    req.flush(mockEsResponse);
  });

  it('should handle HTTP errors gracefully', (done) => {
    service.search('keyboard');

    service.error$.subscribe(error => {
      if (error) {
        expect(error.message).toContain('search could not be completed');
        done();
      }
    });

    const req = httpMock.expectOne('/api/search/products');
    req.flush(
      { code: 'SEARCH_FAILED', message: 'Query parse error' },
      { status: 400, statusText: 'Bad Request' }
    );
  });

  it('should verify request URL and method', () => {
    service.search('test');

    const req = httpMock.expectOne(r =>
      r.url === '/api/search/products' && r.method === 'POST'
    );
    req.flush(mockEsResponse);
  });

  it('should include search_after in subsequent page requests', (done) => {
    // First search
    service.search('keyboard');

    const firstReq = httpMock.expectOne('/api/search/products');
    firstReq.flush(mockEsResponse);

    // Load next page
    service.loadNextPage();

    // Wait for the second request
    setTimeout(() => {
      const secondReq = httpMock.expectOne('/api/search/products');
      const body = secondReq.request.body as any;
      expect(body.search_after).toEqual([1.2, 'prod-2']);  // Last hit's sort values
      secondReq.flush(mockEsResponse);
      done();
    });
  });
});
```

Key patterns:
- **`httpMock.verify()`** in `afterEach` ensures no unexpected HTTP requests were made. If the test triggers an HTTP call you did not expect, it fails.
- **`req.flush()`** simulates the server response. The service's RxJS pipeline processes it as if it came from a real server.
- **Request body assertions** verify that the query builder produced the correct Elasticsearch query. This is the integration: `SearchService` delegates to `QueryBuilderService`, which produces the query, which gets sent via `HttpClient`.

### Testing the Error Interceptor (Integration)

The interceptor test verifies the full chain: HTTP error -> interceptor -> error service notification.

```typescript
// interceptors/error.interceptor.spec.ts (integration)

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpClient, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ErrorInterceptor } from './error.interceptor';
import { ErrorService } from '../services/error.service';
import { ErrorCode } from '../models/app-error.model';

describe('ErrorInterceptor (integration)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let errorService: ErrorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ErrorService,
        {
          provide: HTTP_INTERCEPTORS,
          useClass: ErrorInterceptor,
          multi: true
        }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    errorService = TestBed.inject(ErrorService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should transform 500 to SERVER_ERROR and notify ErrorService', (done) => {
    spyOn(errorService, 'handleError').and.callThrough();

    http.get('/api/test').subscribe({
      error: (error) => {
        expect(error.code).toBe(ErrorCode.SERVER_ERROR);
        expect(error.message).toContain('unexpected server error');
        expect(errorService.handleError).toHaveBeenCalled();
        done();
      }
    });

    httpMock.expectOne('/api/test').flush(null, {
      status: 500,
      statusText: 'Internal Server Error'
    });
  });

  it('should transform network error to NETWORK_OFFLINE', (done) => {
    http.get('/api/test').subscribe({
      error: (error) => {
        expect(error.code).toBe(ErrorCode.NETWORK_OFFLINE);
        done();
      }
    });

    httpMock.expectOne('/api/test').error(
      new ProgressEvent('error'),
      { status: 0, statusText: 'Unknown Error' }
    );
  });

  it('should pass through normalized API error body', (done) => {
    http.get('/api/test').subscribe({
      error: (error) => {
        expect(error.code).toBe(ErrorCode.SEARCH_FAILED);
        expect(error.message).toBe('Shard failure during query');
        expect(error.detail).toBe('all shards failed');
        done();
      }
    });

    httpMock.expectOne('/api/test').flush(
      { code: 'SEARCH_FAILED', message: 'Shard failure during query', details: 'all shards failed' },
      { status: 400, statusText: 'Bad Request' }
    );
  });

  it('should not intercept successful responses', (done) => {
    spyOn(errorService, 'handleError');

    http.get('/api/test').subscribe({
      next: (data) => {
        expect(data).toEqual({ result: 'ok' });
        expect(errorService.handleError).not.toHaveBeenCalled();
        done();
      }
    });

    httpMock.expectOne('/api/test').flush({ result: 'ok' });
  });
});
```

---

## E2E Tests

E2E tests verify critical user flows through the running application. Per [e2e-testing](../layer-1/cross-cutting/testing/e2e-testing.md), they are expensive to write and maintain. Only cover the flows that, if broken, would prevent users from accomplishing their primary task.

For the reference application, the critical flows are:
1. Search for a product and see results
2. Apply a filter and see results narrow
3. Scroll to load more results (infinite scroll / `search_after`)
4. Navigate to a product detail page
5. Encounter an error and see a user-friendly message

### Playwright Test (preferred over Protractor for new projects)

```typescript
// e2e/search-flow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Product Search Flow', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should search for a product and display results', async ({ page }) => {
    // Type in the search bar
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('keyboard');
    await searchInput.press('Enter');

    // Wait for results to appear
    const productCards = page.locator('app-product-card');
    await expect(productCards.first()).toBeVisible();

    // Verify at least one result rendered
    const count = await productCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should apply category filter and narrow results', async ({ page }) => {
    // Search first
    await page.locator('[data-testid="search-input"]').fill('keyboard');
    await page.locator('[data-testid="search-input"]').press('Enter');

    // Wait for facets to load
    const facetList = page.locator('.facets li');
    await expect(facetList.first()).toBeVisible();

    // Get initial result count
    const initialCount = await page.locator('app-product-card').count();

    // Click a category filter
    await facetList.first().click();

    // Wait for results to update
    await page.waitForResponse(resp =>
      resp.url().includes('/api/search/products') && resp.status() === 200
    );

    // Verify the active filter is highlighted
    await expect(facetList.first()).toHaveClass(/active/);
  });

  test('should load more results on scroll', async ({ page }) => {
    // Search for something with many results
    await page.locator('[data-testid="search-input"]').fill('product');
    await page.locator('[data-testid="search-input"]').press('Enter');

    // Wait for initial results
    await expect(page.locator('app-product-card').first()).toBeVisible();
    const initialCount = await page.locator('app-product-card').count();

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for more results to load
    await page.waitForResponse(resp =>
      resp.url().includes('/api/search/products') && resp.status() === 200
    );

    // Verify more cards appeared
    const newCount = await page.locator('app-product-card').count();
    expect(newCount).toBeGreaterThan(initialCount);
  });

  test('should navigate to product detail and back', async ({ page }) => {
    await page.locator('[data-testid="search-input"]').fill('keyboard');
    await page.locator('[data-testid="search-input"]').press('Enter');

    await expect(page.locator('app-product-card').first()).toBeVisible();

    // Click first product
    await page.locator('app-product-card').first().click();

    // Verify navigation to detail page
    await expect(page).toHaveURL(/\/products\/.+/);
    await expect(page.locator('.product-detail')).toBeVisible();

    // Navigate back
    await page.goBack();
    await expect(page).toHaveURL('/');
  });

  test('should display user-friendly error on server failure', async ({ page }) => {
    // Intercept the search API and force a 500
    await page.route('**/api/search/products', route =>
      route.fulfill({ status: 500, body: JSON.stringify({
        code: 'SERVER_ERROR',
        message: 'An unexpected server error occurred.'
      })})
    );

    await page.locator('[data-testid="search-input"]').fill('keyboard');
    await page.locator('[data-testid="search-input"]').press('Enter');

    // Verify error state shows, not a blank page or raw error
    const errorState = page.locator('.error-state');
    await expect(errorState).toBeVisible();
    await expect(errorState).toContainText('Something went wrong');

    // Verify retry button exists
    await expect(page.locator('.error-state button')).toBeVisible();
  });
});
```

### What E2E Tests Do NOT Cover

- Every filter combination (covered by integration tests on `QueryBuilderService`)
- Every error code (covered by interceptor integration tests)
- Aggregation bucket rendering (covered by component tests)
- Exact query format sent to Elasticsearch (covered by unit tests on `QueryBuilderService`)
- CSS layout and visual appearance (covered by visual regression tools, if used)

This distribution follows the [testing-pyramid](../layer-1/cross-cutting/testing/testing-pyramid.md): many unit tests (fast, cheap), fewer integration tests (medium), and a handful of E2E tests (slow, expensive).

---

## Testing the Full Search Flow: End-to-End Across Levels

To illustrate how the levels compose, here is the same search flow tested at each level:

**User story**: A user searches for "keyboard", sees results with category facets, clicks "Electronics", and sees filtered results.

### Unit level
- `QueryBuilderService.buildProductSearch({ query: 'keyboard', filters: {} })` produces the correct `multi_match` query.
- `QueryBuilderService.buildProductSearch({ query: 'keyboard', filters: { category: 'Electronics' } })` adds a `term` filter to `bool.filter`.
- Aggregation-to-facet mapping returns `{ label: 'Electronics', count: 42, selected: true }` when `activeFilters.category === 'Electronics'`.

### Component level
- `SearchResultsComponent` renders 2 `app-product-card` stubs when `mockResults$` emits 2 products.
- Clicking a facet calls `searchService.applyFilter({ category: 'Electronics' })`.
- The `.active` class appears on the selected facet when the summary shows `selected: true`.

### Integration level
- `SearchService.search('keyboard')` sends a POST to `/api/search/products` with the correct body.
- `SearchService.applyFilter({ category: 'Electronics' })` sends a new POST with `category.keyword` in `bool.filter`.
- The response is mapped to `Product[]` and `SearchSummary` correctly.

### E2E level
- User types "keyboard", presses Enter, sees product cards.
- User clicks "Electronics" facet, sees updated results, sees the facet highlighted.

Each level trusts the levels below it. The E2E test does not verify query format. The component test does not verify HTTP calls. The unit test does not verify DOM rendering. This is the discipline defined by [test-boundaries](../layer-1/cross-cutting/testing/test-boundaries.md) and [separation-of-concerns](../layer-1/architecture/design-principles/separation-of-concerns.md).

---

## Anti-Patterns

### Testing implementation, not behavior

```typescript
// BAD -- tests internal method call order, breaks on any refactor
it('should call buildQuery then executeSearch', () => {
  spyOn(service as any, 'buildQuery');
  spyOn(service as any, 'executeSearch');
  service.search('keyboard');
  expect((service as any).buildQuery).toHaveBeenCalledBefore((service as any).executeSearch);
});
```

Test the output (correct products returned), not the internal call sequence.

### Testing framework code

```typescript
// BAD -- tests that Angular's DI works, not your code
it('should create the service', () => {
  expect(service).toBeTruthy();  // This tests Angular, not you
});
```

Every test should assert a behavior, not the existence of an object. Per [unit-testing](../layer-1/cross-cutting/testing/unit-testing.md), the question is "given this input, does it produce this output?" not "does it exist?"

### Skipping `httpMock.verify()`

```typescript
// BAD -- no afterEach verify, phantom HTTP calls go undetected
afterEach(() => {
  // Missing: httpMock.verify()
});
```

Without `verify()`, a test could trigger unexpected HTTP calls and still pass. The test is lying about the service's behavior.

---

## Summary by Praxis Node

| Praxis Node | Test Level | What It Governs |
|---|---|---|
| [testing-pyramid](../layer-1/cross-cutting/testing/testing-pyramid.md) | All | Distribution of tests across levels |
| [unit-testing](../layer-1/cross-cutting/testing/unit-testing.md) | Unit | Isolation, single-behavior, single-reason-to-fail |
| [integration-testing](../layer-1/cross-cutting/testing/integration-testing.md) | Integration | Service + HttpClient collaboration |
| [e2e-testing](../layer-1/cross-cutting/testing/e2e-testing.md) | E2E | Critical user flows only |
| [test-boundaries](../layer-1/cross-cutting/testing/test-boundaries.md) | All | What is inside/outside the test boundary |
| [angular-testbed](../layer-2/testing/angular-testbed.md) | Component, Integration | TestBed configuration and module isolation |
| [angular-component-testing](../layer-2/testing/angular-component-testing.md) | Component | Fixture, DebugElement, detectChanges |
| [angular-http-testing](../layer-2/testing/angular-http-testing.md) | Integration | HttpClientTestingModule, HttpTestingController |
| [angular-service-testing](../layer-2/testing/angular-service-testing.md) | Unit | Services with mocked dependencies |
| [angular-component-harness](../layer-2/testing/angular-component-harness.md) | Component | Page object pattern for DOM isolation |
| [angular-marble-testing](../layer-2/testing/angular-marble-testing.md) | Unit | Synchronous testing of complex async sequences |
| [separation-of-concerns](../layer-1/architecture/design-principles/separation-of-concerns.md) | All | Each level tests its own concern, trusts levels below |
