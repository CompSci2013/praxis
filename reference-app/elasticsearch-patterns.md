# Elasticsearch Patterns

This document covers architectural patterns for using Elasticsearch as the primary data store in the reference application. Elasticsearch is not a relational database -- it is a search engine with document storage. Every pattern here addresses a consequence of that distinction.

The reference application exposes a product catalog and document search UI. The API layer queries Elasticsearch and serves results to an Angular 14 front-end.

---

## Query Building

**Governing principle**: Query construction belongs in the service layer, never in components. Components declare _what_ they want (search term, filters, sort order). Services translate that intent into Elasticsearch Query DSL. This is a direct application of [separation-of-concerns](../layer-1/architecture/design-principles/separation-of-concerns.md) -- the component should not know that Elasticsearch exists, only that a service returns typed results.

The [query-dsl](../layer-1/backend/search-engine/query-dsl.md) node defines the universal distinction: **queries** (scored by relevance) vs. **filters** (binary match, cached). The [query-builders](../layer-1/backend/data-access/query-builders.md) node generalizes this to any data access layer -- build queries programmatically, never concatenate strings.

### TypeScript Interfaces for Query Construction

Define types that mirror Elasticsearch's query structure. These live in a shared `models/` directory, never inside component files.

```typescript
// models/search-request.model.ts

export interface SearchRequest {
  query: string;
  filters: SearchFilters;
  sort: SortField;
  pagination: PaginationParams;
}

export interface SearchFilters {
  category?: string;
  priceRange?: { min: number; max: number };
  inStock?: boolean;
  tags?: string[];
}

export interface SortField {
  field: string;
  order: 'asc' | 'desc';
}

export interface PaginationParams {
  size: number;
  searchAfter?: unknown[];  // for deep pagination -- see Pagination section
}
```

### The Query Builder Service

The query builder translates the application's `SearchRequest` into Elasticsearch Query DSL JSON. This is a pure function with no side effects -- it takes a request and returns a body object. The [repository-pattern](../layer-1/backend/data-access/repository-pattern.md) governs this: the builder is the query abstraction, the search service is the repository.

```typescript
// services/query-builder.service.ts

import { Injectable } from '@angular/core';
import { SearchRequest, SearchFilters } from '../models/search-request.model';

@Injectable({ providedIn: 'root' })
export class QueryBuilderService {

  buildProductSearch(request: SearchRequest): object {
    const must: object[] = [];
    const filter: object[] = [];

    // Full-text query -- scored by relevance
    if (request.query) {
      must.push({
        multi_match: {
          query: request.query,
          fields: ['name^3', 'description', 'tags^2'],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      });
    }

    // Filters -- binary, cached, not scored
    this.applyFilters(request.filters, filter);

    const body: Record<string, unknown> = {
      query: {
        bool: {
          must: must.length ? must : [{ match_all: {} }],
          filter
        }
      },
      size: request.pagination.size,
      sort: this.buildSort(request),
    };

    if (request.pagination.searchAfter) {
      body['search_after'] = request.pagination.searchAfter;
    }

    return body;
  }

  private applyFilters(filters: SearchFilters, target: object[]): void {
    if (filters.category) {
      target.push({ term: { 'category.keyword': filters.category } });
    }
    if (filters.priceRange) {
      target.push({
        range: { price: { gte: filters.priceRange.min, lte: filters.priceRange.max } }
      });
    }
    if (filters.inStock !== undefined) {
      target.push({ term: { in_stock: filters.inStock } });
    }
    if (filters.tags?.length) {
      target.push({ terms: { 'tags.keyword': filters.tags } });
    }
  }

  private buildSort(request: SearchRequest): object[] {
    const sort: object[] = [];

    if (request.query && request.sort.field === '_score') {
      sort.push({ _score: { order: 'desc' } });
    } else {
      sort.push({ [request.sort.field]: { order: request.sort.order } });
    }

    // Tiebreaker required for search_after pagination
    sort.push({ _id: { order: 'asc' } });

    return sort;
  }
}
```

### Anti-pattern: Query DSL in Components

This violates [separation-of-concerns](../layer-1/architecture/design-principles/separation-of-concerns.md) and [single-responsibility](../layer-1/architecture/design-principles/single-responsibility.md):

```typescript
// BAD -- component builds query DSL directly
export class SearchComponent {
  search(): void {
    const body = {
      query: { bool: { must: [{ match: { name: this.searchTerm } }] } }
    };
    this.http.post('/api/products/_search', body).subscribe(/* ... */);
  }
}
```

The component now depends on Elasticsearch's query format. Changing the search engine means changing every component that searches. Move query construction to `QueryBuilderService`, HTTP calls to `SearchService`.

---

## Aggregation Consumption

Elasticsearch aggregations compute summaries -- counts, averages, histograms, nested breakdowns -- alongside search results in a single request. The [aggregations](../layer-1/backend/search-engine/aggregations.md) node defines the concept. In the reference application, aggregations drive three UI patterns: faceted navigation, summary cards, and charts.

### Adding Aggregations to the Query

Aggregations ride alongside the query in the same request body. The `aggs` section does not affect which documents match -- it computes statistics over the matched set.

```typescript
// In QueryBuilderService

buildProductSearchWithFacets(request: SearchRequest): object {
  const body = this.buildProductSearch(request) as Record<string, unknown>;

  body['aggs'] = {
    categories: {
      terms: { field: 'category.keyword', size: 50 }
    },
    price_histogram: {
      histogram: { field: 'price', interval: 25 }
    },
    avg_price: {
      avg: { field: 'price' }
    },
    in_stock_count: {
      filter: { term: { in_stock: true } },
      aggs: {
        count: { value_count: { field: '_id' } }
      }
    }
  };

  return body;
}
```

### Typed Aggregation Response

Elasticsearch returns aggregations in a separate `aggregations` key, not mixed with hits. Define interfaces that match the response shape:

```typescript
// models/search-response.model.ts

export interface SearchResponse<T> {
  hits: {
    total: { value: number; relation: 'eq' | 'gte' };
    hits: Array<{
      _id: string;
      _index: string;
      _score: number | null;
      _source: T;
      sort?: unknown[];  // needed for search_after
    }>;
  };
  aggregations?: AggregationResults;
}

export interface AggregationResults {
  categories?: BucketAggregation;
  price_histogram?: BucketAggregation;
  avg_price?: MetricAggregation;
  in_stock_count?: FilterAggregation;
}

export interface BucketAggregation {
  buckets: Array<{ key: string | number; doc_count: number }>;
}

export interface MetricAggregation {
  value: number | null;
}

export interface FilterAggregation {
  doc_count: number;
  count?: MetricAggregation;
}
```

### Mapping Aggregations to UI Facets

The service layer transforms raw aggregation buckets into UI-ready models. Components never parse aggregation response structures.

```typescript
// models/facet.model.ts

export interface Facet {
  label: string;
  count: number;
  selected: boolean;
}

export interface SearchSummary {
  totalResults: number;
  averagePrice: number | null;
  inStockCount: number;
  facets: { [key: string]: Facet[] };
}
```

```typescript
// services/search.service.ts (excerpt)

private mapAggregationsToSummary(
  aggs: AggregationResults | undefined,
  total: number,
  activeFilters: SearchFilters
): SearchSummary {
  return {
    totalResults: total,
    averagePrice: aggs?.avg_price?.value ?? null,
    inStockCount: aggs?.in_stock_count?.doc_count ?? 0,
    facets: {
      categories: (aggs?.categories?.buckets ?? []).map(bucket => ({
        label: String(bucket.key),
        count: bucket.doc_count,
        selected: activeFilters.category === String(bucket.key)
      }))
    }
  };
}
```

### Component Consumption

The component binds to the summary model. It does not know that aggregations exist:

```typescript
// components/search-results/search-results.component.ts

@Component({
  selector: 'app-search-results',
  templateUrl: './search-results.component.html'
})
export class SearchResultsComponent implements OnInit, OnDestroy {
  results$!: Observable<Product[]>;
  summary$!: Observable<SearchSummary>;

  private destroy$ = new Subject<void>();

  constructor(private searchService: SearchService) {}

  ngOnInit(): void {
    this.results$ = this.searchService.results$;
    this.summary$ = this.searchService.summary$;
  }

  onFacetSelected(category: string): void {
    this.searchService.applyFilter({ category });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

```html
<!-- search-results.component.html -->
<div class="search-layout">
  <aside class="facets" *ngIf="summary$ | async as summary">
    <h3>Categories</h3>
    <ul>
      <li *ngFor="let facet of summary.facets['categories']"
          [class.active]="facet.selected"
          (click)="onFacetSelected(facet.label)">
        {{ facet.label }} ({{ facet.count }})
      </li>
    </ul>
    <div class="summary-cards">
      <div class="card">{{ summary.totalResults }} results</div>
      <div class="card" *ngIf="summary.averagePrice !== null">
        Avg price: {{ summary.averagePrice | currency }}
      </div>
      <div class="card">{{ summary.inStockCount }} in stock</div>
    </div>
  </aside>

  <main class="results">
    <app-product-card
      *ngFor="let product of results$ | async"
      [product]="product">
    </app-product-card>
  </main>
</div>
```

This follows [angular-services](../layer-2/services/angular-services.md) -- the service owns the data, the component renders it. The `async` pipe handles subscription lifecycle per [angular-subscription-management](../layer-2/rxjs/angular-subscription-management.md).

---

## Mapping Design

Index mappings define how Elasticsearch stores and indexes fields. They are not an afterthought -- they directly determine what queries are possible and how the front-end behaves. The [mapping-design](../layer-1/backend/search-engine/mapping-design.md) node covers this in depth; the [inverted-index-concepts](../layer-1/backend/search-engine/inverted-index-concepts.md) node explains why mappings matter at the engine level.

### Mapping Conventions

```json
{
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "analyzer": "standard",
        "fields": {
          "keyword": { "type": "keyword" },
          "autocomplete": {
            "type": "text",
            "analyzer": "autocomplete_analyzer"
          }
        }
      },
      "description": {
        "type": "text",
        "analyzer": "english"
      },
      "category": {
        "type": "keyword"
      },
      "price": {
        "type": "float"
      },
      "in_stock": {
        "type": "boolean"
      },
      "tags": {
        "type": "keyword"
      },
      "created_at": {
        "type": "date",
        "format": "strict_date_optional_time"
      },
      "metadata": {
        "type": "object",
        "enabled": false
      }
    }
  },
  "settings": {
    "analysis": {
      "analyzer": {
        "autocomplete_analyzer": {
          "type": "custom",
          "tokenizer": "autocomplete_tokenizer",
          "filter": ["lowercase"]
        }
      },
      "tokenizer": {
        "autocomplete_tokenizer": {
          "type": "edge_ngram",
          "min_gram": 2,
          "max_gram": 20,
          "token_chars": ["letter", "digit"]
        }
      }
    }
  }
}
```

### How Mappings Affect the Front-End

| Mapping Decision | Front-End Consequence |
|---|---|
| `text` field with `standard` analyzer | Full-text search works, but exact match fails. Use `.keyword` sub-field for exact filters. |
| `keyword` only | Exact match and aggregations work. Full-text search (fuzzy, partial) does not. |
| Multi-field (`text` + `keyword` + `autocomplete`) | Supports search, filtering, and typeahead from a single source field. |
| `english` analyzer on `description` | Stemming applies: searching "running" matches "run", "runs", "runner". |
| `edge_ngram` analyzer | Autocomplete/typeahead: "pro" matches "product", "professional". Higher index size. |
| `enabled: false` on `metadata` | Field is stored but not searchable. Good for pass-through data the UI displays but never queries. |
| Missing `keyword` sub-field on a `text` field | Aggregation on that field fails at query time. This is the most common mapping mistake. |

### TypeScript Model Alignment

The TypeScript interface mirrors the mapping, not the other way around. If the mapping has a `keyword` sub-field, the TypeScript type is `string`. If the mapping has `float`, the TypeScript type is `number`. The query builder references the mapping field paths (e.g., `category.keyword`, not `category`).

```typescript
// models/product.model.ts

export interface Product {
  name: string;
  description: string;
  category: string;
  price: number;
  in_stock: boolean;
  tags: string[];
  created_at: string;  // ISO 8601 string, not Date -- ES returns strings
  metadata?: Record<string, unknown>;
}
```

---

## Pagination

Elasticsearch's default `from/size` pagination breaks at 10,000 results. This is a hard limit (`index.max_result_window`), not a suggestion. The [pagination-strategies](../layer-1/architecture/api-design/pagination-strategies.md) node describes offset vs. cursor pagination generally; the [pagination-deep-dive](../layer-1/backend/bulk-operations/pagination-deep-dive.md) node covers the backend implementation.

For deep pagination, use `search_after` -- a cursor-based approach that uses the sort values of the last document to fetch the next page.

### How `search_after` Works

1. First request: normal query with `sort` and `size`. No `search_after`.
2. Response includes `sort` values on each hit.
3. Next request: same query, but add `search_after: [last_hit.sort]`.
4. Repeat. No random access -- you can only go forward.

This maps naturally to infinite scroll in the front-end. It does **not** map to traditional page-number navigation (page 1, 2, 3...). If you need page numbers, use `from/size` within the 10,000 limit.

### Service Implementation

```typescript
// services/search.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { map, switchMap, scan, takeUntil, tap } from 'rxjs/operators';
import { SearchRequest, SearchFilters, PaginationParams } from '../models/search-request.model';
import { SearchResponse, AggregationResults } from '../models/search-response.model';
import { Product } from '../models/product.model';
import { QueryBuilderService } from './query-builder.service';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private searchParams$ = new BehaviorSubject<SearchRequest>(this.defaultRequest());
  private loadMore$ = new Subject<void>();

  results$: Observable<Product[]>;
  summary$: Observable<SearchSummary>;
  loading$ = new BehaviorSubject<boolean>(false);
  hasMore$ = new BehaviorSubject<boolean>(true);

  private lastSortValues: unknown[] | undefined;
  private currentFilters: SearchFilters = {};

  constructor(
    private http: HttpClient,
    private queryBuilder: QueryBuilderService
  ) {
    // New search resets accumulation; loadMore appends
    this.results$ = this.searchParams$.pipe(
      switchMap(params => this.executeSearch(params)),
      scan((accumulated, response) => {
        if (!response.isAppend) {
          return response.products;
        }
        return [...accumulated, ...response.products];
      }, [] as Product[])
    );

    this.summary$ = this.searchParams$.pipe(
      switchMap(params => this.executeSummary(params))
    );
  }

  search(query: string): void {
    this.lastSortValues = undefined;
    this.searchParams$.next({
      ...this.defaultRequest(),
      query,
      filters: this.currentFilters
    });
  }

  applyFilter(filters: Partial<SearchFilters>): void {
    this.lastSortValues = undefined;
    this.currentFilters = { ...this.currentFilters, ...filters };
    const current = this.searchParams$.value;
    this.searchParams$.next({
      ...current,
      filters: this.currentFilters,
      pagination: { size: current.pagination.size }
    });
  }

  loadNextPage(): void {
    if (!this.lastSortValues || !this.hasMore$.value) { return; }
    const current = this.searchParams$.value;
    this.searchParams$.next({
      ...current,
      pagination: {
        size: current.pagination.size,
        searchAfter: this.lastSortValues
      }
    });
  }

  private executeSearch(params: SearchRequest): Observable<{ products: Product[]; isAppend: boolean }> {
    this.loading$.next(true);
    const body = this.queryBuilder.buildProductSearchWithFacets(params);
    const isAppend = !!params.pagination.searchAfter;

    return this.http.post<SearchResponse<Product>>('/api/search/products', body).pipe(
      tap(response => {
        const hits = response.hits.hits;
        this.lastSortValues = hits.length ? hits[hits.length - 1].sort : undefined;
        this.hasMore$.next(hits.length === params.pagination.size);
        this.loading$.next(false);
      }),
      map(response => ({
        products: response.hits.hits.map(hit => ({ ...hit._source, _id: hit._id })),
        isAppend
      }))
    );
  }

  private executeSummary(params: SearchRequest): Observable<SearchSummary> {
    // Summary is derived from the same response -- in production, cache or combine
    const body = this.queryBuilder.buildProductSearchWithFacets(params);
    return this.http.post<SearchResponse<Product>>('/api/search/products', body).pipe(
      map(response => this.mapAggregationsToSummary(
        response.aggregations,
        response.hits.total.value,
        params.filters
      ))
    );
  }

  private defaultRequest(): SearchRequest {
    return {
      query: '',
      filters: {},
      sort: { field: '_score', order: 'desc' },
      pagination: { size: 20 }
    };
  }

  private mapAggregationsToSummary(
    aggs: AggregationResults | undefined,
    total: number,
    activeFilters: SearchFilters
  ): SearchSummary {
    return {
      totalResults: total,
      averagePrice: aggs?.avg_price?.value ?? null,
      inStockCount: aggs?.in_stock_count?.doc_count ?? 0,
      facets: {
        categories: (aggs?.categories?.buckets ?? []).map(bucket => ({
          label: String(bucket.key),
          count: bucket.doc_count,
          selected: activeFilters.category === String(bucket.key)
        }))
      }
    };
  }
}
```

### Infinite Scroll Component

The component uses `search_after` pagination through the service. It does not know about Elasticsearch cursors -- it calls `loadNextPage()`.

```typescript
// components/product-list/product-list.component.ts

import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SearchService } from '../../services/search.service';
import { Product } from '../../models/product.model';

@Component({
  selector: 'app-product-list',
  template: `
    <div class="product-list">
      <app-product-card
        *ngFor="let product of products; trackBy: trackById"
        [product]="product">
      </app-product-card>

      <div class="loading-indicator" *ngIf="loading">
        Loading more results...
      </div>

      <div class="end-of-results" *ngIf="!hasMore && products.length > 0">
        All results loaded
      </div>
    </div>
  `
})
export class ProductListComponent implements OnInit, OnDestroy {
  products: Product[] = [];
  loading = false;
  hasMore = true;

  private destroy$ = new Subject<void>();

  constructor(private searchService: SearchService) {}

  ngOnInit(): void {
    this.searchService.results$
      .pipe(takeUntil(this.destroy$))
      .subscribe(products => this.products = products);

    this.searchService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => this.loading = loading);

    this.searchService.hasMore$
      .pipe(takeUntil(this.destroy$))
      .subscribe(hasMore => this.hasMore = hasMore);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (this.loading || !this.hasMore) { return; }

    const scrollPosition = window.scrollY + window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const threshold = 200; // px from bottom

    if (documentHeight - scrollPosition < threshold) {
      this.searchService.loadNextPage();
    }
  }

  trackById(_index: number, product: Product & { _id: string }): string {
    return product._id;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

This follows [angular-subscription-management](../layer-2/rxjs/angular-subscription-management.md) for lifecycle cleanup and [url-as-source-of-truth](../layer-1/frontend/routing/url-as-source-of-truth.md) -- in a full implementation, the search state would be reflected in query parameters so deep-linking works.

---

## Bulk Operations

Bulk indexing and updating in Elasticsearch uses the `_bulk` API, which accepts newline-delimited JSON (NDJSON). The [bulk-operations](../layer-1/backend/bulk-operations/bulk-operations.md) node defines the general pattern; the [background-jobs](../layer-1/backend/bulk-operations/background-jobs.md) node addresses long-running operations.

In the reference application, bulk operations arise when an administrator imports a product catalog CSV or batch-updates prices. The front-end needs progress reporting.

### Bulk Service

```typescript
// services/bulk-import.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { map, finalize } from 'rxjs/operators';

export interface BulkProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: BulkItemError[];
  status: 'idle' | 'running' | 'complete' | 'error';
}

export interface BulkItemError {
  index: number;
  id: string;
  reason: string;
}

@Injectable({ providedIn: 'root' })
export class BulkImportService {
  private progress$ = new BehaviorSubject<BulkProgress>(this.initialProgress());

  getProgress(): Observable<BulkProgress> {
    return this.progress$.asObservable();
  }

  /**
   * Sends documents in batches to the API.
   * The API handles _bulk calls to Elasticsearch.
   * Batch size is kept small enough to avoid HTTP timeouts.
   */
  importProducts(products: object[]): Observable<BulkProgress> {
    const batchSize = 500;
    const total = products.length;
    const progress: BulkProgress = { ...this.initialProgress(), total, status: 'running' };
    this.progress$.next(progress);

    return new Observable<BulkProgress>(subscriber => {
      const batches = this.chunk(products, batchSize);
      let batchIndex = 0;

      const processNext = (): void => {
        if (batchIndex >= batches.length) {
          progress.status = 'complete';
          this.progress$.next({ ...progress });
          subscriber.next({ ...progress });
          subscriber.complete();
          return;
        }

        this.http.post<BulkApiResponse>('/api/bulk/products', {
          documents: batches[batchIndex]
        }).subscribe({
          next: (response) => {
            progress.processed += batches[batchIndex].length;
            progress.succeeded += response.succeeded;
            progress.failed += response.failed;
            progress.errors.push(...response.errors);
            this.progress$.next({ ...progress });
            subscriber.next({ ...progress });
            batchIndex++;
            processNext();
          },
          error: (err) => {
            progress.status = 'error';
            this.progress$.next({ ...progress });
            subscriber.error(err);
          }
        });
      };

      processNext();
    });
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }

  private initialProgress(): BulkProgress {
    return { total: 0, processed: 0, succeeded: 0, failed: 0, errors: [], status: 'idle' };
  }

  constructor(private http: HttpClient) {}
}

interface BulkApiResponse {
  succeeded: number;
  failed: number;
  errors: BulkItemError[];
}
```

### Progress Reporting Component

```typescript
// components/import-progress/import-progress.component.ts

@Component({
  selector: 'app-import-progress',
  template: `
    <div class="import-progress" *ngIf="progress$ | async as p">
      <div class="progress-bar">
        <div class="fill"
             [style.width.%]="p.total ? (p.processed / p.total * 100) : 0">
        </div>
      </div>
      <span>{{ p.processed }} / {{ p.total }} processed</span>
      <span *ngIf="p.failed > 0" class="error-count">{{ p.failed }} failed</span>
      <span class="status">{{ p.status }}</span>
    </div>
  `
})
export class ImportProgressComponent {
  progress$ = this.bulkImportService.getProgress();
  constructor(private bulkImportService: BulkImportService) {}
}
```

---

## Multi-Index Queries

Elasticsearch can query multiple indices in a single request. In the reference application, this arises when searching across both products and documentation (e.g., a unified search bar). The [search-engine-as-datastore](../layer-1/backend/search-engine/search-engine-as-datastore.md) node addresses the tradeoffs of using Elasticsearch as primary storage -- multi-index queries are one of its strengths over relational databases.

### When to Use Multi-Index Queries

- **Unified search**: User types in a global search bar, results come from products, documents, and support articles.
- **Cross-referencing**: Dashboard shows aggregated metrics across multiple data types.

### When NOT to Use Multi-Index Queries

- **Unrelated data**: Querying products and server logs together has no user value.
- **Different access controls**: If indices have different visibility rules, merge at the API layer after separate queries.

### Response Merging

Each hit in a multi-index response includes an `_index` field. The service uses this to sort results into typed buckets:

```typescript
// services/unified-search.service.ts

export interface UnifiedSearchResult {
  products: Product[];
  documents: Document[];
}

@Injectable({ providedIn: 'root' })
export class UnifiedSearchService {

  constructor(
    private http: HttpClient,
    private queryBuilder: QueryBuilderService
  ) {}

  search(query: string): Observable<UnifiedSearchResult> {
    const body = this.queryBuilder.buildUnifiedSearch(query);

    // API proxies to POST /products,documents/_search
    return this.http.post<SearchResponse<unknown>>('/api/search/unified', body).pipe(
      map(response => this.partitionByIndex(response))
    );
  }

  private partitionByIndex(response: SearchResponse<unknown>): UnifiedSearchResult {
    const result: UnifiedSearchResult = { products: [], documents: [] };

    for (const hit of response.hits.hits) {
      switch (hit._index) {
        case 'products':
          result.products.push(hit._source as Product);
          break;
        case 'documents':
          result.documents.push(hit._source as Document);
          break;
        // Unknown indices are silently ignored -- defensive coding
      }
    }

    return result;
  }
}
```

This preserves [layered-architecture](../layer-1/architecture/module-design/layered-architecture.md) -- the API layer handles the multi-index query, the service layer splits the response, and the component receives typed data.

---

## Error Shapes

Elasticsearch error responses differ from REST conventions. A `400 Bad Request` from Elasticsearch includes a nested JSON structure with `type`, `reason`, `root_cause`, and sometimes `caused_by`. The API layer must normalize these into a consistent error contract before they reach the front-end. The [api-error-contracts](../layer-1/architecture/api-design/api-error-contracts.md) node governs this normalization; the [error-boundaries](../layer-1/cross-cutting/error-handling/error-boundaries.md) node defines where the boundary sits.

### Elasticsearch Error Structure

```json
{
  "error": {
    "root_cause": [
      {
        "type": "query_shard_exception",
        "reason": "No mapping found for [nonexistent_field] in order to sort on",
        "index": "products"
      }
    ],
    "type": "search_phase_execution_exception",
    "reason": "all shards failed",
    "phase": "query",
    "grouped": true,
    "failed_shards": [
      {
        "shard": 0,
        "index": "products",
        "reason": {
          "type": "query_shard_exception",
          "reason": "No mapping found for [nonexistent_field] in order to sort on"
        }
      }
    ]
  },
  "status": 400
}
```

### Normalized Error Model

The API normalizes Elasticsearch errors into a standard shape. The front-end never sees raw Elasticsearch JSON:

```typescript
// models/api-error.model.ts

export interface ApiError {
  code: string;           // e.g., 'SEARCH_FAILED', 'INDEX_NOT_FOUND', 'VALIDATION_ERROR'
  message: string;        // User-safe message
  details?: string;       // Developer-facing detail (stripped in production)
  status: number;         // HTTP status code
  timestamp: string;
}
```

### API-Side Normalization (Server Context)

The API catches Elasticsearch errors and maps them:

```typescript
// api/middleware/elasticsearch-error.handler.ts (server-side, for reference)

function normalizeElasticsearchError(esError: any): ApiError {
  const rootCause = esError?.error?.root_cause?.[0];
  const type = rootCause?.type || esError?.error?.type || 'unknown';

  const codeMap: Record<string, { code: string; message: string }> = {
    'index_not_found_exception':       { code: 'INDEX_NOT_FOUND', message: 'The requested resource collection does not exist.' },
    'query_shard_exception':           { code: 'SEARCH_FAILED', message: 'The search query could not be processed.' },
    'mapper_parsing_exception':        { code: 'VALIDATION_ERROR', message: 'The provided data does not match the expected format.' },
    'search_phase_execution_exception': { code: 'SEARCH_FAILED', message: 'The search could not be completed.' },
    'resource_already_exists_exception': { code: 'CONFLICT', message: 'This resource already exists.' },
  };

  const mapped = codeMap[type] || { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' };

  return {
    code: mapped.code,
    message: mapped.message,
    details: rootCause?.reason,
    status: esError?.status || 500,
    timestamp: new Date().toISOString()
  };
}
```

### Front-End Error Handling

The Angular interceptor catches HTTP errors and wraps them in the `ApiError` type. See [error-handling.md](./error-handling.md) for the full interceptor implementation. The key point: raw Elasticsearch errors never reach components.

```typescript
// In the HTTP interceptor (see error-handling.md for full implementation)
// The interceptor reads the normalized ApiError from the response body,
// not the raw Elasticsearch error.

catchError((error: HttpErrorResponse) => {
  const apiError: ApiError = error.error as ApiError;
  // apiError.code is 'SEARCH_FAILED', not 'query_shard_exception'
  // apiError.message is 'The search query could not be processed.', not a shard dump
  return throwError(() => apiError);
})
```

### Anti-pattern: Surfacing Raw Errors

This violates [user-vs-developer-errors](../layer-1/cross-cutting/error-handling/user-vs-developer-errors.md):

```typescript
// BAD -- raw Elasticsearch error shown to user
this.http.post('/api/search', body).subscribe({
  error: (err) => {
    this.errorMessage = err.error.error.root_cause[0].reason;
    // User sees: "No mapping found for [nonexistent_field] in order to sort on"
  }
});
```

The user cannot act on that message. The API should have normalized it to "The search could not be completed" with the technical detail logged server-side per [structured-logging](../layer-1/cross-cutting/observability/structured-logging.md).
