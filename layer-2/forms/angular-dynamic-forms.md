---
id: angular-dynamic-forms
layer1_parent: dynamic-forms
angular_version: "14"
module: "@angular/forms"
---

# Angular Dynamic Forms

## How Angular Implements This

Dynamic forms are forms whose structure changes at runtime — adding/removing fields, repeating groups of fields, or building the entire form from a configuration object. Angular implements this primarily through `FormArray`, which is an ordered collection of `AbstractControl` instances that can be dynamically added, removed, and reordered.

`FormArray` is the third pillar of Angular reactive forms alongside `FormGroup` (fixed structure, keyed by name) and `FormControl` (single value). While a `FormGroup` has a fixed set of named controls defined at creation time, a `FormArray` has an indexed list that grows and shrinks.

Common dynamic form scenarios:
- **Repeating rows**: "Add another phone number," "Add another line item"
- **Config-driven forms**: Build form structure from a JSON schema or API response
- **Conditional fields**: Show/hide fields based on other field values (using `addControl`/`removeControl` on `FormGroup`)

## The Correct Way

```typescript
// invoice-form.component.ts — FormArray for repeating line items
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';

@Component({
  selector: 'app-invoice-form',
  templateUrl: './invoice-form.component.html'
})
export class InvoiceFormComponent implements OnInit {
  invoiceForm!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.invoiceForm = this.fb.group({
      customerName: ['', Validators.required],
      invoiceDate: ['', Validators.required],
      lineItems: this.fb.array([
        this.createLineItem()  // Start with one empty line item
      ])
    });
  }

  // Typed getter for the FormArray
  get lineItems(): FormArray {
    return this.invoiceForm.get('lineItems') as FormArray;
  }

  // Factory method — creates a consistent FormGroup for each line item
  private createLineItem(): FormGroup {
    return this.fb.group({
      description: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]]
    });
  }

  addLineItem(): void {
    this.lineItems.push(this.createLineItem());
  }

  removeLineItem(index: number): void {
    if (this.lineItems.length > 1) {  // Keep at least one
      this.lineItems.removeAt(index);
    }
  }

  moveLineItem(fromIndex: number, toIndex: number): void {
    const item = this.lineItems.at(fromIndex);
    this.lineItems.removeAt(fromIndex);
    this.lineItems.insert(toIndex, item);
  }

  getTotal(): number {
    return this.lineItems.controls.reduce((sum, control) => {
      const group = control as FormGroup;
      return sum + (group.controls['quantity'].value * group.controls['unitPrice'].value);
    }, 0);
  }

  onSubmit(): void {
    if (this.invoiceForm.invalid) {
      this.invoiceForm.markAllAsTouched();
      return;
    }
    console.log(this.invoiceForm.getRawValue());
  }
}
```

```html
<!-- invoice-form.component.html -->
<form [formGroup]="invoiceForm" (ngSubmit)="onSubmit()">
  <div>
    <label>Customer</label>
    <input formControlName="customerName">
  </div>

  <div>
    <label>Date</label>
    <input formControlName="invoiceDate" type="date">
  </div>

  <h3>Line Items</h3>
  <!-- formArrayName binds to the FormArray -->
  <div formArrayName="lineItems">
    <!-- Loop over FormArray controls by index -->
    <div *ngFor="let item of lineItems.controls; let i = index" [formGroupName]="i">
      <span>{{ i + 1 }}.</span>
      <input formControlName="description" placeholder="Description">
      <input formControlName="quantity" type="number" placeholder="Qty">
      <input formControlName="unitPrice" type="number" placeholder="Price">
      <span>= {{ item.get('quantity')?.value * item.get('unitPrice')?.value | currency }}</span>
      <button type="button" (click)="removeLineItem(i)"
              [disabled]="lineItems.length === 1">Remove</button>
    </div>
  </div>

  <button type="button" (click)="addLineItem()">+ Add Line Item</button>

  <div>
    <strong>Total: {{ getTotal() | currency }}</strong>
  </div>

  <button type="submit" [disabled]="invoiceForm.invalid">Submit Invoice</button>
</form>
```

```typescript
// Config-driven dynamic form — build from JSON schema
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';

interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox';
  required: boolean;
  options?: { value: string; label: string }[];  // For select fields
}

@Component({
  selector: 'app-dynamic-form',
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <div *ngFor="let field of fieldConfigs">
        <label [for]="field.key">{{ field.label }}</label>

        <input *ngIf="field.type === 'text'"
               [id]="field.key"
               [formControlName]="field.key"
               type="text">

        <input *ngIf="field.type === 'number'"
               [id]="field.key"
               [formControlName]="field.key"
               type="number">

        <select *ngIf="field.type === 'select'"
                [id]="field.key"
                [formControlName]="field.key">
          <option value="">-- Select --</option>
          <option *ngFor="let opt of field.options" [value]="opt.value">
            {{ opt.label }}
          </option>
        </select>

        <input *ngIf="field.type === 'checkbox'"
               [id]="field.key"
               [formControlName]="field.key"
               type="checkbox">

        <div *ngIf="form.get(field.key)?.touched && form.get(field.key)?.errors?.['required']">
          {{ field.label }} is required.
        </div>
      </div>

      <button type="submit">Submit</button>
    </form>
  `
})
export class DynamicFormComponent implements OnInit {
  fieldConfigs: FieldConfig[] = [];
  form!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    // In practice, this comes from an API
    this.fieldConfigs = [
      { key: 'firstName', label: 'First Name', type: 'text', required: true },
      { key: 'lastName', label: 'Last Name', type: 'text', required: true },
      { key: 'age', label: 'Age', type: 'number', required: false },
      { key: 'department', label: 'Department', type: 'select', required: true,
        options: [
          { value: 'eng', label: 'Engineering' },
          { value: 'hr', label: 'Human Resources' }
        ]
      }
    ];

    this.form = this.buildForm(this.fieldConfigs);
  }

  private buildForm(fields: FieldConfig[]): FormGroup {
    const group: { [key: string]: FormControl } = {};

    fields.forEach(field => {
      const validators = field.required ? [Validators.required] : [];
      const initialValue = field.type === 'checkbox' ? false : '';
      group[field.key] = this.fb.control(initialValue, validators);
    });

    return this.fb.group(group);
  }

  onSubmit(): void {
    console.log(this.form.getRawValue());
  }
}
```

```typescript
// Conditional fields — add/remove controls based on other values
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-order-form',
  template: `
    <form [formGroup]="orderForm">
      <label>
        <input type="checkbox" formControlName="needsShipping"> Ship to address
      </label>

      <!-- Only shown when shipping is checked -->
      <fieldset *ngIf="orderForm.controls['needsShipping'].value" formGroupName="shippingAddress">
        <legend>Shipping Address</legend>
        <input formControlName="street" placeholder="Street">
        <input formControlName="city" placeholder="City">
        <input formControlName="zip" placeholder="ZIP">
      </fieldset>
    </form>
  `
})
export class OrderFormComponent implements OnInit, OnDestroy {
  orderForm!: FormGroup;
  private destroy$ = new Subject<void>();

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.orderForm = this.fb.group({
      needsShipping: [false]
    });

    // Dynamically add/remove the shipping address group
    this.orderForm.controls['needsShipping'].valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(needsShipping => {
      if (needsShipping) {
        this.orderForm.addControl('shippingAddress', this.fb.group({
          street: ['', Validators.required],
          city: ['', Validators.required],
          zip: ['', Validators.required]
        }));
      } else {
        this.orderForm.removeControl('shippingAddress');
      }
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
// WRONG: Using *ngIf to hide fields but keeping them in the form
<input *ngIf="showPhone" formControlName="phone">
// The control "phone" still exists in the FormGroup.
// Its validators still run. If it's required but hidden, the form is always invalid.
// The user can't see the field, can't fill it in, and can't submit.
// Fix: addControl/removeControl, or enable/disable the control.

// WRONG: Pushing raw FormControls without the factory method
addItem(): void {
  this.lineItems.push(new FormControl(''));  // Just a string, not a group
}
// When the template expects formGroupName="i" with named controls,
// it gets a bare FormControl and throws: "Cannot find control with path: 'lineItems -> 0 -> description'"
// Always use a consistent factory method that returns the right FormGroup structure.

// WRONG: Not tracking FormArray by index in *ngFor
<div *ngFor="let item of lineItems.controls; trackBy: trackByFn" [formGroupName]="i">
// Missing "let i = index" — formGroupName needs the index, not the control reference.
// Also: if you re-render without trackBy, Angular destroys and recreates DOM elements
// on every change, which loses focus state and selection.
```

## Common Mistakes

1. **Forgetting `[formGroupName]="i"` in the loop**: The `*ngFor` loop over a `FormArray` must use the index to bind each iteration to the correct `FormGroup`. `formGroupName` takes a number (the index), not the control itself.

2. **Hidden fields still validate**: Using `*ngIf` to hide a form field does not remove its control from the form model. The control's validators still run. Either `removeControl()` the field from the parent group, or use `control.disable()` (which excludes the control from `form.value` but keeps it in `form.getRawValue()`).

3. **FormArray `trackBy`**: Without `trackBy` in `*ngFor`, Angular re-creates DOM elements when the array changes. This loses input focus and selection state. Use a `trackBy` function that returns the index or a stable ID.

4. **Mutable array operations**: `this.lineItems.controls.splice(1, 1)` directly mutates the internal array without notifying Angular. Always use `FormArray` methods: `push()`, `removeAt()`, `insert()`, `clear()`. These trigger change detection and update form validity.

5. **Performance with large FormArrays**: Each control in a FormArray runs validators on every value change of any sibling. A FormArray with 100 items and complex validators will be slow. Consider `updateOn: 'blur'` for individual controls, or batch updates with `form.patchValue(data, { emitEvent: false })` followed by a single `form.updateValueAndValidity()`.

## Testing This

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormArray } from '@angular/forms';
import { InvoiceFormComponent } from './invoice-form.component';

describe('InvoiceFormComponent', () => {
  let component: InvoiceFormComponent;
  let fixture: ComponentFixture<InvoiceFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      declarations: [InvoiceFormComponent]
    });
    fixture = TestBed.createComponent(InvoiceFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should start with one line item', () => {
    expect(component.lineItems.length).toBe(1);
  });

  it('should add a line item', () => {
    component.addLineItem();
    expect(component.lineItems.length).toBe(2);
  });

  it('should remove a line item', () => {
    component.addLineItem();  // Now 2 items
    component.removeLineItem(0);
    expect(component.lineItems.length).toBe(1);
  });

  it('should not remove the last line item', () => {
    component.removeLineItem(0);  // Only 1 item — should not remove
    expect(component.lineItems.length).toBe(1);
  });

  it('should calculate total correctly', () => {
    const firstItem = component.lineItems.at(0);
    firstItem.patchValue({ quantity: 3, unitPrice: 10 });

    component.addLineItem();
    component.lineItems.at(1).patchValue({ quantity: 2, unitPrice: 25 });

    expect(component.getTotal()).toBe(80);  // (3*10) + (2*25)
  });

  it('should be invalid with empty required fields', () => {
    expect(component.invoiceForm.valid).toBeFalse();
  });

  it('should validate line item fields', () => {
    const firstItem = component.lineItems.at(0);
    firstItem.patchValue({ description: '', quantity: 0, unitPrice: -1 });

    expect(firstItem.get('description')?.errors?.['required']).toBeTruthy();
    expect(firstItem.get('quantity')?.errors?.['min']).toBeTruthy();
    expect(firstItem.get('unitPrice')?.errors?.['min']).toBeTruthy();
  });
});
```

Test dynamic forms by programmatically calling `addLineItem()`, `removeLineItem()`, and `patchValue()`, then asserting on the form model. Test the form's `valid` state at each step. Test edge cases: removing all items, adding many items, validating individual items within the array. No DOM interaction needed — reactive forms are fully testable through the model.
