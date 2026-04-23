---
id: angular-view-encapsulation
layer1_parent: encapsulation
angular_version: "14"
module: "@angular/core"
---

# View Encapsulation

## How Angular Implements This

Angular applies the principle of encapsulation to component styles. Each component's CSS is scoped to that component by default, so styles defined in one component cannot leak into another. This prevents the classic CSS problem where a `.title` rule in one component accidentally styles every `.title` element in the application.

Angular provides three `ViewEncapsulation` modes:

**Emulated** (default) -- Angular adds unique attributes (like `_ngcontent-abc-1`) to the component's DOM elements and rewrites its CSS selectors to include those attributes. The result: `.title` becomes `.title[_ngcontent-abc-1]`, which only matches elements inside that specific component. No browser support for Shadow DOM is needed. This is what you should use almost always.

**None** -- Angular adds styles to the global stylesheet with no scoping. Every style rule affects the entire application. This is equivalent to writing a global CSS file. Use sparingly and intentionally -- for global resets, third-party library overrides, or truly global theming.

**ShadowDom** -- Angular uses the browser's native Shadow DOM to encapsulate styles. The component gets a real shadow root. Styles are physically isolated. External styles cannot reach into the shadow DOM, and the component's styles cannot leak out. This provides the strongest encapsulation but has implications: global styles (fonts, resets) do not apply inside shadow DOM elements.

## The Correct Way

```typescript
// === Emulated (default -- use this in most components) ===
import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-user-badge',
  // ViewEncapsulation.Emulated is the default; you can omit it.
  encapsulation: ViewEncapsulation.Emulated,
  template: `
    <span class="badge" [ngClass]="role">
      {{ username }}
    </span>
  `,
  styles: [`
    /* These styles ONLY affect elements inside app-user-badge.
       Angular rewrites this to: .badge[_ngcontent-xyz-1] { ... } */
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
    }
    .admin { background: #fee; color: #c00; }
    .user  { background: #eef; color: #00c; }
    .guest { background: #eee; color: #666; }
  `],
})
export class UserBadgeComponent {
  @Input() username = '';
  @Input() role: 'admin' | 'user' | 'guest' = 'user';
}
```

```typescript
// === None (global styles -- use deliberately) ===
@Component({
  selector: 'app-theme-provider',
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content></ng-content>`,
  styles: [`
    /* These styles are GLOBAL. They affect the entire application.
       Use this for CSS custom properties, font loading, or third-party overrides. */
    :root {
      --primary-color: #1976d2;
      --accent-color: #ff4081;
      --text-color: #333;
      --font-family: 'Inter', sans-serif;
    }

    body {
      font-family: var(--font-family);
      color: var(--text-color);
    }
  `],
})
export class ThemeProviderComponent {}
```

```typescript
// === ShadowDom (native isolation -- use for truly self-contained widgets) ===
@Component({
  selector: 'app-embedded-widget',
  encapsulation: ViewEncapsulation.ShadowDom,
  template: `
    <div class="widget">
      <h3>{{ title }}</h3>
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    /* These styles are physically isolated in a shadow root.
       No external CSS can affect elements inside this component.
       No styles defined here can leak outside. */
    .widget {
      border: 2px solid #1976d2;
      border-radius: 8px;
      padding: 16px;
      font-family: system-ui;  /* Must declare font -- global font rules don't apply */
    }
    h3 {
      margin: 0 0 8px;
      color: #1976d2;
    }
  `],
})
export class EmbeddedWidgetComponent {
  @Input() title = '';
}
```

### Styling Projected Content

Content projection interacts with encapsulation. Projected content belongs to the parent's view, so the parent's styles apply, not the child's:

```typescript
// Card component -- its styles do NOT affect projected content
@Component({
  selector: 'app-card',
  template: `
    <div class="card">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .card { border: 1px solid #ccc; padding: 16px; }
    /* This will NOT style projected <h2> elements: */
    h2 { color: red; }
  `],
})
export class CardComponent {}
```

```typescript
// Parent component -- its styles DO affect projected content
@Component({
  selector: 'app-dashboard',
  template: `
    <app-card>
      <h2>Dashboard</h2>  <!-- Styled by app-dashboard's styles, not app-card's -->
    </app-card>
  `,
  styles: [`
    h2 { color: blue; }  /* This DOES affect the projected h2 */
  `],
})
export class DashboardComponent {}
```

### The :host Selector

```typescript
@Component({
  selector: 'app-alert',
  template: `<p>{{ message }}</p>`,
  styles: [`
    /* :host targets the component element itself (<app-alert>) */
    :host {
      display: block;
      padding: 12px;
      border-radius: 4px;
    }
    /* :host with a condition */
    :host(.error) {
      background: #fee;
      border: 1px solid #c00;
    }
    :host(.success) {
      background: #efe;
      border: 1px solid #0c0;
    }
  `],
})
export class AlertComponent {
  @Input() message = '';
}
```

```html
<!-- Usage: the host class determines the style variant -->
<app-alert class="error" message="Something went wrong"></app-alert>
<app-alert class="success" message="Operation completed"></app-alert>
```

## The Anti-Pattern in Angular

The junior dev sets `ViewEncapsulation.None` on every component because "the styles weren't working" (usually because they were trying to style a child component's internals from the parent). Now every component's `.title`, `.container`, `.wrapper` rules collide globally.

```typescript
// DO NOT DO THIS -- disabling encapsulation because styles "don't work"
@Component({
  selector: 'app-user-list',
  encapsulation: ViewEncapsulation.None,  // Now every .item style is global
  template: `
    <div class="item" *ngFor="let user of users">{{ user.name }}</div>
  `,
  styles: [`
    .item {
      padding: 8px;
      border-bottom: 1px solid #ccc;
    }
    /* This now affects EVERY element with class="item" in the entire app */
  `],
})
export class UserListComponent { ... }
```

```typescript
// DO NOT DO THIS -- using ::ng-deep everywhere
@Component({
  selector: 'app-parent',
  template: `<app-child></app-child>`,
  styles: [`
    /* ::ng-deep pierces encapsulation and is deprecated */
    :host ::ng-deep .child-internal-class {
      color: red;
    }
    /* This works but it's a maintenance nightmare:
       - The parent now depends on the child's internal CSS classes
       - The child can't rename .child-internal-class without breaking the parent
       - Encapsulation is defeated */
  `],
})
export class ParentComponent {}
```

```typescript
// DO NOT DO THIS -- putting all styles in a global stylesheet
// styles.scss:
.user-badge { ... }
.user-list .item { ... }
.order-card .header { ... }
.dashboard .widget { ... }
// One giant file with increasingly specific selectors fighting each other.
// Components are not portable -- their styles are somewhere else entirely.
```

## Common Mistakes

1. **Using `ViewEncapsulation.None` to fix styling issues.** The real fix is usually one of: use `:host` to style the component element, use CSS custom properties to allow theming from outside, pass data through `@Input()` to conditionally apply classes, or accept that the parent should style its own projected content.

2. **Expecting global styles to apply inside ShadowDom.** `ViewEncapsulation.ShadowDom` creates a real shadow boundary. Global fonts, resets, and CSS custom properties declared on `:root` do not automatically apply. You must either redeclare them inside the shadow DOM or use CSS custom properties (which do pierce shadow boundaries).

3. **Overusing `::ng-deep`.** `::ng-deep` is deprecated (though still functional). It pierces view encapsulation, creating invisible dependencies between parent and child CSS class names. If you must override a child's styles, prefer CSS custom properties or explicit `@Input()` for style variants.

4. **Forgetting `:host` display behavior.** Angular components are rendered as custom elements (e.g., `<app-user-badge>`). Custom elements default to `display: inline`. If your component's template starts with a `<div>`, the outer component element is inline but its content is block. This causes layout issues. Set `display: block` on `:host` for block-level components.

5. **Styling the `:host` element from inside and outside simultaneously.** Styles on `:host` inside the component have lower specificity than styles applied to the component's selector from outside. A parent's `app-user-badge { color: red; }` overrides the component's `:host { color: blue; }`. This is by design -- it lets parents customize component appearance -- but it can be confusing.

## Testing This

Test that styles are scoped (Emulated):

```typescript
describe('UserBadgeComponent encapsulation', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UserBadgeComponent],
    }).compileComponents();
  });

  it('should have scoping attribute on elements', () => {
    const fixture = TestBed.createComponent(UserBadgeComponent);
    fixture.componentInstance.username = 'Alice';
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.badge');
    // Angular adds a unique attribute for emulated encapsulation.
    const attrs = Array.from(badge.attributes).map((a: Attr) => a.name);
    const hasScopingAttr = attrs.some(name => name.startsWith('_ngcontent'));
    expect(hasScopingAttr).toBeTrue();
  });

  it('should apply role-based class', () => {
    const fixture = TestBed.createComponent(UserBadgeComponent);
    fixture.componentInstance.username = 'Alice';
    fixture.componentInstance.role = 'admin';
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge.classList).toContain('admin');
  });
});
```

Test :host class binding:

```typescript
@Component({
  template: `<app-alert class="error" message="Test error"></app-alert>`,
})
class TestHostComponent {}

describe('AlertComponent :host styling', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestHostComponent, AlertComponent],
    }).compileComponents();
  });

  it('should apply host class from parent', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const alertEl = fixture.nativeElement.querySelector('app-alert');
    expect(alertEl.classList).toContain('error');
  });
});
```

Test that ViewEncapsulation.None makes styles global (integration test):

```typescript
@Component({
  template: `
    <app-theme-provider></app-theme-provider>
    <div class="test-element">Test</div>
  `,
})
class TestHostComponent {}

it('should apply global styles from None-encapsulated component', () => {
  const fixture = TestBed.createComponent(TestHostComponent);
  fixture.detectChanges();

  // CSS custom properties from ThemeProviderComponent should be available
  const root = document.documentElement;
  const primaryColor = getComputedStyle(root).getPropertyValue('--primary-color').trim();
  expect(primaryColor).toBe('#1976d2');
});
```
