---
id: angular-interceptors
layer1_parent: middleware-pipelines
angular_version: "14"
module: "@angular/common/http"
---

# Angular HTTP Interceptors

## How Angular Implements This

HTTP interceptors are Angular's middleware pipeline for HTTP requests and responses. Every HTTP call made through `HttpClient` passes through all registered interceptors before reaching the server, and every response passes back through them in reverse order.

An interceptor is a class that implements the `HttpInterceptor` interface with a single method: `intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>>`. The interceptor receives the request, optionally modifies it, and calls `next.handle(req)` to pass it to the next interceptor in the chain (or to the actual HTTP backend if it's the last one).

Key constraints:
- **`HttpRequest` is immutable**: You cannot modify the request directly. You must `clone()` it with the desired changes.
- **Registration order matters**: Interceptors run in the order they are listed in the `providers` array. The first interceptor runs first on the request, last on the response.
- **Multi-provider token**: Interceptors are registered using `{ provide: HTTP_INTERCEPTORS, useClass: MyInterceptor, multi: true }`. The `multi: true` is critical — it tells Angular this is one of many providers for the same token, not a replacement.

## The Correct Way

```typescript
// auth.interceptor.ts — attach auth token to every request
import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();

    if (token) {
      // Clone the request — HttpRequest is immutable
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
      return next.handle(authReq);
    }

    return next.handle(req);
  }
}
```

```typescript
// error.interceptor.ts — global error handling
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
import { Router } from '@angular/router';
import { NotificationService } from '../services/notification.service';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private router: Router,
    private notifications: NotificationService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        switch (error.status) {
          case 401:
            // Token expired or invalid — redirect to login
            this.router.navigate(['/login']);
            break;
          case 403:
            this.notifications.showError('You do not have permission for this action.');
            break;
          case 404:
            // Let the calling code handle 404s — don't show a global message
            break;
          case 500:
          case 502:
          case 503:
            this.notifications.showError('Server error. Please try again later.');
            break;
          case 0:
            // Network error — no response received
            this.notifications.showError('Network error. Check your connection.');
            break;
        }

        // Always re-throw so the calling code can also handle it
        return throwError(() => error);
      })
    );
  }
}
```

```typescript
// logging.interceptor.ts — request/response logging
import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpResponse
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const startTime = Date.now();

    return next.handle(req).pipe(
      tap({
        next: (event) => {
          if (event instanceof HttpResponse) {
            const elapsed = Date.now() - startTime;
            console.log(`${req.method} ${req.urlWithParams} → ${event.status} (${elapsed}ms)`);
          }
        },
        error: (error) => {
          const elapsed = Date.now() - startTime;
          console.error(`${req.method} ${req.urlWithParams} → ${error.status} (${elapsed}ms)`);
        }
      })
    );
  }
}
```

```typescript
// retry.interceptor.ts — retry failed requests with exponential backoff
import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { retryWhen, mergeMap } from 'rxjs/operators';

@Injectable()
export class RetryInterceptor implements HttpInterceptor {
  private maxRetries = 3;
  private retryableStatuses = [408, 429, 500, 502, 503, 504];

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Only retry idempotent methods
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next.handle(req);
    }

    return next.handle(req).pipe(
      retryWhen(errors =>
        errors.pipe(
          mergeMap((error: HttpErrorResponse, attempt: number) => {
            if (attempt >= this.maxRetries || !this.retryableStatuses.includes(error.status)) {
              return throwError(() => error);
            }
            const delay = Math.pow(2, attempt) * 1000;  // 1s, 2s, 4s
            console.warn(`Retrying ${req.url} (attempt ${attempt + 1}/${this.maxRetries}) in ${delay}ms`);
            return timer(delay);
          })
        )
      )
    );
  }
}
```

```typescript
// Registering interceptors — order matters
// app.module.ts
import { NgModule } from '@angular/core';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { RetryInterceptor } from './interceptors/retry.interceptor';
import { ErrorInterceptor } from './interceptors/error.interceptor';

@NgModule({
  imports: [HttpClientModule],
  providers: [
    // Order: Auth → Logging → Retry → Error
    // Request flows: Auth (add token) → Logging (log start) → Retry → Server
    // Response flows: Server → Retry (retry if needed) → Logging (log end) → Error (handle) → Auth
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: LoggingInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: RetryInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true }
  ]
})
export class AppModule {}
```

```typescript
// Skip interceptors for specific requests using HttpContext (Angular 12+)
import { HttpContext, HttpContextToken } from '@angular/common/http';

export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

// In the interceptor:
intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
  if (req.context.get(SKIP_AUTH)) {
    return next.handle(req);  // Skip this interceptor
  }
  // ... normal logic
}

// In the service:
login(credentials: Credentials): Observable<AuthResponse> {
  return this.http.post<AuthResponse>('/api/auth/login', credentials, {
    context: new HttpContext().set(SKIP_AUTH, true)  // Don't attach auth header to login request
  });
}
```

## The Anti-Pattern in Angular

```typescript
// WRONG: Forgetting multi: true
providers: [
  { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor },  // No multi: true
  { provide: HTTP_INTERCEPTORS, useClass: LoggingInterceptor, multi: true }
]
// The AuthInterceptor REPLACES the entire interceptor chain.
// LoggingInterceptor is never called. No error is thrown.
// This is one of Angular's most silent and destructive mistakes.

// WRONG: Mutating the request instead of cloning
intercept(req: HttpRequest<any>, next: HttpHandler) {
  req.headers.set('Authorization', `Bearer ${token}`);  // Does nothing!
  // HttpRequest and HttpHeaders are immutable. .set() returns a new instance.
  return next.handle(req);  // Original request sent — no auth header
}

// WRONG: Not calling next.handle()
intercept(req: HttpRequest<any>, next: HttpHandler) {
  console.log('Request:', req.url);
  // Forgot to return next.handle(req)
  // The request is never sent. The subscriber never receives a response.
  // The observable hangs forever.
  return EMPTY;  // Or worse, returns EMPTY — no response, no error
}

// WRONG: Catching errors and not re-throwing
intercept(req: HttpRequest<any>, next: HttpHandler) {
  return next.handle(req).pipe(
    catchError(error => {
      console.error(error);
      return of(null as any);  // Swallows the error — downstream code thinks success
    })
  );
}
// The calling service/component never knows the request failed.
// It processes null as if it were valid data.
```

## Common Mistakes

1. **Forgetting `multi: true`**: Without it, each interceptor provider replaces the previous one instead of adding to the chain. Only the last interceptor runs. This is Angular's most common silent misconfiguration. Always use `multi: true`.

2. **Mutating immutable objects**: `HttpRequest`, `HttpHeaders`, and `HttpParams` are all immutable. Calling `.set()` on the existing instance does nothing — you must use the return value: `const newReq = req.clone({ setHeaders: { ... } })`.

3. **Interceptor order**: The first interceptor in the `providers` array processes the request first and the response last. This means the auth interceptor should be first (so the token is added before any other interceptor sees the request), and the error interceptor should be last (so it catches errors from all previous interceptors).

4. **Interceptors in lazy-loaded modules**: Interceptors provided in a lazy-loaded module's `providers` only apply to HTTP calls made from that module's injector. If you want interceptors to apply globally, register them in `AppModule`. This is a common source of "my interceptor doesn't fire" bugs.

5. **Infinite loops in token refresh**: An auth interceptor that detects a 401, calls a token refresh endpoint, and retries the original request must ensure the refresh request itself doesn't trigger the interceptor again. Use `HttpContext` or a URL check to skip the interceptor for the refresh call.

## Testing This

```typescript
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { HttpClient, HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('AuthInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authService = jasmine.createSpyObj('AuthService', ['getToken']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: AuthService, useValue: authService }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should add Authorization header when token exists', () => {
    authService.getToken.and.returnValue('test-token-123');

    http.get('/api/data').subscribe();

    const req = httpMock.expectOne('/api/data');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token-123');
    req.flush({});
  });

  it('should not add header when no token', () => {
    authService.getToken.and.returnValue(null);

    http.get('/api/data').subscribe();

    const req = httpMock.expectOne('/api/data');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });
});

describe('ErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    router = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
        { provide: Router, useValue: router },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['showError']) }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should redirect to login on 401', () => {
    http.get('/api/data').subscribe({ error: () => {} });

    httpMock.expectOne('/api/data').flush('Unauthorized', {
      status: 401, statusText: 'Unauthorized'
    });

    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
```

Test interceptors by registering them as providers in `TestBed` alongside `HttpClientTestingModule`. Make HTTP calls through `HttpClient`, intercept them with `HttpTestingController`, and assert that the interceptor modified the request (headers, params) or handled the response (redirects, error notifications). The interceptor is automatically part of the chain — no explicit invocation needed.
