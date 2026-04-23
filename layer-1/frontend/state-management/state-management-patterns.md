---
id: state-management-patterns
domain: frontend
category: state-management
depends_on:
  - separation-of-concerns
related:
  - local-component-state
  - shared-state
  - global-application-state
  - unidirectional-data-flow
  - derived-state
  - state-normalization
  - url-as-state
anti_pattern_of: null
severity: critical
---

# State Management Patterns

## Definition
State management is the discipline of deciding where application data lives, how it changes, and how different parts of the application access it — organized into local (single component), shared (multiple components), and global (application-wide) tiers.

## Why It Matters
State is the source of almost every frontend bug. When state has no clear owner, multiple components modify the same data through different paths, leading to inconsistencies that are impossible to reproduce. When all state is global, every component re-renders on every change, performance degrades, and a bug in one feature corrupts data in another. When state is scattered without a strategy, the application becomes unpredictable: the same action produces different results depending on what other actions happened first.

## The Anti-Pattern
The self-taught developer starts with local state, then the first time two components need the same data, they install a global state library and put everything in it. User form input, API cache, UI toggle states, scroll positions — all in one global store. The store becomes a dumping ground with hundreds of keys. Components that display a simple tooltip are coupled to the same store that manages user authentication. Changing the shape of one feature's state breaks unrelated features. There's no principle governing what goes where; it's just "wherever I put it last time."

```
// Everything in one global store
const store = {
  user: { ... },
  theme: 'dark',
  sidebarOpen: true,
  modalVisible: false,
  searchQuery: '',
  searchResults: [],
  tooltipText: '',          // Why is this global?
  dropdownSelectedIndex: 2, // Why is THIS global?
  formField1: '',
  formField2: '',
  isFormDirty: false,
  // ... 200 more keys
};
```

## Recognition Signal
Open the global state/store file. If it contains UI state like `isDropdownOpen`, `tooltipPosition`, or form field values, state is being over-globalized. If you see prop drilling through 4+ component levels, state needs to be lifted or shared via context, but not necessarily made global. If the same piece of data is stored in two different places (store and local state) and they get out of sync, there's no state ownership strategy.

## Related Concepts
This concept is the overview; the specific tiers are **local component state** (component-owned), **shared state** (cross-component), and **global application state** (app-wide). **Unidirectional data flow** constrains how state changes propagate. **Derived state** eliminates redundant storage. **State normalization** structures complex data for reliable access. **URL as state** recognizes the URL as a state tier for navigation concerns.
