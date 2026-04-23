---
id: angular-error-handling-http
layer1_parent: error-boundaries
angular_version: "14"
module: "@angular/common/http"
---

# Angular HTTP Error Handling

## How Angular Implements This

Angular has no "error boundary" equivalent that catches HTTP errors automatically. Every observable error must be explicitly handled, or it propagates as an unhandled rejection. Angular provides several mechanisms for catching and processing HTTP errors at different levels:

1. **Operator-level**: `catchError` in the service's RxJS pipe — handles errors for a specific API call.
2. **Interceptor-level**: `HttpInterceptor` with `catchError` — handles errors globally for all HTTP calls.
3. **Application-level**: Custom `ErrorHandler` class — catches unhandled errors from anywhere in the application (not just HTTP), including template errors and uncaught promise rejections.

`HttpErrorResponse` is the error type thrown by `HttpClient` for non-2xx responses. It contains:
- `status`: HTTP status code (0 for network errors)
- `statusText`: HTTP status text
- `error`: The response body (parsed JSON if the server returned JSON, or a string)
- `url`: The request URL
- `headers`: Response headers
- `message`: A human-readable error message

Network errors (no response received) have `status: 0` and `error` is a `ProgressEvent`, not an HTTP response body.

## The Correct Way

```typescript
// Service-level error handling — per-endpoint strategies
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of, EMPTY, timer } from 'rxjs';
import { catchError, retry, retryWhen, mergeMap, map } from 'rxjs/operators';

export interface ApiError {
  status: number;
  message: string;
  details?: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(private http: HttpClient) {}

  // Strategy 1: Return typed error for the component to display
  getOrder(id: string): Observable<Order> {
    return this.http.get<Order>(`/api/orders/${id}`).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => this.toApiError(error));
      })
    );
  }

  // Strategy 2: Return fallback data — never error
  getRecommendations(): Observable<Product[]> {
    return this.http.get<Product[]>('/api/recommendations').pipe(
      catchError(() => of([]))  // Show empty list rather than an error
    );
  }

  // Strategy 3: Retry with exponential backoff, then error
  getInventory(): Observable<InventoryItem[]> {
    return this.http.get<InventoryItem[]>('/api/inventory').pipe(
      retryWhen(errors =>
        errors.pipe(
          mergeMap((error: HttpErrorResponse, attempt) => {
            // Only retry on server/network errors
            if (attempt >= 3 || (error.status > 0 && error.status < 500)) {
              return throwError(() => this.toApiError(error));
            }
            const delay = Math.pow(2, attempt) * 1000;
            return timer(delay);
          })
        )
      )
    );
  }

  // Strategy 4: Different behavior per status code
  submitOrder(order: OrderRequest): Observable<OrderConfirmation> {
    return this.http.post<OrderConfirmation>('/api/orders', order).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 409) {
          // Conflict — order already exists, fetch it instead
          return this.http.get<OrderConfirmation>(`/api/orders/${order.idempotencyKey}`);
        }
        if (error.status === 422) {
          // Validation error — server returned field-level errors
          return throwError(() => ({
            status: 422,
            message: 'Validation failed',
            details: error.error?.errors  // { fieldName: 'error message' }
          } as ApiError));
        }
        return throwError(() => this.toApiError(error));
      })
    );
  }

  private toApiError(error: HttpErrorResponse): ApiError {
    if (error.status === 0) {
      return { status: 0, message: 'Network error. Check your connection.' };
    }
    return {
      status: error.status,
      message: error.error?.message || error.statusText || 'An error occurred',
      details: error.error?.details
    };
  }
}
```

```typescript
// Component-level error handling with user-facing states
import { Component, OnInit } from '@angular/core';
import { Observable, Subject, EMPTY, of } from 'rxjs';
import { switchMap, catchError, startWith, shareReplay } from 'rxjs/operators';
import { OrderService, ApiError } from '../services/order.service';

interface ViewState<T> {
  loading: boolean;
  data: T | null;
  error: ApiError | null;
}

@Component({
  selector: 'app-order-detail',
  template: `
    <ng-container *ngIf="state$ | async as state">
      <!-- Loading -->
      <app-skeleton *ngIf="state.loading"></app-skeleton>

      <!-- Error -->
      <div *ngIf="state.error" class="error-banner">
        <p>{{ state.error.message }}</p>
        <button (click)="retry()">Retry</button>
      </div>

      <!-- Data -->
      <div *ngIf="state.data as order" class="order-detail">
        <h1>Order #{{ order.id }}</h1>
        <p>Status: {{ order.status }}</p>
        <div *ngFor="let item of order.items">
          {{ item.name }} x {{ item.quantity }}
        </div>
      </div>
    </ng-container>
  `
})
export class OrderDetailComponent implements OnInit {
  state$!: Observable<ViewState<Order>>;
  private retry$ = new Subject<void>();

  constructor(
    private orderService: OrderService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.state$ = this.retry$.pipe(
      startWith(undefined),  // Trigger initial load
      switchMap(() =>
        this.route.paramMap.pipe(
          switchMap(params => {
            const id = params.get('id')!;
            return this.orderService.getOrder(id).pipe(
              map(data => ({ loading: false, data, error: null } as ViewState<Order>)),
              catchError((error: ApiError) =>
                of({ loading: false, data: null, error } as ViewState<Order>)
              ),
              startWith({ loading: true, data: null, error: null } as ViewState<Order>)
            );
          })
        )
      ),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  retry(): void {
    this.retry$.next();
  }
}
```

```typescript
// Global ErrorHandler — catch unhandled errors
import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private injector: Injector) {}
  // Use Injector to avoid circular dependency with services that use HttpClient

  handleError(error: any): void {
    // Unwrap the error if it's wrapped in a zone.js promise rejection
    const unwrapped = error.rejection || error;

    if (unwrapped instanceof HttpErrorResponse) {
      // HTTP error that wasn't caught by a service or interceptor
      console.error(`Unhandled HTTP error: ${unwrapped.status} ${unwrapped.url}`);
    } else if (unwrapped instanceof TypeError) {
      // Template error — usually a null reference
      console.error('Template error:', unwrapped.message);
    } else {
      console.error('Unhandled error:', unwrapped);
    }

    // Send to error reporting service
    const errorService = this.injector.get(ErrorReportingService);
    errorService.report(unwrapped);
  }
}
```

```typescript
// Register the global error handler
@NgModule({
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
})
export class AppModule {}
```

## The Anti-Pattern in Angular

```typescript
// WRONG: Empty catchError — swallowing errors silently
this.http.get('/api/data').pipe(
  catchError(() => of(null))  // Error disappears. No log. No notification.
).subscribe(data => {
  this.processData(data);  // data is null — crashes or produces wrong results
});

// WRONG: Error handling in subscribe only
this.orderService.getOrder(id).subscribe({
  next: (order) => this.order = order,
  error: (err) => console.log(err)  // Only console.log — user sees nothing
});
// The error is "handled" (no unhandled rejection) but the component shows
// a blank screen with no feedback. Always update UI state on error.

// WRONG: Catching at every level — triple handling
// Service:
getOrder(id: string) {
  return this.http.get<Order>(`/api/orders/${id}`).pipe(
    catchError(err => { this.logger.error(err); return throwError(() => err); })
  );
}
// Interceptor:
intercept(req, next) {
  return next.handle(req).pipe(
    catchError(err => { this.logger.error(err); return throwError(() => err); })
  );
}
// Component:
this.service.getOrder(id).subscribe({
  error: (err) => { this.logger.error(err); }
});
// The same error is logged THREE times. Pick ONE level for logging.
// Interceptor: global logging. Service: business-specific recovery. Component: UI state.
```

## Common Mistakes

1. **Not distinguishing network errors from server errors**: `HttpErrorResponse` with `status: 0` means the request never reached the server (network down, CORS blocked, DNS failure). The `error` property is a `ProgressEvent`, not a parsed response body. Trying to access `error.error.message` on a network error throws `TypeError`.

2. **`catchError` must return an observable**: `catchError(err => null)` is a type error. Return `of(fallbackValue)` to recover, `throwError(() => err)` to re-throw, or `EMPTY` to complete silently.

3. **Error handler circular dependency**: `GlobalErrorHandler` cannot inject services that use `HttpClient` directly in the constructor, because `HttpClient` depends on error handling → circular dependency. Use `Injector.get()` to lazily resolve dependencies.

4. **Retry on POST/PUT/DELETE**: Retrying non-idempotent requests can cause duplicate operations (double charges, duplicate records). Only retry GET and HEAD requests automatically. For write operations, implement idempotency keys on the server side.

5. **Zone.js error wrapping**: In development, zone.js wraps promise rejections in a `ZoneAwareError` object. The original error is in `error.rejection`. Your `ErrorHandler` must unwrap this to get the actual `HttpErrorResponse`.

6. **The "blank screen" failure mode**: If a component's data loading fails and there's no error state in the template, the user sees nothing. No spinner, no message, no retry button — just a blank area. Always design three states: loading, data, and error.

## Testing This

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { OrderService, ApiError } from './order.service';

describe('OrderService Error Handling', () => {
  let service: OrderService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [OrderService]
    });
    service = TestBed.inject(OrderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should convert 404 to ApiError', (done) => {
    service.getOrder('999').subscribe({
      error: (error: ApiError) => {
        expect(error.status).toBe(404);
        expect(error.message).toBe('Order not found');
        done();
      }
    });

    httpMock.expectOne('/api/orders/999').flush(
      { message: 'Order not found' },
      { status: 404, statusText: 'Not Found' }
    );
  });

  it('should handle network errors', (done) => {
    service.getOrder('1').subscribe({
      error: (error: ApiError) => {
        expect(error.status).toBe(0);
        expect(error.message).toContain('Network error');
        done();
      }
    });

    httpMock.expectOne('/api/orders/1').error(
      new ProgressEvent('error')  // Simulates network failure
    );
  });

  it('should return empty array for failed recommendations', (done) => {
    service.getRecommendations().subscribe(products => {
      expect(products).toEqual([]);  // Fallback, not an error
      done();
    });

    httpMock.expectOne('/api/recommendations').flush('Error', {
      status: 500, statusText: 'Internal Server Error'
    });
  });

  it('should handle 409 conflict by fetching existing order', () => {
    const order = { id: 'existing', idempotencyKey: 'key-123' } as any;

    service.submitOrder(order).subscribe(result => {
      expect(result.id).toBe('existing');
    });

    // First request: 409 Conflict
    httpMock.expectOne('/api/orders').flush(null, {
      status: 409, statusText: 'Conflict'
    });

    // Second request: fetch existing order
    httpMock.expectOne('/api/orders/key-123').flush({ id: 'existing' });
  });

  it('should handle 422 validation errors', (done) => {
    service.submitOrder({} as any).subscribe({
      error: (error: ApiError) => {
        expect(error.status).toBe(422);
        expect(error.details).toEqual({ email: 'is required' });
        done();
      }
    });

    httpMock.expectOne('/api/orders').flush(
      { message: 'Validation failed', errors: { email: 'is required' } },
      { status: 422, statusText: 'Unprocessable Entity' }
    );
  });
});
```

Test every error path explicitly. Use `req.flush(body, { status, statusText })` for server errors and `req.error(new ProgressEvent('error'))` for network errors. Assert on the error shape your service returns — your components depend on this contract. Test fallback strategies by asserting the subscriber receives data (not an error) even when the HTTP call fails.
