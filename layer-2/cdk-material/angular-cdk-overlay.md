---
id: angular-cdk-overlay
layer1_parent: null
angular_version: "14"
module: "@angular/cdk/overlay"
---

# CDK Overlay

## How Angular Implements This

The CDK Overlay system renders content that floats above the page -- modals, tooltips, dropdowns, snackbars, and autocomplete panels. Every Angular Material component that opens a floating panel (MatDialog, MatMenu, MatSelect, MatTooltip, MatAutocomplete) is built on this.

The Overlay creates a container at the document root (`<body>`) level, outside your component tree. This eliminates z-index stacking context problems -- the overlay is never clipped by a parent's `overflow: hidden` or trapped inside a `position: relative` container.

Key concepts:
- **Overlay** -- injectable service that creates overlay instances
- **OverlayRef** -- a handle to a specific overlay (attach content, detach, dispose, listen for events)
- **OverlayConfig** -- configuration: position strategy, scroll strategy, backdrop, size
- **PositionStrategy** -- where the overlay appears: `global()` (centered in viewport) or `flexibleConnectedTo()` (anchored to an element)
- **ScrollStrategy** -- what happens when the user scrolls: `reposition()`, `close()`, `block()`, or `noop()`
- **Portal** -- the content to render: a component (`ComponentPortal`) or a template (`TemplatePortal`)

## The Correct Way

### Module setup

```typescript
// shared.module.ts
import { OverlayModule } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';

@NgModule({
  imports: [OverlayModule, PortalModule],
  // ...
})
export class SharedModule {}
```

### Dropdown anchored to a trigger element

```typescript
// dropdown.component.ts
import {
  Component,
  ElementRef,
  OnDestroy,
  TemplateRef,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';

@Component({
  selector: 'app-dropdown',
  template: `
    <button #trigger (click)="toggle()">Options</button>

    <ng-template #panel>
      <ul class="dropdown-menu" role="menu">
        <li role="menuitem" *ngFor="let item of items"
            (click)="selectItem(item)"
            (keydown.enter)="selectItem(item)"
            tabindex="0">
          {{ item.label }}
        </li>
      </ul>
    </ng-template>
  `
})
export class DropdownComponent implements OnDestroy {
  @ViewChild('trigger') triggerEl!: ElementRef;
  @ViewChild('panel') panelTemplate!: TemplateRef<any>;

  items = [
    { id: 1, label: 'Edit' },
    { id: 2, label: 'Duplicate' },
    { id: 3, label: 'Delete' },
  ];

  private overlayRef: OverlayRef | null = null;

  constructor(
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef
  ) {}

  toggle(): void {
    this.overlayRef?.hasAttached() ? this.close() : this.open();
  }

  open(): void {
    // 1. Define position: below the trigger, aligned left
    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(this.triggerEl)
      .withPositions([
        {
          originX: 'start',    // Left edge of trigger
          originY: 'bottom',   // Bottom edge of trigger
          overlayX: 'start',   // Left edge of overlay
          overlayY: 'top',     // Top edge of overlay
          offsetY: 4           // 4px gap
        },
        {
          // Fallback: open ABOVE the trigger if no room below
          originX: 'start',
          originY: 'top',
          overlayX: 'start',
          overlayY: 'bottom',
          offsetY: -4
        }
      ]);

    // 2. Create the overlay
    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop'
    });

    // 3. Attach the template
    const portal = new TemplatePortal(
      this.panelTemplate,
      this.viewContainerRef
    );
    this.overlayRef.attach(portal);

    // 4. Close on backdrop click or escape
    this.overlayRef.backdropClick().subscribe(() => this.close());
    this.overlayRef.keydownEvents().subscribe(event => {
      if (event.key === 'Escape') {
        this.close();
        this.triggerEl.nativeElement.focus();
      }
    });
  }

  close(): void {
    this.overlayRef?.detach();
  }

  selectItem(item: { id: number; label: string }): void {
    console.log('Selected:', item.label);
    this.close();
  }

  ngOnDestroy(): void {
    this.overlayRef?.dispose();  // Clean up on component destroy
  }
}
```

### Global modal centered in the viewport

```typescript
// modal.service.ts
import { Injectable, Injector, InjectionToken } from '@angular/core';
import { Overlay, OverlayConfig, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ComponentType } from '@angular/cdk/portal';

export const MODAL_DATA = new InjectionToken<any>('MODAL_DATA');

@Injectable({ providedIn: 'root' })
export class ModalService {
  constructor(
    private overlay: Overlay,
    private injector: Injector
  ) {}

  open<T>(component: ComponentType<T>, data?: any): OverlayRef {
    const config = new OverlayConfig({
      positionStrategy: this.overlay.position()
        .global()
        .centerHorizontally()
        .centerVertically(),
      scrollStrategy: this.overlay.scrollStrategies.block(),
      hasBackdrop: true,
      backdropClass: 'dark-backdrop',
      width: '500px',
      maxHeight: '80vh'
    });

    const overlayRef = this.overlay.create(config);

    // Create a custom injector so the modal component can receive data
    const modalInjector = Injector.create({
      parent: this.injector,
      providers: [
        { provide: OverlayRef, useValue: overlayRef },
        { provide: MODAL_DATA, useValue: data }
      ]
    });

    const portal = new ComponentPortal(component, null, modalInjector);
    overlayRef.attach(portal);

    overlayRef.backdropClick().subscribe(() => overlayRef.dispose());

    return overlayRef;
  }
}
```

```typescript
// delete-confirmation.component.ts
import { Component, Inject } from '@angular/core';
import { OverlayRef } from '@angular/cdk/overlay';
import { MODAL_DATA } from './modal.service';

@Component({
  selector: 'app-delete-confirmation',
  template: `
    <div class="modal-body">
      <h2>Delete {{ data.itemName }}?</h2>
      <p>This cannot be undone.</p>
      <div class="actions">
        <button (click)="close()">Cancel</button>
        <button class="danger" (click)="confirm()">Delete</button>
      </div>
    </div>
  `
})
export class DeleteConfirmationComponent {
  constructor(
    @Inject(MODAL_DATA) public data: { itemName: string },
    private overlayRef: OverlayRef
  ) {}

  close(): void {
    this.overlayRef.dispose();
  }

  confirm(): void {
    // Perform deletion...
    this.overlayRef.dispose();
  }
}
```

```typescript
// Usage from any component
@Component({ /* ... */ })
export class ItemListComponent {
  constructor(private modal: ModalService) {}

  deleteItem(item: Item): void {
    this.modal.open(DeleteConfirmationComponent, {
      itemName: item.name
    });
  }
}
```

## The Anti-Pattern in Angular

**Using CSS `position: absolute` and `z-index` for floating UI.**

```html
<!-- WRONG -->
<div class="container" style="position: relative;">
  <button (click)="open = !open">Menu</button>
  <ul *ngIf="open"
      style="position: absolute; top: 100%; z-index: 9999;">
    <li>Option 1</li>
  </ul>
</div>
```

Problems:
1. If any ancestor has `overflow: hidden`, the dropdown is clipped
2. If any ancestor has `transform` or `will-change`, a new stacking context forms and z-index fights begin
3. No automatic repositioning when the dropdown would overflow the viewport
4. No backdrop for click-outside-to-close behavior
5. No scroll strategy
6. No keyboard management (Escape to close)

CDK Overlay solves all six problems by rendering at the document root with calculated positions.

**Creating a new OverlayRef every time without disposing the old one.**

```typescript
// WRONG -- orphans overlays in the DOM
open(): void {
  this.overlayRef = this.overlay.create(config);  // Old ref is now orphaned
  this.overlayRef.attach(portal);
}
```

Each `overlay.create()` adds invisible DOM elements. Without `.dispose()` on the old ref, you leak DOM nodes and event listeners. Either reuse one OverlayRef (detach/re-attach) or dispose before creating a new one.

## Common Mistakes

1. **Confusing `global()` and `flexibleConnectedTo()`**: `global()` positions relative to the viewport (for modals, toasts). `flexibleConnectedTo(element)` positions relative to a specific element (for dropdowns, tooltips). Using the wrong one puts the overlay in the wrong place.

2. **Forgetting to import `PortalModule`**: Without it, `TemplatePortal` and `ComponentPortal` constructors work, but attaching them fails silently or throws an opaque injection error.

3. **Not calling `overlayRef.dispose()` in `ngOnDestroy`**: If the component that created the overlay is destroyed while the overlay is open, the overlay stays in the DOM forever. Always dispose in `ngOnDestroy`.

4. **Backdrop clicks not wired up**: `hasBackdrop: true` displays a backdrop but does NOT close the overlay on click. You must subscribe to `overlayRef.backdropClick()` and call `close()` yourself.

5. **Scroll strategy mismatch**: Use `block()` for modals (prevents page scrolling). Use `reposition()` for dropdowns (updates position as user scrolls). Use `close()` for tooltips (dismisses on scroll). Using `block()` for a dropdown traps the user.

## Testing This

```typescript
// dropdown.component.spec.ts
import { OverlayModule, OverlayContainer } from '@angular/cdk/overlay';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DropdownComponent } from './dropdown.component';

describe('DropdownComponent', () => {
  let fixture: ComponentFixture<DropdownComponent>;
  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OverlayModule],
      declarations: [DropdownComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DropdownComponent);
    fixture.detectChanges();

    // The overlay renders OUTSIDE the fixture -- get its container
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
  });

  afterEach(() => {
    // Destroy all overlays between tests
    overlayContainer.ngOnDestroy();
  });

  it('should open the dropdown on click', () => {
    const trigger = fixture.debugElement.query(By.css('button'));
    trigger.triggerEventHandler('click', null);
    fixture.detectChanges();

    const menu = overlayContainerEl.querySelector('.dropdown-menu');
    expect(menu).toBeTruthy();
  });

  it('should close on backdrop click', () => {
    fixture.componentInstance.open();
    fixture.detectChanges();

    const backdrop = overlayContainerEl.querySelector(
      '.cdk-overlay-backdrop'
    ) as HTMLElement;
    backdrop.click();
    fixture.detectChanges();

    const menu = overlayContainerEl.querySelector('.dropdown-menu');
    expect(menu).toBeFalsy();
  });

  it('should render menu items', () => {
    fixture.componentInstance.open();
    fixture.detectChanges();

    const items = overlayContainerEl.querySelectorAll('[role="menuitem"]');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toContain('Edit');
  });
});
```

The critical testing insight: overlay content is NOT in `fixture.nativeElement`. It is in `overlayContainer.getContainerElement()`. You must query that container to find overlay content. Always call `overlayContainer.ngOnDestroy()` in `afterEach` to clean up.
