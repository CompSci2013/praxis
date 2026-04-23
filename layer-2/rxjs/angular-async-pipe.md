---
id: angular-async-pipe
layer1_parent: subscription-management
angular_version: "14"
module: "@angular/common"
---

# Angular Async Pipe

## How Angular Implements This

The `async` pipe (`| async`) is a built-in pipe that subscribes to an `Observable` or `Promise` in the template, returns the latest emitted value, and **automatically unsubscribes when the component is destroyed**. It is the single most important tool for avoiding memory leaks in Angular.

When you use `async` pipe:
1. Angular subscribes to the observable when the pipe is first evaluated.
2. Each new emission triggers change detection on the component and updates the template.
3. When the component is destroyed, Angular unsubscribes automatically.
4. When the observable reference changes (e.g., the component property is reassigned), Angular unsubscribes from the old observable and subscribes to the new one.

The async pipe also works with `OnPush` change detection — it calls `markForCheck()` internally when a new value arrives. This makes it the ideal pattern for high-performance components.

## The Correct Way

```typescript
// Basic async pipe usage
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { UserService } from '../services/user.service';
import { User } from '../models/user.model';

@Component({
  selector: 'app-user-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,  // Safe with async pipe
  template: `
    <!-- Pattern 1: *ngIf with alias — subscribe once, use multiple properties -->
    <ng-container *ngIf="user$ | async as user">
      <h1>{{ user.name }}</h1>
      <p>{{ user.email }}</p>
      <p>Joined: {{ user.createdAt | date:'mediumDate' }}</p>
    </ng-container>

    <!-- Pattern 2: *ngFor with async -->
    <ul>
      <li *ngFor="let item of items$ | async">{{ item.name }}</li>
    </ul>

    <!-- Pattern 3: Pass to child component -->
    <app-notifications [count]="notificationCount$ | async"></app-notifications>
  `
})
export class UserProfileComponent implements OnInit {
  user$!: Observable<User>;
  items$!: Observable<Item[]>;
  notificationCount$!: Observable<number>;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.user$ = this.userService.getCurrentUser();
    this.items$ = this.userService.getUserItems();
    this.notificationCount$ = this.userService.getUnreadCount();
  }
  // No ngOnDestroy needed. No subscriptions to manage. No takeUntil.
}
```

```typescript
// View model pattern — combine multiple observables into one
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

interface DashboardVm {
  user: User;
  projects: Project[];
  notifications: Notification[];
  isAdmin: boolean;
}

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *ngIf="vm$ | async as vm; else loading">
      <app-header [user]="vm.user" [isAdmin]="vm.isAdmin"></app-header>
      <app-project-list [projects]="vm.projects"></app-project-list>
      <app-notification-panel [notifications]="vm.notifications"></app-notification-panel>
    </ng-container>
    <ng-template #loading>
      <app-skeleton-loader></app-skeleton-loader>
    </ng-template>
  `
})
export class DashboardComponent implements OnInit {
  vm$!: Observable<DashboardVm>;

  constructor(
    private userService: UserService,
    private projectService: ProjectService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.vm$ = combineLatest([
      this.userService.currentUser$,
      this.projectService.projects$,
      this.notificationService.notifications$
    ]).pipe(
      map(([user, projects, notifications]) => ({
        user,
        projects,
        notifications,
        isAdmin: user.roles.includes('admin')
      }))
    );
    // Single subscription in the template via one async pipe.
    // All data arrives together. No partial renders.
    // Loading state is handled by the *ngIf / else template.
  }
}
```

```typescript
// Handling null emissions and loading states
@Component({
  selector: 'app-data-view',
  template: `
    <!-- Handle loading, data, and empty states -->
    <ng-container *ngIf="data$ | async as data; else loadingOrEmpty">
      <div *ngIf="data.length > 0; else emptyState">
        <div *ngFor="let item of data">{{ item.name }}</div>
      </div>
      <ng-template #emptyState>
        <p>No items found.</p>
      </ng-template>
    </ng-container>

    <ng-template #loadingOrEmpty>
      <app-spinner></app-spinner>
    </ng-template>
  `
})
export class DataViewComponent implements OnInit {
  data$!: Observable<Item[]>;

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.data$ = this.dataService.getItems();
  }
}
```

```typescript
// Async pipe with method calls — event-driven data loading
@Component({
  selector: 'app-search',
  template: `
    <input #searchInput (keyup.enter)="search(searchInput.value)">
    <div *ngIf="results$ | async as results">
      <p>{{ results.length }} results found</p>
      <div *ngFor="let r of results">{{ r.title }}</div>
    </div>
    <div *ngIf="error$ | async as error" class="error">
      {{ error }}
    </div>
  `
})
export class SearchComponent {
  results$!: Observable<SearchResult[]>;
  error$!: Observable<string | null>;

  private searchSubject = new Subject<string>();

  constructor(private searchService: SearchService) {
    this.results$ = this.searchSubject.pipe(
      switchMap(term => this.searchService.search(term).pipe(
        catchError(err => {
          // Error handling inside the switchMap so the outer stream survives
          return of([]);
        })
      ))
    );
  }

  search(term: string): void {
    this.searchSubject.next(term);
  }
}
```

## The Anti-Pattern in Angular

```typescript
// WRONG: Subscribing manually when async pipe would work
@Component({
  selector: 'app-user-list',
  template: `
    <div *ngIf="loading">Loading...</div>
    <ul>
      <li *ngFor="let user of users">{{ user.name }}</li>
    </ul>
  `
})
export class UserListComponent implements OnInit, OnDestroy {
  users: User[] = [];
  loading = true;
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.userService.getUsers().pipe(
      takeUntil(this.destroy$)
    ).subscribe(users => {
      this.users = users;
      this.loading = false;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
// This is 15 lines of boilerplate that the async pipe eliminates entirely:
// users$: Observable<User[]> in the class, *ngFor="let user of users$ | async" in template.

// WRONG: Multiple async pipes on the same observable without shareReplay
@Component({
  template: `
    <h1>{{ (user$ | async)?.name }}</h1>
    <p>{{ (user$ | async)?.email }}</p>
    <img [src]="(user$ | async)?.avatar">
  `
})
export class UserCardComponent {
  user$ = this.http.get<User>('/api/user');  // Each async pipe = separate HTTP request!
  constructor(private http: HttpClient) {}
}
// Fix: use *ngIf="user$ | async as user" to subscribe once,
// or add shareReplay({ bufferSize: 1, refCount: true }) to the observable.

// WRONG: Mixing async pipe and manual subscription
@Component({
  template: `{{ items$ | async }}`
})
export class MixedComponent implements OnInit {
  items$!: Observable<Item[]>;

  ngOnInit(): void {
    this.items$ = this.service.getItems();
    this.items$.subscribe(items => this.doSomething(items));  // Manual subscribe TOO
    // Now you have two subscriptions — one from async pipe, one manual.
    // Two HTTP requests (if the source is cold). Two side effect executions.
  }
}
```

## Common Mistakes

1. **Multiple `async` pipes on the same cold observable**: Each `| async` creates a separate subscription. If the observable is an HTTP call, you get duplicate requests. Fix: use `*ngIf="obs$ | async as value"` to subscribe once and alias the result, or add `shareReplay` to the observable.

2. **Null initial value with `async`**: Before the first emission, `async` pipe returns `null`. If your template does `{{ (user$ | async).name }}`, you get `Cannot read properties of null`. Use the safe navigation operator `{{ (user$ | async)?.name }}` or the `*ngIf` alias pattern.

3. **`async` pipe with `OnPush` is correct, not broken**: Some developers think `OnPush` components won't update with `async` pipe because change detection is restricted. The opposite is true — the `async` pipe calls `markForCheck()` internally, which is exactly how `OnPush` is meant to work. `async` pipe + `OnPush` is the ideal combination.

4. **Returning `null` from an observable**: If your observable emits `null`, `*ngIf="data$ | async as data"` evaluates to false (because `null` is falsy). The `else` template renders even though data has "arrived." For observables that can legitimately emit `null`, wrap the value: `map(data => ({ value: data }))` and use `*ngIf="wrapped$ | async as w"` then access `w.value`.

5. **Async pipe in attribute bindings**: `<img [src]="imageUrl$ | async">` works but emits `null` initially, which sets `src="null"` and triggers a failed image request. Use `<img *ngIf="imageUrl$ | async as url" [src]="url">` to only render the element after the URL arrives.

## Testing This

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, BehaviorSubject } from 'rxjs';
import { UserProfileComponent } from './user-profile.component';
import { UserService } from '../services/user.service';

describe('UserProfileComponent (async pipe)', () => {
  let fixture: ComponentFixture<UserProfileComponent>;
  let component: UserProfileComponent;
  let userSubject: BehaviorSubject<User>;

  beforeEach(() => {
    userSubject = new BehaviorSubject<User>({
      name: 'Alice',
      email: 'alice@example.com',
      createdAt: new Date('2024-01-01')
    } as User);

    TestBed.configureTestingModule({
      declarations: [UserProfileComponent],
      providers: [
        {
          provide: UserService,
          useValue: { getCurrentUser: () => userSubject.asObservable() }
        }
      ]
    });

    fixture = TestBed.createComponent(UserProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();  // Triggers ngOnInit + first async pipe evaluation
  });

  it('should display the user name', () => {
    const el = fixture.nativeElement;
    expect(el.querySelector('h1').textContent).toContain('Alice');
  });

  it('should update when observable emits new value', () => {
    userSubject.next({
      name: 'Bob',
      email: 'bob@example.com',
      createdAt: new Date()
    } as User);
    fixture.detectChanges();  // Trigger change detection after new emission

    const el = fixture.nativeElement;
    expect(el.querySelector('h1').textContent).toContain('Bob');
  });

  it('should show loading template before data arrives', () => {
    // To test loading state, use a Subject (no initial value) instead of BehaviorSubject
    // The async pipe returns null, *ngIf is false, else template renders
  });
});
```

Testing async pipe components is straightforward: provide mock services that return observables, call `fixture.detectChanges()` to trigger template evaluation, and assert on the rendered DOM. Push new values to `BehaviorSubject` to test reactive updates. The async pipe handles subscription/unsubscription — you only test the rendered output.
