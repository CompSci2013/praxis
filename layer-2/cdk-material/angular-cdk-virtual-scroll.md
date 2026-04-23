---
id: angular-cdk-virtual-scroll
layer1_parent: virtualization
angular_version: "14"
module: "@angular/cdk/scrolling"
---

# CDK Virtual Scroll

## How Angular Implements This

Virtual scrolling renders only the DOM nodes visible in the viewport, plus a small buffer. For a list of 100,000 items, the browser maintains perhaps 20-30 DOM nodes at any time. As the user scrolls, nodes leaving the viewport are recycled for items entering it.

The CDK provides `cdk-virtual-scroll-viewport` as the scroll container and `*cdkVirtualFor` as the structural directive (replaces `*ngFor`). The viewport manages a spacer element whose height equals the total height of all items, giving the scrollbar the correct proportions.

Angular 14 supports one production-ready strategy: **fixed-size items** via `itemSize`. Every item must be the same height. The alternative (`autosize`) is experimental and not recommended.

How it works internally:
1. The viewport measures its own height
2. Given `itemSize`, it calculates how many items fit (visible items + buffer)
3. On scroll, it calculates which slice of the data array to render
4. `*cdkVirtualFor` creates/recycles DOM nodes for that slice
5. A CSS `transform: translateY(...)` positions the rendered items correctly

## The Correct Way

### Basic list with fixed-size items

```typescript
// item-list.component.ts
import { Component } from '@angular/core';

interface Item {
  id: number;
  name: string;
  description: string;
}

@Component({
  selector: 'app-item-list',
  template: `
    <cdk-virtual-scroll-viewport itemSize="56" class="list-viewport">
      <div
        *cdkVirtualFor="let item of items; trackBy: trackById"
        class="list-item"
      >
        <strong>{{ item.name }}</strong>
        <span>{{ item.description }}</span>
      </div>
    </cdk-virtual-scroll-viewport>
  `,
  styles: [`
    .list-viewport {
      height: 400px;       /* REQUIRED: viewport needs a fixed height */
      width: 100%;
    }
    .list-item {
      height: 56px;        /* Must match itemSize exactly */
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 16px;
      border-bottom: 1px solid #eee;
      box-sizing: border-box;  /* Include border in height calculation */
    }
  `]
})
export class ItemListComponent {
  items: Item[] = Array.from({ length: 50000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    description: `Description for item ${i}`
  }));

  trackById(index: number, item: Item): number {
    return item.id;
  }
}
```

### Module setup

```typescript
// item-list.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ItemListComponent } from './item-list.component';

@NgModule({
  imports: [
    CommonModule,
    ScrollingModule   // Provides cdk-virtual-scroll-viewport and *cdkVirtualFor
  ],
  declarations: [ItemListComponent],
  exports: [ItemListComponent]
})
export class ItemListModule {}
```

### Scrolling to a specific index

```typescript
// scroll-to.component.ts
import { Component, ViewChild } from '@angular/core';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';

@Component({
  selector: 'app-scroll-to',
  template: `
    <div class="controls">
      <input #indexInput type="number" placeholder="Jump to index..." />
      <button (click)="scrollTo(indexInput.value)">Go</button>
    </div>
    <cdk-virtual-scroll-viewport itemSize="48" class="viewport">
      <div *cdkVirtualFor="let item of items; trackBy: trackById" class="row">
        #{{ item.id }} - {{ item.name }}
      </div>
    </cdk-virtual-scroll-viewport>
  `,
  styles: [`
    .viewport { height: 300px; }
    .row { height: 48px; line-height: 48px; padding: 0 16px; }
  `]
})
export class ScrollToComponent {
  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;

  items = Array.from({ length: 10000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`
  }));

  trackById(index: number, item: { id: number }): number {
    return item.id;
  }

  scrollTo(indexStr: string): void {
    const index = parseInt(indexStr, 10);
    if (!isNaN(index)) {
      this.viewport.scrollToIndex(index, 'smooth');
    }
  }
}
```

### Using with an observable data source

```typescript
// observable-list.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-observable-list',
  template: `
    <button (click)="loadMore()">Load 1000 More</button>
    <cdk-virtual-scroll-viewport itemSize="40" class="viewport">
      <div *cdkVirtualFor="let item of items$ | async; trackBy: trackById"
           class="row">
        {{ item.name }}
      </div>
    </cdk-virtual-scroll-viewport>
  `,
  styles: [`
    .viewport { height: 500px; }
    .row { height: 40px; line-height: 40px; padding: 0 16px; }
  `]
})
export class ObservableListComponent implements OnInit, OnDestroy {
  private allItems: { id: number; name: string }[] = [];
  items$ = new BehaviorSubject<{ id: number; name: string }[]>([]);
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadMore();
  }

  loadMore(): void {
    const start = this.allItems.length;
    const newItems = Array.from({ length: 1000 }, (_, i) => ({
      id: start + i,
      name: `Item ${start + i}`
    }));
    this.allItems = [...this.allItems, ...newItems];
    this.items$.next(this.allItems);
  }

  trackById(index: number, item: { id: number }): number {
    return item.id;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

## The Anti-Pattern in Angular

**Using `*ngFor` for large lists.**

```html
<!-- WRONG: 50,000 DOM nodes created at once -->
<div class="list-container" style="height: 400px; overflow: auto;">
  <div *ngFor="let item of items" class="row">
    {{ item.name }}
  </div>
</div>
```

This creates a DOM node for every item in the array. With 50,000 items, the browser must allocate memory for 50,000 elements, compute layout for all of them, and repaint on every scroll. Initial render takes multiple seconds. Memory usage is enormous. Virtual scroll renders ~20 nodes regardless of list size.

**No fixed height on the viewport.**

```html
<!-- WRONG: viewport collapses to 0px height -->
<cdk-virtual-scroll-viewport itemSize="48">
  <div *cdkVirtualFor="let item of items" class="row">
    {{ item.name }}
  </div>
</cdk-virtual-scroll-viewport>
```

The viewport must have an explicit height. Without it, the viewport has zero height, zero items are visible, and nothing renders. Set height in CSS, or use flex layout where the parent gives the viewport a bounded height.

**`itemSize` does not match actual item height.**

```html
<!-- itemSize="48" but actual rendered height is 64px (48px + 16px padding) -->
<cdk-virtual-scroll-viewport itemSize="48">
  <div *cdkVirtualFor="let item of items"
       style="height: 48px; padding: 8px 0;">
    <!-- Actual height: 48 + 8 + 8 = 64px -->
  </div>
</cdk-virtual-scroll-viewport>
```

The mismatch causes: scroll position jumps, gaps between items, items overlapping, and incorrect scrollbar height. Measure the actual rendered height of an item (including padding, border, margin) and set `itemSize` to that value. Use `box-sizing: border-box` to make height calculations predictable.

## Common Mistakes

1. **Forgetting `trackBy`**: Without `trackBy`, Angular destroys and recreates every DOM node on each data change. With virtual scroll this causes visible flickering during scrolling. Always provide a `trackBy` function that returns a stable, unique ID.

2. **Putting the viewport inside a scrollable container**: If the viewport is inside a `<div style="overflow: auto">`, the outer div handles scrolling and the viewport never receives scroll events. The viewport itself must be the scroll container.

3. **Variable-height items**: The fixed-size strategy requires uniform item heights. If your items have genuinely different heights (expanding sections, variable text), either normalize the height (truncate text, fix dimensions) or use pagination instead of virtual scroll. The experimental `autosize` strategy exists but is unreliable in Angular 14.

4. **Empty viewport after data change**: If you replace the `items` array reference and the viewport does not update, call `this.viewport.checkViewportSize()` after the data change. This forces the viewport to recalculate.

5. **Performance with complex item templates**: Virtual scroll reduces DOM node count, not rendering cost per node. If each item contains 10 nested components with change detection, scrolling will still be slow. Keep item templates simple or use `ChangeDetectionStrategy.OnPush` on child components.

## Testing This

```typescript
// item-list.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { By } from '@angular/platform-browser';
import { ItemListComponent } from './item-list.component';

describe('ItemListComponent', () => {
  let fixture: ComponentFixture<ItemListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScrollingModule],
      declarations: [ItemListComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ItemListComponent);
    fixture.detectChanges();
  });

  it('should render far fewer DOM nodes than data items', () => {
    const renderedItems = fixture.debugElement.queryAll(By.css('.list-item'));
    const totalItems = fixture.componentInstance.items.length;

    expect(totalItems).toBe(50000);
    expect(renderedItems.length).toBeLessThan(30);
    expect(renderedItems.length).toBeGreaterThan(0);
  });

  it('should scroll to a specific index', () => {
    const viewport = fixture.debugElement.query(
      By.directive(CdkVirtualScrollViewport)
    ).componentInstance as CdkVirtualScrollViewport;

    viewport.scrollToIndex(500);
    fixture.detectChanges();

    const range = viewport.getRenderedRange();
    expect(range.start).toBeLessThanOrEqual(500);
    expect(range.end).toBeGreaterThan(500);
  });
});
```

The primary assertion: rendered DOM node count stays constant regardless of total data size. If `queryAll(By.css('.list-item')).length` scales with data size, virtual scroll is misconfigured.
