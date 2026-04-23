---
id: controlled-vs-uncontrolled
domain: frontend
category: forms
depends_on:
  - local-component-state
  - unidirectional-data-flow
related:
  - validation-strategies
  - form-state-machines
  - single-responsibility
anti_pattern_of: null
severity: important
---

# Controlled vs Uncontrolled Components

## Definition
A controlled form component has its value managed by framework state (the component is the single source of truth for the input's value), while an uncontrolled component lets the DOM manage the value internally (the component reads the DOM when it needs the value, typically on submit).

## Why It Matters
Mixing the two approaches without understanding the distinction creates bugs that are maddening to debug. A controlled input that sometimes doesn't have its value set reverts to the DOM's stale value. An uncontrolled input that the developer tries to programmatically update (clear on submit, populate with default data) doesn't respond because the DOM owns the value. The choice between controlled and uncontrolled determines where the truth lives, and that truth must be consistent — you can't be "sometimes controlled."

## The Anti-Pattern
The developer starts with an uncontrolled input, then realizes they need to validate on every keystroke, so they add an `onChange` handler that reads `e.target.value` and stores it in state — but they forget to set the input's `value` attribute from state, creating a half-controlled input. Or they start controlled but bypass it by reading `document.getElementById('myInput').value` directly, creating two conflicting sources of truth. In Angular, they mix template-driven and reactive forms in the same component, getting warnings they ignore.

```
// Half-controlled: reads state on change but doesn't write state back to input
function SearchForm() {
  const [query, setQuery] = useState('');

  return (
    <input
      onChange={(e) => setQuery(e.target.value)}
      // Missing: value={query}
      // The input displays whatever the user types (DOM-managed)
      // But setQuery programmatic update won't reflect in the input
    />
  );
}

// Fully controlled: state is the single source of truth
function SearchForm() {
  const [query, setQuery] = useState('');

  const handleClear = () => setQuery('');  // This works because input reads from state

  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
    />
  );
}

// Uncontrolled: DOM is the source of truth, read on submit
function SearchForm() {
  const inputRef = useRef();

  const handleSubmit = () => {
    const query = inputRef.current.value;  // Read from DOM
    search(query);
  };

  return <input ref={inputRef} defaultValue="" />;
}
```

## Recognition Signal
In React, look for inputs with `onChange` but no `value` prop, or inputs with `value` that produce "you provided a `value` prop without an `onChange` handler" warnings. Look for `document.getElementById` or `ref.current.value` in components that also use state for the same input. In Angular, look for components that import both `FormsModule` and `ReactiveFormsModule` and mix `ngModel` with `FormControl` on the same input. Look for inputs that can't be programmatically cleared or reset — a sign that the DOM owns the value but the code thinks it's controlled.

## Related Concepts
**Validation strategies** depend on this choice: controlled components can validate on every keystroke, uncontrolled can only validate on submit or blur. **Form state machines** describe the states (pristine, dirty, valid) that controlled forms track explicitly. **Unidirectional data flow** is the principle behind controlled components — state flows down to the input, events flow up to change state. **Single responsibility**: the form component's job is to manage form state; if the DOM is also managing it, responsibility is split.
