---
id: angular-content-projection
layer1_parent: composition-over-inheritance
angular_version: "14"
module: "@angular/core"
---

# Content Projection

## How Angular Implements This

Content projection is Angular's mechanism for composition over inheritance in templates. Instead of creating `BaseCardComponent` and having `UserCardComponent extends BaseCardComponent`, you create a `CardComponent` with slots that consumers fill with their own content. The component defines the structure; the consumer provides the content.

Angular offers four content projection mechanisms:

1. **`<ng-content>`** -- Projects content from the parent's template into the child's template. This is the simplest form: the parent puts content between the child's tags, and the child renders it wherever `<ng-content>` appears.

2. **`<ng-content select="...">`** -- Multi-slot projection. The child defines named slots with CSS selectors, and the parent's content is routed to the matching slot.

3. **`<ng-template>` + `ngTemplateOutlet`** -- The parent passes a template reference that the child can stamp out zero or more times, optionally with a context object. This is the most powerful form because the child controls when and how many times the template renders.

4. **`@ContentChild` / `@ContentChildren`** -- Queries that let the child component access projected content programmatically (read directive instances, count projected items, etc.).

Content projection replaces inheritance-based component reuse. You never need a base component class. Instead, you compose: a layout component projects page content, a card component projects header and body, a table component projects row templates.

## The Correct Way

### Single-slot Projection

```typescript
// === card.component.ts ===
import { Component } from '@angular/core';

@Component({
  selector: 'app-card',
  template: `
    <div class="card">
      <div class="card-body">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .card { border: 1px solid #ddd; border-radius: 8px; }
    .card-body { padding: 16px; }
  `],
})
export class CardComponent {}
```

```html
<!-- Usage in parent template -->
<app-card>
  <h2>User Profile</h2>
  <p>This content is projected into the card body.</p>
</app-card>
```

### Multi-slot Projection

```typescript
// === panel.component.ts ===
import { Component } from '@angular/core';

@Component({
  selector: 'app-panel',
  template: `
    <div class="panel">
      <div class="panel-header">
        <ng-content select="[panelHeader]"></ng-content>
      </div>
      <div class="panel-body">
        <ng-content select="[panelBody]"></ng-content>
      </div>
      <div class="panel-footer">
        <ng-content select="[panelFooter]"></ng-content>
      </div>
    </div>
  `,
})
export class PanelComponent {}
```

```html
<!-- Usage in parent template -->
<app-panel>
  <div panelHeader>
    <h2>Order Summary</h2>
  </div>
  <div panelBody>
    <p>3 items, total: $47.99</p>
  </div>
  <div panelFooter>
    <button (click)="checkout()">Checkout</button>
  </div>
</app-panel>
```

### Template Projection with ngTemplateOutlet

This is the most powerful pattern. The child controls when and how many times the template renders, and passes context data back to the template:

```typescript
// === data-list.component.ts ===
import { Component, Input, ContentChild, TemplateRef } from '@angular/core';

@Component({
  selector: 'app-data-list',
  template: `
    <div class="list">
      <div *ngIf="items.length === 0">
        <ng-container
          *ngTemplateOutlet="emptyTemplate || defaultEmpty">
        </ng-container>
      </div>

      <div *ngFor="let item of items; let i = index" class="list-item">
        <ng-container
          *ngTemplateOutlet="itemTemplate; context: { $implicit: item, index: i }">
        </ng-container>
      </div>
    </div>

    <ng-template #defaultEmpty>
      <p>No items found.</p>
    </ng-template>
  `,
})
export class DataListComponent<T> {
  @Input() items: T[] = [];

  // ContentChild queries find ng-template elements projected from the parent.
  @ContentChild('itemTemplate') itemTemplate!: TemplateRef<any>;
  @ContentChild('emptyTemplate') emptyTemplate?: TemplateRef<any>;
}
```

```html
<!-- Usage in parent template -->
<app-data-list [items]="users">
  <!-- This template is projected into the child and stamped for each item.
       'let user' binds to the $implicit context property.
       'let i = index' binds to the explicit 'index' context property. -->
  <ng-template #itemTemplate let-user let-i="index">
    <span>{{ i + 1 }}. {{ user.name }} ({{ user.email }})</span>
  </ng-template>

  <!-- Optional: custom empty state -->
  <ng-template #emptyTemplate>
    <div class="empty-state">
      <img src="assets/no-users.svg" alt="No users" />
      <p>No users found. Try adjusting your filters.</p>
    </div>
  </ng-template>
</app-data-list>
```

### @ContentChildren for Programmatic Access

```typescript
// === tab-group.component.ts ===
import {
  Component,
  ContentChildren,
  QueryList,
  AfterContentInit,
} from '@angular/core';
import { TabComponent } from './tab.component';

@Component({
  selector: 'app-tab-group',
  template: `
    <div class="tab-headers">
      <button
        *ngFor="let tab of tabs"
        [class.active]="tab === activeTab"
        (click)="selectTab(tab)">
        {{ tab.label }}
      </button>
    </div>
    <div class="tab-content">
      <ng-content></ng-content>
    </div>
  `,
})
export class TabGroupComponent implements AfterContentInit {
  @ContentChildren(TabComponent) tabs!: QueryList<TabComponent>;
  activeTab!: TabComponent;

  ngAfterContentInit(): void {
    // ContentChildren is populated here, not in ngOnInit.
    this.activeTab = this.tabs.first;
    this.tabs.forEach(tab => tab.active = false);
    this.activeTab.active = true;
  }

  selectTab(tab: TabComponent): void {
    this.tabs.forEach(t => t.active = false);
    tab.active = true;
    this.activeTab = tab;
  }
}
```

```typescript
// === tab.component.ts ===
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-tab',
  template: `
    <div [hidden]="!active">
      <ng-content></ng-content>
    </div>
  `,
})
export class TabComponent {
  @Input() label = '';
  active = false;
}
```

```html
<!-- Usage -->
<app-tab-group>
  <app-tab label="Profile">
    <app-user-profile [userId]="userId"></app-user-profile>
  </app-tab>
  <app-tab label="Orders">
    <app-order-list [userId]="userId"></app-order-list>
  </app-tab>
  <app-tab label="Settings">
    <app-user-settings [userId]="userId"></app-user-settings>
  </app-tab>
</app-tab-group>
```

## The Anti-Pattern in Angular

The junior dev uses component inheritance instead of composition. They create deep class hierarchies to reuse template structure.

```typescript
// DO NOT DO THIS -- component inheritance for template reuse
@Component({ template: '' })
export class BaseCardComponent {
  @Input() title = '';
  @Input() subtitle = '';

  getFormattedTitle(): string {
    return this.title.toUpperCase();
  }
}

@Component({
  selector: 'app-user-card',
  template: `
    <div class="card">
      <h2>{{ getFormattedTitle() }}</h2>
      <h3>{{ subtitle }}</h3>
      <p>{{ user?.email }}</p>
    </div>
  `,
})
export class UserCardComponent extends BaseCardComponent {
  @Input() user: User | null = null;
}

@Component({
  selector: 'app-product-card',
  template: `
    <div class="card">
      <h2>{{ getFormattedTitle() }}</h2>
      <h3>{{ subtitle }}</h3>
      <p>{{ product?.price | currency }}</p>
    </div>
  `,
})
export class ProductCardComponent extends BaseCardComponent {
  @Input() product: Product | null = null;
}
// Every "card" duplicates the card chrome in its template.
// Adding a close button means editing every card component.
// The base class grows as you add more shared behavior.
```

The composition approach: a single `CardComponent` with `<ng-content>`:

```html
<!-- No inheritance needed -->
<app-card>
  <h2>{{ user.name }}</h2>
  <p>{{ user.email }}</p>
</app-card>

<app-card>
  <h2>{{ product.name }}</h2>
  <p>{{ product.price | currency }}</p>
</app-card>
```

## Common Mistakes

1. **Using `@ViewChild` instead of `@ContentChild`.** `@ViewChild` queries elements in the component's own template. `@ContentChild` queries elements projected from the parent. If you're looking for projected content, use `@ContentChild`. Using `@ViewChild` returns `undefined` because the content is not in the component's own view.

2. **Accessing `@ContentChild` in `ngOnInit`.** Content queries are not populated until `ngAfterContentInit`. Accessing them in `ngOnInit` gives `undefined`.

3. **Multiple `<ng-content>` without selectors.** If a component has two `<ng-content>` tags without selectors, all projected content goes into the first one and the second is empty. Use `select` attributes to route content to the correct slot.

4. **Expecting `<ng-content>` to be lazy.** Content inside `<ng-content>` is instantiated by the parent, not the child. Wrapping `<ng-content>` in `*ngIf="false"` does not prevent the projected content from being created -- it just hides it. For truly conditional rendering of projected templates, use `<ng-template>` + `ngTemplateOutlet`.

5. **Trying to style projected content from the child.** Due to view encapsulation, the child component's styles cannot reach projected content (it belongs to the parent's view). Use `::ng-deep` (deprecated but functional) or scope the styles in the parent.

## Testing This

Test single-slot projection:

```typescript
@Component({
  template: `
    <app-card>
      <h2>Test Title</h2>
      <p>Test content</p>
    </app-card>
  `,
})
class TestHostComponent {}

describe('CardComponent projection', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestHostComponent, CardComponent],
    }).compileComponents();
  });

  it('should project content into the card body', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const cardBody = fixture.nativeElement.querySelector('.card-body');
    expect(cardBody.querySelector('h2').textContent).toBe('Test Title');
    expect(cardBody.querySelector('p').textContent).toBe('Test content');
  });
});
```

Test multi-slot projection:

```typescript
@Component({
  template: `
    <app-panel>
      <div panelHeader>Header Content</div>
      <div panelBody>Body Content</div>
      <div panelFooter>Footer Content</div>
    </app-panel>
  `,
})
class TestHostComponent {}

it('should project content into correct slots', () => {
  const fixture = TestBed.createComponent(TestHostComponent);
  fixture.detectChanges();

  const header = fixture.nativeElement.querySelector('.panel-header');
  const body = fixture.nativeElement.querySelector('.panel-body');
  const footer = fixture.nativeElement.querySelector('.panel-footer');

  expect(header.textContent).toContain('Header Content');
  expect(body.textContent).toContain('Body Content');
  expect(footer.textContent).toContain('Footer Content');
});
```

Test template outlet with context:

```typescript
@Component({
  template: `
    <app-data-list [items]="items">
      <ng-template #itemTemplate let-item let-i="index">
        <span class="item">{{ i }}: {{ item.name }}</span>
      </ng-template>
    </app-data-list>
  `,
})
class TestHostComponent {
  items = [{ name: 'Alice' }, { name: 'Bob' }];
}

it('should render items using projected template', () => {
  const fixture = TestBed.createComponent(TestHostComponent);
  fixture.detectChanges();

  const items = fixture.nativeElement.querySelectorAll('.item');
  expect(items.length).toBe(2);
  expect(items[0].textContent).toContain('0: Alice');
  expect(items[1].textContent).toContain('1: Bob');
});
```

Test @ContentChildren:

```typescript
@Component({
  template: `
    <app-tab-group>
      <app-tab label="Tab 1">Content 1</app-tab>
      <app-tab label="Tab 2">Content 2</app-tab>
    </app-tab-group>
  `,
})
class TestHostComponent {}

it('should activate first tab by default', () => {
  const fixture = TestBed.createComponent(TestHostComponent);
  fixture.detectChanges();

  const activeButton = fixture.nativeElement.querySelector('button.active');
  expect(activeButton.textContent).toContain('Tab 1');
});

it('should switch tabs on click', () => {
  const fixture = TestBed.createComponent(TestHostComponent);
  fixture.detectChanges();

  const buttons = fixture.nativeElement.querySelectorAll('button');
  buttons[1].click();
  fixture.detectChanges();

  expect(buttons[1].classList).toContain('active');
  expect(buttons[0].classList).not.toContain('active');
});
```
