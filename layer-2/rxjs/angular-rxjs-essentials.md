---
id: angular-rxjs-essentials
layer1_parent: reactive-programming-intro
angular_version: "14"
module: "rxjs"
---

# Angular RxJS Essentials

## How Angular Implements This

Angular is built on RxJS. HTTP responses are observables. Route parameters are observables. Form value changes are observables. Event emitters are backed by subjects. You cannot write Angular without RxJS — but you can write it with only a small subset of operators.

These are the operators every Angular developer uses daily:

- **`map`** — transforms each emitted value. Like `Array.map()` but for streams.
- **`filter`** — only passes values that match a predicate. Like `Array.filter()` for streams.
- **`tap`** — performs side effects (logging, setting flags) without modifying the stream. The stream passes through unchanged.
- **`catchError`** — intercepts errors in the stream. Must return a new observable (recovery value or re-throw).
- **`finalize`** — runs cleanup logic when the observable completes or errors. Runs regardless of how the stream ends.

These operators are composed using `pipe()`, which chains them left-to-right. Each operator receives the output of the previous one. The observable does nothing until someone subscribes.

## The Correct Way

```typescript
// map — transform HTTP response
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface ApiResponse<T> {
  data: T;
  meta: { total: number };
}

interface User {
  id: number;
  name: string;
  email: string;
}

@Component({
  selector: 'app-user-list',
  template: `
    <ul>
      <li *ngFor="let name of userNames$ | async">{{ name }}</li>
    </ul>
  `
})
export class UserListComponent implements OnInit {
  userNames$!: Observable<string[]>;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.userNames$ = this.http.get<ApiResponse<User[]>>('/api/users').pipe(
      map(response => response.data),               // Extract data from wrapper
      map(users => users.map(user => user.name))     // Extract just names
    );
  }
}
```

```typescript
// filter — only react to specific values
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-analytics',
  template: ''
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe(event => {
      this.trackPageView(event.urlAfterRedirects);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private trackPageView(url: string): void {
    // Send to analytics
  }
}
```

```typescript
// tap — side effects without modifying the stream
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class ProductService {
  constructor(private http: HttpClient) {}

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>('/api/products').pipe(
      tap(products => console.log(`Fetched ${products.length} products`)),  // Log
      tap(products => {
        if (products.length === 0) {
          console.warn('No products returned — check API');
        }
      }),
      map(products => products.filter(p => p.active))  // Then transform
    );
  }
}
```

```typescript
// catchError — handle errors and recover
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class DataService {
  constructor(
    private http: HttpClient,
    private notifications: NotificationService
  ) {}

  // Pattern 1: Return a fallback value
  getConfig(): Observable<AppConfig> {
    return this.http.get<AppConfig>('/api/config').pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Config load failed, using defaults', error);
        return of(DEFAULT_CONFIG);  // Return fallback — stream continues
      })
    );
  }

  // Pattern 2: Re-throw after logging
  saveData(data: any): Observable<any> {
    return this.http.post('/api/data', data).pipe(
      catchError((error: HttpErrorResponse) => {
        this.notifications.showError(`Save failed: ${error.message}`);
        return throwError(() => error);  // Re-throw — subscriber's error handler runs
      })
    );
  }

  // Pattern 3: Retry then fail
  getWithRetry(): Observable<any> {
    return this.http.get('/api/unstable').pipe(
      retry(3),  // Retry up to 3 times on error
      catchError(error => {
        this.notifications.showError('Service unavailable after 3 retries');
        return of(null);
      })
    );
  }
}
```

```typescript
// finalize — cleanup regardless of outcome
import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-upload',
  template: `
    <button (click)="upload()" [disabled]="isUploading">
      {{ isUploading ? 'Uploading...' : 'Upload' }}
    </button>
  `
})
export class UploadComponent {
  isUploading = false;

  constructor(private http: HttpClient) {}

  upload(): void {
    this.isUploading = true;

    this.http.post('/api/upload', this.formData).pipe(
      catchError(error => {
        alert('Upload failed');
        return of(null);
      }),
      finalize(() => {
        this.isUploading = false;  // Runs on complete, error, or unsubscribe
      })
    ).subscribe(result => {
      if (result) {
        alert('Upload successful');
      }
    });
  }
}
```

## The Anti-Pattern in Angular

```typescript
// WRONG: Transforming data inside subscribe instead of using map
this.http.get<User[]>('/api/users').subscribe(users => {
  this.userNames = users.map(u => u.name);  // Transformation buried in subscribe
  this.filteredNames = this.userNames.filter(n => n.startsWith('A'));
});
// This is imperative programming with extra steps. The observable chain
// should do the transformation. subscribe() should only assign the final result
// (or better yet, use async pipe and don't subscribe at all).

// WRONG: Using tap to transform data
this.http.get<User[]>('/api/users').pipe(
  tap(users => {
    this.users = users.filter(u => u.active);  // Mutation in tap!
  })
).subscribe();
// tap is for side effects — logging, debugging, analytics.
// Use map/filter for transformations. Mutating state in tap is invisible
// and makes the stream unpredictable.

// WRONG: Empty catchError that swallows errors
this.http.get('/api/data').pipe(
  catchError(() => of(null))  // Error silently disappears
).subscribe(data => {
  this.data = data;  // data is null but component has no idea why
});
// At minimum, log the error. Better: show a user notification.
// Best: return a typed error state the component can display.
```

## Common Mistakes

1. **Confusing `map` with `subscribe`**: `map` transforms the stream — it returns an observable. `subscribe` consumes the stream — it triggers execution. If you find yourself doing complex logic inside `subscribe()`, move it into `map()` and use `async` pipe in the template.

2. **`catchError` must return an observable**: `catchError(err => null)` is a type error. You must return `of(fallbackValue)`, `throwError(() => err)`, or `EMPTY`. The return value becomes the new stream.

3. **`tap` should not modify the emitted value**: `tap(items => items.push(newItem))` mutates the array in place, which affects downstream operators. `tap` is for side effects that don't change the data (logging, analytics, setting component flags).

4. **Operator import paths**: In RxJS 7 (bundled with Angular 14), import operators from `rxjs/operators` or directly from `rxjs`. The older `rxjs/internal/*` paths are private and may break.

5. **`finalize` runs on unsubscribe too**: If the component is destroyed and the async pipe unsubscribes, `finalize` still runs. This is usually what you want (cleanup loading state), but be aware that the observable did not necessarily complete — it may have been interrupted.

## Testing This

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DataService } from './data.service';

describe('DataService', () => {
  let service: DataService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DataService]
    });
    service = TestBed.inject(DataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();  // Ensure no unmatched requests
  });

  it('should return fallback config on error', (done) => {
    service.getConfig().subscribe(config => {
      expect(config).toEqual(DEFAULT_CONFIG);  // Fallback returned
      done();
    });

    const req = httpMock.expectOne('/api/config');
    req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });
  });

  it('should retry 3 times then return null', (done) => {
    service.getWithRetry().subscribe(result => {
      expect(result).toBeNull();
      done();
    });

    // Original + 3 retries = 4 requests
    for (let i = 0; i < 4; i++) {
      const req = httpMock.expectOne('/api/unstable');
      req.flush('Error', { status: 503, statusText: 'Unavailable' });
    }
  });
});
```

Use `HttpClientTestingModule` and `HttpTestingController` to control HTTP responses in tests. Flush errors to test `catchError` paths. Count expected requests to verify `retry` behavior. For `finalize`, assert that cleanup code (like resetting loading flags) runs after the stream completes.
