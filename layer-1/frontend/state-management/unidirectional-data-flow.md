---
id: unidirectional-data-flow
domain: frontend
category: state-management
depends_on:
  - state-management-patterns
related:
  - local-component-state
  - shared-state
  - global-application-state
  - separation-of-concerns
anti_pattern_of: null
severity: critical
---

# Unidirectional Data Flow

## Definition
Data flows in one direction through the component tree: state is owned by a parent and passed down to children as read-only input, while children communicate changes back up through events or callbacks — never by mutating the data they received.

## Why It Matters
When data flows in one direction, you can trace any piece of UI back to its source. Click on a number in the UI, find which component renders it, follow the data upward to its owner, and you've found the truth. When data flows in multiple directions — children mutate parent state directly, siblings modify each other, services push changes into components without going through the state owner — the same number could be coming from anywhere. Bugs become impossible to trace because a value might have been changed by any of a dozen code paths. Every framework (React, Angular, Vue, Svelte) is designed around this principle; fighting it creates code the framework can't optimize or reason about.

## The Anti-Pattern
The developer passes an object to a child component, and the child mutates it directly. It "works" because JavaScript objects are passed by reference. But now the parent's state changed without the parent knowing — no re-render is triggered, the change is invisible to devtools, and if two children both mutate the same object, they silently overwrite each other. Another pattern: a child reaches up into the parent (through DOM traversal, injected references, or a shared mutable service) and changes state directly.

```
// Child mutating parent's data directly
function ParentList({ items }) {
  return items.map(item => <ItemEditor key={item.id} item={item} />);
}

function ItemEditor({ item }) {
  const handleChange = (e) => {
    item.name = e.target.value; // Direct mutation of parent's object
    // No re-render. Parent doesn't know. DevTools shows stale state.
  };
  return <input value={item.name} onChange={handleChange} />;
}

// Correct: child requests change via callback
function ItemEditor({ item, onUpdate }) {
  const handleChange = (e) => {
    onUpdate(item.id, { name: e.target.value }); // Parent decides what to do
  };
  return <input value={item.name} onChange={handleChange} />;
}
```

## Recognition Signal
Look for object or array mutations in child components: `props.items.push(...)`, `this.input.value = ...` where `input` is an `@Input()` in Angular, direct property assignment on received objects. Look for two-way binding used as a default rather than a conscious choice. Look for bugs where the UI doesn't update after a change — a hallmark of mutation that bypasses the framework's change detection.

## Related Concepts
This principle governs all three state tiers: **local component state** is the simplest case (one owner, no sharing), **shared state** requires the owner to provide update functions alongside the data, and **global application state** libraries like Redux enforce this through actions and reducers. **Separation of concerns** is the architectural principle behind it — the component that owns state has one concern, the component that displays it has another.
