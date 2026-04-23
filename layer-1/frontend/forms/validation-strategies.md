---
id: validation-strategies
domain: frontend
category: forms
depends_on:
  - controlled-vs-uncontrolled
related:
  - form-state-machines
  - loading-error-empty-states
  - accessibility-wcag
anti_pattern_of: null
severity: important
---

# Validation Strategies

## Definition
Validation strategy determines when form inputs are checked for correctness — on every keystroke (on change), when the user leaves the field (on blur), when the form is submitted (on submit), or a combination — and how errors are communicated to the user.

## Why It Matters
The wrong validation timing creates a hostile user experience. Validate on every keystroke and the user sees "invalid email" while they're still typing their email address — the error appears after the first character and doesn't go away until they've finished typing. This trains users to ignore error messages. Validate only on submit and the user fills out a 20-field form, clicks submit, and discovers 8 errors they could have caught incrementally. The right strategy is usually a hybrid: validate on blur (when the user moves to the next field) to catch errors early, validate on change after the first error has appeared (so the user sees the error clear as they fix it), and validate on submit as a final gate.

## The Anti-Pattern
The developer validates everything on change, showing errors for incomplete input. Or they validate only on submit, providing no incremental feedback. Or they validate inconsistently — some fields on change, some on blur, some only on submit — with no coherent UX pattern. Error messages appear and disappear in unpredictable places. Required field errors show immediately on page load before the user has interacted with anything. Password strength indicators yell "too weak" after a single character.

```
// Aggressive: validates before user finishes typing
function EmailField() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setEmail(e.target.value);
    // User types "j" — immediately shows "Invalid email"
    if (!e.target.value.match(/^[^@]+@[^@]+\.[^@]+$/)) {
      setError('Invalid email address');
    } else {
      setError('');
    }
  };

  return (
    <div>
      <input value={email} onChange={handleChange} />
      {error && <span className="error">{error}</span>}
    </div>
  );
}

// Better: validate on blur, clear on change
function EmailField() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  const validate = (value) => {
    if (!value) return 'Email is required';
    if (!value.match(/^[^@]+@[^@]+\.[^@]+$/)) return 'Invalid email address';
    return '';
  };

  return (
    <div>
      <input
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (touched) setError(validate(e.target.value)); // Clear error as user fixes
        }}
        onBlur={() => {
          setTouched(true);
          setError(validate(email)); // Show error when user leaves field
        }}
      />
      {error && <span className="error">{error}</span>}
    </div>
  );
}
```

## Recognition Signal
Fill out a form on the application. If you see error messages before you've finished typing in a field, validation is too aggressive. If you fill out the entire form and submit before learning about any errors, validation provides no incremental feedback. If some fields show errors on blur and others on change with no apparent logic, the strategy is inconsistent. Check whether error messages are associated with their inputs via `aria-describedby` — if not, screen readers can't connect the error to the field.

## Related Concepts
**Form state machines** track the pristine/dirty/touched state that drives when validation fires. **Controlled vs uncontrolled** determines whether you even have access to the value for real-time validation — uncontrolled forms can typically only validate on submit. **Loading, error, and empty states** is the general principle of handling failure states in the UI, applied here to form fields. **Accessibility** requires that error messages be programmatically associated with their inputs and announced to screen readers.
