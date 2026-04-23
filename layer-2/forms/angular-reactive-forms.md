---
id: angular-reactive-forms
layer1_parent: controlled-vs-uncontrolled
angular_version: "14"
module: "@angular/forms"
---

# Angular Reactive Forms

## How Angular Implements This

Angular provides two form paradigms: **template-driven** (uncontrolled — the template owns the form state) and **reactive** (controlled — the component class owns the form state). Reactive forms are the correct choice for any non-trivial form.

In reactive forms, you build the form model explicitly in the component class using `FormGroup`, `FormControl`, and `FormArray`. The template binds to this model using `[formGroup]`, `formControlName`, and `formArrayName` directives. The component class has complete programmatic control: it can set values, listen to changes, add validators, and manipulate the form structure — all in TypeScript, all testable without the DOM.

`FormBuilder` is a convenience service that reduces boilerplate. Instead of `new FormGroup({ name: new FormControl('', Validators.required) })`, you write `fb.group({ name: ['', Validators.required] })`.

Angular 14 introduced **typed forms** — `FormGroup`, `FormControl`, and `FormArray` are now generic. `fb.group({ name: [''] })` produces a `FormGroup<{ name: FormControl<string | null> }>`. This catches type errors at compile time.

## The Correct Way

```typescript
// user-form.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';

interface UserForm {
  name: FormControl<string>;
  email: FormControl<string>;
  age: FormControl<number | null>;
  address: FormGroup<{
    street: FormControl<string>;
    city: FormControl<string>;
    zip: FormControl<string>;
  }>;
}

@Component({
  selector: 'app-user-form',
  templateUrl: './user-form.component.html'
})
export class UserFormComponent implements OnInit {
  userForm!: FormGroup<UserForm>;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.userForm = this.fb.group({
      name: this.fb.nonNullable.control('', [
        Validators.required,
        Validators.minLength(2)
      ]),
      email: this.fb.nonNullable.control('', [
        Validators.required,
        Validators.email
      ]),
      age: this.fb.control<number | null>(null, [
        Validators.min(0),
        Validators.max(150)
      ]),
      address: this.fb.group({
        street: this.fb.nonNullable.control('', Validators.required),
        city: this.fb.nonNullable.control('', Validators.required),
        zip: this.fb.nonNullable.control('', [
          Validators.required,
          Validators.pattern(/^\d{5}(-\d{4})?$/)
        ])
      })
    });
  }

  onSubmit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();  // Show validation errors
      return;
    }

    const formValue = this.userForm.getRawValue();
    // formValue is fully typed: { name: string, email: string, age: number | null, address: { ... } }
    this.saveUser(formValue);
  }

  private saveUser(data: any): void {
    // HTTP call
  }
}
```

```html
<!-- user-form.component.html -->
<form [formGroup]="userForm" (ngSubmit)="onSubmit()">
  <div>
    <label for="name">Name</label>
    <input id="name" formControlName="name">
    <div *ngIf="userForm.controls.name.touched && userForm.controls.name.errors">
      <span *ngIf="userForm.controls.name.errors?.['required']">Name is required.</span>
      <span *ngIf="userForm.controls.name.errors?.['minlength']">
        Name must be at least 2 characters.
      </span>
    </div>
  </div>

  <div>
    <label for="email">Email</label>
    <input id="email" formControlName="email" type="email">
    <div *ngIf="userForm.controls.email.touched && userForm.controls.email.errors">
      <span *ngIf="userForm.controls.email.errors?.['required']">Email is required.</span>
      <span *ngIf="userForm.controls.email.errors?.['email']">Invalid email format.</span>
    </div>
  </div>

  <div>
    <label for="age">Age</label>
    <input id="age" formControlName="age" type="number">
  </div>

  <!-- Nested FormGroup -->
  <fieldset formGroupName="address">
    <legend>Address</legend>
    <div>
      <label for="street">Street</label>
      <input id="street" formControlName="street">
    </div>
    <div>
      <label for="city">City</label>
      <input id="city" formControlName="city">
    </div>
    <div>
      <label for="zip">ZIP Code</label>
      <input id="zip" formControlName="zip">
    </div>
  </fieldset>

  <button type="submit" [disabled]="userForm.invalid">Save</button>
</form>
```

```typescript
// Listening to form value changes reactively
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-filter-form',
  template: `
    <form [formGroup]="filterForm">
      <input formControlName="search" placeholder="Search...">
      <select formControlName="category">
        <option value="">All</option>
        <option value="electronics">Electronics</option>
        <option value="books">Books</option>
      </select>
    </form>
  `
})
export class FilterFormComponent implements OnInit, OnDestroy {
  filterForm!: FormGroup;
  private destroy$ = new Subject<void>();

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.filterForm = this.fb.group({
      search: [''],
      category: ['']
    });

    // React to any form change
    this.filterForm.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      takeUntil(this.destroy$)
    ).subscribe(filters => {
      this.applyFilters(filters);
    });

    // React to a single control change
    this.filterForm.controls['category'].valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(category => {
      this.onCategoryChange(category);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

## The Anti-Pattern in Angular

```typescript
// WRONG: Template-driven form for complex logic
@Component({
  template: `
    <form #f="ngForm" (ngSubmit)="save(f.value)">
      <input name="email" [(ngModel)]="user.email" required email>
      <input name="name" [(ngModel)]="user.name" required>
      <!-- How do you add cross-field validation? Async validation?
           Dynamic fields? Conditional validators? It's all in the template
           with no TypeScript access. -->
    </form>
  `
})
export class TemplateFormComponent {
  user = { name: '', email: '' };
  save(value: any) { /* untyped, untestable */ }
}
// Template-driven forms are acceptable for simple login forms.
// For anything with validation logic, dynamic fields, or complex state, use reactive forms.

// WRONG: Mixing reactive and template-driven
@Component({
  template: `
    <form [formGroup]="myForm">
      <input formControlName="name">
      <input [(ngModel)]="otherValue" name="other">  <!-- MIXING! -->
    </form>
  `
})
// Angular throws a warning: "It looks like you're using ngModel on the same form as formGroup."
// This is unsupported and leads to unpredictable behavior.

// WRONG: Manipulating the DOM directly instead of the form model
document.getElementById('name')!.value = 'John';  // Does NOT update the FormControl
// The FormControl still has the old value. The form is invalid. Validation doesn't trigger.
// Always use: this.userForm.controls.name.setValue('John');
```

## Common Mistakes

1. **Forgetting to import `ReactiveFormsModule`**: Reactive forms require `ReactiveFormsModule` in the module's `imports` array. Without it, `formGroup` and `formControlName` directives are not recognized. The error is: `Can't bind to 'formGroup' since it isn't a known property of 'form'`. Template-driven forms use `FormsModule` — they are different modules.

2. **`setValue` vs `patchValue`**: `setValue` requires you to provide values for ALL controls in the group — omitting one throws an error. `patchValue` updates only the controls you specify. Use `patchValue` when loading partial data (e.g., from an API response that doesn't include all fields).

3. **Typed forms gotcha — `null`**: In Angular 14 typed forms, `FormControl<string>` can be reset to `null` unless you use `nonNullable: true` (or `fb.nonNullable.control()`). After `form.reset()`, a nullable control's value is `null`, not the initial value. Use `nonNullable` for controls that should never be null.

4. **Validation errors shown before user interaction**: Validation errors are present from the moment the form is created (if the initial value is invalid). Don't show errors until the user has touched the control: `*ngIf="control.touched && control.errors"`. Call `markAllAsTouched()` on submit to show all errors at once.

5. **Not disabling the submit button properly**: `[disabled]="form.invalid"` prevents submission but gives no feedback. Better: allow submission, call `markAllAsTouched()` in the handler if invalid, and show all validation messages. This way the user sees what's wrong.

## Testing This

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { UserFormComponent } from './user-form.component';

describe('UserFormComponent', () => {
  let component: UserFormComponent;
  let fixture: ComponentFixture<UserFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      declarations: [UserFormComponent]
    });
    fixture = TestBed.createComponent(UserFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create form with initial values', () => {
    expect(component.userForm.controls.name.value).toBe('');
    expect(component.userForm.controls.email.value).toBe('');
  });

  it('should be invalid when empty', () => {
    expect(component.userForm.valid).toBeFalse();
  });

  it('should be valid when all required fields are filled', () => {
    component.userForm.patchValue({
      name: 'Alice',
      email: 'alice@example.com',
      address: { street: '123 Main St', city: 'Springfield', zip: '12345' }
    });
    expect(component.userForm.valid).toBeTrue();
  });

  it('should show email validation error for invalid email', () => {
    const emailControl = component.userForm.controls.email;
    emailControl.setValue('not-an-email');
    expect(emailControl.errors?.['email']).toBeTruthy();
  });

  it('should validate zip code pattern', () => {
    const zipControl = component.userForm.controls.address.controls.zip;
    zipControl.setValue('abc');
    expect(zipControl.errors?.['pattern']).toBeTruthy();

    zipControl.setValue('12345');
    expect(zipControl.errors).toBeNull();
  });
});
```

Reactive forms are highly testable because the form model lives in the component class. No DOM manipulation needed — set values with `setValue`/`patchValue`, read validity with `.valid`, read errors with `.errors`. This is one of the key advantages over template-driven forms, where testing requires rendering the template and querying the DOM.
