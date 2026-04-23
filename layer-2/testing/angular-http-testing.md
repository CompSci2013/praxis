---
id: angular-http-testing
layer1_parent: integration-testing
angular_version: "14"
module: "@angular/common/http/testing"
---

# HTTP Testing

## How Angular Implements This

Angular provides `HttpClientTestingModule` as a drop-in replacement for `HttpClientModule`. When you import it in your test, every `HttpClient` call is intercepted by `HttpTestingController` instead of going to the network. You then manually flush responses, simulate errors, and verify that the correct requests were made.

The flow is always:
1. Import `HttpClientTestingModule` in TestBed (replaces `HttpClientModule`)
2. Inject `HttpTestingController` alongside your service
3. Call the method that triggers an HTTP request
4. Use `httpController.expectOne()` or `httpController.match()` to capture the request
5. Inspect the request (URL, method, headers, body)
6. Call `req.flush()` with a mock response or `req.error()` to simulate failure
7. Call `httpController.verify()` in `afterEach` to ensure no unexpected requests

This is synchronous. There are no timers, no waiting, no race conditions. You control exactly when the response arrives.

## The Correct Way

### Basic GET request

```typescript
// product.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Product {
  id: number;
  name: string;
  price: number;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly apiUrl = '/api/products';

  constructor(private http: HttpClient) {}

  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`);
  }

  searchProducts(query: string, page: number): Observable<Product[]> {
    const params = new HttpParams()
      .set('q', query)
      .set('page', page.toString());
    return this.http.get<Product[]>(this.apiUrl, { params });
  }

  createProduct(product: Omit<Product, 'id'>): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, product);
  }

  updateProduct(id: number, changes: Partial<Product>): Observable<Product> {
    return this.http.patch<Product>(`${this.apiUrl}/${id}`, changes);
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
```

```typescript
// product.service.spec.ts
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { ProductService, Product } from './product.service';

describe('ProductService', () => {
  let service: ProductService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ProductService]
    });

    service = TestBed.inject(ProductService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();  // Fail if any request was not handled
  });

  // --- GET ---
  it('should fetch a product by id', () => {
    const mockProduct: Product = { id: 1, name: 'Widget', price: 9.99 };

    service.getProduct(1).subscribe(product => {
      expect(product).toEqual(mockProduct);
    });

    const req = httpController.expectOne('/api/products/1');
    expect(req.request.method).toBe('GET');
    req.flush(mockProduct);
  });

  // --- GET with query params ---
  it('should search with query params', () => {
    service.searchProducts('widget', 2).subscribe(products => {
      expect(products.length).toBe(1);
    });

    const req = httpController.expectOne(
      r => r.url === '/api/products'
        && r.params.get('q') === 'widget'
        && r.params.get('page') === '2'
    );
    // Using a predicate function because expectOne(url) does not match params
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, name: 'Widget', price: 9.99 }]);
  });

  // --- POST ---
  it('should create a product', () => {
    const newProduct = { name: 'Gadget', price: 19.99 };
    const createdProduct: Product = { id: 2, ...newProduct };

    service.createProduct(newProduct).subscribe(product => {
      expect(product.id).toBe(2);
    });

    const req = httpController.expectOne('/api/products');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(newProduct);  // Verify the payload
    req.flush(createdProduct);
  });

  // --- PATCH ---
  it('should update a product', () => {
    const changes = { price: 14.99 };

    service.updateProduct(1, changes).subscribe(product => {
      expect(product.price).toBe(14.99);
    });

    const req = httpController.expectOne('/api/products/1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(changes);
    req.flush({ id: 1, name: 'Widget', price: 14.99 });
  });

  // --- DELETE ---
  it('should delete a product', () => {
    service.deleteProduct(1).subscribe();

    const req = httpController.expectOne('/api/products/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
```

### Testing error responses

```typescript
it('should handle 404 error', () => {
  service.getProduct(999).subscribe({
    next: () => fail('should have failed'),
    error: (error) => {
      expect(error.status).toBe(404);
      expect(error.statusText).toBe('Not Found');
    }
  });

  const req = httpController.expectOne('/api/products/999');
  req.flush('Not found', {
    status: 404,
    statusText: 'Not Found'
  });
});

it('should handle network error', () => {
  service.getProduct(1).subscribe({
    next: () => fail('should have failed'),
    error: (error) => {
      expect(error.error.message).toBe('Network failure');
    }
  });

  const req = httpController.expectOne('/api/products/1');
  req.error(new ProgressEvent('error'), {
    status: 0,
    statusText: 'Unknown Error'
  });
});
```

### Testing headers

```typescript
// auth-api.service.ts
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  constructor(private http: HttpClient) {}

  getProtectedResource(): Observable<any> {
    return this.http.get('/api/protected', {
      headers: { 'Authorization': 'Bearer my-token' }
    });
  }
}

// In the test:
it('should send authorization header', () => {
  service.getProtectedResource().subscribe();

  const req = httpController.expectOne('/api/protected');
  expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
  req.flush({ data: 'secret' });
});
```

### Testing multiple concurrent requests

```typescript
it('should handle multiple requests with match()', () => {
  service.getProduct(1).subscribe();
  service.getProduct(2).subscribe();
  service.getProduct(3).subscribe();

  // match() returns all matching requests as an array
  const requests = httpController.match(
    req => req.url.startsWith('/api/products/')
  );
  expect(requests.length).toBe(3);

  requests[0].flush({ id: 1, name: 'A', price: 1 });
  requests[1].flush({ id: 2, name: 'B', price: 2 });
  requests[2].flush({ id: 3, name: 'C', price: 3 });
});
```

## The Anti-Pattern in Angular

**Importing `HttpClientModule` instead of `HttpClientTestingModule`.**

```typescript
// WRONG -- makes real HTTP requests in tests
imports: [HttpClientModule]

// RIGHT -- intercepts all HTTP requests
imports: [HttpClientTestingModule]
```

**Using `expectOne` with a URL string when query params are present.**

```typescript
// WRONG -- expectOne matches the full URL including params,
// but the string form only matches the path
const req = httpController.expectOne('/api/products');
// Actual URL: /api/products?q=widget&page=2
// Result: "Expected one matching request, found 0"

// RIGHT -- use a predicate function
const req = httpController.expectOne(r => r.url === '/api/products');
```

**Not calling `httpController.verify()` in `afterEach`.**

```typescript
// Without verify(), this test passes even though the service
// makes an HTTP call you forgot to handle:
it('should do something', () => {
  service.getProduct(1).subscribe();
  // Forgot to expectOne and flush
  // Test passes silently. Bug hidden.
});
```

## Common Mistakes

1. **`expectOne` fails with "Expected one matching request, found 0"**: The most common cause is that you called `expectOne` before subscribing to the observable. The request is not made until something subscribes. Second most common: the URL string does not match exactly (trailing slash, different case, query params).

2. **`expectOne` fails with "Expected one matching request, found 2"**: Your code made the same request twice. This happens when you subscribe to the same observable twice (each subscription triggers a new request) or when `ngOnInit` fires unexpectedly. Use `match()` instead if multiple requests are expected.

3. **`verify()` fails with "Expected no open requests, found 1"**: Your code made an HTTP request you did not handle with `expectOne()` or `match()`. Either add the missing expectation or investigate why the unexpected request is happening.

4. **Flushing with wrong status code**: `req.flush(body)` defaults to status 200. If you want to test error handling, you must pass the status explicitly: `req.flush('error', { status: 500, statusText: 'Server Error' })`.

5. **Testing interceptors**: Interceptors are not automatically included in `HttpClientTestingModule`. You must provide them explicitly:
   ```typescript
   providers: [
     { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
   ]
   ```

## Testing This

A complete HTTP test verifies four things:

```typescript
it('demonstrates the four assertions for HTTP tests', () => {
  const mockData = { id: 1, name: 'Widget', price: 9.99 };

  // 1. The response data is handled correctly
  service.getProduct(1).subscribe(product => {
    expect(product).toEqual(mockData);
  });

  // 2. The correct URL was called
  const req = httpController.expectOne('/api/products/1');

  // 3. The correct HTTP method was used
  expect(req.request.method).toBe('GET');

  // 4. The request body/headers are correct (for POST/PUT/PATCH)
  // expect(req.request.body).toEqual({...});
  // expect(req.request.headers.get('Content-Type')).toBe('application/json');

  req.flush(mockData);
});
```
