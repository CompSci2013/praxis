---
id: angular-subscription-management
layer1_parent: subscription-management
angular_version: "14"
module: "rxjs"
---

# Angular Subscription Management

## How Angular Implements This

Every `.subscribe()` call in Angular creates a subscription that holds a reference to the callback closure, which holds a reference to the component, which holds references to all injected services and template bindings. If the subscription is not cleaned up when the component is destroyed, the callback continues to fire, the component stays in memory, and you have a memory leak.

Angular 14 provides several patterns for managing subscription lifecycles, ranked from best to worst:

1. **`async` pipe** (best) — the template manages the subscription. No manual cleanup needed.
2. **`takeUntil(destroy$)` pattern** — a destroy subject emits in `ngOnDestroy`, terminating all subscriptions.
3. **`Subscription.add()` composite** — collect subscriptions into one composite and unsubscribe once.
4. **Manual unsubscribe** (worst) — store each subscription individually and unsubscribe each in `ngOnDestroy`.

Angular 14 does **not** have `DestroyRef` or the `takeUntilDestroyed` operator — those are Angular 16+ features. The `takeUntil` pattern with a `Subject` is the standard approach in Angular 14.

Some observables complete naturally and don't need cleanup: `HttpClient` calls complete after one response, `route.paramMap` is managed by the router. But `interval()`, `fromEvent()`, store selectors, WebSocket streams, and `BehaviorSubject` subscriptions all require explicit cleanup.

## The Correct Way

```typescript
// Pattern 1: async pipe — PREFERRED
import { Component, OnInit } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserService } from '../services/user.service';
import { NotificationService } from '../services/notification.service';

@Component({
  selector: 'app-dashboard',
  template: `
    <!-- async pipe subscribes on render, unsubscribes on destroy -->
    <ng-container *ngIf="vm$ | async as vm">
      <h1>Welcome, {{ vm.userName }}</h1>
      <span class="badge">{{ vm.unreadCount }} unread</span>
      <ul>
        <li *ngFor="let notification of vm.notifications">
          {{ notification.message }}
        </li>
      </ul>
    </ng-container>
  `
})
export class DashboardComponent implements OnInit {
  vm$!: Observable<DashboardViewModel>;

  constructor(
    private userService: UserService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    // Combine multiple observables into a single view model
    this.vm$ = combineLatest([
      this.userService.currentUser$,
      this.notificationService.notifications$
    ]).pipe(
      map(([user, notifications]) => ({
        userName: user.name,
        unreadCount: notifications.filter(n => !n.read).length,
        notifications
      }))
    );
    // Zero subscriptions in the component. Zero cleanup needed.
    // The async pipe does everything.
  }
}
```

```typescript
// Pattern 2: takeUntil — for when you MUST subscribe in the component
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, interval } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
import { WebSocketService } from '../services/websocket.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-live-feed',
  template: `<div *ngFor="let msg of messages">{{ msg }}</div>`
})
export class LiveFeedComponent implements OnInit, OnDestroy {
  messages: string[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    private wsService: WebSocketService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // WebSocket messages — never completes on its own
    this.wsService.messages$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(msg => {
      this.messages.push(msg);
    });

    // Periodic polling — never completes
    interval(30000).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.wsService.ping();
    });

    // Auth state changes — BehaviorSubject, never completes
    this.authService.isAuthenticated$.pipe(
      filter(isAuth => !isAuth),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.wsService.disconnect();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();      // Emit to trigger takeUntil
    this.destroy$.complete();  // Clean up the subject itself
  }
}
```

```typescript
// Pattern 3: Subscription composite — acceptable alternative
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-complex',
  template: '...'
})
export class ComplexComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  ngOnInit(): void {
    this.subscriptions.add(
      this.service1.data$.subscribe(data => this.handleData(data))
    );
    this.subscriptions.add(
      this.service2.events$.subscribe(event => this.handleEvent(event))
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();  // Unsubscribes all at once
  }
}
```

```typescript
// Base class to reduce boilerplate (use sparingly — composition > inheritance)
import { Directive, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

@Directive()  // Required in Angular 14 for base classes with lifecycle hooks
export abstract class DestroyableComponent implements OnDestroy {
  protected destroy$ = new Subject<void>();

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

// Usage
@Component({
  selector: 'app-my-feature',
  template: '...'
})
export class MyFeatureComponent extends DestroyableComponent implements OnInit {
  ngOnInit(): void {
    this.someService.data$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(data => this.handle(data));
  }
}
```

## The Anti-Pattern in Angular

```typescript
// WRONG: Subscribing in ngOnInit with no cleanup
@Component({ ... })
export class LeakyComponent implements OnInit {
  ngOnInit(): void {
    this.authService.user$.subscribe(user => this.user = user);
    this.store.select(selectItems).subscribe(items => this.items = items);
    interval(5000).subscribe(() => this.pollServer());
    // Three permanent subscriptions. Navigate away → component is "destroyed"
    // but these subscriptions keep the component alive in memory.
    // After 10 navigation cycles: 30 zombie subscriptions, 10 zombie components.
  }
  // No ngOnDestroy. No takeUntil. No async pipe.
}

// WRONG: takeUntil in the wrong position
this.http.get('/api/data').pipe(
  takeUntil(this.destroy$),  // takeUntil before switchMap
  switchMap(data => this.processService.process(data))
).subscribe();
// If destroy$ fires while processService.process() is running,
// the inner observable is NOT cancelled — only the outer one is.
// takeUntil must be the LAST operator in the pipe.

// Correct:
this.http.get('/api/data').pipe(
  switchMap(data => this.processService.process(data)),
  takeUntil(this.destroy$)  // Last operator — catches everything
).subscribe();

// WRONG: Subscribing to HttpClient for side effects and forgetting
save(): void {
  this.http.post('/api/save', this.data);  // No subscribe — request never fires!
}
// Developer realizes, adds subscribe:
save(): void {
  this.http.post('/api/save', this.data).subscribe();  // Fires, but no error handling
}
// HttpClient observables are cold — they don't execute until subscribed.
// They also complete after one emission, so they don't leak. But you still
// need error handling.
```

## Common Mistakes

1. **`takeUntil` must be the last operator in the pipe**: If `takeUntil` comes before `switchMap`, the inner observable created by `switchMap` will not be cancelled when `destroy$` emits. This is the most common `takeUntil` mistake and there is an ESLint rule (`rxjs/no-unsafe-takeuntil`) that catches it.

2. **HttpClient doesn't need cleanup (usually)**: `HttpClient` methods return observables that complete after one emission. They don't leak. But if you pipe them through `retry()` or `repeatWhen()`, or if the HTTP call is made inside a `switchMap` from a long-lived source, the source observable still needs cleanup.

3. **`ngOnDestroy` not called on services**: `ngOnDestroy` is only called on components, directives, and pipes. Services provided at the root level are never destroyed (unless you use `providedIn: 'any'` in a lazy module). If a service subscribes to a long-lived observable, it must manage that subscription differently — typically the service outlives all components and the subscription is intentional.

4. **Forgetting `OnDestroy` in the `implements` clause**: TypeScript won't warn you if you define `ngOnDestroy()` without implementing `OnDestroy`. The method still works at runtime, but you lose compile-time checks and the intent is unclear to other developers.

5. **The base class `@Directive()` decorator**: In Angular 14, if a base class has lifecycle hooks (like `ngOnDestroy`), it must have a `@Directive()` or `@Component()` decorator. Without it, the lifecycle hook may not be called. This is an Angular compiler requirement.

## Testing This

```typescript
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BehaviorSubject, interval } from 'rxjs';
import { LiveFeedComponent } from './live-feed.component';
import { WebSocketService } from '../services/websocket.service';

describe('LiveFeedComponent', () => {
  let fixture: ComponentFixture<LiveFeedComponent>;
  let component: LiveFeedComponent;
  let messages$: BehaviorSubject<string>;

  beforeEach(() => {
    messages$ = new BehaviorSubject<string>('init');

    TestBed.configureTestingModule({
      declarations: [LiveFeedComponent],
      providers: [
        {
          provide: WebSocketService,
          useValue: {
            messages$: messages$.asObservable(),
            ping: jasmine.createSpy('ping'),
            disconnect: jasmine.createSpy('disconnect')
          }
        },
        {
          provide: AuthService,
          useValue: { isAuthenticated$: new BehaviorSubject(true) }
        }
      ]
    });

    fixture = TestBed.createComponent(LiveFeedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();  // Triggers ngOnInit
  });

  it('should receive messages', () => {
    messages$.next('hello');
    expect(component.messages).toContain('hello');
  });

  it('should stop receiving messages after destroy', () => {
    fixture.destroy();  // Triggers ngOnDestroy
    messages$.next('should not appear');
    expect(component.messages).not.toContain('should not appear');
  });

  it('should not leak subscriptions', () => {
    // Count active observers on the subject
    expect(messages$.observers.length).toBe(1);
    fixture.destroy();
    expect(messages$.observers.length).toBe(0);  // Subscription cleaned up
  });
});
```

Test cleanup by destroying the component (`fixture.destroy()`) and then emitting new values on the source observable. Assert that the component's callback does not fire. You can also check `subject.observers.length` to verify that subscriptions were actually removed — this is the most direct proof of proper cleanup.
