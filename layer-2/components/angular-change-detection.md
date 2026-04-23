---
id: angular-change-detection
layer1_parent: null
angular_version: "14"
module: "@angular/core"
---

# Change Detection

## How Angular Implements This

Angular uses **Zone.js** to automatically trigger change detection. Zone.js monkey-patches every asynchronous browser API -- `setTimeout`, `setInterval`, `Promise.then`, `addEventListener`, `XMLHttpRequest`, `fetch` -- so that Angular knows when any async operation completes. When it does, Angular runs change detection from the root component downward through the entire component tree, checking every template binding against its current value.

This is the **Default** change detection strategy. It is simple and correct: after any async event, Angular checks everything. For small apps, this is fine. For large apps with hundreds of components, it means Angular is diffing thousands of template bindings after every keystroke, mouse move, and timer tick.

The **OnPush** change detection strategy changes the rules. A component marked `OnPush` tells Angular: "Only check me when one of these things happens:"

1. One of my `@Input()` references changes (not mutation -- reference identity must change).
2. An event handler bound in my template fires (click, keyup, etc.).
3. An observable wired through the `async` pipe emits a new value.
4. I explicitly call `ChangeDetectorRef.markForCheck()`.

If none of these happen, Angular skips the component and its entire subtree during change detection. This can dramatically reduce the number of checks per cycle.

OnPush is not an optimization toggle you flip at the end. It is a design constraint that forces you into immutable data patterns and observable-driven templates -- which are better architecture regardless of performance.

## The Correct Way

```typescript
// === user-list.component.ts ===
// OnPush: Angular only checks this component when inputs change or events fire.
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

interface User {
  id: number;
  name: string;
  email: string;
}

@Component({
  selector: 'app-user-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul>
      <li *ngFor="let user of users; trackBy: trackById">
        {{ user.name }} - {{ user.email }}
      </li>
    </ul>
  `,
})
export class UserListComponent {
  @Input() users: User[] = [];

  trackById(index: number, user: User): number {
    return user.id;
  }
}
```

```typescript
// === user-container.component.ts ===
// Smart component that provides data to the presentational component.
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Observable } from 'rxjs';
import { UserService, User } from '../user.service';

@Component({
  selector: 'app-user-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- async pipe subscribes, unsubscribes, and triggers markForCheck automatically -->
    <app-user-list [users]="users$ | async"></app-user-list>
  `,
})
export class UserContainerComponent implements OnInit {
  users$!: Observable<User[]>;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.users$ = this.userService.getUsers();
  }
}
```

### Using ChangeDetectorRef for Imperative Scenarios

```typescript
import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { WebSocketService } from '../websocket.service';

@Component({
  selector: 'app-live-feed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *ngFor="let message of messages">
      {{ message.text }} - {{ message.timestamp | date:'short' }}
    </div>
  `,
})
export class LiveFeedComponent implements OnInit, OnDestroy {
  messages: { text: string; timestamp: Date }[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    private ws: WebSocketService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.ws.messages$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(msg => {
      // Mutating the array and calling markForCheck because
      // this update comes from outside Angular's template event system.
      this.messages = [...this.messages, msg];  // New reference (immutable update)
      this.cdr.markForCheck();  // Tell Angular this component needs checking
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

### The Immutable Input Pattern

OnPush compares input references, not deep equality. You must produce new object/array references when data changes:

```typescript
// In the parent component:
addUser(newUser: User): void {
  // CORRECT: new array reference -- OnPush child detects the change
  this.users = [...this.users, newUser];

  // WRONG: same array reference -- OnPush child does NOT detect the change
  // this.users.push(newUser);
}

updateUser(id: number, updates: Partial<User>): void {
  // CORRECT: new array with new object reference for the changed item
  this.users = this.users.map(u =>
    u.id === id ? { ...u, ...updates } : u
  );
}
```

## The Anti-Pattern in Angular

The junior dev uses Default change detection everywhere and mutates objects and arrays in place. The app works but gets slower as it grows. Then they try to add OnPush and everything breaks because their code relies on mutation.

```typescript
// DO NOT DO THIS with OnPush
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div>{{ user.name }}</div>`,
})
export class UserCardComponent {
  @Input() user!: User;
}

// Parent mutates the object:
this.user.name = 'New Name';
// The child does NOT update because the object reference is the same.
// OnPush checks reference identity, not property values.
```

```typescript
// DO NOT DO THIS -- subscribing manually in an OnPush component without markForCheck
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div>{{ count }}</div>`,
})
export class CounterComponent implements OnInit {
  count = 0;

  constructor(private counterService: CounterService) {}

  ngOnInit(): void {
    this.counterService.count$.subscribe(c => {
      this.count = c;
      // Template never updates because Angular doesn't know this component changed.
      // Missing: this.cdr.markForCheck();
    });
  }
}
```

```typescript
// DO NOT DO THIS -- using detectChanges() from the root as a "fix"
// Some developers call detectChanges() everywhere when OnPush "doesn't work."
// This defeats the purpose of OnPush and can cause performance issues.
ngOnInit(): void {
  this.service.data$.subscribe(data => {
    this.data = data;
    this.cdr.detectChanges();  // Forces synchronous check -- use markForCheck() instead
  });
}
// detectChanges() runs change detection immediately on this component and its children.
// markForCheck() marks the component as dirty and lets Angular check it on the next cycle.
// markForCheck() is almost always the correct choice.
```

## Common Mistakes

1. **Mutating objects/arrays with OnPush.** OnPush compares references. `array.push()` does not change the reference. `object.name = 'x'` does not change the reference. You must produce new references: `[...array, newItem]`, `{ ...object, name: 'x' }`.

2. **Using `detectChanges()` instead of `markForCheck()`.** `detectChanges()` runs change detection synchronously and immediately. It can cause `ExpressionChangedAfterItHasBeenCheckedError` if called during an ongoing check. `markForCheck()` simply flags the component for the next natural check cycle.

3. **Not using `trackBy` with `*ngFor`.** Without `trackBy`, Angular destroys and recreates every DOM element in the list when the array reference changes (which happens every time with immutable updates). With `trackBy`, Angular reuses DOM elements for items with the same identity.

4. **Forgetting that `async` pipe handles `markForCheck()` automatically.** If you use the `async` pipe in the template, you don't need to inject `ChangeDetectorRef` or call `markForCheck()`. The pipe does it for you. Prefer the `async` pipe over manual subscriptions in OnPush components.

5. **Putting heavy computation in template expressions.** Angular re-evaluates template expressions on every check. A method call like `{{ getFilteredItems() }}` runs on every cycle. Use a pipe (which Angular can memoize with `pure: true`) or precompute the value and bind to a property.

## Testing This

Test that OnPush components update when inputs change by reference:

```typescript
describe('UserListComponent (OnPush)', () => {
  let fixture: ComponentFixture<UserListComponent>;
  let component: UserListComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UserListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UserListComponent);
    component = fixture.componentInstance;
  });

  it('should render users when input reference changes', () => {
    component.users = [{ id: 1, name: 'Alice', email: 'alice@test.com' }];
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('li');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('Alice');
  });

  it('should update when input is replaced with new reference', () => {
    component.users = [{ id: 1, name: 'Alice', email: 'alice@test.com' }];
    fixture.detectChanges();

    // New array reference with additional user
    component.users = [
      { id: 1, name: 'Alice', email: 'alice@test.com' },
      { id: 2, name: 'Bob', email: 'bob@test.com' },
    ];
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('li');
    expect(items.length).toBe(2);
  });
});
```

Test that the `async` pipe triggers updates in OnPush:

```typescript
describe('UserContainerComponent (OnPush + async)', () => {
  let fixture: ComponentFixture<UserContainerComponent>;
  let usersSubject: BehaviorSubject<User[]>;

  beforeEach(async () => {
    usersSubject = new BehaviorSubject<User[]>([]);
    const mockService = { getUsers: () => usersSubject.asObservable() };

    await TestBed.configureTestingModule({
      declarations: [UserContainerComponent, UserListComponent],
      providers: [{ provide: UserService, useValue: mockService }],
    }).compileComponents();

    fixture = TestBed.createComponent(UserContainerComponent);
    fixture.detectChanges();
  });

  it('should update when observable emits new value', () => {
    usersSubject.next([{ id: 1, name: 'Alice', email: 'a@b.com' }]);
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('li');
    expect(items.length).toBe(1);
  });
});
```
