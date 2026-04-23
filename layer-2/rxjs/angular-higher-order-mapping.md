---
id: angular-higher-order-mapping
layer1_parent: null
angular_version: "14"
module: "rxjs"
---

# Angular Higher-Order Mapping Operators

## How Angular Implements This

Higher-order mapping operators (`switchMap`, `mergeMap`, `concatMap`, `exhaustMap`) are the bridge between an outer observable (like route parameter changes, button clicks, or form value changes) and an inner observable (like an HTTP request). They subscribe to the inner observable for you and flatten the result into a single stream.

The difference between them is what happens when a new outer value arrives **while the previous inner observable is still running**:

| Operator | New value arrives while previous is running | Use when |
|---|---|---|
| `switchMap` | **Cancels** previous inner, starts new one | Reading data (search, navigation, autocomplete) |
| `mergeMap` | **Keeps** previous inner, runs both concurrently | Independent writes (logging, analytics events) |
| `concatMap` | **Queues** new one, waits for previous to complete | Sequential writes (form saves, ordered operations) |
| `exhaustMap` | **Ignores** new value until previous completes | Submit buttons (prevent double-submit) |

Choosing the wrong operator is the #1 source of subtle bugs in Angular applications. The app will appear to work during development (when you click slowly and navigate carefully) but break in production (when users click fast, spam buttons, or navigate rapidly).

## The Correct Way

```typescript
// switchMap — search/typeahead (cancel previous request on new input)
import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable, EMPTY } from 'rxjs';
import { switchMap, debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';
import { SearchService } from '../services/search.service';

@Component({
  selector: 'app-search',
  template: `
    <input [formControl]="searchControl" placeholder="Search...">
    <ul>
      <li *ngFor="let result of results$ | async">{{ result.title }}</li>
    </ul>
  `
})
export class SearchComponent implements OnInit {
  searchControl = new FormControl('');
  results$!: Observable<SearchResult[]>;

  constructor(private searchService: SearchService) {}

  ngOnInit(): void {
    this.results$ = this.searchControl.valueChanges.pipe(
      debounceTime(300),                        // Wait 300ms after last keystroke
      distinctUntilChanged(),                    // Don't search if value hasn't changed
      filter((term): term is string => !!term && term.length >= 2),
      switchMap(term => this.searchService.search(term))
      // switchMap: typing "ang" → fires search for "ang"
      // User keeps typing "angular" → CANCELS "ang" request, fires "angular"
      // Only the latest search matters. Old results never appear.
    );
  }
}
```

```typescript
// switchMap — route parameter changes (cancel previous data load)
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ProductService } from '../services/product.service';

@Component({
  selector: 'app-product-detail',
  template: `
    <div *ngIf="product$ | async as product">
      <h1>{{ product.name }}</h1>
      <p>{{ product.description }}</p>
    </div>
  `
})
export class ProductDetailComponent implements OnInit {
  product$!: Observable<Product>;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService
  ) {}

  ngOnInit(): void {
    this.product$ = this.route.paramMap.pipe(
      switchMap(params => this.productService.getProduct(params.get('id')!))
      // Navigate from /products/1 to /products/2:
      // switchMap cancels the HTTP request for product 1 (if still pending)
      // and starts the request for product 2. No race condition.
    );
  }
}
```

```typescript
// concatMap — sequential form saves (order matters)
import { Component } from '@angular/core';
import { Subject } from 'rxjs';
import { concatMap, tap } from 'rxjs/operators';
import { FormService } from '../services/form.service';

@Component({
  selector: 'app-auto-save',
  template: `<textarea (input)="onInput($event)"></textarea>`
})
export class AutoSaveComponent {
  private save$ = new Subject<string>();

  constructor(private formService: FormService) {
    this.save$.pipe(
      concatMap(content => this.formService.save(content))
      // User types fast, triggering saves for v1, v2, v3.
      // concatMap: saves v1, WAITS for completion, then saves v2, then v3.
      // Final state on server is always v3 (latest).
      // With mergeMap: saves run concurrently. If v3 completes before v2,
      // server's final state is v2 (stale). Data corruption.
    ).subscribe();
  }

  onInput(event: Event): void {
    this.save$.next((event.target as HTMLTextAreaElement).value);
  }
}
```

```typescript
// exhaustMap — form submission (prevent double-submit)
import { Component } from '@angular/core';
import { Subject } from 'rxjs';
import { exhaustMap, tap, finalize } from 'rxjs/operators';
import { OrderService } from '../services/order.service';

@Component({
  selector: 'app-checkout',
  template: `
    <button (click)="submit$.next()" [disabled]="isSubmitting">
      {{ isSubmitting ? 'Processing...' : 'Place Order' }}
    </button>
  `
})
export class CheckoutComponent {
  submit$ = new Subject<void>();
  isSubmitting = false;

  constructor(private orderService: OrderService) {
    this.submit$.pipe(
      exhaustMap(() => {
        this.isSubmitting = true;
        return this.orderService.placeOrder(this.orderData).pipe(
          finalize(() => this.isSubmitting = false)
        );
      })
      // User spam-clicks "Place Order":
      // exhaustMap: processes first click, IGNORES all clicks while request is in-flight.
      // No double orders. No race conditions. No disabling the button via template hacks.
    ).subscribe({
      next: (order) => this.router.navigate(['/order-confirmation', order.id]),
      error: (err) => this.notifications.showError('Order failed')
    });
  }
}
```

```typescript
// mergeMap — fire-and-forget analytics (order doesn't matter, don't drop)
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private events$ = new Subject<AnalyticsEvent>();

  constructor(private http: HttpClient) {
    this.events$.pipe(
      mergeMap(event => this.http.post('/api/analytics', event))
      // Every event fires independently. Order doesn't matter.
      // Don't cancel previous (switchMap). Don't queue (concatMap).
      // Don't drop (exhaustMap). Just fire them all concurrently.
    ).subscribe();
  }

  track(event: AnalyticsEvent): void {
    this.events$.next(event);
  }
}
```

## The Anti-Pattern in Angular

```typescript
// WRONG: Using mergeMap for search (race condition)
this.searchControl.valueChanges.pipe(
  mergeMap(term => this.searchService.search(term))
).subscribe(results => {
  this.results = results;
});
// User types "a" (200ms response), then "ab" (50ms response).
// "ab" results arrive first → displayed. Then "a" results arrive → overwrite "ab" results.
// User sees results for "a" even though they searched for "ab".
// switchMap cancels "a" when "ab" fires — this bug is impossible with switchMap.

// WRONG: Using switchMap for saves (data loss)
this.autoSave$.pipe(
  switchMap(data => this.http.post('/api/save', data))
).subscribe();
// User saves v1, then v2 quickly. switchMap CANCELS the v1 save.
// If v2 save fails, v1 is also lost. Use concatMap for ordered writes.

// WRONG: Nested subscribes instead of higher-order operators
this.route.paramMap.subscribe(params => {
  this.productService.getProduct(params.get('id')!).subscribe(product => {
    this.product = product;
  });
});
// Each param change creates a new inner subscription.
// Old subscriptions are never cleaned up.
// Race conditions between fast and slow responses.
// This is the exact problem switchMap was designed to solve.
```

## Common Mistakes

1. **Default to `switchMap` when unsure**: If you're reading data (GET requests, searches, data loads), `switchMap` is almost always correct. It cancels stale requests and prevents race conditions. Only use the others when you have a specific reason.

2. **Nested subscribes**: If you find yourself writing `.subscribe(x => { someObservable.subscribe(...) })`, you need a higher-order mapping operator. Nested subscribes leak inner subscriptions, create race conditions, and make error handling nearly impossible.

3. **`mergeMap` with unlimited concurrency**: `mergeMap` has an optional second parameter for max concurrency: `mergeMap(fn, 3)` limits to 3 concurrent inner subscriptions. Without it, 100 rapid clicks create 100 concurrent HTTP requests. For analytics/logging this is fine. For API calls with rate limits, set a concurrency limit.

4. **`concatMap` with a cold source that never completes**: `concatMap` queues inner observables and processes them in order. If an inner observable never completes (like a WebSocket stream), the queue is stuck forever. `concatMap` is for finite inner observables (HTTP requests, timers).

5. **Forgetting that `switchMap` cancels**: If the inner observable has side effects (like POST requests), `switchMap` may cancel them before the server processes them. Don't use `switchMap` for write operations — the cancellation only cancels the HTTP client subscription, not the server-side processing. This can result in the server completing the operation but the client never seeing the response.

## Testing This

```typescript
import { fakeAsync, tick } from '@angular/core/testing';
import { of, delay, Subject } from 'rxjs';
import { switchMap, concatMap } from 'rxjs/operators';

describe('Higher-Order Mapping', () => {
  it('switchMap should cancel previous inner observable', fakeAsync(() => {
    const results: number[] = [];
    const source$ = new Subject<number>();

    source$.pipe(
      switchMap(val => of(val).pipe(delay(100)))
    ).subscribe(val => results.push(val));

    source$.next(1);      // Starts inner observable for 1
    tick(50);              // 50ms elapsed — 1 is still pending
    source$.next(2);      // Cancels 1, starts 2
    tick(100);             // 2 completes
    source$.next(3);      // Starts 3
    tick(100);             // 3 completes

    expect(results).toEqual([2, 3]);  // 1 was cancelled
  }));

  it('concatMap should queue and process in order', fakeAsync(() => {
    const results: number[] = [];
    const source$ = new Subject<number>();

    source$.pipe(
      concatMap(val => of(val).pipe(delay(100)))
    ).subscribe(val => results.push(val));

    source$.next(1);
    source$.next(2);
    source$.next(3);

    tick(100);
    expect(results).toEqual([1]);

    tick(100);
    expect(results).toEqual([1, 2]);

    tick(100);
    expect(results).toEqual([1, 2, 3]);  // All processed in order
  }));
});
```

Use `fakeAsync` and `tick` to control time precisely. Create a `Subject` as the outer source, emit values with specific timing, and assert on the order and content of results. This makes the differences between operators visible and testable.
