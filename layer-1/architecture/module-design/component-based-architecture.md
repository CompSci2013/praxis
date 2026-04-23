---
id: component-based-architecture
domain: architecture
category: module-design
depends_on:
  - separation-of-concerns
  - composition-over-inheritance
  - encapsulation
related:
  - module-boundaries
  - cohesion-coupling
  - single-responsibility
  - component-lifecycle
  - state-management-patterns
anti_pattern_of: null
severity: critical
---

# Component-Based Architecture

## Definition
Build user interfaces (and increasingly, backend systems) from composable, self-contained components that own their own rendering, behavior, and local state.

## Why It Matters
Before components, UIs were built by layering behavior: one file of HTML, one global CSS file, one monolithic JavaScript file that reached into the DOM with jQuery selectors. Changes to one part of the page required careful coordination across all three files, and the risk of unintended side effects was constant. Component architecture makes each piece of UI a self-contained unit that you can develop, test, and reason about independently. When done well, you can look at a component in isolation and understand everything it does without reading the rest of the application.

When done poorly -- which is common -- you get components that are either too granular (a `<DivWrapper>` around every `<div>`) or too monolithic (a 600-line `<Dashboard>` that does everything). Neither extreme delivers the benefits.

## The Anti-Pattern
Self-taught developers typically make one of two mistakes:

**Mistake 1: God components.** One component that manages a complex form, handles validation, fetches data, formats display values, and renders a complex layout. It starts as a simple component and grows because splitting it "seems like extra work."

```jsx
// 500 lines of interleaved concerns
function OrderPage() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  // ... 15 more state variables

  useEffect(() => { /* fetch logic */ }, [page, filter, sortBy]);
  // ... 20 handler functions
  // ... 200 lines of JSX with deeply nested conditionals
}
```

**Mistake 2: Prop drilling.** Instead of decomposing state management, the developer splits UI into smaller components but passes state down through 5 levels of props, creating tight implicit coupling between every layer.

```jsx
<App user={user} theme={theme} locale={locale}>
  <Layout user={user} theme={theme} locale={locale}>
    <Sidebar user={user} theme={theme}>
      <NavItem user={user} theme={theme} />  {/* Just needs user.name */}
```

## Recognition Signal
- Components longer than ~150 lines of JSX/template code
- Components with more than 8-10 props
- Props being passed through intermediate components that don't use them (prop drilling)
- Component names that describe pages rather than UI elements (`OrderManagementDashboard` vs. `OrderTable`, `OrderFilters`, `OrderRow`)
- Components that directly call APIs or contain business logic inline
- Changing one visual element requires understanding the entire component
- Components that are never reused anywhere -- everything is bespoke

## Related Concepts
**Composition over inheritance** is the core mechanism: components compose smaller components rather than inheriting from base components. **Separation of concerns** determines what goes inside a component versus what gets extracted: data fetching, business logic, and presentation are separate concerns even within a component tree. **Encapsulation** means each component hides its internal state and exposes a clean props interface. **Component lifecycle** governs how components initialize, update, and clean up. **State management patterns** solve the prop drilling problem by providing state at the right level of the tree. **Module boundaries** scale components up: a "feature module" groups related components, services, and state together.
