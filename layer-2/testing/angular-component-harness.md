---
id: angular-component-harness
layer1_parent: test-boundaries
angular_version: "14"
module: "@angular/cdk/testing"
---

# Component Harness

## How Angular Implements This

A ComponentHarness is the page object pattern implemented as a first-class Angular CDK concept. Instead of each test directly querying the DOM with `By.css('.submit-btn')`, you create a harness class that encapsulates how to interact with a component. Tests call `await harness.clickSubmit()` instead of knowing that the submit button has class `.submit-btn`.

The benefit is isolation of DOM structure from test logic. When you refactor a component's template (rename a CSS class, wrap elements in a new div, change from `<button>` to `<a>`), you update the harness once and all tests continue to pass.

Angular Material ships harnesses for every Material component (`MatButtonHarness`, `MatInputHarness`, `MatSelectHarness`, etc.). You can and should write harnesses for your own components.

Harnesses work in two environments:
- **Unit tests** via `TestbedHarnessEnvironment` -- runs in Karma/Jest
- **E2E tests** via `ProtractorHarnessEnvironment` -- same harness, same API, different environment

The key classes:
- `ComponentHarness` -- base class you extend
- `HarnessPredicate` -- filter harnesses by properties (label text, disabled state)
- `TestElement` -- abstraction over DOM elements (supports `click()`, `text()`, `getAttribute()`)
- `HarnessLoader` -- loads harnesses from a host element

## The Correct Way

### Writing a harness for your component

```typescript
// confirm-dialog.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  template: `
    <div class="dialog-overlay">
      <div class="dialog-content">
        <h2 class="dialog-title">{{ title }}</h2>
        <p class="dialog-message">{{ message }}</p>
        <div class="dialog-actions">
          <button class="cancel-btn" (click)="onCancel()">{{ cancelText }}</button>
          <button class="confirm-btn"
                  [disabled]="confirmDisabled"
                  (click)="onConfirm()">
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class ConfirmDialogComponent {
  @Input() title = 'Confirm';
  @Input() message = '';
  @Input() confirmText = 'OK';
  @Input() cancelText = 'Cancel';
  @Input() confirmDisabled = false;
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  onConfirm(): void { this.confirmed.emit(); }
  onCancel(): void { this.cancelled.emit(); }
}
```

```typescript
// confirm-dialog.harness.ts
import { ComponentHarness, HarnessPredicate } from '@angular/cdk/testing';

export interface ConfirmDialogHarnessFilters {
  title?: string | RegExp;
}

export class ConfirmDialogHarness extends ComponentHarness {
  // The CSS selector that identifies the host element of this component
  static hostSelector = 'app-confirm-dialog';

  // Locators -- lazy references to DOM elements within the component
  private getTitleEl = this.locatorFor('.dialog-title');
  private getMessageEl = this.locatorFor('.dialog-message');
  private getConfirmBtn = this.locatorFor('.confirm-btn');
  private getCancelBtn = this.locatorFor('.cancel-btn');

  /**
   * Factory method that returns a HarnessPredicate for filtering.
   * Allows: loader.getHarness(ConfirmDialogHarness.with({ title: 'Delete?' }))
   */
  static with(
    options: ConfirmDialogHarnessFilters = {}
  ): HarnessPredicate<ConfirmDialogHarness> {
    return new HarnessPredicate(ConfirmDialogHarness, options)
      .addOption('title', options.title, async (harness, title) => {
        const actualTitle = await harness.getTitle();
        return HarnessPredicate.stringMatches(actualTitle, title);
      });
  }

  /** Get the dialog title text. */
  async getTitle(): Promise<string> {
    const el = await this.getTitleEl();
    return el.text();
  }

  /** Get the dialog message text. */
  async getMessage(): Promise<string> {
    const el = await this.getMessageEl();
    return el.text();
  }

  /** Get the confirm button text. */
  async getConfirmText(): Promise<string> {
    const el = await this.getConfirmBtn();
    return el.text();
  }

  /** Check if the confirm button is disabled. */
  async isConfirmDisabled(): Promise<boolean> {
    const el = await this.getConfirmBtn();
    return (await el.getAttribute('disabled')) !== null;
  }

  /** Click the confirm button. */
  async confirm(): Promise<void> {
    const btn = await this.getConfirmBtn();
    return btn.click();
  }

  /** Click the cancel button. */
  async cancel(): Promise<void> {
    const btn = await this.getCancelBtn();
    return btn.click();
  }
}
```

### Using the harness in tests

```typescript
// confirm-dialog.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { HarnessLoader } from '@angular/cdk/testing';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { ConfirmDialogHarness } from './confirm-dialog.harness';

describe('ConfirmDialogComponent (via harness)', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let loader: HarnessLoader;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ConfirmDialogComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.componentInstance.title = 'Delete item?';
    fixture.componentInstance.message = 'This action cannot be undone.';
    fixture.detectChanges();

    // Create a HarnessLoader rooted at the fixture's host element
    loader = TestbedHarnessEnvironment.loader(fixture);
  });

  it('should display the title', async () => {
    const harness = await loader.getHarness(ConfirmDialogHarness);
    expect(await harness.getTitle()).toBe('Delete item?');
  });

  it('should display the message', async () => {
    const harness = await loader.getHarness(ConfirmDialogHarness);
    expect(await harness.getMessage()).toBe('This action cannot be undone.');
  });

  it('should emit confirmed when confirm is clicked', async () => {
    spyOn(fixture.componentInstance.confirmed, 'emit');
    const harness = await loader.getHarness(ConfirmDialogHarness);

    await harness.confirm();

    expect(fixture.componentInstance.confirmed.emit).toHaveBeenCalledTimes(1);
  });

  it('should report disabled state', async () => {
    fixture.componentInstance.confirmDisabled = true;
    fixture.detectChanges();

    const harness = await loader.getHarness(ConfirmDialogHarness);
    expect(await harness.isConfirmDisabled()).toBe(true);
  });
});
```

### Using Material harnesses

```typescript
// login-form.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { HarnessLoader } from '@angular/cdk/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ReactiveFormsModule } from '@angular/forms';
import { LoginFormComponent } from './login-form.component';

describe('LoginFormComponent (Material harnesses)', () => {
  let fixture: ComponentFixture<LoginFormComponent>;
  let loader: HarnessLoader;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        MatInputModule,
        MatButtonModule,
        NoopAnimationsModule  // Required: skip Material animations in tests
      ],
      declarations: [LoginFormComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginFormComponent);
    fixture.detectChanges();
    loader = TestbedHarnessEnvironment.loader(fixture);
  });

  it('should fill in the email field', async () => {
    // Find the input harness by its placeholder or label
    const emailInput = await loader.getHarness(
      MatInputHarness.with({ placeholder: 'Email' })
    );
    await emailInput.setValue('alice@example.com');
    expect(await emailInput.getValue()).toBe('alice@example.com');
  });

  it('should click the submit button', async () => {
    const submitBtn = await loader.getHarness(
      MatButtonHarness.with({ text: 'Log In' })
    );
    await submitBtn.click();
    // assert component state after click
  });

  it('should find all inputs', async () => {
    const inputs = await loader.getAllHarnesses(MatInputHarness);
    expect(inputs.length).toBe(2);  // email and password
  });
});
```

## The Anti-Pattern in Angular

**Querying DOM details directly in every test.**

```typescript
// WRONG -- every test knows the internal DOM structure
it('should show title', () => {
  const el = fixture.debugElement.query(By.css('.dialog-content > h2.dialog-title'));
  expect(el.nativeElement.textContent).toBe('Delete?');
});

it('should click confirm', () => {
  const btn = fixture.debugElement.query(
    By.css('.dialog-actions > button.confirm-btn:not([disabled])')
  );
  btn.triggerEventHandler('click', null);
});
// If you rename .dialog-title to .heading, EVERY test breaks.
// With a harness, you update one line in the harness and zero tests change.
```

**Writing harnesses that expose internal state.**

```typescript
// WRONG -- the harness should not expose implementation details
export class BadDialogHarness extends ComponentHarness {
  static hostSelector = 'app-confirm-dialog';

  async getOverlayDiv(): Promise<TestElement> {
    return this.locatorFor('.dialog-overlay')();
  }

  async getContentDiv(): Promise<TestElement> {
    return this.locatorFor('.dialog-content')();
  }
  // These expose CSS classes that are layout implementation details.
  // A harness should expose semantic actions: getTitle, confirm, cancel.
}
```

## Common Mistakes

1. **Forgetting `NoopAnimationsModule`**: Material components use animations. Without `NoopAnimationsModule`, tests either fail with missing animation errors or run slowly waiting for animations to complete.

2. **Using `loader.getHarness()` when the element might not exist**: `getHarness()` throws if no matching harness is found. Use `loader.getHarnessOrNull()` when testing that something is absent:
   ```typescript
   const dialog = await loader.getHarnessOrNull(ConfirmDialogHarness);
   expect(dialog).toBeNull();  // Dialog not rendered
   ```

3. **Forgetting that harness methods are async**: Every harness method returns a Promise. If you forget `await`, the assertion runs against the Promise object and passes vacuously:
   ```typescript
   // WRONG -- compares a Promise to a string, always passes (truthy)
   expect(harness.getTitle()).toBe('Delete?');

   // RIGHT
   expect(await harness.getTitle()).toBe('Delete?');
   ```

4. **Not scoping the loader**: If your component contains child components, `loader.getHarness()` searches the entire subtree. Use `loader.getChildLoader('.specific-section')` to narrow the scope:
   ```typescript
   const actionsLoader = await loader.getChildLoader('.dialog-actions');
   const confirmBtn = await actionsLoader.getHarness(MatButtonHarness);
   ```

5. **Creating harnesses for trivial components**: A harness for a component with one static text element and no interactions is overhead. Harnesses pay off when the component has complex DOM structure, multiple interactive elements, or is reused across many test files.

## Testing This

Test your harness itself with a dedicated spec:

```typescript
describe('ConfirmDialogHarness', () => {
  // ... standard TestBed setup ...

  it('should find harness by title filter', async () => {
    fixture.componentInstance.title = 'Delete?';
    fixture.detectChanges();

    const harness = await loader.getHarness(
      ConfirmDialogHarness.with({ title: 'Delete?' })
    );
    expect(harness).toBeTruthy();
  });

  it('should not find harness with wrong title', async () => {
    fixture.componentInstance.title = 'Delete?';
    fixture.detectChanges();

    const harness = await loader.getHarnessOrNull(
      ConfirmDialogHarness.with({ title: 'Save?' })
    );
    expect(harness).toBeNull();
  });

  it('should support regex title filter', async () => {
    fixture.componentInstance.title = 'Delete item #42?';
    fixture.detectChanges();

    const harness = await loader.getHarness(
      ConfirmDialogHarness.with({ title: /Delete item/ })
    );
    expect(await harness.getTitle()).toBe('Delete item #42?');
  });
});
```
