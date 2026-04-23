---
id: angular-singleton-vs-scoped
layer1_parent: single-responsibility
angular_version: "14"
module: "@angular/core"
---

# Singleton vs Scoped Services

## How Angular Implements This

Angular's DI system provides three levels of service scope, each mapped to a different point in the injector hierarchy. Choosing the right scope is a design decision about the service's responsibility:

**Root-level singleton** (`providedIn: 'root'`) -- One instance for the entire application. Every component and service that injects it gets the same instance. This is the default for most services: HTTP clients, authentication, global state, logging.

**Module-level** (provided in a lazy-loaded module's `providers` array) -- One instance per lazy-loaded module. Components inside the lazy module share one instance, but it is separate from any instance in another module. This naturally scopes feature state to its feature.

**Component-level** (provided in a component's `providers` array) -- A new instance is created for every instance of that component. The instance is shared with the component's children in the DOM tree. When the component is destroyed, the service instance is garbage collected. This is for local, ephemeral state that belongs to a specific UI context.

The injector hierarchy determines which instance you get. When a component requests a service, Angular searches upward: component injector, then parent component injector, then module injector, then root injector. The first match wins. This means a component-level provider shadows a root-level provider of the same type.

## The Correct Way

### Root Singleton

```typescript
// === auth.service.ts ===
// Singleton: one instance manages authentication for the entire app.
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

export interface AuthUser {
  id: number;
  email: string;
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUser$ = new BehaviorSubject<AuthUser | null>(null);

  readonly user$: Observable<AuthUser | null> = this.currentUser$.asObservable();

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<AuthUser> {
    return this.http.post<AuthUser>('/api/auth/login', { email, password }).pipe(
      tap(user => this.currentUser$.next(user)),
    );
  }

  logout(): void {
    this.currentUser$.next(null);
    // ... clear tokens, redirect, etc.
  }

  isAuthenticated(): boolean {
    return this.currentUser$.value !== null;
  }
}
// Every component, guard, and interceptor gets the SAME AuthService instance.
// There is exactly one source of truth for "who is logged in."
```

### Module-scoped (Lazy Module)

```typescript
// === admin/admin-state.service.ts ===
// Scoped to the admin feature. Separate instance from any other module.
@Injectable()  // Note: NOT providedIn: 'root'. Provided in the module below.
export class AdminStateService {
  private selectedTab = 'users';
  private sidebarCollapsed = false;

  getSelectedTab(): string { return this.selectedTab; }
  setSelectedTab(tab: string): void { this.selectedTab = tab; }

  isSidebarCollapsed(): boolean { return this.sidebarCollapsed; }
  toggleSidebar(): void { this.sidebarCollapsed = !this.sidebarCollapsed; }
}

// === admin/admin.module.ts ===
@NgModule({
  declarations: [AdminDashboardComponent, AdminUsersComponent, AdminSettingsComponent],
  imports: [
    CommonModule,
    RouterModule.forChild([
      { path: '', component: AdminDashboardComponent },
      { path: 'users', component: AdminUsersComponent },
      { path: 'settings', component: AdminSettingsComponent },
    ]),
  ],
  providers: [
    AdminStateService,  // Scoped to this lazy module.
    // All components in the admin feature share one instance.
    // When the user navigates away and the module is destroyed,
    // the service instance is garbage collected.
    // If there were a separate "super-admin" lazy module that also
    // provided AdminStateService, it would get its own instance.
  ],
})
export class AdminModule {}
```

### Component-scoped

```typescript
// === form-state.service.ts ===
// Each form instance gets its own tracking service.
@Injectable()  // NOT providedIn -- will be provided at component level
export class FormStateService {
  private originalValues: Record<string, unknown> = {};
  private currentValues: Record<string, unknown> = {};

  initialize(values: Record<string, unknown>): void {
    this.originalValues = { ...values };
    this.currentValues = { ...values };
  }

  updateField(field: string, value: unknown): void {
    this.currentValues[field] = value;
  }

  isDirty(): boolean {
    return JSON.stringify(this.originalValues) !== JSON.stringify(this.currentValues);
  }

  getChanges(): Record<string, unknown> {
    const changes: Record<string, unknown> = {};
    for (const key of Object.keys(this.currentValues)) {
      if (this.currentValues[key] !== this.originalValues[key]) {
        changes[key] = this.currentValues[key];
      }
    }
    return changes;
  }

  reset(): void {
    this.currentValues = { ...this.originalValues };
  }
}

// === user-edit.component.ts ===
@Component({
  selector: 'app-user-edit',
  providers: [FormStateService],  // Each <app-user-edit> gets its own instance
  template: `
    <form>
      <input
        [value]="user.name"
        (input)="onNameChange($event)"
      />
      <input
        [value]="user.email"
        (input)="onEmailChange($event)"
      />
      <button [disabled]="!formState.isDirty()" (click)="save()">Save</button>
      <button (click)="formState.reset()">Reset</button>
    </form>
  `,
})
export class UserEditComponent implements OnInit {
  @Input() user!: { name: string; email: string };

  constructor(public formState: FormStateService) {}

  ngOnInit(): void {
    this.formState.initialize({ name: this.user.name, email: this.user.email });
  }

  onNameChange(event: Event): void {
    this.formState.updateField('name', (event.target as HTMLInputElement).value);
  }

  onEmailChange(event: Event): void {
    this.formState.updateField('email', (event.target as HTMLInputElement).value);
  }

  save(): void {
    const changes = this.formState.getChanges();
    // submit changes...
  }
}
```

```html
<!-- Two forms on the same page: each has its own FormStateService instance -->
<app-user-edit [user]="user1"></app-user-edit>
<app-user-edit [user]="user2"></app-user-edit>
<!-- Editing user1's form does NOT affect user2's dirty state -->
```

### Component-scoped Service Shared with Children

```typescript
// === wizard.service.ts ===
@Injectable()
export class WizardService {
  private steps: string[] = [];
  private currentStep = 0;

  setSteps(steps: string[]): void { this.steps = steps; }
  getCurrentStep(): number { return this.currentStep; }
  getStepName(): string { return this.steps[this.currentStep]; }
  next(): void { if (this.currentStep < this.steps.length - 1) this.currentStep++; }
  back(): void { if (this.currentStep > 0) this.currentStep--; }
  isFirst(): boolean { return this.currentStep === 0; }
  isLast(): boolean { return this.currentStep === this.steps.length - 1; }
}

// === checkout-wizard.component.ts ===
@Component({
  selector: 'app-checkout-wizard',
  providers: [WizardService],  // Instance for this wizard
  template: `
    <app-wizard-progress></app-wizard-progress>
    <app-wizard-step-content></app-wizard-step-content>
    <app-wizard-nav></app-wizard-nav>
  `,
})
export class CheckoutWizardComponent implements OnInit {
  constructor(private wizard: WizardService) {}

  ngOnInit(): void {
    this.wizard.setSteps(['Cart', 'Shipping', 'Payment', 'Review']);
  }
}

// === wizard-nav.component.ts ===
// Child component: receives the SAME WizardService instance from the parent.
// No providers array here -- it inherits from the parent's injector.
@Component({
  selector: 'app-wizard-nav',
  template: `
    <button [disabled]="wizard.isFirst()" (click)="wizard.back()">Back</button>
    <button [disabled]="wizard.isLast()" (click)="wizard.next()">Next</button>
  `,
})
export class WizardNavComponent {
  constructor(public wizard: WizardService) {}
  // This is the SAME instance that CheckoutWizardComponent has.
}
```

## The Anti-Pattern in Angular

The junior dev uses `providedIn: 'root'` for everything, even state that belongs to a specific feature or component. They end up with singleton services holding stale state from the last time a feature was visited.

```typescript
// DO NOT DO THIS -- singleton for local state
@Injectable({ providedIn: 'root' })  // Singleton -- lives forever
export class EditFormService {
  dirty = false;
  values: Record<string, unknown> = {};
}
// Problem: user edits Form A, navigates away, comes back --
// the service still has Form A's dirty state.
// Two forms on the same page share the same service instance.
```

```typescript
// DO NOT DO THIS -- component-scoped when you need a singleton
@Component({
  selector: 'app-header',
  providers: [AuthService],  // Creates a NEW AuthService for the header
  template: `<span>{{ authService.currentUser?.name }}</span>`,
})
export class HeaderComponent {
  constructor(public authService: AuthService) {}
}
// This AuthService is different from the one used by the login page.
// Logging in does not update the header because they are different instances.
```

```typescript
// DO NOT DO THIS -- providing a service in BOTH root and a module
@Injectable({ providedIn: 'root' })
export class CartService { ... }

@NgModule({
  providers: [CartService],  // Creates a SECOND instance in this module's injector
})
export class ShopModule {}
// Components in ShopModule get a different CartService than components outside it.
// Items added from outside ShopModule don't appear inside it.
```

## Common Mistakes

1. **Using `providedIn: 'root'` for feature-specific state.** If a service manages state for a specific page or feature (form state, wizard step, filter selections), it should be scoped to the component or lazy module, not the root. Root services persist for the entire application lifetime.

2. **Double-providing a service.** A service with `providedIn: 'root'` that is also listed in a module's `providers` array creates two instances. Angular does not warn about this. Symptoms: data set in one part of the app is invisible in another.

3. **Expecting component-scoped services to survive navigation.** When a component is destroyed (user navigates away), its component-scoped services are also destroyed. If you need state to persist across navigations, use a root or module-scoped service.

4. **Confusing module-level scope with lazy loading.** Module-level scoping only creates a separate injector for lazy-loaded modules. Eagerly imported modules share the root injector. If `AdminModule` is imported in `AppModule` (eager), providing `AdminStateService` in `AdminModule.providers` is effectively the same as `providedIn: 'root'`.

5. **Not knowing which instance you got.** When debugging, use `console.log(this.service === otherRef)` to verify instance identity, or add a random ID to the service constructor and log it.

## Testing This

Test that a singleton is truly shared:

```typescript
describe('AuthService singleton', () => {
  it('should return the same instance from TestBed', () => {
    TestBed.configureTestingModule({});

    const instance1 = TestBed.inject(AuthService);
    const instance2 = TestBed.inject(AuthService);

    expect(instance1).toBe(instance2);  // Same reference
  });
});
```

Test that component-scoped services are unique per component:

```typescript
describe('FormStateService (component-scoped)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UserEditComponent],
    }).compileComponents();
  });

  it('should create separate instances for each component', () => {
    const fixture1 = TestBed.createComponent(UserEditComponent);
    fixture1.componentInstance.user = { name: 'Alice', email: 'alice@test.com' };
    fixture1.detectChanges();

    const fixture2 = TestBed.createComponent(UserEditComponent);
    fixture2.componentInstance.user = { name: 'Bob', email: 'bob@test.com' };
    fixture2.detectChanges();

    const service1 = fixture1.debugElement.injector.get(FormStateService);
    const service2 = fixture2.debugElement.injector.get(FormStateService);

    // Different instances
    expect(service1).not.toBe(service2);

    // Modifying one doesn't affect the other
    service1.updateField('name', 'Changed');
    expect(service1.isDirty()).toBeTrue();
    expect(service2.isDirty()).toBeFalse();
  });
});
```

Test that children share the parent's component-scoped service:

```typescript
describe('WizardService shared with children', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CheckoutWizardComponent, WizardNavComponent, WizardProgressComponent, WizardStepContentComponent],
    }).compileComponents();
  });

  it('should provide same WizardService to parent and child', () => {
    const fixture = TestBed.createComponent(CheckoutWizardComponent);
    fixture.detectChanges();

    const parentService = fixture.debugElement.injector.get(WizardService);
    const childNav = fixture.debugElement.query(By.directive(WizardNavComponent));
    const childService = childNav.injector.get(WizardService);

    expect(parentService).toBe(childService);
  });
});
```

Test cleanup on component destruction:

```typescript
it('should lose state when component is destroyed', () => {
  const fixture = TestBed.createComponent(UserEditComponent);
  fixture.componentInstance.user = { name: 'Alice', email: 'alice@test.com' };
  fixture.detectChanges();

  const service = fixture.debugElement.injector.get(FormStateService);
  service.updateField('name', 'Modified');
  expect(service.isDirty()).toBeTrue();

  fixture.destroy();

  // Create a new instance -- it has fresh state
  const fixture2 = TestBed.createComponent(UserEditComponent);
  fixture2.componentInstance.user = { name: 'Bob', email: 'bob@test.com' };
  fixture2.detectChanges();

  const newService = fixture2.debugElement.injector.get(FormStateService);
  expect(newService.isDirty()).toBeFalse();
  expect(newService).not.toBe(service);
});
```
