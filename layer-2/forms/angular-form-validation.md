---
id: angular-form-validation
layer1_parent: validation-strategies
angular_version: "14"
module: "@angular/forms"
---

# Angular Form Validation

## How Angular Implements This

Angular's validation system operates on `AbstractControl` — the base class for `FormControl`, `FormGroup`, and `FormArray`. Validators are functions that receive a control and return either `null` (valid) or a `ValidationErrors` object (a key-value map of error names to error details).

Three types of validators:

1. **Built-in validators**: `Validators.required`, `Validators.email`, `Validators.minLength(n)`, `Validators.maxLength(n)`, `Validators.min(n)`, `Validators.max(n)`, `Validators.pattern(regex)`.
2. **Custom sync validators**: Functions of type `ValidatorFn` — `(control: AbstractControl) => ValidationErrors | null`. Run synchronously on every value change.
3. **Custom async validators**: Functions of type `AsyncValidatorFn` — `(control: AbstractControl) => Observable<ValidationErrors | null> | Promise<ValidationErrors | null>`. Run after sync validators pass. Typical use: checking uniqueness against an API.

Validators are attached to controls at creation time or added later with `setValidators()`. Angular runs sync validators first; if they all pass, async validators run. The control's `status` is `VALID`, `INVALID`, or `PENDING` (while async validators are running).

Cross-field validation (e.g., "password must match confirm password") is applied at the `FormGroup` level, not on individual controls.

## The Correct Way

```typescript
// Custom sync validator — reusable function
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Factory function pattern — configurable validators
export function forbiddenValueValidator(forbidden: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null;  // Don't validate empty — let Validators.required handle that
    }
    const isForbidden = control.value.toLowerCase() === forbidden.toLowerCase();
    return isForbidden ? { forbiddenValue: { value: control.value, forbidden } } : null;
  };
}

// Validator that checks format
export function strongPasswordValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;
    if (!value) return null;

    const errors: ValidationErrors = {};

    if (!/[A-Z]/.test(value)) {
      errors['missingUppercase'] = true;
    }
    if (!/[a-z]/.test(value)) {
      errors['missingLowercase'] = true;
    }
    if (!/[0-9]/.test(value)) {
      errors['missingDigit'] = true;
    }
    if (value.length < 8) {
      errors['tooShort'] = { requiredLength: 8, actualLength: value.length };
    }

    return Object.keys(errors).length > 0 ? errors : null;
  };
}
```

```typescript
// Custom async validator — check uniqueness against API
import { Injectable } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { map, catchError, debounceTime, switchMap, first } from 'rxjs/operators';
import { UserService } from '../services/user.service';

@Injectable({ providedIn: 'root' })
export class UniqueEmailValidator {
  constructor(private userService: UserService) {}

  validate(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value) {
        return of(null);
      }

      return control.valueChanges.pipe(
        debounceTime(400),       // Wait for user to stop typing
        switchMap(value =>        // Cancel previous API call
          this.userService.checkEmailExists(value)
        ),
        map(exists => exists ? { emailTaken: true } : null),
        catchError(() => of(null)),  // Don't block the form on API errors
        first()                   // Complete after first result — required for async validators
      );
    };
  }
}
```

```typescript
// Cross-field validator — applied at FormGroup level
export function passwordMatchValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;

    if (!password || !confirm) {
      return null;  // Let required validators handle empty fields
    }

    return password === confirm ? null : { passwordMismatch: true };
  };
}
```

```typescript
// Registration form using all validation types
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forbiddenValueValidator, strongPasswordValidator, passwordMatchValidator } from '../validators';
import { UniqueEmailValidator } from '../validators/unique-email.validator';

@Component({
  selector: 'app-registration',
  templateUrl: './registration.component.html'
})
export class RegistrationComponent implements OnInit {
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private uniqueEmail: UniqueEmailValidator
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      username: ['', [
        Validators.required,
        Validators.minLength(3),
        forbiddenValueValidator('admin')     // Custom sync validator
      ]],
      email: ['',
        [Validators.required, Validators.email],  // Sync validators (2nd arg)
        [this.uniqueEmail.validate()]              // Async validators (3rd arg)
      ],
      passwords: this.fb.group({
        password: ['', [Validators.required, strongPasswordValidator()]],
        confirmPassword: ['', Validators.required]
      }, {
        validators: [passwordMatchValidator()]     // Cross-field on the sub-group
      })
    });
  }

  get emailPending(): boolean {
    return this.form.controls['email'].status === 'PENDING';
  }
}
```

```html
<!-- registration.component.html -->
<form [formGroup]="form" (ngSubmit)="onSubmit()">
  <div>
    <label for="username">Username</label>
    <input id="username" formControlName="username">
    <div *ngIf="form.controls['username'].touched && form.controls['username'].errors as errors">
      <span *ngIf="errors['required']">Username is required.</span>
      <span *ngIf="errors['minlength']">
        Minimum {{ errors['minlength'].requiredLength }} characters
        (you typed {{ errors['minlength'].actualLength }}).
      </span>
      <span *ngIf="errors['forbiddenValue']">
        "{{ errors['forbiddenValue'].forbidden }}" is not allowed.
      </span>
    </div>
  </div>

  <div>
    <label for="email">Email</label>
    <input id="email" formControlName="email">
    <span *ngIf="emailPending" class="hint">Checking availability...</span>
    <div *ngIf="form.controls['email'].touched && form.controls['email'].errors as errors">
      <span *ngIf="errors['required']">Email is required.</span>
      <span *ngIf="errors['email']">Invalid email format.</span>
      <span *ngIf="errors['emailTaken']">This email is already registered.</span>
    </div>
  </div>

  <fieldset formGroupName="passwords">
    <div>
      <label for="password">Password</label>
      <input id="password" formControlName="password" type="password">
      <div *ngIf="form.get('passwords.password')?.touched && form.get('passwords.password')?.errors as errors">
        <span *ngIf="errors['required']">Password is required.</span>
        <span *ngIf="errors['missingUppercase']">Must contain an uppercase letter.</span>
        <span *ngIf="errors['missingLowercase']">Must contain a lowercase letter.</span>
        <span *ngIf="errors['missingDigit']">Must contain a digit.</span>
        <span *ngIf="errors['tooShort']">Must be at least {{ errors['tooShort'].requiredLength }} characters.</span>
      </div>
    </div>

    <div>
      <label for="confirm">Confirm Password</label>
      <input id="confirm" formControlName="confirmPassword" type="password">
    </div>

    <!-- Cross-field error is on the FormGroup, not on individual controls -->
    <div *ngIf="form.get('passwords')?.errors?.['passwordMismatch']
                && form.get('passwords.confirmPassword')?.touched">
      <span>Passwords do not match.</span>
    </div>
  </fieldset>

  <button type="submit" [disabled]="form.invalid || form.pending">Register</button>
</form>
```

## The Anti-Pattern in Angular

```typescript
// WRONG: Validation logic in the submit handler
onSubmit(): void {
  if (!this.form.value.email.includes('@')) {
    this.emailError = 'Invalid email';  // Manual error tracking
    return;
  }
  if (this.form.value.password.length < 8) {
    this.passwordError = 'Too short';
    return;
  }
  // Duplicates what Validators.email and Validators.minLength already do.
  // These manual checks don't update control.errors, don't integrate with
  // form.valid, and must be manually cleared on each keystroke.
}

// WRONG: Async validator without debounce
validate(): AsyncValidatorFn {
  return (control: AbstractControl) => {
    return this.http.get(`/api/check-email?email=${control.value}`).pipe(
      map(exists => exists ? { taken: true } : null)
    );
  };
}
// Fires an HTTP request on EVERY keystroke. Typing "user@example.com" fires 16 requests.
// Add debounceTime and switchMap.

// WRONG: Cross-field validation on individual controls
this.fb.group({
  password: ['', [Validators.required, this.matchConfirmValidator]],
  confirmPassword: ['', Validators.required]
});
// The password validator can't access confirmPassword's value because
// it only receives its own FormControl, not the parent FormGroup.
// Cross-field validators must be applied to the group.
```

## Common Mistakes

1. **Async validator as second argument**: `FormControl` constructor takes sync validators as the second argument and async validators as the third. Putting an async validator in the sync position causes cryptic errors because Angular calls it synchronously and gets an Observable instead of `ValidationErrors | null`.

2. **Async validator observable must complete**: If the async validator returns an observable that never completes, the control stays in `PENDING` status forever. HTTP calls complete naturally, but if you derive from a `BehaviorSubject` or store selector, pipe through `first()` or `take(1)`.

3. **Cross-field validator access**: A validator applied to a `FormGroup` receives the group as its `AbstractControl` argument. Use `group.get('fieldName')` to access child controls. If you apply it to a `FormControl`, `group.get('fieldName')` returns `null`.

4. **`updateOn` timing**: By default, validators run on every `change` event (every keystroke). For expensive validators (async API calls), set `updateOn: 'blur'` on the control: `fb.control('', { validators: [Validators.required], updateOn: 'blur' })`. This runs validators only when the field loses focus.

5. **Error display before touching**: Show errors only when `control.touched` is true (user has interacted with the field) or after the first submit attempt. Showing errors on a pristine form is hostile UX.

## Testing This

```typescript
import { FormControl } from '@angular/forms';
import { forbiddenValueValidator, strongPasswordValidator } from './validators';

describe('forbiddenValueValidator', () => {
  it('should return null for non-forbidden value', () => {
    const validator = forbiddenValueValidator('admin');
    const control = new FormControl('alice');
    expect(validator(control)).toBeNull();
  });

  it('should return error for forbidden value (case insensitive)', () => {
    const validator = forbiddenValueValidator('admin');
    const control = new FormControl('Admin');
    expect(validator(control)).toEqual({
      forbiddenValue: { value: 'Admin', forbidden: 'admin' }
    });
  });

  it('should return null for empty value', () => {
    const validator = forbiddenValueValidator('admin');
    const control = new FormControl('');
    expect(validator(control)).toBeNull();
  });
});

describe('strongPasswordValidator', () => {
  const validator = strongPasswordValidator();

  it('should pass for strong password', () => {
    expect(validator(new FormControl('Abcdef1!'))).toBeNull();
  });

  it('should fail for missing uppercase', () => {
    const result = validator(new FormControl('abcdef1!'));
    expect(result?.['missingUppercase']).toBeTrue();
  });

  it('should report multiple failures', () => {
    const result = validator(new FormControl('abc'));
    expect(result?.['missingUppercase']).toBeTrue();
    expect(result?.['missingDigit']).toBeTrue();
    expect(result?.['tooShort']).toBeTruthy();
  });
});

// Testing async validators
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { UniqueEmailValidator } from './unique-email.validator';
import { UserService } from '../services/user.service';

describe('UniqueEmailValidator', () => {
  let validator: UniqueEmailValidator;
  let userService: jasmine.SpyObj<UserService>;

  beforeEach(() => {
    userService = jasmine.createSpyObj('UserService', ['checkEmailExists']);
    TestBed.configureTestingModule({
      providers: [
        UniqueEmailValidator,
        { provide: UserService, useValue: userService }
      ]
    });
    validator = TestBed.inject(UniqueEmailValidator);
  });

  it('should return null for available email', (done) => {
    userService.checkEmailExists.and.returnValue(of(false));
    const control = new FormControl('new@example.com');
    const fn = validator.validate();

    (fn(control) as Observable<any>).subscribe(result => {
      expect(result).toBeNull();
      done();
    });
    control.setValue('new@example.com');  // Trigger valueChanges
  });

  it('should return error for taken email', (done) => {
    userService.checkEmailExists.and.returnValue(of(true));
    const control = new FormControl('taken@example.com');
    const fn = validator.validate();

    (fn(control) as Observable<any>).subscribe(result => {
      expect(result).toEqual({ emailTaken: true });
      done();
    });
    control.setValue('taken@example.com');
  });
});
```

Validators are pure functions (or nearly pure, for async ones). Test them by creating a `FormControl` with a test value and calling the validator function directly. Assert on the returned error object. For async validators, subscribe to the returned observable and assert in the callback. No component fixture or DOM needed.
