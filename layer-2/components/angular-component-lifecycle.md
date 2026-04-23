---
id: angular-component-lifecycle
layer1_parent: component-lifecycle
angular_version: "14"
module: "@angular/core"
---

# Component Lifecycle

## How Angular Implements This

Angular components go through a predictable sequence of lifecycle events, each exposed as a hook method that you implement by adding the corresponding interface. There are 8 lifecycle hooks, and they fire in this exact order:

1. **constructor** -- Dependency injection happens here. The component instance is created but no inputs are set and no DOM exists yet. Do not put logic here; use it only for DI.

2. **ngOnChanges(changes: SimpleChanges)** -- Called before `ngOnInit` and every time an `@Input()` property changes. Receives a `SimpleChanges` object mapping each changed input to its previous and current value. Only fires for components that have `@Input()` properties.

3. **ngOnInit** -- Called once, after the first `ngOnChanges`. This is where you perform initialization logic: fetch data, subscribe to observables, set up state based on inputs. The component's inputs are available here. The DOM is not yet fully rendered.

4. **ngDoCheck** -- Called on every change detection cycle. This is Angular giving you a hook to implement custom change detection logic. Most components never need this. It fires frequently -- after every keystroke, mouse event, timer tick, and HTTP response.

5. **ngAfterContentInit** -- Called once, after Angular projects external content into the component's `<ng-content>`. `@ContentChild` and `@ContentChildren` queries are available here.

6. **ngAfterContentChecked** -- Called after every check of the projected content. Fires frequently like `ngDoCheck`.

7. **ngAfterViewInit** -- Called once, after the component's view (and its child views) are fully initialized. `@ViewChild` and `@ViewChildren` queries are available here. This is the first moment you can interact with DOM elements rendered by the component.

8. **ngOnDestroy** -- Called once, right before Angular destroys the component. Unsubscribe from observables, detach event listeners, clear timers. This is your cleanup hook.

The critical ones for daily work are `ngOnInit`, `ngOnChanges`, `ngAfterViewInit`, and `ngOnDestroy`. The others are for advanced use cases.

## The Correct Way

```typescript
import {
  Component,
  Input,
  OnInit,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  SimpleChanges,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UserService, User } from '../user.service';

@Component({
  selector: 'app-user-profile',
  template: `
    <div #profileCard>
      <h2>{{ user?.name }}</h2>
      <p>{{ user?.email }}</p>
    </div>
  `,
})
export class UserProfileComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() userId!: number;
  @ViewChild('profileCard') profileCard!: ElementRef;

  user: User | null = null;

  // Destroy notifier -- every subscription uses this to auto-unsubscribe.
  private destroy$ = new Subject<void>();

  constructor(private userService: UserService) {
    // ONLY dependency injection here. Nothing else.
    // this.userId is undefined at this point.
    // this.profileCard is undefined at this point.
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Fires before ngOnInit (first time) and on every @Input change.
    if (changes['userId'] && !changes['userId'].isFirstChange()) {
      // Input changed after initialization -- refetch.
      this.loadUser();
    }
  }

  ngOnInit(): void {
    // Inputs are set. Safe to use this.userId.
    // DOM is not yet rendered, so this.profileCard is still undefined.
    this.loadUser();
  }

  ngAfterViewInit(): void {
    // DOM is rendered. @ViewChild queries are populated.
    // this.profileCard is now available.
    console.log('Profile card height:', this.profileCard.nativeElement.offsetHeight);
    // WARNING: avoid changing data-bound properties here -- it causes
    // ExpressionChangedAfterItHasBeenCheckedError in dev mode.
  }

  ngOnDestroy(): void {
    // Component is being removed from the DOM.
    // Signal all subscriptions to complete.
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadUser(): void {
    this.userService.getUser(this.userId).pipe(
      takeUntil(this.destroy$),  // Auto-unsubscribes when component is destroyed
    ).subscribe(user => {
      this.user = user;
    });
  }
}
```

### The `destroy$` Pattern (Critical)

Every subscription that outlives a single synchronous operation must be cleaned up. The `destroy$` subject pattern is the standard Angular 14 approach:

```typescript
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(
    private tickerService: TickerService,
    private alertService: AlertService,
  ) {}

  ngOnInit(): void {
    // Multiple subscriptions, all cleaned up by one destroy$.
    this.tickerService.prices$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(prices => { ... });

    this.alertService.alerts$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(alert => { ... });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

## The Anti-Pattern in Angular

The junior dev puts everything in the constructor, ignores `ngOnDestroy`, and accesses `@ViewChild` before `ngAfterViewInit`.

```typescript
// DO NOT DO THIS
@Component({ selector: 'app-user-profile', template: '...' })
export class UserProfileComponent {
  @Input() userId!: number;
  @ViewChild('chart') chart!: ElementRef;

  constructor(private userService: UserService) {
    // BUG: this.userId is undefined in the constructor
    this.userService.getUser(this.userId).subscribe(user => {
      this.user = user;
    });

    // BUG: this.chart is undefined -- DOM doesn't exist yet
    this.chart.nativeElement.style.height = '300px';
  }

  user: User | null = null;
  // No ngOnDestroy -- subscription leaks when component is destroyed.
  // If the user navigates away before the HTTP response arrives,
  // the callback still fires on a destroyed component.
}
```

Another common mistake -- putting state mutation in `ngAfterViewInit`:

```typescript
// DO NOT DO THIS
ngAfterViewInit(): void {
  this.title = 'Loaded';  // Changing a template-bound property after view init
  // Angular (in dev mode) throws:
  // ExpressionChangedAfterItHasBeenCheckedError:
  // Expression has changed after it was checked. Previous value: 'null'. Current value: 'Loaded'.
}
```

## Common Mistakes

1. **Putting logic in the constructor instead of `ngOnInit`.** The constructor runs before inputs are set and before the component is part of the DOM. Accessing `@Input()` values there gives you `undefined`. The constructor is exclusively for receiving injected dependencies.

2. **Accessing `@ViewChild` before `ngAfterViewInit`.** The query is not populated until the view is initialized. Accessing it in `ngOnInit` gives `undefined`. If you need the element reference during initialization, use `ngAfterViewInit`.

3. **Not cleaning up in `ngOnDestroy`.** Every `subscribe()` that is not to a completing observable (like `HttpClient.get()`) is a memory leak. Timers (`setInterval`), event listeners, and WebSocket connections all need cleanup. Symptoms: the app gets slower over time, callbacks fire on destroyed components, console warnings about updates to unmounted components.

4. **`ExpressionChangedAfterItHasBeenCheckedError`.** This fires in development mode when a template binding changes between the change detection check and the verification check. It usually means you changed a data-bound property in `ngAfterViewInit` or `ngAfterContentChecked`. Fix: wrap the assignment in `setTimeout(() => this.title = 'Loaded')` or, better, restructure to avoid the timing issue.

5. **Using `ngOnChanges` without checking `isFirstChange()`.** `ngOnChanges` fires before `ngOnInit` on the first change. If your handler should only react to subsequent changes (not the initial binding), check `changes['propName'].isFirstChange()`.

6. **Implementing `ngDoCheck` without understanding the cost.** `ngDoCheck` runs on every single change detection cycle -- potentially hundreds of times per second during animations or rapid input. Heavy logic here destroys performance.

## Testing This

Test that initialization happens in `ngOnInit`, not the constructor:

```typescript
describe('UserProfileComponent lifecycle', () => {
  let component: UserProfileComponent;
  let fixture: ComponentFixture<UserProfileComponent>;
  let mockUserService: jasmine.SpyObj<UserService>;

  beforeEach(async () => {
    mockUserService = jasmine.createSpyObj('UserService', ['getUser']);
    mockUserService.getUser.and.returnValue(of({ id: 1, name: 'Alice', email: 'a@b.com' }));

    await TestBed.configureTestingModule({
      declarations: [UserProfileComponent],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compileComponents();

    fixture = TestBed.createComponent(UserProfileComponent);
    component = fixture.componentInstance;
  });

  it('should NOT call service before ngOnInit', () => {
    // Component is created but detectChanges() has not been called yet.
    expect(mockUserService.getUser).not.toHaveBeenCalled();
  });

  it('should fetch user on init', () => {
    component.userId = 42;
    fixture.detectChanges(); // Triggers ngOnChanges + ngOnInit

    expect(mockUserService.getUser).toHaveBeenCalledWith(42);
    expect(component.user?.name).toBe('Alice');
  });

  it('should refetch when userId input changes', () => {
    component.userId = 1;
    fixture.detectChanges(); // First init

    mockUserService.getUser.calls.reset();
    component.userId = 2;
    fixture.detectChanges(); // Triggers ngOnChanges with new value

    expect(mockUserService.getUser).toHaveBeenCalledWith(2);
  });

  it('should unsubscribe on destroy', () => {
    component.userId = 1;
    fixture.detectChanges();

    const destroySpy = spyOn(component['destroy$'], 'next');
    fixture.destroy(); // Triggers ngOnDestroy

    expect(destroySpy).toHaveBeenCalled();
  });
});
```

Test `ngAfterViewInit` for DOM access:

```typescript
it('should have ViewChild populated after view init', () => {
  component.userId = 1;
  fixture.detectChanges(); // Triggers full lifecycle including afterViewInit

  expect(component.profileCard).toBeTruthy();
  expect(component.profileCard.nativeElement).toBeInstanceOf(HTMLElement);
});
```
