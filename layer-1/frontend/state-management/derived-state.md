---
id: derived-state
domain: frontend
category: state-management
depends_on:
  - state-management-patterns
  - unidirectional-data-flow
related:
  - local-component-state
  - state-normalization
  - single-responsibility
anti_pattern_of: null
severity: important
---

# Derived State

## Definition
Derived state is any value that can be computed from existing state rather than stored independently — totals calculated from line items, filtered lists computed from a full list plus a filter value, display labels formatted from raw data.

## Why It Matters
When you store derived values alongside their source data, you create the obligation to keep them in sync. Every time the source changes, you must remember to update the derived value. Forget once, and the UI shows contradictory information — the cart says 3 items but lists 4, the total doesn't match the line items, the "5 unread" badge stays lit after you've read everything. These bugs are insidious because they only appear when a specific update path forgets to recalculate, making them hard to reproduce.

## The Anti-Pattern
The developer stores a computed value in state and manually updates it whenever the source data changes. They store `totalPrice` alongside `cartItems`, `filteredUsers` alongside `users` and `filterText`, or `isFormValid` alongside individual field validations. Every mutation to the source data must now also update the derived value. The developer writes synchronization code, and eventually one code path misses the sync.

```
// Storing derived state
const [items, setItems] = useState([]);
const [total, setTotal] = useState(0);      // DERIVED — should not be stored
const [itemCount, setItemCount] = useState(0); // DERIVED — should not be stored

const addItem = (item) => {
  setItems([...items, item]);
  setTotal(total + item.price);     // Must remember to update
  setItemCount(itemCount + 1);      // Must remember to update
};

const removeItem = (id) => {
  const newItems = items.filter(i => i.id !== id);
  setItems(newItems);
  // Forgot to update total and itemCount — now they're wrong
};

// Correct: derive at render time
const [items, setItems] = useState([]);
const total = items.reduce((sum, item) => sum + item.price, 0);
const itemCount = items.length;
// No sync bugs possible. One source of truth.
```

## Recognition Signal
Look for state variables that are always updated in tandem — if `setX` is always called alongside `setY`, one of them is probably derived from the other. Look for variables named `total*`, `filtered*`, `sorted*`, `*Count`, `is*Valid`, `display*` — these are often derivable. Look for bugs where two pieces of the UI disagree about the same fact (badge count vs. list length, total vs. sum of line items).

## Related Concepts
**State normalization** reduces redundancy in stored data structures, which is the same principle applied to object shape rather than computed values. **Local component state** is where derived values are most commonly over-stored — it's tempting to add one more `useState` instead of computing inline. **Unidirectional data flow** supports derivation: since state changes flow through a single path, deriving values at render time is reliable. **Single responsibility** applies: the source state has the responsibility of being the truth; derived values should depend on it, not compete with it.
