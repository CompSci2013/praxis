---
id: angular-cdk-drag-drop
layer1_parent: null
angular_version: "14"
module: "@angular/cdk/drag-drop"
---

# CDK Drag and Drop

## How Angular Implements This

The CDK `DragDropModule` provides directives for making elements draggable (`cdkDrag`) and defining drop zones (`cdkDropList`). It handles hit detection, animation, placeholder rendering, and accessibility. You respond to the `cdkDropListDropped` event by updating your data model -- the CDK does not mutate your arrays.

Three capabilities:
1. **Reordering within a list** -- drag items up/down to rearrange (use `moveItemInArray`)
2. **Transferring between lists** -- drag items from one list to another (use `transferArrayItem`)
3. **Free dragging** -- drag elements anywhere on the page without a list container

Supporting features:
- `cdkDragHandle` -- only a specific child element starts the drag
- `*cdkDragPreview` -- customizes the element the user sees while dragging
- `*cdkDragPlaceholder` -- customizes the gap left behind in the list
- `cdkDragBoundary` -- constrains drag movement within a CSS selector
- `cdkDropListConnectedTo` -- declares which drop lists accept items from each other

## The Correct Way

### Reorderable list

```typescript
// task-list.component.ts
import { Component } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

interface Task {
  id: number;
  title: string;
  priority: 'high' | 'medium' | 'low';
}

@Component({
  selector: 'app-task-list',
  template: `
    <h3>Tasks</h3>
    <div cdkDropList class="task-list" (cdkDropListDropped)="onDrop($event)">
      <div
        *ngFor="let task of tasks"
        cdkDrag
        class="task-item"
      >
        <!-- Only the handle starts the drag -->
        <span cdkDragHandle class="handle">&#9776;</span>
        <span class="title">{{ task.title }}</span>
        <span class="badge" [class]="task.priority">{{ task.priority }}</span>
      </div>
    </div>
  `,
  styles: [`
    .task-list {
      max-width: 400px;
      min-height: 60px;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    .task-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border-bottom: 1px solid #eee;
      background: white;
    }
    .handle { cursor: grab; }

    /* CDK adds these classes during drag operations */
    .cdk-drag-preview {
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      border-radius: 4px;
    }
    .cdk-drag-placeholder {
      opacity: 0;
    }
    .cdk-drag-animating {
      transition: transform 200ms ease;
    }
    .cdk-drop-list-dragging .cdk-drag:not(.cdk-drag-placeholder) {
      transition: transform 200ms ease;
    }
  `]
})
export class TaskListComponent {
  tasks: Task[] = [
    { id: 1, title: 'Design the API', priority: 'high' },
    { id: 2, title: 'Write tests', priority: 'medium' },
    { id: 3, title: 'Deploy to staging', priority: 'low' },
    { id: 4, title: 'Update docs', priority: 'low' },
  ];

  onDrop(event: CdkDragDrop<Task[]>): void {
    moveItemInArray(this.tasks, event.previousIndex, event.currentIndex);
  }
}
```

### Module setup

```typescript
import { DragDropModule } from '@angular/cdk/drag-drop';

@NgModule({
  imports: [CommonModule, DragDropModule],
  declarations: [TaskListComponent]
})
export class TaskModule {}
```

### Kanban board -- transferring between lists

```typescript
// kanban.component.ts
import { Component } from '@angular/core';
import {
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem
} from '@angular/cdk/drag-drop';

interface Card {
  id: number;
  title: string;
}

@Component({
  selector: 'app-kanban',
  template: `
    <div class="board">
      <div class="column">
        <h3>To Do</h3>
        <div
          cdkDropList
          #todoList="cdkDropList"
          [cdkDropListData]="todo"
          [cdkDropListConnectedTo]="[doingList, doneList]"
          class="card-list"
          (cdkDropListDropped)="drop($event)"
        >
          <div *ngFor="let card of todo" cdkDrag class="card">
            {{ card.title }}
          </div>
        </div>
      </div>

      <div class="column">
        <h3>Doing</h3>
        <div
          cdkDropList
          #doingList="cdkDropList"
          [cdkDropListData]="doing"
          [cdkDropListConnectedTo]="[todoList, doneList]"
          class="card-list"
          (cdkDropListDropped)="drop($event)"
        >
          <div *ngFor="let card of doing" cdkDrag class="card">
            {{ card.title }}
          </div>
        </div>
      </div>

      <div class="column">
        <h3>Done</h3>
        <div
          cdkDropList
          #doneList="cdkDropList"
          [cdkDropListData]="done"
          [cdkDropListConnectedTo]="[todoList, doingList]"
          class="card-list"
          (cdkDropListDropped)="drop($event)"
        >
          <div *ngFor="let card of done" cdkDrag class="card">
            {{ card.title }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .board { display: flex; gap: 16px; }
    .column { flex: 1; }
    .card-list {
      min-height: 60px;
      background: #f5f5f5;
      border-radius: 4px;
      padding: 8px;
    }
    .card {
      padding: 12px;
      margin-bottom: 8px;
      background: white;
      border-radius: 4px;
      border: 1px solid #ddd;
      cursor: move;
    }
  `]
})
export class KanbanComponent {
  todo: Card[] = [
    { id: 1, title: 'Research competitors' },
    { id: 2, title: 'Draft requirements' },
  ];
  doing: Card[] = [
    { id: 3, title: 'Build prototype' },
  ];
  done: Card[] = [
    { id: 4, title: 'Set up CI/CD' },
  ];

  drop(event: CdkDragDrop<Card[]>): void {
    if (event.previousContainer === event.container) {
      // Reorder within same list
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    } else {
      // Move from one list to another
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
  }
}
```

### Custom drag preview and placeholder

```typescript
@Component({
  template: `
    <div cdkDropList (cdkDropListDropped)="drop($event)">
      <div *ngFor="let item of items" cdkDrag>
        {{ item.name }}

        <!-- What the user drags (replaces the default clone) -->
        <div *cdkDragPreview class="custom-preview">
          Moving: {{ item.name }}
        </div>

        <!-- What stays behind in the list -->
        <div *cdkDragPlaceholder class="custom-placeholder">
          <!-- empty box showing where item will land -->
        </div>
      </div>
    </div>
  `,
  styles: [`
    .custom-preview {
      padding: 8px;
      background: #e3f2fd;
      border: 2px dashed #1976d2;
      border-radius: 4px;
      font-weight: bold;
    }
    .custom-placeholder {
      height: 48px;
      background: #f0f0f0;
      border: 2px dashed #ccc;
      border-radius: 4px;
    }
  `]
})
export class CustomDragComponent { }
```

## The Anti-Pattern in Angular

**Mutating the DOM instead of the data model.**

```typescript
// WRONG -- manually moves DOM elements
drop(event: CdkDragDrop<any>): void {
  const element = event.item.element.nativeElement;
  event.container.element.nativeElement.appendChild(element);
}
```

Angular renders the DOM from data. If you move DOM nodes manually, the DOM and data desync. The next change detection cycle re-renders from data, undoing your move. Always update the data array with `moveItemInArray` or `transferArrayItem`, and let `*ngFor` reconcile the DOM.

**Not connecting lists.**

```html
<!-- WRONG: two lists with no connection -->
<div cdkDropList [cdkDropListData]="listA">...</div>
<div cdkDropList [cdkDropListData]="listB">...</div>
<!-- Dragging from A to B does nothing. No visual feedback. -->
```

Lists are isolated by default. You must explicitly connect them using `cdkDropListConnectedTo`. For a group of lists where every list connects to every other, use `cdkDropListGroup`:

```html
<div cdkDropListGroup>
  <div cdkDropList [cdkDropListData]="listA">...</div>
  <div cdkDropList [cdkDropListData]="listB">...</div>
  <div cdkDropList [cdkDropListData]="listC">...</div>
  <!-- All three are automatically connected -->
</div>
```

## Common Mistakes

1. **Using `moveItemInArray` for cross-list transfers**: `moveItemInArray(array, from, to)` operates on a single array. For cross-list moves, use `transferArrayItem(source, dest, fromIndex, toIndex)`. Check `event.previousContainer === event.container` to decide which to call.

2. **Missing `[cdkDropListData]`**: Without binding the data array to `cdkDropListData`, `event.container.data` is `undefined`. `transferArrayItem` crashes with "Cannot read property 'splice' of undefined."

3. **Items snap back after drop**: The `drop` handler threw an error (silently caught by Angular), or you reassigned the array reference instead of mutating it. `moveItemInArray` mutates in place. If you do `this.tasks = [...this.tasks]` after the move, the CDK animation breaks because the array reference changed.

4. **Drag handle not working**: `cdkDragHandle` must be a descendant of the `cdkDrag` element. If it is a sibling or projected from a different component, it does not connect.

5. **No visual feedback during drag**: The CDK applies CSS classes automatically (`cdk-drag-preview`, `cdk-drag-placeholder`, `cdk-drag-animating`, `cdk-drop-list-dragging`). If you do not define styles for these classes, the drag looks broken -- no elevation, no placeholder, jerky animations. Add the CSS shown in the correct example above.

## Testing This

```typescript
// task-list.component.spec.ts
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TaskListComponent } from './task-list.component';

describe('TaskListComponent', () => {
  let fixture: ComponentFixture<TaskListComponent>;
  let component: TaskListComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DragDropModule],
      declarations: [TaskListComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TaskListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render all tasks', () => {
    const items = fixture.debugElement.queryAll(By.css('.task-item'));
    expect(items.length).toBe(4);
  });

  it('should reorder on drop', () => {
    expect(component.tasks[0].title).toBe('Design the API');
    expect(component.tasks[2].title).toBe('Deploy to staging');

    // Simulate a drop event directly -- do not attempt to simulate mouse drag
    component.onDrop({
      previousIndex: 0,
      currentIndex: 2,
      container: { data: component.tasks },
      previousContainer: { data: component.tasks },
      isPointerOverContainer: true,
      item: {},
      distance: { x: 0, y: 0 },
      dropPoint: { x: 0, y: 0 },
    } as CdkDragDrop<any[]>);

    expect(component.tasks[0].title).toBe('Write tests');
    expect(component.tasks[2].title).toBe('Design the API');
  });
});
```

Testing actual drag-and-drop mouse interactions in unit tests is fragile and slow. Test the `drop` handler logic directly by constructing the `CdkDragDrop` event manually. Use Cypress or Playwright for visual interaction testing.
