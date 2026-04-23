---
id: angular-cdk-accessibility
layer1_parent: accessibility-wcag
angular_version: "14"
module: "@angular/cdk/a11y"
---

# CDK Accessibility

## How Angular Implements This

The CDK `A11yModule` provides programmatic accessibility tools for dynamic Angular applications. HTML's native accessibility attributes (ARIA) are static, but Angular apps create, destroy, and modify content constantly. The CDK bridges the gap with services and directives that manage focus, announce changes to screen readers, and detect how users interact with the page.

Four core tools:

- **FocusTrap** (`cdkTrapFocus`) -- constrains Tab key navigation within a container. When a modal opens, pressing Tab cycles through the modal's controls instead of escaping to the page behind it. This is a WCAG 2.1 requirement for dialog components.

- **LiveAnnouncer** -- programmatically announces messages to screen readers via an ARIA live region. When you show a toast notification or update a counter, sighted users see the change but screen reader users hear nothing unless you announce it.

- **FocusMonitor** -- tracks HOW an element received focus: keyboard, mouse, touch, or programmatic. This lets you show focus indicators only for keyboard users (visible outline) and suppress them for mouse users (no outline), solving the "ugly focus ring on click" problem.

- **AriaDescriber** -- associates descriptive text with elements via `aria-describedby` without adding visible text to the DOM. Useful for tooltips and supplementary instructions.

## The Correct Way

### FocusTrap in a modal dialog

```typescript
// modal-dialog.component.ts
import { Component, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-modal-dialog',
  template: `
    <div class="overlay" (click)="close()">
      <div
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-heading"
        cdkTrapFocus
        cdkTrapFocusAutoCapture
        (click)="$event.stopPropagation()"
      >
        <h2 id="dialog-heading">Confirm Action</h2>
        <p>Are you sure you want to proceed?</p>
        <div class="actions">
          <button #cancelBtn (click)="close()">Cancel</button>
          <button (click)="confirm()">Confirm</button>
        </div>
      </div>
    </div>
  `
})
export class ModalDialogComponent implements AfterViewInit {
  @ViewChild('cancelBtn') cancelBtn!: ElementRef<HTMLButtonElement>;

  ngAfterViewInit(): void {
    // cdkTrapFocusAutoCapture moves focus into the trap automatically.
    // But if you want a SPECIFIC element to get initial focus:
    this.cancelBtn.nativeElement.focus();
  }

  close(): void { /* ... */ }
  confirm(): void { /* ... */ }
}
```

Key attributes:
- `cdkTrapFocus` -- traps Tab navigation within the dialog
- `cdkTrapFocusAutoCapture` -- auto-focuses the first tabbable element and restores focus to the trigger element when the trap is destroyed
- `role="dialog"` + `aria-modal="true"` -- tells screen readers this is a modal
- `aria-labelledby="dialog-heading"` -- associates the heading with the dialog

### LiveAnnouncer for dynamic content changes

```typescript
// notification.service.ts
import { Injectable } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private announcer: LiveAnnouncer) {}

  success(message: string): void {
    // 'polite' waits until screen reader finishes current speech
    this.announcer.announce(message, 'polite');
  }

  error(message: string): void {
    // 'assertive' interrupts current speech -- use for critical errors
    this.announcer.announce(message, 'assertive');
  }
}
```

```typescript
// form.component.ts -- usage
@Component({ /* ... */ })
export class FormComponent {
  constructor(
    private userService: UserService,
    private notifications: NotificationService
  ) {}

  save(): void {
    this.userService.save(this.form.value).subscribe({
      next: () => this.notifications.success('Profile saved successfully.'),
      error: () => this.notifications.error('Error: could not save profile.')
    });
  }
}
```

### FocusMonitor for keyboard-only focus styles

```typescript
// focus-style.directive.ts
import { Directive, ElementRef, OnDestroy } from '@angular/core';
import { FocusMonitor, FocusOrigin } from '@angular/cdk/a11y';

@Directive({
  selector: '[appFocusStyle]'
})
export class FocusStyleDirective implements OnDestroy {
  constructor(
    private el: ElementRef,
    private focusMonitor: FocusMonitor
  ) {
    this.focusMonitor.monitor(this.el, true).subscribe((origin: FocusOrigin) => {
      if (origin === 'keyboard') {
        this.el.nativeElement.classList.add('focus-visible');
      } else {
        this.el.nativeElement.classList.remove('focus-visible');
      }
    });
  }

  ngOnDestroy(): void {
    this.focusMonitor.stopMonitoring(this.el);
  }
}
```

```css
/* global styles */
.focus-visible {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
}
```

```html
<!-- Usage: focus ring appears only when user tabs to the button -->
<button appFocusStyle (click)="save()">Save</button>
```

### Module setup

```typescript
import { A11yModule } from '@angular/cdk/a11y';

@NgModule({
  imports: [A11yModule],
  declarations: [
    ModalDialogComponent,
    FocusStyleDirective
  ]
})
export class SharedModule {}
```

## The Anti-Pattern in Angular

**Suppressing all focus outlines.**

```css
/* WRONG -- completely destroys keyboard accessibility */
*:focus { outline: none; }
button:focus { outline: none; }
```

This makes the page impossible to navigate for keyboard users. They cannot see which element is focused. Instead, use `FocusMonitor` to suppress outlines only for mouse/touch users, keeping them visible for keyboard users.

**Using `autofocus` for dynamically created content.**

```html
<!-- WRONG -- autofocus fires once on page load, not when a dialog opens -->
<dialog>
  <input autofocus />
</dialog>
```

The `autofocus` HTML attribute only works on initial page load. For dynamically created modals, overlays, and panels, use `cdkTrapFocusAutoCapture` or programmatic `.focus()` in `ngAfterViewInit`.

**Relying on visual cues alone.**

```typescript
// WRONG -- sighted users see the toast, screen reader users hear nothing
showToast(message: string): void {
  this.toastVisible = true;
  this.toastMessage = message;
  setTimeout(() => this.toastVisible = false, 3000);
}
```

Every dynamic content change that conveys information must be announced to screen readers. Use `LiveAnnouncer` alongside visual feedback.

**Icon-only buttons without accessible labels.**

```html
<!-- WRONG -- screen reader says "button" with no description -->
<button (click)="delete()">
  <mat-icon>delete</mat-icon>
</button>

<!-- RIGHT -->
<button (click)="delete()" aria-label="Delete item">
  <mat-icon aria-hidden="true">delete</mat-icon>
</button>
```

## Common Mistakes

1. **FocusMonitor memory leak**: Every `focusMonitor.monitor()` must have a matching `focusMonitor.stopMonitoring()` in `ngOnDestroy`. Without it, event listeners accumulate on each component lifecycle, causing memory leaks and stale references.

2. **LiveAnnouncer called too frequently**: If you announce a message on every keystroke (e.g., "3 results found", "4 results found", "5 results found"), the screen reader queue overflows. Debounce announcements -- announce once when the user pauses typing.

3. **`aria-label` overrides visible text**: If a button has visible text "Save" and you add `aria-label="Submit form"`, screen reader users hear "Submit form" while sighted users see "Save". Only use `aria-label` when there is NO visible text.

4. **Forgetting `aria-hidden="true"` on decorative elements**: Icons, avatars, and decorative images should have `aria-hidden="true"` so screen readers skip them. Without it, screen readers may announce the icon's text content or alt text, adding noise.

5. **Not restoring focus when a dialog closes**: When a modal closes, focus should return to the element that opened it. `cdkTrapFocusAutoCapture` handles this automatically. If you manage focus manually, save `document.activeElement` before opening and call `.focus()` on it after closing.

## Testing This

```typescript
// focus-trap test
import { A11yModule } from '@angular/cdk/a11y';

describe('ModalDialogComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [A11yModule],
      declarations: [ModalDialogComponent]
    }).compileComponents();
  });

  it('should trap focus within the dialog', async () => {
    const fixture = TestBed.createComponent(ModalDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    // The cancel button should have focus (we set it in ngAfterViewInit)
    const cancelBtn = fixture.componentInstance.cancelBtn.nativeElement;
    expect(document.activeElement).toBe(cancelBtn);
  });

  it('should have correct ARIA attributes', () => {
    const fixture = TestBed.createComponent(ModalDialogComponent);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('dialog-heading');
  });
});

// LiveAnnouncer test
describe('NotificationService', () => {
  let service: NotificationService;
  let announcerSpy: jasmine.SpyObj<LiveAnnouncer>;

  beforeEach(() => {
    announcerSpy = jasmine.createSpyObj('LiveAnnouncer', ['announce']);

    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: LiveAnnouncer, useValue: announcerSpy }
      ]
    });

    service = TestBed.inject(NotificationService);
  });

  it('should announce success messages politely', () => {
    service.success('Saved');
    expect(announcerSpy.announce).toHaveBeenCalledWith('Saved', 'polite');
  });

  it('should announce errors assertively', () => {
    service.error('Failed');
    expect(announcerSpy.announce).toHaveBeenCalledWith('Failed', 'assertive');
  });
});
```

Beyond unit tests, validate accessibility with:
- Screen reader testing (NVDA, VoiceOver) to verify announcements and focus behavior
- `axe-core` or Lighthouse audits to catch missing ARIA attributes
- Keyboard-only navigation testing (unplug the mouse, use only Tab/Enter/Escape)
