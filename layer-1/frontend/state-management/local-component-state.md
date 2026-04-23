---
id: local-component-state
domain: frontend
category: state-management
depends_on:
  - state-management-patterns
  - component-lifecycle
related:
  - shared-state
  - derived-state
  - controlled-vs-uncontrolled
  - single-responsibility
anti_pattern_of: null
severity: important
---

# Local Component State

## Definition
Local state is data that belongs to a single component, is managed entirely within that component, and has no meaning or relevance outside of it — toggle flags, form input values before submission, animation progress, hover states.

## Why It Matters
When local state leaks into a global store, you create coupling between unrelated parts of the application. A dropdown's open/closed state is nobody else's business. Putting it in a global store means every global state change potentially triggers a re-evaluation of every dropdown in the app. More importantly, it makes the component impossible to reuse — it can't function without the specific global store shape it depends on. Local state is what makes a component self-contained and portable.

## The Anti-Pattern
Two patterns appear. First: putting everything in global state because the developer learned one state management approach and applies it universally. The dropdown `isOpen` flag, the text input's current value, the accordion's expanded section — all dispatched to a Redux/NgRx store with actions, reducers, and selectors for something that could be a single `useState` or class field. Second: lifting state up prematurely. The developer anticipates that some parent "might need" the data someday, so they lift a toggle state three levels up and pass it back down through props, creating fragile prop chains for no current requirement.

```
// Over-engineered: global store for a toggle
// actions.ts
export const TOGGLE_FAQ_ITEM = 'TOGGLE_FAQ_ITEM';
// reducer.ts
case TOGGLE_FAQ_ITEM:
  return { ...state, expandedFaqId: action.payload };
// component.ts
const expandedId = useSelector(state => state.ui.expandedFaqId);
const dispatch = useDispatch();
// Could have been: const [expandedId, setExpandedId] = useState(null);
```

## Recognition Signal
In the global store, look for keys that describe UI state of a single component: `isModalOpen`, `selectedTabIndex`, `accordionExpandedPanel`, `inputValue`. If a piece of state is only read by the component that writes it, it should be local. Another signal: components that dispatch actions and immediately select the result back — they're round-tripping through the store for no reason.

## Related Concepts
**Shared state** is the next tier up — when two sibling components genuinely need the same data, it gets lifted to their closest common ancestor or a shared context. **Derived state** applies within local state too — if you can compute it from existing local state, don't store it separately. **Controlled vs uncontrolled** forms is a specific instance of the local state decision — who owns the form input value? **Single responsibility** from architecture applies: a component should own the state for its own concern and nothing else.
