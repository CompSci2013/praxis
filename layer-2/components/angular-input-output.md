---
id: angular-input-output
layer1_parent: unidirectional-data-flow
angular_version: "14"
module: "@angular/core"
---

# @Input and @Output

## How Angular Implements This

Angular enforces unidirectional data flow through a strict contract between parent and child components:

- **@Input()** -- Data flows down. A parent binds a value to a child's input property. The child reads it but does not modify it.
- **@Output()** -- Events flow up. A child declares an `EventEmitter` and emits events when something happens. The parent listens and decides what to do.

This is the Angular equivalent of "props down, events up." The parent is the single source of truth. The child is a pure function of its inputs: same inputs, same output. When something happens in the child (user clicks, form changes), the child emits an event. The parent receives the event and updates its state, which flows back down through inputs.

This is how Angular's change detection works correctly. When a parent changes, Angular checks its children by comparing input references. If the child mutates its own input, the parent doesn't know, Angular doesn't know, and the UI becomes inconsistent.

## The Correct Way

```typescript
// === task-card.component.ts (child -- presentational) ===
import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

export interface Task {
  id: number;
  title: string;
  completed: boolean;
}

@Component({
  selector: 'app-task-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="task-card" [class.completed]="task.completed">
      <h3>{{ task.title }}</h3>
      <button (click)="onToggle()">
        {{ task.completed ? 'Reopen' : 'Complete' }}
      </button>
      <button (click)="onDelete()">Delete</button>
    </div>
  `,
})
export class TaskCardComponent {
  @Input() task!: Task;

  // Outputs are EventEmitters. The generic type is the payload.
  @Output() toggle = new EventEmitter<number>();  // Emits the task ID
  @Output() delete = new EventEmitter<number>();  // Emits the task ID

  onToggle(): void {
    // Do NOT mutate this.task.completed here.
    // Emit an event and let the parent handle state change.
    this.toggle.emit(this.task.id);
  }

  onDelete(): void {
    this.delete.emit(this.task.id);
  }
}
```

```typescript
// === task-list.component.ts (parent -- smart/container) ===
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Task } from '../task-card/task-card.component';
import { TaskService } from '../task.service';

@Component({
  selector: 'app-task-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-task-card
      *ngFor="let task of tasks; trackBy: trackById"
      [task]="task"
      (toggle)="onToggle($event)"
      (delete)="onDelete($event)"
    ></app-task-card>
  `,
})
export class TaskListComponent implements OnInit {
  tasks: Task[] = [];

  constructor(private taskService: TaskService) {}

  ngOnInit(): void {
    this.taskService.getTasks().subscribe(tasks => {
      this.tasks = tasks;
    });
  }

  trackById(index: number, task: Task): number {
    return task.id;
  }

  onToggle(taskId: number): void {
    // Immutable update: new array, new object for the toggled task.
    this.tasks = this.tasks.map(t =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    this.taskService.updateTask(taskId, { completed: !this.tasks.find(t => t.id === taskId)?.completed });
  }

  onDelete(taskId: number): void {
    // Immutable update: new array without the deleted task.
    this.tasks = this.tasks.filter(t => t.id !== taskId);
    this.taskService.deleteTask(taskId);
  }
}
```

### Typed Input Transforms and Setters

Sometimes you need to react when a specific input changes, or validate/transform the incoming value:

```typescript
@Component({
  selector: 'app-pagination',
  template: `
    <span>Page {{ currentPage }} of {{ totalPages }}</span>
    <button [disabled]="currentPage <= 1" (click)="prevPage.emit()">Previous</button>
    <button [disabled]="currentPage >= totalPages" (click)="nextPage.emit()">Next</button>
  `,
})
export class PaginationComponent {
  @Output() prevPage = new EventEmitter<void>();
  @Output() nextPage = new EventEmitter<void>();

  totalPages = 0;
  currentPage = 1;

  // Use a setter to react to input changes and compute derived state.
  @Input()
  set config(value: { total: number; pageSize: number; current: number }) {
    this.currentPage = value.current;
    this.totalPages = Math.ceil(value.total / value.pageSize);
  }
}
```

### Complex Output Payloads

```typescript
export interface FilterChange {
  field: string;
  value: string;
  operator: 'equals' | 'contains' | 'startsWith';
}

@Component({
  selector: 'app-filter-bar',
  template: `
    <select (change)="onFieldChange($event)">
      <option *ngFor="let f of fields" [value]="f">{{ f }}</option>
    </select>
    <input #searchInput (keyup.enter)="onSearch(searchInput.value)" />
  `,
})
export class FilterBarComponent {
  @Input() fields: string[] = [];
  @Output() filterChange = new EventEmitter<FilterChange>();

  private selectedField = '';

  onFieldChange(event: Event): void {
    this.selectedField = (event.target as HTMLSelectElement).value;
  }

  onSearch(value: string): void {
    this.filterChange.emit({
      field: this.selectedField,
      value,
      operator: 'contains',
    });
  }
}
```

## The Anti-Pattern in Angular

The junior dev mutates `@Input()` values directly, bypassing the parent. Or they use two-way binding (`[(ngModel)]`) on inputs to silently push changes back to the parent through object mutation.

```typescript
// DO NOT DO THIS -- child mutating parent's data
@Component({
  selector: 'app-task-card',
  template: `
    <div>
      <h3>{{ task.title }}</h3>
      <button (click)="task.completed = !task.completed">Toggle</button>
    </div>
  `,
})
export class TaskCardComponent {
  @Input() task!: Task;
  // Directly mutating task.completed. The parent object is mutated silently
  // because JavaScript objects are passed by reference.
  // The parent doesn't know the change happened.
  // OnPush change detection won't detect it.
  // There's no event for the parent to persist the change.
}
```

```typescript
// DO NOT DO THIS -- EventEmitter used as an Observable in a service
// EventEmitter extends Subject, so technically you can subscribe to it
// outside the template. But it is designed ONLY for @Output().
@Injectable({ providedIn: 'root' })
export class NotificationService {
  onNotification = new EventEmitter<string>();  // WRONG: use Subject or BehaviorSubject
}
```

```typescript
// DO NOT DO THIS -- emitting from ngOnInit
@Component({ ... })
export class ChildComponent implements OnInit {
  @Output() ready = new EventEmitter<void>();

  ngOnInit(): void {
    this.ready.emit();  // Emitting during initialization can cause
    // ExpressionChangedAfterItHasBeenCheckedError in the parent
    // if the parent changes state in response.
  }
}
```

## Common Mistakes

1. **Mutating @Input objects.** Angular passes objects by reference. If a child does `this.user.name = 'X'`, the parent's object is mutated too, but Angular doesn't detect the change (especially with OnPush). The child should emit an event; the parent creates a new object.

2. **Using EventEmitter outside of @Output.** `EventEmitter` is not a general-purpose event bus. It extends `Subject` but has Angular-specific behavior (synchronous by default, designed for template binding). For service-to-service communication, use `Subject` or `BehaviorSubject`.

3. **Forgetting to declare the generic type on EventEmitter.** `new EventEmitter()` defaults to `EventEmitter<void>`. If you emit a number, use `new EventEmitter<number>()`. Without the type, consumers get no type safety in their event handlers.

4. **Naming conflicts with native DOM events.** If you name an `@Output` `click`, `change`, `focus`, or any native event name, it shadows the native event and causes confusing behavior. Use descriptive names: `taskToggle`, `filterChange`, `rowSelect`.

5. **Not using `$event` in the template.** The parent accesses the emitted value via `$event` in the template binding: `(toggle)="onToggle($event)"`. Forgetting `$event` means the handler receives no argument.

## Testing This

Test that inputs render correctly:

```typescript
describe('TaskCardComponent', () => {
  let fixture: ComponentFixture<TaskCardComponent>;
  let component: TaskCardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskCardComponent);
    component = fixture.componentInstance;
  });

  it('should display task title', () => {
    component.task = { id: 1, title: 'Write tests', completed: false };
    fixture.detectChanges();

    const title = fixture.nativeElement.querySelector('h3');
    expect(title.textContent).toBe('Write tests');
  });

  it('should apply completed class when task is completed', () => {
    component.task = { id: 1, title: 'Done', completed: true };
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.task-card');
    expect(card.classList).toContain('completed');
  });
});
```

Test that outputs emit correctly:

```typescript
it('should emit toggle with task id when toggle button clicked', () => {
  component.task = { id: 42, title: 'Test', completed: false };
  fixture.detectChanges();

  spyOn(component.toggle, 'emit');

  const button = fixture.nativeElement.querySelector('button');
  button.click();

  expect(component.toggle.emit).toHaveBeenCalledWith(42);
});

it('should emit delete with task id when delete button clicked', () => {
  component.task = { id: 42, title: 'Test', completed: false };
  fixture.detectChanges();

  spyOn(component.delete, 'emit');

  const buttons = fixture.nativeElement.querySelectorAll('button');
  buttons[1].click(); // Second button is delete

  expect(component.delete.emit).toHaveBeenCalledWith(42);
});
```

Test parent-child integration (the full data flow):

```typescript
@Component({
  template: `
    <app-task-card
      [task]="task"
      (toggle)="toggled = $event"
      (delete)="deleted = $event"
    ></app-task-card>
  `,
})
class TestHostComponent {
  task: Task = { id: 1, title: 'Test', completed: false };
  toggled: number | null = null;
  deleted: number | null = null;
}

describe('TaskCard integration', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestHostComponent, TaskCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('should pass task input to child', () => {
    const title = fixture.nativeElement.querySelector('h3');
    expect(title.textContent).toBe('Test');
  });

  it('should receive toggle event from child', () => {
    const button = fixture.nativeElement.querySelector('button');
    button.click();

    expect(fixture.componentInstance.toggled).toBe(1);
  });
});
```
