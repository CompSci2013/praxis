---
id: angular-sharing-operators
layer1_parent: hot-vs-cold-observables
angular_version: "14"
module: "rxjs"
---

# Angular Sharing Operators

## How Angular Implements This

By default, observables are **cold** — each subscriber gets its own independent execution. An `HttpClient.get()` call subscribed to by three components fires three HTTP requests. This is usually not what you want.

Sharing operators convert cold observables into hot (multicasted) ones — multiple subscribers share a single execution. In Angular, this matters most in two scenarios:

1. **Multiple `async` pipes consuming the same observable**: Each `async` pipe creates a separate subscription. Without sharing, each subscription triggers the observable's source (like an HTTP call) independently.
2. **Services exposing data streams**: Multiple components injecting the same service and subscribing to the same observable.

The key operators:

- **`shareReplay({ bufferSize: 1, refCount: true })`** — shares the source, replays the last N values to new subscribers, and unsubscribes from the source when all subscribers leave (if `refCount: true`). This is the workhorse for HTTP caching.
- **`share()`** — shares the source but does not replay values. Late subscribers miss emissions that happened before they subscribed.
- **`BehaviorSubject`** — a subject that holds the current value and emits it to new subscribers. Often used in services as a manual multicasting mechanism.
- **`ReplaySubject(n)`** — replays the last `n` values to new subscribers. More flexible than `BehaviorSubject` (no required initial value, configurable buffer size).

## The Correct Way

```typescript
// shareReplay — cache an HTTP response for multiple subscribers
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config$: Observable<AppConfig> | null = null;

  constructor(private http: HttpClient) {}

  getConfig(): Observable<AppConfig> {
    if (!this.config$) {
      this.config$ = this.http.get<AppConfig>('/api/config').pipe(
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }
    return this.config$;
  }

  // Call this to force a refresh
  clearCache(): void {
    this.config$ = null;
  }
}
```

```typescript
// Multiple async pipes sharing one HTTP call
@Component({
  selector: 'app-user-info',
  template: `
    <!-- Without shareReplay, each async pipe triggers a separate HTTP request -->
    <h1>{{ (user$ | async)?.name }}</h1>
    <p>{{ (user$ | async)?.email }}</p>
    <img [src]="(user$ | async)?.avatar">
    <!-- Three async pipes = three subscriptions. With shareReplay, one HTTP call. -->
  `
})
export class UserInfoComponent implements OnInit {
  user$!: Observable<User>;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.user$ = this.userService.getUser(this.userId).pipe(
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }
}
```

```typescript
// BehaviorSubject — manual state management in a service
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';

export interface CartState {
  items: CartItem[];
  loading: boolean;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private state$ = new BehaviorSubject<CartState>({
    items: [],
    loading: false
  });

  // Expose read-only observables for specific slices
  readonly items$: Observable<CartItem[]> = this.state$.pipe(
    map(state => state.items),
    distinctUntilChanged()  // Only emit when items actually change
  );

  readonly itemCount$: Observable<number> = this.state$.pipe(
    map(state => state.items.length),
    distinctUntilChanged()
  );

  readonly isLoading$: Observable<boolean> = this.state$.pipe(
    map(state => state.loading),
    distinctUntilChanged()
  );

  addItem(item: CartItem): void {
    const current = this.state$.getValue();
    this.state$.next({
      ...current,
      items: [...current.items, item]
    });
  }

  removeItem(itemId: string): void {
    const current = this.state$.getValue();
    this.state$.next({
      ...current,
      items: current.items.filter(i => i.id !== itemId)
    });
  }

  // BehaviorSubject always has a current value.
  // New subscribers immediately receive the latest state.
  // No "flash of empty" in the template.
}
```

```typescript
// ReplaySubject — for when you don't have an initial value
import { Injectable } from '@angular/core';
import { ReplaySubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // No initial value — user data comes from an API call
  private currentUser = new ReplaySubject<User | null>(1);
  readonly currentUser$: Observable<User | null> = this.currentUser.asObservable();

  constructor(private http: HttpClient) {}

  login(credentials: LoginCredentials): Observable<User> {
    return this.http.post<User>('/api/auth/login', credentials).pipe(
      tap(user => this.currentUser.next(user))
    );
  }

  logout(): void {
    this.currentUser.next(null);
  }

  // Components that subscribe to currentUser$ after login will immediately
  // receive the cached user via ReplaySubject(1). Before login, they wait
  // (no emission until the first next() call — unlike BehaviorSubject which
  // would emit undefined or null immediately).
}
```

## The Anti-Pattern in Angular

```typescript
// WRONG: shareReplay without refCount
this.http.get('/api/data').pipe(
  shareReplay(1)  // Short form — refCount defaults to false
);
// When all subscribers unsubscribe, the source subscription stays alive.
// The observable never re-executes, even if the data is stale.
// Memory leak if the source is long-lived.

// Always use the object form:
shareReplay({ bufferSize: 1, refCount: true })

// WRONG: Exposing the BehaviorSubject directly
@Injectable({ providedIn: 'root' })
export class UserService {
  currentUser$ = new BehaviorSubject<User | null>(null);
  // Any component can call currentUser$.next() and corrupt the state.
  // The service has no control over its own data.
}

// Fix: private subject, public observable
private currentUserSubject = new BehaviorSubject<User | null>(null);
readonly currentUser$ = this.currentUserSubject.asObservable();

// WRONG: Using share() when late subscribers need the value
loadData(): Observable<Data> {
  return this.http.get<Data>('/api/data').pipe(
    share()  // No replay buffer
  );
}
// Component A subscribes → HTTP fires → data arrives → Component A has data.
// Component B subscribes 100ms later → data already emitted → Component B gets nothing.
// Use shareReplay(1) when late subscribers need the last value.
```

## Common Mistakes

1. **`shareReplay(1)` vs `shareReplay({ bufferSize: 1, refCount: true })`**: The shorthand `shareReplay(1)` sets `refCount: false`, meaning the source subscription stays alive even after all subscribers unsubscribe. This prevents re-execution (which might be intentional for caching) but causes memory leaks for long-lived observables. Always use the object form and explicitly choose `refCount`.

2. **`share()` loses emissions for late subscribers**: `share()` multicasts but has no buffer. If a component subscribes after the data has already been emitted, it gets nothing. Use `shareReplay` when the data needs to be available to future subscribers.

3. **`BehaviorSubject` requires an initial value**: `new BehaviorSubject<User>(undefined!)` is a common hack that introduces `undefined` into a `User` stream, causing template errors. If you don't have a meaningful initial value, use `ReplaySubject(1)` instead — it only emits after the first `next()` call.

4. **Forgetting `distinctUntilChanged`**: `BehaviorSubject` emits on every `next()`, even if the value hasn't changed. If you derive observables from it (like `state$.pipe(map(s => s.items))`), the derived observable emits a new reference on every state change, even if `items` didn't change. Use `distinctUntilChanged()` (with a custom comparator if needed) to prevent unnecessary re-renders.

5. **Sharing at the wrong level**: Putting `shareReplay` on an observable inside a component means each component instance creates its own shared cache — useless. Put `shareReplay` in the service, where the cache lives across component lifecycles. In a component, use `shareReplay` only to avoid duplicate subscriptions from multiple `async` pipes in the same template.

## Testing This

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ConfigService } from './config.service';

describe('ConfigService (shareReplay)', () => {
  let service: ConfigService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ConfigService]
    });
    service = TestBed.inject(ConfigService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should make only one HTTP request for multiple subscribers', () => {
    const config1Values: any[] = [];
    const config2Values: any[] = [];

    service.getConfig().subscribe(c => config1Values.push(c));
    service.getConfig().subscribe(c => config2Values.push(c));

    // Only ONE request despite two subscriptions
    const req = httpMock.expectOne('/api/config');
    req.flush({ theme: 'dark' });

    expect(config1Values).toEqual([{ theme: 'dark' }]);
    expect(config2Values).toEqual([{ theme: 'dark' }]);
  });

  it('should replay to late subscribers', () => {
    let earlyValue: any;
    let lateValue: any;

    service.getConfig().subscribe(c => earlyValue = c);
    httpMock.expectOne('/api/config').flush({ theme: 'dark' });

    // Subscribe AFTER the HTTP response
    service.getConfig().subscribe(c => lateValue = c);

    expect(earlyValue).toEqual({ theme: 'dark' });
    expect(lateValue).toEqual({ theme: 'dark' });  // Replayed from cache
  });

  it('should re-fetch after cache clear', () => {
    service.getConfig().subscribe();
    httpMock.expectOne('/api/config').flush({ theme: 'dark' });

    service.clearCache();

    service.getConfig().subscribe();
    httpMock.expectOne('/api/config');  // New request after cache clear
  });
});
```

Test multicasting by subscribing multiple times and asserting that `httpMock.expectOne()` (not `expectMultiple`) matches. If `shareReplay` is missing, `expectOne` will throw because multiple requests were made. Test replay by subscribing after the response has been flushed and verifying the late subscriber receives the cached value.
