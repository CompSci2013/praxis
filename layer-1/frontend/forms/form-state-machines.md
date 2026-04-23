---
id: form-state-machines
domain: frontend
category: forms
depends_on:
  - controlled-vs-uncontrolled
  - validation-strategies
related:
  - local-component-state
  - loading-error-empty-states
  - derived-state
anti_pattern_of: null
severity: recommended
---

# Form State Machines

## Definition
A form is a state machine with well-defined states — pristine (untouched), dirty (modified), touched (focused then blurred), valid, invalid, submitting, submitted, and error — and transitions between them that determine what the UI shows and what actions are allowed.

## Why It Matters
When form state is modeled as independent booleans (`isLoading`, `isValid`, `isDirty`, `hasError`, `isSubmitted`), impossible combinations can occur: `isLoading && isSubmitted`, `isValid && hasError`, or the submit button is enabled while the form is already submitting (causing double submissions). A state machine makes illegal states unrepresentable. The form is in exactly one state at a time, and only defined transitions are possible. This eliminates entire categories of bugs — double submits, error messages showing during loading, success messages appearing alongside error messages.

## The Anti-Pattern
The developer tracks form status with a loose collection of booleans and strings. Each piece of state is updated independently, and synchronization between them is the developer's responsibility. The submit handler sets `isLoading = true`, the success callback sets `isLoading = false` and `isSubmitted = true`, and the error callback sets `isLoading = false` and `hasError = true`. But a race condition means both callbacks fire, leaving the form in `isSubmitted = true && hasError = true`. The submit button check is `disabled={isLoading}` but doesn't account for `isSubmitted`, allowing re-submission.

```
// Loose booleans — impossible states possible
function ContactForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await submitForm(data);
      setIsSubmitted(true);
    } catch (e) {
      setError(e.message);
    }
    setIsLoading(false);
    // Possible state: isSubmitted=true, error="Network error", isLoading=false
    // What should the UI show? Both success and error?
  };
}

// State machine — one state at a time
function ContactForm() {
  const [formState, setFormState] = useState('idle');
  // Possible states: 'idle' | 'dirty' | 'submitting' | 'success' | 'error'
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setFormState('submitting');
    try {
      await submitForm(data);
      setFormState('success');
    } catch (e) {
      setError(e.message);
      setFormState('error');
    }
  };

  // UI is always unambiguous:
  // submitting → show spinner, disable button
  // success → show confirmation
  // error → show error, enable retry
}
```

## Recognition Signal
Look for multiple boolean state variables that describe form status (`isLoading`, `isSuccess`, `isError`, `isDirty`, `isSubmitted`). If there are more than 2 such booleans, they probably represent states of a single state machine. Look for bugs where the UI shows contradictory feedback (success message and error message simultaneously, or a spinner that never goes away). Look for the submit button being clickable during submission (double-submit bug). Test by clicking submit rapidly — if the form submits multiple times, the submitting state isn't gating the button correctly.

## Related Concepts
**Local component state** is where form state machines live — they're component-scoped by nature. **Loading, error, and empty states** is the general version of this pattern for data-driven views; form state machines apply the same principle specifically to forms. **Derived state** applies: `isSubmitDisabled` should be derived from the form state (`state === 'submitting' || state === 'success'`), not tracked as a separate boolean. **Validation strategies** interact with form state — validation errors are only shown when the field is touched or the form has been submitted.
