# Error Handling

This document specifies error boundaries in the reference application: where errors are caught, how they transform, and where they surface. The governing nodes are [error-boundaries](../layer-1/cross-cutting/error-handling/error-boundaries.md), [error-propagation](../layer-1/cross-cutting/error-handling/error-propagation.md), [error-typing](../layer-1/cross-cutting/error-handling/error-typing.md), and [user-vs-developer-errors](../layer-1/cross-cutting/error-handling/user-vs-developer-errors.md).

---

## Error Boundary Map

| Layer | Catches | Transforms To | Surfaces At |
|---|---|---|---|
| HttpClient interceptor | HTTP errors (4xx, 5xx) | Typed `AppError` object | Error service / toast notification |
| Service | Business logic errors, empty results, invalid state | User-facing message via observable error | Component via `catchError` in pipe or error callback |
| Component | Template rendering errors (null reference, bad pipe input) | Error state template (`*ngIf="error"`) | Global `ErrorHandler` for unhandled cases |
| Route resolver | Navigation errors (failed data fetch before route activates) | Redirect to error page | Router navigates to `/error` |

Each boundary has one job: catch, transform, and either recover or propagate. No boundary should swallow errors silently. No boundary should pass raw technical details to the user.

---

## The Anti-Pattern This Architecture Prevents

Junior developers default to one of these patterns:

```typescript
// ANTI-PATTERN 1: try/catch everywhere, swallow with console.log
async loadProducts(): Promise<void> {
  try {
    this.products = await this.http.get('/api/products').toPromise();
  } catch (e) {
    console.log('error', e);  // swallowed -- UI shows nothing, user confused
  }
}

// ANTI-PATTERN 2: raw HTTP error text shown to user
this.http.get('/api/products').subscribe({
  error: (err) => {
    this.errorMessage = err.message;
    // User sees: "Http failure response for /api/products: 500 Internal Server Error"
  }
});

// ANTI-PATTERN 3: every component handles errors independently
// Result: 47 different error handling implementations, none consistent
```

These violate [error-propagation](../layer-1/cross-cutting/error-handling/error-propagation.md) (errors must flow through defined channels), [user-vs-developer-errors](../layer-1/cross-cutting/error-handling/user-vs-developer-errors.md) (users see technical gibberish), and [error-boundaries](../layer-1/cross-cutting/error-handling/error-boundaries.md) (no defined catch point).

---

## Typed Error Model

All errors in the application flow through a single type. This is [error-typing](../layer-1/cross-cutting/error-handling/error-typing.md) in practice.

```typescript
// models/app-error.model.ts

export interface AppError {
  /** Machine-readable code for programmatic handling */
  code: ErrorCode;
  /** User-safe message, suitable for display */
  message: string;
  /** HTTP status code (if applicable) */
  status?: number;
  /** Developer-facing detail -- never shown to users */
  detail?: string;
  /** Timestamp of the error occurrence */
  timestamp: Date;
  /** Correlation ID for tracing across layers */
  correlationId?: string;
}

export enum ErrorCode {
  // Network
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  TIMEOUT = 'TIMEOUT',

  // HTTP
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION = 'VALIDATION',
  CONFLICT = 'CONFLICT',
  SERVER_ERROR = 'SERVER_ERROR',

  // Search (Elasticsearch-specific, normalized by API)
  SEARCH_FAILED = 'SEARCH_FAILED',
  INDEX_NOT_FOUND = 'INDEX_NOT_FOUND',

  // Application
  UNEXPECTED = 'UNEXPECTED'
}
```

---

## Layer 1: HTTP Interceptor

The interceptor is the outermost error boundary for all HTTP communication. It catches every failed HTTP response and transforms it into an `AppError`. This implements the [angular-interceptors](../layer-2/http/angular-interceptors.md) pattern and the [middleware-pipelines](../layer-1/backend/api-patterns/middleware-pipelines.md) principle.

```typescript
// interceptors/error.interceptor.ts

import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ErrorService } from '../services/error.service';
import { AppError, ErrorCode } from '../models/app-error.model';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {

  constructor(private errorService: ErrorService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      catchError((httpError: HttpErrorResponse) => {
        const appError = this.transformError(httpError);

        // Notify the error service for global handling (toast, logging)
        this.errorService.handleError(appError);

        // Re-throw so the calling service/component can also react
        return throwError(() => appError);
      })
    );
  }

  private transformError(httpError: HttpErrorResponse): AppError {
    // Network errors have status 0
    if (httpError.status === 0) {
      return {
        code: ErrorCode.NETWORK_OFFLINE,
        message: 'Unable to connect to the server. Check your network connection.',
        status: 0,
        detail: httpError.message,
        timestamp: new Date()
      };
    }

    // If the API returned a normalized error body (see elasticsearch-patterns.md),
    // use it directly
    if (this.isApiError(httpError.error)) {
      return {
        code: this.mapApiCode(httpError.error.code),
        message: httpError.error.message,
        status: httpError.status,
        detail: httpError.error.details,
        timestamp: new Date()
      };
    }

    // Fallback for non-standard error responses
    return this.mapHttpStatus(httpError);
  }

  private isApiError(body: unknown): body is { code: string; message: string; details?: string } {
    return (
      typeof body === 'object' &&
      body !== null &&
      'code' in body &&
      'message' in body
    );
  }

  private mapApiCode(apiCode: string): ErrorCode {
    const mapping: Record<string, ErrorCode> = {
      'SEARCH_FAILED': ErrorCode.SEARCH_FAILED,
      'INDEX_NOT_FOUND': ErrorCode.INDEX_NOT_FOUND,
      'VALIDATION_ERROR': ErrorCode.VALIDATION,
      'CONFLICT': ErrorCode.CONFLICT,
      'NOT_FOUND': ErrorCode.NOT_FOUND,
    };
    return mapping[apiCode] || ErrorCode.SERVER_ERROR;
  }

  private mapHttpStatus(httpError: HttpErrorResponse): AppError {
    const statusMap: Record<number, { code: ErrorCode; message: string }> = {
      400: { code: ErrorCode.VALIDATION, message: 'The request was invalid. Please check your input.' },
      404: { code: ErrorCode.NOT_FOUND, message: 'The requested resource was not found.' },
      408: { code: ErrorCode.TIMEOUT, message: 'The request timed out. Please try again.' },
      409: { code: ErrorCode.CONFLICT, message: 'A conflict occurred. The resource may have been modified.' },
      500: { code: ErrorCode.SERVER_ERROR, message: 'An unexpected server error occurred.' },
      502: { code: ErrorCode.SERVER_ERROR, message: 'The server is temporarily unavailable.' },
      503: { code: ErrorCode.SERVER_ERROR, message: 'The service is temporarily unavailable. Please try again later.' },
    };

    const mapped = statusMap[httpError.status] || {
      code: ErrorCode.UNEXPECTED,
      message: 'An unexpected error occurred.'
    };

    return {
      code: mapped.code,
      message: mapped.message,
      status: httpError.status,
      detail: httpError.message,
      timestamp: new Date()
    };
  }
}
```

### Registering the Interceptor

Interceptors are registered in the module, not via `providedIn: 'root'`. Order matters -- the error interceptor should be last so it catches errors after other interceptors (e.g., retry, auth) have had their chance. Per [angular-interceptors](../layer-2/http/angular-interceptors.md):

```typescript
// app.module.ts (excerpt)

import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { ErrorInterceptor } from './interceptors/error.interceptor';

@NgModule({
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ErrorInterceptor,
      multi: true
    }
  ]
})
export class AppModule {}
```

---

## Layer 2: Error Service

The error service is the central hub for error state. It receives errors from the interceptor, logs them, and exposes them to any component that needs to react. This follows [separation-of-concerns](../layer-1/architecture/design-principles/separation-of-concerns.md) -- error presentation logic lives in one place, not scattered across interceptors and components.

```typescript
// services/error.service.ts

import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { AppError, ErrorCode } from '../models/app-error.model';

export interface ErrorNotification {
  error: AppError;
  dismissed: boolean;
}

@Injectable({ providedIn: 'root' })
export class ErrorService {
  private errors$ = new Subject<ErrorNotification>();
  private errorLog: AppError[] = [];

  /** Stream of errors for toast/notification components to subscribe to */
  getErrors(): Observable<ErrorNotification> {
    return this.errors$.asObservable();
  }

  /** Called by the interceptor and by services that catch non-HTTP errors */
  handleError(error: AppError): void {
    // Log for debugging -- in production, send to a logging endpoint
    this.logError(error);

    // Suppress notification for specific error codes that are handled locally
    if (this.isSilent(error)) {
      return;
    }

    this.errors$.next({ error, dismissed: false });
  }

  /** Create an AppError from a non-HTTP context */
  createError(code: ErrorCode, message: string, detail?: string): AppError {
    return {
      code,
      message,
      detail,
      timestamp: new Date()
    };
  }

  private logError(error: AppError): void {
    // Keep last 50 errors in memory for debugging
    this.errorLog.push(error);
    if (this.errorLog.length > 50) {
      this.errorLog.shift();
    }

    // Structured log output per structured-logging principle
    console.error('[ErrorService]', {
      code: error.code,
      message: error.message,
      status: error.status,
      detail: error.detail,
      timestamp: error.timestamp.toISOString(),
      correlationId: error.correlationId
    });
  }

  private isSilent(error: AppError): boolean {
    // 404s during search are expected (user typed a bad query) -- handle in component
    // Network offline has its own UI indicator
    return error.code === ErrorCode.NOT_FOUND || error.code === ErrorCode.NETWORK_OFFLINE;
  }
}
```

### Toast Notification Component

A global component subscribes to the error stream and displays temporary notifications. This is the default surface for errors -- components that need custom error handling override it locally.

```typescript
// components/error-toast/error-toast.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ErrorService, ErrorNotification } from '../../services/error.service';

@Component({
  selector: 'app-error-toast',
  template: `
    <div class="toast-container">
      <div *ngFor="let notification of activeNotifications; trackBy: trackByTimestamp"
           class="toast"
           [class.error]="true"
           (click)="dismiss(notification)">
        <span class="toast-message">{{ notification.error.message }}</span>
        <button class="toast-close" aria-label="Dismiss">&times;</button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .toast {
      padding: 12px 16px;
      border-radius: 4px;
      background: #d32f2f;
      color: white;
      cursor: pointer;
      max-width: 400px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .toast-close {
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
    }
  `]
})
export class ErrorToastComponent implements OnInit, OnDestroy {
  activeNotifications: ErrorNotification[] = [];
  private destroy$ = new Subject<void>();

  constructor(private errorService: ErrorService) {}

  ngOnInit(): void {
    this.errorService.getErrors()
      .pipe(takeUntil(this.destroy$))
      .subscribe(notification => {
        this.activeNotifications.push(notification);

        // Auto-dismiss after 6 seconds
        setTimeout(() => this.dismiss(notification), 6000);
      });
  }

  dismiss(notification: ErrorNotification): void {
    notification.dismissed = true;
    this.activeNotifications = this.activeNotifications.filter(n => !n.dismissed);
  }

  trackByTimestamp(_index: number, notification: ErrorNotification): number {
    return notification.error.timestamp.getTime();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

Place `<app-error-toast></app-error-toast>` in `app.component.html` so it renders globally.

---

## Layer 3: Service-Level Error Handling

Services catch errors that require business logic decisions: retrying, returning fallback data, or transforming the error into a domain-specific message. Per [error-propagation](../layer-1/cross-cutting/error-handling/error-propagation.md), the service either handles the error fully (the component never sees it) or re-throws a transformed version.

```typescript
// services/search.service.ts (error handling excerpt)

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError, retry, tap } from 'rxjs/operators';
import { AppError, ErrorCode } from '../models/app-error.model';
import { ErrorService } from './error.service';
import { Product } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private searchError$ = new BehaviorSubject<AppError | null>(null);

  /** Components subscribe to this for search-specific error states */
  error$ = this.searchError$.asObservable();

  constructor(
    private http: HttpClient,
    private errorService: ErrorService
  ) {}

  search(query: string): Observable<Product[]> {
    this.searchError$.next(null);  // Clear previous error

    return this.http.post<SearchResponse<Product>>('/api/search/products', {
      query: { match: { name: query } }
    }).pipe(
      // Retry once for transient failures (502, 503)
      retry(1),

      map(response => response.hits.hits.map(hit => hit._source)),

      catchError((error: AppError) => {
        // Search-specific error handling:
        // - SEARCH_FAILED: show "no results" with explanation, don't re-throw
        // - NETWORK_OFFLINE: let the interceptor handle it (re-throw)
        // - Everything else: surface to component via error$

        if (error.code === ErrorCode.SEARCH_FAILED) {
          this.searchError$.next({
            ...error,
            message: 'Your search could not be completed. Try different search terms.'
          });
          return of([]);  // Return empty results -- component shows error state
        }

        if (error.code === ErrorCode.NETWORK_OFFLINE) {
          // Already handled by interceptor's global notification
          return of([]);
        }

        // For unexpected errors, surface to component
        this.searchError$.next(error);
        return of([]);
      })
    );
  }
}
```

Key decisions shown here:
- **Retry**: Only for transient errors. The `retry(1)` operator retries the entire HTTP call once before giving up. This is appropriate for 502/503 but not for 400/404.
- **Recovery**: `catchError` returns `of([])` (empty array) instead of re-throwing. The component still renders -- it shows an error state instead of breaking.
- **Error channel**: `searchError$` is a separate observable the component subscribes to. This keeps the data stream (`search()` returns `Product[]`) clean.

---

## Layer 4: Component Error States

Components handle two kinds of errors: errors from their data source (service) and errors in template rendering. Per [error-boundaries](../layer-1/cross-cutting/error-handling/error-boundaries.md), the component is the last boundary before the user.

### Component with Error State

```typescript
// components/search-results/search-results.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subject, combineLatest } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { SearchService } from '../../services/search.service';
import { Product } from '../../models/product.model';
import { AppError } from '../../models/app-error.model';

interface ViewState {
  status: 'loading' | 'results' | 'empty' | 'error';
  products: Product[];
  error: AppError | null;
}

@Component({
  selector: 'app-search-results',
  template: `
    <ng-container *ngIf="viewState$ | async as state">

      <!-- Loading -->
      <div *ngIf="state.status === 'loading'" class="loading-state">
        <app-spinner></app-spinner>
        <p>Searching...</p>
      </div>

      <!-- Results -->
      <div *ngIf="state.status === 'results'" class="results-state">
        <app-product-card
          *ngFor="let product of state.products"
          [product]="product">
        </app-product-card>
      </div>

      <!-- Empty -->
      <div *ngIf="state.status === 'empty'" class="empty-state">
        <p>No results found. Try broadening your search.</p>
      </div>

      <!-- Error -->
      <div *ngIf="state.status === 'error'" class="error-state">
        <div class="error-card">
          <h3>Something went wrong</h3>
          <p>{{ state.error?.message }}</p>
          <button (click)="retry()">Try again</button>
        </div>
      </div>

    </ng-container>
  `
})
export class SearchResultsComponent implements OnInit, OnDestroy {
  viewState$!: Observable<ViewState>;

  private destroy$ = new Subject<void>();

  constructor(private searchService: SearchService) {}

  ngOnInit(): void {
    this.viewState$ = combineLatest([
      this.searchService.results$,
      this.searchService.error$,
      this.searchService.loading$
    ]).pipe(
      map(([products, error, loading]) => this.deriveViewState(products, error, loading)),
      takeUntil(this.destroy$)
    );
  }

  retry(): void {
    this.searchService.retryLastSearch();
  }

  private deriveViewState(
    products: Product[],
    error: AppError | null,
    loading: boolean
  ): ViewState {
    if (loading) {
      return { status: 'loading', products: [], error: null };
    }
    if (error) {
      return { status: 'error', products: [], error };
    }
    if (products.length === 0) {
      return { status: 'empty', products: [], error: null };
    }
    return { status: 'results', products, error: null };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

The `ViewState` interface makes template logic explicit. There are exactly four states. The `*ngIf` directives are mutually exclusive. No `else` chains, no hidden states, no "loading AND error simultaneously."

This follows [local-component-state](../layer-1/frontend/state-management/local-component-state.md) -- the view state is derived, not stored independently. The component does not maintain its own `isLoading`, `hasError`, `isEmpty` booleans that can get out of sync.

---

## Layer 5: Route Resolver Error Handling

When a route needs data before activation (e.g., navigating to `/products/:id`), a resolver fetches the data. If the fetch fails, the resolver redirects to an error page rather than activating the route with missing data. Per [angular-route-resolvers](../layer-2/routing/angular-route-resolvers.md) and [route-guards](../layer-1/frontend/routing/route-guards.md):

```typescript
// resolvers/product.resolver.ts

import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot, Router } from '@angular/router';
import { Observable, EMPTY } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ProductService } from '../services/product.service';
import { Product } from '../models/product.model';
import { ErrorService } from '../services/error.service';
import { ErrorCode } from '../models/app-error.model';

@Injectable({ providedIn: 'root' })
export class ProductResolver implements Resolve<Product> {

  constructor(
    private productService: ProductService,
    private errorService: ErrorService,
    private router: Router
  ) {}

  resolve(route: ActivatedRouteSnapshot): Observable<Product> {
    const productId = route.paramMap.get('id');

    if (!productId) {
      this.router.navigate(['/error'], {
        queryParams: { code: 'NOT_FOUND', message: 'No product ID provided.' }
      });
      return EMPTY;
    }

    return this.productService.getById(productId).pipe(
      catchError(error => {
        if (error.code === ErrorCode.NOT_FOUND) {
          this.router.navigate(['/not-found']);
        } else {
          this.router.navigate(['/error'], {
            queryParams: { message: error.message }
          });
        }
        return EMPTY;  // Prevents route activation
      })
    );
  }
}
```

```typescript
// app-routing.module.ts (excerpt)

const routes: Routes = [
  {
    path: 'products/:id',
    component: ProductDetailComponent,
    resolve: { product: ProductResolver }
  },
  {
    path: 'error',
    component: ErrorPageComponent
  },
  {
    path: 'not-found',
    component: NotFoundComponent
  },
  {
    path: '**',
    redirectTo: 'not-found'
  }
];
```

### Error Page Component

```typescript
// components/error-page/error-page.component.ts

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-error-page',
  template: `
    <div class="error-page">
      <h1>Something went wrong</h1>
      <p>{{ message }}</p>
      <a routerLink="/">Return to home</a>
    </div>
  `
})
export class ErrorPageComponent implements OnInit {
  message = 'An unexpected error occurred.';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const queryMessage = this.route.snapshot.queryParamMap.get('message');
    if (queryMessage) {
      this.message = queryMessage;
    }
  }
}
```

---

## Layer 6: Global ErrorHandler

Angular's `ErrorHandler` catches unhandled exceptions -- template errors, uncaught promise rejections, errors in lifecycle hooks. This is the safety net. It should log the error and optionally show a generic notification, but it should never be the _primary_ error handling mechanism. Per [error-boundaries](../layer-1/cross-cutting/error-handling/error-boundaries.md), this is the boundary of last resort.

```typescript
// handlers/global-error.handler.ts

import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { ErrorService } from '../services/error.service';
import { ErrorCode } from '../models/app-error.model';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

  // Use Injector to avoid circular dependency with ErrorService
  constructor(private injector: Injector) {}

  handleError(error: unknown): void {
    const errorService = this.injector.get(ErrorService);

    // Extract message from various error shapes
    const message = error instanceof Error ? error.message : String(error);

    errorService.handleError({
      code: ErrorCode.UNEXPECTED,
      message: 'An unexpected error occurred. Please try refreshing the page.',
      detail: message,
      timestamp: new Date()
    });

    // Always log the original error for debugging
    console.error('[GlobalErrorHandler] Unhandled error:', error);
  }
}
```

Register in `AppModule`:

```typescript
// app.module.ts (excerpt)

import { ErrorHandler } from '@angular/core';
import { GlobalErrorHandler } from './handlers/global-error.handler';

@NgModule({
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
})
export class AppModule {}
```

---

## Error Flow Diagram

```
User Action
    |
    v
Component calls Service method
    |
    v
Service calls HttpClient
    |
    v
HttpClient sends request
    |
    v
[HTTP Error Response]
    |
    v
ErrorInterceptor.intercept()
    |-- transforms HttpErrorResponse -> AppError
    |-- notifies ErrorService (toast/logging)
    |-- re-throws AppError
    |
    v
Service.catchError()
    |-- decides: recover (return fallback) or re-throw
    |-- updates error$ subject for component
    |
    v
Component
    |-- reads error$ via ViewState
    |-- renders error state template
    |
    v
[Unhandled?] -----> GlobalErrorHandler (safety net)
```

Each layer transforms the error into something more appropriate for the next consumer. Raw `HttpErrorResponse` never reaches a component. Elasticsearch shard failures never reach the user. This is the chain defined by [error-propagation](../layer-1/cross-cutting/error-handling/error-propagation.md).

---

## Principles Summary

| Principle | Reference | How It Applies |
|---|---|---|
| Errors flow through defined channels | [error-propagation](../layer-1/cross-cutting/error-handling/error-propagation.md) | Interceptor -> Service -> Component -> GlobalErrorHandler |
| Catch at boundaries, not everywhere | [error-boundaries](../layer-1/cross-cutting/error-handling/error-boundaries.md) | Four boundaries, not try/catch in every method |
| Users see user errors, developers see developer errors | [user-vs-developer-errors](../layer-1/cross-cutting/error-handling/user-vs-developer-errors.md) | `message` field for users, `detail` field for logs |
| Errors have types, not just strings | [error-typing](../layer-1/cross-cutting/error-handling/error-typing.md) | `ErrorCode` enum, `AppError` interface |
| API defines its error contract | [api-error-contracts](../layer-1/architecture/api-design/api-error-contracts.md) | Normalized error shape from API, not raw ES errors |
| Interceptors are middleware | [angular-interceptors](../layer-2/http/angular-interceptors.md) | Single registration point, runs on every HTTP call |
| Log structure, not strings | [structured-logging](../layer-1/cross-cutting/observability/structured-logging.md) | `console.error('[ErrorService]', { code, message, ... })` |
