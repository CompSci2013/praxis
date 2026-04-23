---
id: angular-services-as-state
layer1_parent: shared-state
angular_version: "14"
module: "@angular/core"
---

# Services as State Containers

## How Angular Implements This

Angular does not ship a state management library. Instead, it provides the building blocks: services (via DI) and RxJS (included as a dependency). The idiomatic Angular 14 pattern for shared state is a service that holds state in a `BehaviorSubject`, exposes it as a read-only `Observable`, and provides methods to update it.

This is the "service-as-store" pattern. It replaces NgRx, Akita, or other state management libraries for most applications. The service is the single source of truth. Components subscribe to the observable and react to changes. The service controls how state is updated -- components cannot reach in and mutate it directly.

`BehaviorSubject` is the right choice (not `Subject` or `ReplaySubject`) because it:
- Has a current value accessible synchronously via `.value` (useful for the service's own methods).
- Emits the current value immediately to new subscribers (so components get the current state when they subscribe, not just future changes).
- Requires an initial value (forces you to define the starting state).

The pattern works with OnPush change detection because the `async` pipe calls `markForCheck()` when the observable emits.

## The Correct Way

### Basic State Service

```typescript
// === cart.service.ts ===
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface CartItem {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  loading: boolean;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  // Private: only the service can push new state.
  private state$ = new BehaviorSubject<CartState>({
    items: [],
    loading: false,
  });

  // Public: components observe these. They are read-only.
  readonly items$: Observable<CartItem[]> = this.state$.pipe(
    map(state => state.items),
  );

  readonly itemCount$: Observable<number> = this.state$.pipe(
    map(state => state.items.reduce((sum, item) => sum + item.quantity, 0)),
  );

  readonly total$: Observable<number> = this.state$.pipe(
    map(state => state.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity, 0,
    )),
  );

  readonly loading$: Observable<boolean> = this.state$.pipe(
    map(state => state.loading),
  );

  // --- Mutation methods: the ONLY way to change state ---

  addItem(product: { id: number; name: string; price: number }): void {
    const current = this.state$.value;
    const existing = current.items.find(i => i.productId === product.id);

    let updatedItems: CartItem[];
    if (existing) {
      // Increment quantity -- immutable update
      updatedItems = current.items.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      );
    } else {
      // Add new item -- immutable update
      updatedItems = [
        ...current.items,
        {
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          quantity: 1,
        },
      ];
    }

    this.setState({ items: updatedItems });
  }

  removeItem(productId: number): void {
    const current = this.state$.value;
    this.setState({
      items: current.items.filter(item => item.productId !== productId),
    });
  }

  updateQuantity(productId: number, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(productId);
      return;
    }

    const current = this.state$.value;
    this.setState({
      items: current.items.map(item =>
        item.productId === productId ? { ...item, quantity } : item,
      ),
    });
  }

  clearCart(): void {
    this.setState({ items: [] });
  }

  // Private helper: merge partial state updates immutably.
  private setState(partial: Partial<CartState>): void {
    this.state$.next({ ...this.state$.value, ...partial });
  }
}
```

```typescript
// === cart-summary.component.ts ===
// Presentational component. Subscribes via async pipe. OnPush-friendly.
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CartService } from '../cart.service';

@Component({
  selector: 'app-cart-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cart-summary">
      <span>{{ itemCount$ | async }} items</span>
      <span>{{ total$ | async | currency }}</span>
    </div>
  `,
})
export class CartSummaryComponent {
  // Observables from the service, consumed via async pipe.
  // No manual subscribe. No manual unsubscribe. No markForCheck.
  readonly itemCount$ = this.cartService.itemCount$;
  readonly total$ = this.cartService.total$;

  constructor(private cartService: CartService) {}
}
```

```typescript
// === cart-page.component.ts ===
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Observable } from 'rxjs';
import { CartService, CartItem } from '../cart.service';

@Component({
  selector: 'app-cart-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *ngIf="items$ | async as items">
      <div *ngIf="items.length === 0">Your cart is empty.</div>

      <div *ngFor="let item of items; trackBy: trackByProductId" class="cart-item">
        <span>{{ item.productName }}</span>
        <span>{{ item.unitPrice | currency }} x {{ item.quantity }}</span>
        <input
          type="number"
          [value]="item.quantity"
          min="0"
          (change)="onQuantityChange(item.productId, $event)"
        />
        <button (click)="onRemove(item.productId)">Remove</button>
      </div>

      <div class="cart-total">
        Total: {{ total$ | async | currency }}
      </div>

      <button (click)="onClear()">Clear Cart</button>
    </div>
  `,
})
export class CartPageComponent {
  readonly items$ = this.cartService.items$;
  readonly total$ = this.cartService.total$;

  constructor(private cartService: CartService) {}

  trackByProductId(index: number, item: CartItem): number {
    return item.productId;
  }

  onQuantityChange(productId: number, event: Event): void {
    const quantity = parseInt((event.target as HTMLInputElement).value, 10);
    this.cartService.updateQuantity(productId, quantity);
  }

  onRemove(productId: number): void {
    this.cartService.removeItem(productId);
  }

  onClear(): void {
    this.cartService.clearCart();
  }
}
```

### State Service with Async Loading

```typescript
// === user-directory.service.ts ===
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError, finalize } from 'rxjs/operators';

export interface User {
  id: number;
  name: string;
  email: string;
  department: string;
}

interface DirectoryState {
  users: User[];
  selectedUserId: number | null;
  filterDepartment: string | null;
  loading: boolean;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserDirectoryService {
  private state$ = new BehaviorSubject<DirectoryState>({
    users: [],
    selectedUserId: null,
    filterDepartment: null,
    loading: false,
    error: null,
  });

  // Derived observables
  readonly users$: Observable<User[]> = this.state$.pipe(
    map(s => {
      if (s.filterDepartment) {
        return s.users.filter(u => u.department === s.filterDepartment);
      }
      return s.users;
    }),
  );

  readonly selectedUser$: Observable<User | undefined> = this.state$.pipe(
    map(s => s.users.find(u => u.id === s.selectedUserId)),
  );

  readonly loading$: Observable<boolean> = this.state$.pipe(map(s => s.loading));
  readonly error$: Observable<string | null> = this.state$.pipe(map(s => s.error));

  readonly departments$: Observable<string[]> = this.state$.pipe(
    map(s => [...new Set(s.users.map(u => u.department))].sort()),
  );

  constructor(private http: HttpClient) {}

  loadUsers(): void {
    this.setState({ loading: true, error: null });

    this.http.get<User[]>('/api/users').pipe(
      tap(users => this.setState({ users, loading: false })),
      catchError(err => {
        this.setState({ error: err.message, loading: false });
        return of([]);
      }),
    ).subscribe(); // Fire-and-forget: state is updated via tap/catchError
  }

  selectUser(userId: number): void {
    this.setState({ selectedUserId: userId });
  }

  filterByDepartment(department: string | null): void {
    this.setState({ filterDepartment: department });
  }

  clearError(): void {
    this.setState({ error: null });
  }

  private setState(partial: Partial<DirectoryState>): void {
    this.state$.next({ ...this.state$.value, ...partial });
  }
}
```

### Feature-scoped State (Component-level Provider)

```typescript
// === search-state.service.ts ===
// Scoped to a search feature. Each search page instance gets its own state.
@Injectable()  // NOT providedIn: 'root'
export class SearchStateService {
  private state$ = new BehaviorSubject<{
    query: string;
    results: any[];
    loading: boolean;
  }>({
    query: '',
    results: [],
    loading: false,
  });

  readonly query$ = this.state$.pipe(map(s => s.query));
  readonly results$ = this.state$.pipe(map(s => s.results));
  readonly loading$ = this.state$.pipe(map(s => s.loading));

  search(query: string, searchFn: (q: string) => Observable<any[]>): void {
    this.setState({ query, loading: true });
    searchFn(query).pipe(
      tap(results => this.setState({ results, loading: false })),
      catchError(() => {
        this.setState({ results: [], loading: false });
        return of([]);
      }),
    ).subscribe();
  }

  clear(): void {
    this.state$.next({ query: '', results: [], loading: false });
  }

  private setState(partial: Partial<{ query: string; results: any[]; loading: boolean }>): void {
    this.state$.next({ ...this.state$.value, ...partial });
  }
}

// === product-search.component.ts ===
@Component({
  selector: 'app-product-search',
  providers: [SearchStateService],  // New instance per component instance
  template: `
    <input (keyup.enter)="onSearch($event)" [value]="query$ | async" />
    <div *ngIf="loading$ | async">Searching...</div>
    <div *ngFor="let result of results$ | async">{{ result.name }}</div>
  `,
})
export class ProductSearchComponent {
  readonly query$ = this.searchState.query$;
  readonly results$ = this.searchState.results$;
  readonly loading$ = this.searchState.loading$;

  constructor(
    private searchState: SearchStateService,
    private http: HttpClient,
  ) {}

  onSearch(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchState.search(query, q =>
      this.http.get<any[]>(`/api/products/search?q=${q}`),
    );
  }
}
```

## The Anti-Pattern in Angular

The junior dev stores state in component properties and passes it around through inputs and outputs across many levels. Or they use a mutable service where components reach in and mutate state directly.

```typescript
// DO NOT DO THIS -- mutable state, no encapsulation
@Injectable({ providedIn: 'root' })
export class CartService {
  items: CartItem[] = [];  // Public mutable array
  total = 0;               // Public mutable number
}

// Component:
this.cartService.items.push(newItem);         // Direct mutation
this.cartService.items.splice(index, 1);      // Direct mutation
this.cartService.total = this.calculateTotal(); // Direct mutation
// No observable. No notification of changes. OnPush components never update.
// Multiple components mutate the same array in unpredictable order.
```

```typescript
// DO NOT DO THIS -- Subject instead of BehaviorSubject
@Injectable({ providedIn: 'root' })
export class CartService {
  private items$ = new Subject<CartItem[]>();  // No initial value
  // Components that subscribe AFTER the initial load never get any data.
  // They see nothing until the next update.
}
```

```typescript
// DO NOT DO THIS -- exposing the BehaviorSubject directly
@Injectable({ providedIn: 'root' })
export class CartService {
  readonly items$ = new BehaviorSubject<CartItem[]>([]);
  // Any component can call: this.cartService.items$.next([])
  // The service has no control over state transitions.
  // There's no single place to put validation or side effects.
}
```

## Common Mistakes

1. **Exposing the `BehaviorSubject` directly.** The subject is the write-side of state. If components can call `.next()` on it, the service loses control. Expose `.asObservable()` or pipe the subject through `map()`. Keep the subject private.

2. **Using `Subject` instead of `BehaviorSubject`.** `Subject` has no current value. Late subscribers miss all previous emissions. A component that subscribes after the service already loaded data sees nothing. `BehaviorSubject` emits the current value on subscription.

3. **Forgetting to use the `async` pipe with OnPush.** If you subscribe manually in the component and assign to a property, OnPush will not detect the change unless you also call `markForCheck()`. The `async` pipe handles this automatically. Always prefer the `async` pipe.

4. **Mutating state instead of replacing it.** `this.state$.value.items.push(item)` mutates the current state object. The `BehaviorSubject` doesn't emit because `.next()` was never called. Even if you call `.next(this.state$.value)`, the reference is the same, so `distinctUntilChanged()` and OnPush won't detect a change. Always create new objects and arrays.

5. **Not providing derived observables.** Making every component compute `items.reduce(...)` to get the total means the same logic is duplicated and executed in every component. The service should expose pre-computed `total$`, `itemCount$`, etc.

6. **Not handling loading and error states.** A state service without `loading` and `error` fields forces components to track these independently, leading to inconsistent loading spinners and error messages across the UI.

## Testing This

Test the state service in isolation (no component, no HTTP):

```typescript
describe('CartService', () => {
  let service: CartService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CartService);
  });

  it('should start with empty cart', (done) => {
    service.items$.subscribe(items => {
      expect(items).toEqual([]);
      done();
    });
  });

  it('should add an item', (done) => {
    service.addItem({ id: 1, name: 'Widget', price: 9.99 });

    service.items$.subscribe(items => {
      expect(items.length).toBe(1);
      expect(items[0].productName).toBe('Widget');
      expect(items[0].quantity).toBe(1);
      done();
    });
  });

  it('should increment quantity for duplicate item', (done) => {
    service.addItem({ id: 1, name: 'Widget', price: 9.99 });
    service.addItem({ id: 1, name: 'Widget', price: 9.99 });

    service.items$.subscribe(items => {
      expect(items.length).toBe(1);
      expect(items[0].quantity).toBe(2);
      done();
    });
  });

  it('should calculate total', (done) => {
    service.addItem({ id: 1, name: 'Widget', price: 10 });
    service.addItem({ id: 2, name: 'Gadget', price: 20 });

    service.total$.subscribe(total => {
      expect(total).toBe(30);
      done();
    });
  });

  it('should remove an item', (done) => {
    service.addItem({ id: 1, name: 'Widget', price: 10 });
    service.addItem({ id: 2, name: 'Gadget', price: 20 });
    service.removeItem(1);

    service.items$.subscribe(items => {
      expect(items.length).toBe(1);
      expect(items[0].productId).toBe(2);
      done();
    });
  });

  it('should clear cart', (done) => {
    service.addItem({ id: 1, name: 'Widget', price: 10 });
    service.clearCart();

    service.items$.subscribe(items => {
      expect(items).toEqual([]);
      done();
    });
  });

  it('should remove item when quantity set to 0', (done) => {
    service.addItem({ id: 1, name: 'Widget', price: 10 });
    service.updateQuantity(1, 0);

    service.items$.subscribe(items => {
      expect(items.length).toBe(0);
      done();
    });
  });
});
```

Test the state service with HTTP (loading/error states):

```typescript
describe('UserDirectoryService', () => {
  let service: UserDirectoryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(UserDirectoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should set loading while fetching', () => {
    const loadingValues: boolean[] = [];
    service.loading$.subscribe(v => loadingValues.push(v));

    service.loadUsers();

    // loading is true while request is in flight
    expect(loadingValues).toContain(true);

    httpMock.expectOne('/api/users').flush([]);

    // loading is false after response
    expect(loadingValues[loadingValues.length - 1]).toBeFalse();
  });

  it('should set error on failure', (done) => {
    service.loadUsers();

    httpMock.expectOne('/api/users').error(
      new ProgressEvent('error'),
      { status: 500, statusText: 'Server Error' },
    );

    service.error$.subscribe(error => {
      if (error) {
        expect(error).toBeTruthy();
        done();
      }
    });
  });

  it('should filter by department', (done) => {
    service.loadUsers();
    httpMock.expectOne('/api/users').flush([
      { id: 1, name: 'Alice', email: 'a@b.com', department: 'Engineering' },
      { id: 2, name: 'Bob', email: 'b@b.com', department: 'Marketing' },
    ]);

    service.filterByDepartment('Engineering');

    service.users$.subscribe(users => {
      expect(users.length).toBe(1);
      expect(users[0].name).toBe('Alice');
      done();
    });
  });
});
```

Test component integration with the state service:

```typescript
describe('CartSummaryComponent', () => {
  let fixture: ComponentFixture<CartSummaryComponent>;
  let cartService: CartService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CartSummaryComponent],
    }).compileComponents();

    cartService = TestBed.inject(CartService);
    fixture = TestBed.createComponent(CartSummaryComponent);
  });

  it('should display 0 items initially', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('0 items');
  });

  it('should update when cart changes', () => {
    cartService.addItem({ id: 1, name: 'Widget', price: 25.00 });
    cartService.addItem({ id: 1, name: 'Widget', price: 25.00 });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('2 items');
  });
});
```
