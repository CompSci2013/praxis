---
id: angular-services
layer1_parent: separation-of-concerns
angular_version: "14"
module: "@angular/core"
---

# Angular Services

## How Angular Implements This

In Angular, a service is any class decorated with `@Injectable()` that is provided through the DI system. Services are where business logic, data access, state management, and cross-cutting concerns live. They are the primary mechanism for separating concerns: components handle presentation, services handle everything else.

Angular's architecture is opinionated about this separation. Components should be thin. A component's job is: receive data (via `@Input` or service injection), render it, capture user events, and delegate work to services. If a component contains an HTTP call, a complex calculation, a data transformation, or any logic that could be reused elsewhere, that logic belongs in a service.

Services are injectable, which means they participate in Angular's DI hierarchy. They can depend on other services. They can be singleton (application-wide), module-scoped, or component-scoped depending on how they are provided. They are trivially testable because their dependencies are injected and can be substituted.

There is no `@Service()` decorator in Angular. Every service is just a class with `@Injectable()`. The word "service" is a pattern, not a framework feature.

## The Correct Way

```typescript
// === order.service.ts ===
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Order {
  id: number;
  customerId: number;
  items: OrderItem[];
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
  total: number;
  createdAt: string;
}

export interface OrderItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderSummary {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly apiUrl = '/api/orders';

  constructor(private http: HttpClient) {}

  getOrders(status?: string): Observable<Order[]> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<Order[]>(this.apiUrl, { params });
  }

  getOrder(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/${id}`);
  }

  createOrder(order: Omit<Order, 'id' | 'createdAt'>): Observable<Order> {
    return this.http.post<Order>(this.apiUrl, order);
  }

  updateStatus(id: number, status: Order['status']): Observable<Order> {
    return this.http.patch<Order>(`${this.apiUrl}/${id}`, { status });
  }

  // Business logic lives here, not in the component.
  getOrderSummary(orders: Order[]): OrderSummary {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    return {
      totalOrders,
      totalRevenue,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    };
  }
}
```

```typescript
// === order-list.component.ts ===
// The component is thin. It delegates to the service and renders the result.
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { OrderService, Order, OrderSummary } from '../order.service';

@Component({
  selector: 'app-order-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *ngIf="summary$ | async as summary">
      <p>{{ summary.totalOrders }} orders, {{ summary.totalRevenue | currency }} total</p>
    </div>

    <div *ngFor="let order of orders$ | async; trackBy: trackById">
      <app-order-card [order]="order" (statusChange)="onStatusChange($event)"></app-order-card>
    </div>
  `,
})
export class OrderListComponent implements OnInit {
  orders$!: Observable<Order[]>;
  summary$!: Observable<OrderSummary>;

  constructor(private orderService: OrderService) {}

  ngOnInit(): void {
    this.orders$ = this.orderService.getOrders();
    this.summary$ = this.orders$.pipe(
      map(orders => this.orderService.getOrderSummary(orders)),
    );
  }

  trackById(index: number, order: Order): number {
    return order.id;
  }

  onStatusChange(event: { orderId: number; status: Order['status'] }): void {
    this.orderService.updateStatus(event.orderId, event.status).subscribe(() => {
      // Refresh the list after update
      this.orders$ = this.orderService.getOrders();
    });
  }
}
```

### Service Composition (Services Depending on Services)

```typescript
// === notification.service.ts ===
@Injectable({ providedIn: 'root' })
export class NotificationService {
  show(message: string, type: 'success' | 'error'): void {
    // Implementation: snackbar, toast, etc.
  }
}

// === order-workflow.service.ts ===
// Orchestrates multiple services. Components call this, not the individual services.
@Injectable({ providedIn: 'root' })
export class OrderWorkflowService {
  constructor(
    private orderService: OrderService,
    private notificationService: NotificationService,
  ) {}

  confirmOrder(orderId: number): Observable<Order> {
    return this.orderService.updateStatus(orderId, 'confirmed').pipe(
      tap(order => {
        this.notificationService.show(
          `Order #${order.id} confirmed`,
          'success',
        );
      }),
      catchError(err => {
        this.notificationService.show(
          `Failed to confirm order: ${err.message}`,
          'error',
        );
        return throwError(() => err);
      }),
    );
  }
}
```

## The Anti-Pattern in Angular

The junior dev puts everything in the component. HTTP calls, business logic, data transformations, error handling -- all in the component class. The component is 400 lines and untestable.

```typescript
// DO NOT DO THIS -- god component
@Component({
  selector: 'app-order-list',
  template: `...`,
})
export class OrderListComponent implements OnInit {
  orders: any[] = [];
  filteredOrders: any[] = [];
  totalRevenue = 0;
  loading = false;
  error = '';

  constructor(private http: HttpClient) {}  // Injecting HttpClient directly

  ngOnInit(): void {
    this.loading = true;
    // HTTP call directly in the component
    this.http.get<any[]>('/api/orders').subscribe({
      next: (orders) => {
        this.orders = orders;
        // Business logic in the component
        this.filteredOrders = orders.filter(o => o.status !== 'cancelled');
        this.totalRevenue = this.filteredOrders.reduce((sum, o) => sum + o.total, 0);
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load orders';
        this.loading = false;
        // Error handling in the component
        console.error(err);
      },
    });
  }

  confirmOrder(orderId: number): void {
    // Another HTTP call in the component
    this.http.patch(`/api/orders/${orderId}`, { status: 'confirmed' }).subscribe({
      next: () => {
        // Manual state update
        const order = this.orders.find(o => o.id === orderId);
        if (order) order.status = 'confirmed';
        // Notification logic in the component
        alert('Order confirmed!');
      },
      error: () => {
        alert('Failed to confirm order');
      },
    });
  }

  // Data transformation in the component
  getCustomerName(order: any): string {
    return `${order.customer.firstName} ${order.customer.lastName}`.trim();
  }

  // More business logic in the component
  canCancel(order: any): boolean {
    const hoursSinceCreation = (Date.now() - new Date(order.createdAt).getTime()) / 3600000;
    return order.status === 'pending' && hoursSinceCreation < 24;
  }
}
```

Problems with this approach:
- `canCancel` business logic cannot be reused in the order detail page.
- `getCustomerName` cannot be reused in the customer list.
- Testing `confirmOrder` requires mocking `HttpClient` and DOM alerts.
- Adding a second order view (e.g., admin dashboard) means duplicating everything.
- The component has five responsibilities: fetching, filtering, calculating, rendering, and notifying.

## Common Mistakes

1. **Not creating a service "because there's only one component."** There will never be only one component. Even if there is, the separation makes the component testable and the business logic reusable. Extract services from day one.

2. **Creating services that are just pass-throughs.** If `OrderService.getOrders()` is literally just `return this.http.get('/api/orders')`, that is fine for now. The value is the seam: when you need caching, error handling, or data transformation, you add it in the service without touching the component. But avoid creating a `BaseApiService<T>` that wraps `HttpClient` generically -- it adds abstraction without value.

3. **Injecting too many services into one component.** If a component's constructor has 6+ service parameters, the component is doing too much. Create an orchestrating service (like `OrderWorkflowService` above) that coordinates the others.

4. **Making services that know about the DOM.** Services should not import `ElementRef`, manipulate DOM elements, or reference `document` directly. They should be platform-agnostic. If a service needs to interact with the DOM (e.g., a scroll-to-top service), inject a platform abstraction or use Angular's `Renderer2`.

5. **Stateful services without clear ownership.** If a service holds state (a cached list, a current selection), it must be clear who is responsible for updating that state. See `angular-services-as-state` for the full pattern.

## Testing This

Services are the easiest part of an Angular app to test because they are plain classes with injected dependencies:

```typescript
describe('OrderService', () => {
  let service: OrderService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(OrderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch orders', () => {
    const mockOrders: Order[] = [
      { id: 1, customerId: 1, items: [], status: 'pending', total: 100, createdAt: '2024-01-01' },
    ];

    service.getOrders().subscribe(orders => {
      expect(orders.length).toBe(1);
      expect(orders[0].status).toBe('pending');
    });

    const req = httpMock.expectOne('/api/orders');
    expect(req.request.method).toBe('GET');
    req.flush(mockOrders);
  });

  it('should pass status as query parameter', () => {
    service.getOrders('shipped').subscribe();

    const req = httpMock.expectOne(r =>
      r.url === '/api/orders' && r.params.get('status') === 'shipped'
    );
    req.flush([]);
  });

  // Business logic tests -- no HTTP mocking needed
  it('should calculate order summary', () => {
    const orders: Order[] = [
      { id: 1, customerId: 1, items: [], status: 'confirmed', total: 100, createdAt: '' },
      { id: 2, customerId: 2, items: [], status: 'confirmed', total: 200, createdAt: '' },
    ];

    const summary = service.getOrderSummary(orders);

    expect(summary.totalOrders).toBe(2);
    expect(summary.totalRevenue).toBe(300);
    expect(summary.averageOrderValue).toBe(150);
  });

  it('should handle empty orders for summary', () => {
    const summary = service.getOrderSummary([]);
    expect(summary.averageOrderValue).toBe(0);
  });
});
```

Test the orchestrating service with mocked dependencies:

```typescript
describe('OrderWorkflowService', () => {
  let service: OrderWorkflowService;
  let mockOrderService: jasmine.SpyObj<OrderService>;
  let mockNotificationService: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    mockOrderService = jasmine.createSpyObj('OrderService', ['updateStatus']);
    mockNotificationService = jasmine.createSpyObj('NotificationService', ['show']);

    TestBed.configureTestingModule({
      providers: [
        OrderWorkflowService,
        { provide: OrderService, useValue: mockOrderService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    });

    service = TestBed.inject(OrderWorkflowService);
  });

  it('should confirm order and show success notification', () => {
    const confirmedOrder: Order = {
      id: 42, customerId: 1, items: [], status: 'confirmed', total: 100, createdAt: '',
    };
    mockOrderService.updateStatus.and.returnValue(of(confirmedOrder));

    service.confirmOrder(42).subscribe(order => {
      expect(order.status).toBe('confirmed');
    });

    expect(mockOrderService.updateStatus).toHaveBeenCalledWith(42, 'confirmed');
    expect(mockNotificationService.show).toHaveBeenCalledWith(
      'Order #42 confirmed',
      'success',
    );
  });

  it('should show error notification on failure', () => {
    mockOrderService.updateStatus.and.returnValue(
      throwError(() => new Error('Network error')),
    );

    service.confirmOrder(42).subscribe({
      error: (err) => {
        expect(err.message).toBe('Network error');
      },
    });

    expect(mockNotificationService.show).toHaveBeenCalledWith(
      'Failed to confirm order: Network error',
      'error',
    );
  });
});
```
