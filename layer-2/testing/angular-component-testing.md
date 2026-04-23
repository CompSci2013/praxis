---
id: angular-component-testing
layer1_parent: integration-testing
angular_version: "14"
module: "@angular/core/testing"
---

# Component Testing

## How Angular Implements This

Angular component tests are integration tests by nature. You are testing the interaction between TypeScript class logic, the HTML template, Angular's change detection, and the dependency injection system. The key objects are:

- **ComponentFixture<T>** -- wraps the component instance and its host element. Gives you `detectChanges()`, access to the DOM, and lifecycle control.
- **DebugElement** -- Angular's abstraction over the DOM. Lets you query elements, read attributes, and trigger events without touching native browser APIs directly.
- **componentInstance** -- the actual component class instance. You read its properties and call its methods.

The testing flow is always: create fixture, set inputs, trigger change detection, query the DOM, assert.

## The Correct Way

```typescript
// greeting.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-greeting',
  template: `
    <h1 class="title">Hello, {{ name }}!</h1>
    <p *ngIf="showSubtitle" class="subtitle">Welcome back.</p>
    <button (click)="onDismiss()">Dismiss</button>
  `
})
export class GreetingComponent {
  @Input() name = 'World';
  @Input() showSubtitle = false;
  @Output() dismissed = new EventEmitter<void>();

  onDismiss(): void {
    this.dismissed.emit();
  }
}
```

```typescript
// greeting.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DebugElement } from '@angular/core';
import { GreetingComponent } from './greeting.component';

describe('GreetingComponent', () => {
  let fixture: ComponentFixture<GreetingComponent>;
  let component: GreetingComponent;
  let de: DebugElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GreetingComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(GreetingComponent);
    component = fixture.componentInstance;
    de = fixture.debugElement;
  });

  // --- Input testing ---
  it('should display the default name', () => {
    fixture.detectChanges();
    const title = de.query(By.css('.title')).nativeElement;
    expect(title.textContent).toContain('Hello, World!');
  });

  it('should display the provided name', () => {
    component.name = 'Alice';
    fixture.detectChanges();
    const title = de.query(By.css('.title')).nativeElement;
    expect(title.textContent).toContain('Hello, Alice!');
  });

  // --- Conditional rendering ---
  it('should not show subtitle by default', () => {
    fixture.detectChanges();
    const subtitle = de.query(By.css('.subtitle'));
    expect(subtitle).toBeNull();
  });

  it('should show subtitle when showSubtitle is true', () => {
    component.showSubtitle = true;
    fixture.detectChanges();
    const subtitle = de.query(By.css('.subtitle'));
    expect(subtitle).toBeTruthy();
    expect(subtitle.nativeElement.textContent).toContain('Welcome back.');
  });

  // --- Output testing ---
  it('should emit dismissed when button is clicked', () => {
    fixture.detectChanges();
    spyOn(component.dismissed, 'emit');

    const button = de.query(By.css('button'));
    button.triggerEventHandler('click', null);

    expect(component.dismissed.emit).toHaveBeenCalledTimes(1);
  });

  // --- Alternative: subscribe to the output ---
  it('should emit dismissed (subscribe approach)', (done) => {
    fixture.detectChanges();
    component.dismissed.subscribe(() => {
      expect(true).toBe(true);
      done();
    });

    const button = de.query(By.css('button'));
    button.triggerEventHandler('click', null);
  });
});
```

### Testing a component with dependencies

```typescript
// user-profile.component.ts
import { Component, OnInit } from '@angular/core';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-user-profile',
  template: `
    <div *ngIf="user" class="profile">
      <span class="user-name">{{ user.name }}</span>
    </div>
    <div *ngIf="error" class="error">{{ error }}</div>
  `
})
export class UserProfileComponent implements OnInit {
  user: { name: string } | null = null;
  error: string | null = null;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.userService.getCurrentUser().subscribe({
      next: (user) => this.user = user,
      error: (err) => this.error = err.message
    });
  }
}
```

```typescript
// user-profile.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { UserProfileComponent } from './user-profile.component';
import { UserService } from '../services/user.service';

describe('UserProfileComponent', () => {
  let fixture: ComponentFixture<UserProfileComponent>;
  let userServiceSpy: jasmine.SpyObj<UserService>;

  beforeEach(async () => {
    userServiceSpy = jasmine.createSpyObj('UserService', ['getCurrentUser']);

    await TestBed.configureTestingModule({
      declarations: [UserProfileComponent],
      providers: [
        { provide: UserService, useValue: userServiceSpy }
      ]
    }).compileComponents();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(UserProfileComponent);
  }

  it('should display user name on success', () => {
    userServiceSpy.getCurrentUser.and.returnValue(
      of({ name: 'Alice' })
    );
    createComponent();
    fixture.detectChanges();  // triggers ngOnInit

    const nameEl = fixture.debugElement.query(By.css('.user-name'));
    expect(nameEl.nativeElement.textContent).toContain('Alice');
  });

  it('should display error message on failure', () => {
    userServiceSpy.getCurrentUser.and.returnValue(
      throwError(() => new Error('Network failure'))
    );
    createComponent();
    fixture.detectChanges();

    const errorEl = fixture.debugElement.query(By.css('.error'));
    expect(errorEl.nativeElement.textContent).toContain('Network failure');
  });
});
```

## The Anti-Pattern in Angular

**Testing the component class in isolation without the template.**

```typescript
// WRONG -- this skips the entire point of component testing
it('should set name', () => {
  const component = new GreetingComponent();
  component.name = 'Alice';
  expect(component.name).toBe('Alice');
  // Congratulations, you tested a JavaScript property assignment.
  // You proved nothing about whether the template renders it,
  // whether *ngIf works, whether the binding is correct.
});
```

**Using `nativeElement.click()` instead of `triggerEventHandler()`.**

```typescript
// FRAGILE -- depends on browser event propagation
button.nativeElement.click();
fixture.detectChanges();

// BETTER -- uses Angular's event system directly
button.triggerEventHandler('click', null);
fixture.detectChanges();
// triggerEventHandler invokes the event binding directly, without
// depending on browser event bubbling or zone.js patching.
```

**Querying by tag name when you mean to query by test attribute.**

```typescript
// BRITTLE -- breaks when you wrap the button in a div, or add another button
const button = de.query(By.css('button'));

// STABLE -- add a data attribute for testing
// template: <button data-testid="dismiss-btn" (click)="onDismiss()">
const button = de.query(By.css('[data-testid="dismiss-btn"]'));
```

## Common Mistakes

1. **Forgetting `detectChanges()` after changing inputs**: Setting `component.name = 'Alice'` does nothing to the DOM until you call `fixture.detectChanges()`. The test passes with the old value and you spend 30 minutes confused.

2. **Querying before `detectChanges()`**: The template has not rendered yet. `de.query(By.css('.title'))` returns `null` and you get `TypeError: Cannot read properties of null`.

3. **Testing child components you did not declare**: If your template contains `<app-child-widget>` and you did not add `ChildWidgetComponent` to `declarations`, you get `'app-child-widget' is not a known element`. Options:
   - Add it to declarations (now you are testing it too)
   - Use `schemas: [NO_ERRORS_SCHEMA]` to ignore unknown elements (recommended for unit tests)
   - Create a stub component with the same selector

4. **Not testing the error/empty/loading states**: Junior devs test the happy path and skip the `*ngIf="error"` branch, the `*ngIf="loading"` spinner, and the empty list case. These are the states that break in production.

5. **Asserting exact text content with `toBe` instead of `toContain`**: Angular may add whitespace around interpolated values. `expect(el.textContent).toBe('Hello, Alice!')` fails because the actual content is `' Hello, Alice! '`.

## Testing This

The pattern for every component test:

```typescript
// 1. Arrange: set up TestBed, configure spy return values
userServiceSpy.getCurrentUser.and.returnValue(of({ name: 'Alice' }));

// 2. Act: create fixture, trigger lifecycle
fixture = TestBed.createComponent(UserProfileComponent);
fixture.detectChanges();

// 3. Assert: query DOM, verify rendered state
const el = fixture.debugElement.query(By.css('.user-name'));
expect(el.nativeElement.textContent).toContain('Alice');

// 4. Interact: trigger events
const button = fixture.debugElement.query(By.css('button'));
button.triggerEventHandler('click', null);
fixture.detectChanges();

// 5. Assert again: verify DOM changed
expect(component.dismissed.emit).toHaveBeenCalled();
```
