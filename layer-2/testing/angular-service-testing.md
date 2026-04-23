---
id: angular-service-testing
layer1_parent: unit-testing
angular_version: "14"
module: "@angular/core/testing"
---

# Service Testing

## How Angular Implements This

Services in Angular are plain TypeScript classes decorated with `@Injectable()`. They become interesting to test when they have dependencies injected through the constructor. TestBed's dependency injection system lets you swap real dependencies for test doubles.

The approach is straightforward:
1. Configure TestBed with the real service and mock providers for its dependencies
2. Inject the service via `TestBed.inject()`
3. Call methods, assert return values, verify spy interactions

For services with no dependencies, you do not even need TestBed -- just instantiate the class directly. But most real services have at least one dependency (HttpClient, Router, another service), and TestBed is the standard way to wire those up in tests.

## The Correct Way

### Service with no dependencies

```typescript
// calculator.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CalculatorService {
  add(a: number, b: number): number {
    return a + b;
  }

  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  }
}
```

```typescript
// calculator.service.spec.ts
import { CalculatorService } from './calculator.service';

describe('CalculatorService', () => {
  let service: CalculatorService;

  beforeEach(() => {
    // No TestBed needed -- no dependencies
    service = new CalculatorService();
  });

  it('should add two numbers', () => {
    expect(service.add(2, 3)).toBe(5);
  });

  it('should throw on division by zero', () => {
    expect(() => service.divide(10, 0)).toThrowError('Division by zero');
  });
});
```

### Service with dependencies

```typescript
// order.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { LoggerService } from './logger.service';

export interface Order {
  id: number;
  total: number;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(
    private http: HttpClient,
    private logger: LoggerService
  ) {}

  getOrder(id: number): Observable<Order> {
    this.logger.info(`Fetching order ${id}`);
    return this.http.get<Order>(`/api/orders/${id}`);
  }

  getPendingOrders(): Observable<Order[]> {
    return this.http.get<Order[]>('/api/orders').pipe(
      map(orders => orders.filter(o => o.status === 'pending'))
    );
  }
}
```

```typescript
// order.service.spec.ts
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { OrderService, Order } from './order.service';
import { LoggerService } from './logger.service';

describe('OrderService', () => {
  let service: OrderService;
  let httpController: HttpTestingController;
  let loggerSpy: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    loggerSpy = jasmine.createSpyObj('LoggerService', ['info', 'error', 'warn']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        OrderService,
        { provide: LoggerService, useValue: loggerSpy }
      ]
    });

    service = TestBed.inject(OrderService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Verify no unexpected HTTP calls were made
    httpController.verify();
  });

  it('should fetch an order by id', () => {
    const mockOrder: Order = { id: 42, total: 99.99, status: 'shipped' };

    service.getOrder(42).subscribe(order => {
      expect(order).toEqual(mockOrder);
    });

    const req = httpController.expectOne('/api/orders/42');
    expect(req.request.method).toBe('GET');
    req.flush(mockOrder);  // Provide the mock response

    expect(loggerSpy.info).toHaveBeenCalledWith('Fetching order 42');
  });

  it('should filter to only pending orders', () => {
    const allOrders: Order[] = [
      { id: 1, total: 10, status: 'pending' },
      { id: 2, total: 20, status: 'shipped' },
      { id: 3, total: 30, status: 'pending' }
    ];

    service.getPendingOrders().subscribe(orders => {
      expect(orders.length).toBe(2);
      expect(orders.every(o => o.status === 'pending')).toBe(true);
    });

    const req = httpController.expectOne('/api/orders');
    req.flush(allOrders);
  });
});
```

### Using `jasmine.createSpyObj` effectively

```typescript
// When the dependency has many methods but you only use a few:
const authSpy = jasmine.createSpyObj('AuthService', ['isLoggedIn', 'getToken']);
authSpy.isLoggedIn.and.returnValue(true);
authSpy.getToken.and.returnValue('fake-jwt-token');

// When the dependency has properties you need to read:
const configSpy = jasmine.createSpyObj('ConfigService', ['get'], {
  apiUrl: 'http://localhost:3000'  // Third argument sets properties
});

// When you need the spy to return an Observable:
import { of, throwError } from 'rxjs';

const userSpy = jasmine.createSpyObj('UserService', ['getUser']);
userSpy.getUser.and.returnValue(of({ id: 1, name: 'Alice' }));

// For error cases:
userSpy.getUser.and.returnValue(
  throwError(() => new Error('Not found'))
);
```

## The Anti-Pattern in Angular

**Testing with real dependencies instead of mocks.**

```typescript
// WRONG -- uses the real LoggerService, which may write to console,
// send telemetry, or depend on other services you haven't provided
beforeEach(() => {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [OrderService, LoggerService]  // Real LoggerService
  });
});
// If LoggerService depends on ConfigService which depends on HttpClient,
// you now need to provide all of those too. The dependency graph explodes.
```

**Mocking the service under test.**

```typescript
// WRONG -- you are testing your mock, not your service
const orderServiceSpy = jasmine.createSpyObj('OrderService', ['getOrder']);
orderServiceSpy.getOrder.and.returnValue(of(mockOrder));

// You just tested that your spy returns what you told it to return.
// This proves nothing about OrderService's actual behavior.
// Mock the DEPENDENCIES, not the thing you are testing.
```

**Testing private methods directly.**

```typescript
// WRONG -- accessing private implementation details
it('should parse the response', () => {
  const result = (service as any).parseOrderResponse(rawData);
  expect(result.total).toBe(99.99);
});
// If you feel you need to test a private method, it means either:
// (a) the method should be public, or
// (b) you should test it through the public method that calls it.
```

## Common Mistakes

1. **Forgetting `afterEach(() => httpController.verify())`**: Without this, your test passes even if the service made HTTP calls you did not expect. A test that silently ignores unexpected network requests is a test that hides bugs.

2. **Not subscribing to the Observable**: The HTTP request is not made until something subscribes. If you call `service.getOrder(42)` without `.subscribe()`, `httpController.expectOne()` throws `Expected one matching request, found 0.`

3. **Flushing before subscribing**: `req.flush(data)` delivers the response synchronously to existing subscribers. If you flush before subscribing, the subscriber never receives the data.

4. **Wrong order of operations**:
   ```typescript
   // WRONG order
   const req = httpController.expectOne('/api/orders/42');
   service.getOrder(42).subscribe();  // Too late -- expectOne already failed
   req.flush(mockOrder);

   // RIGHT order
   service.getOrder(42).subscribe(order => { /* assertions */ });
   const req = httpController.expectOne('/api/orders/42');
   req.flush(mockOrder);
   ```

5. **Using `jasmine.createSpyObj` without configuring return values**: The spy methods return `undefined` by default. If your service expects an Observable, it will crash with `Cannot read properties of undefined (reading 'pipe')`.

## Testing This

Verify your service test setup is correct with a smoke test:

```typescript
it('should be created', () => {
  expect(service).toBeTruthy();
});

it('should have mocked dependencies', () => {
  // Verify the injected dependency is your spy, not a real instance
  const logger = TestBed.inject(LoggerService);
  expect(logger).toBe(loggerSpy);
});
```

For async services using Promises instead of Observables:

```typescript
it('should resolve user data', async () => {
  userServiceSpy.getUser.and.returnValue(
    Promise.resolve({ id: 1, name: 'Alice' })
  );

  const user = await service.fetchUserData(1);
  expect(user.name).toBe('Alice');
});
```
