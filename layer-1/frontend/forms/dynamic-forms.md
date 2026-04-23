---
id: dynamic-forms
domain: frontend
category: forms
depends_on:
  - controlled-vs-uncontrolled
  - validation-strategies
  - form-state-machines
related:
  - state-management-patterns
  - derived-state
  - declarative-routing
anti_pattern_of: null
severity: recommended
---

# Dynamic Forms

## Definition
Dynamic forms are forms whose structure — the number, type, and arrangement of fields — changes at runtime based on user input, server configuration, or business rules, rather than being hardcoded in the template.

## Why It Matters
Many real applications require forms that adapt: a tax form that shows different sections based on filing status, an onboarding wizard that skips steps based on user type, a CMS editor where field definitions come from a database, or an order form where selecting "custom" reveals additional configuration fields. Without a dynamic form strategy, the developer hardcodes every possible combination of fields into the template with `v-if`/`*ngIf`/conditional rendering, creating templates hundreds of lines long that are impossible to maintain and test.

## The Anti-Pattern
The developer builds one monolithic template with every possible field, then uses dozens of conditional visibility flags to show/hide fields based on selections. Validation rules are scattered throughout the template, with each conditional field having its own inline validation that may or may not match the visibility condition. When a hidden field retains its value and that value gets submitted to the server, it causes data integrity issues. When a new field combination is needed, the developer adds more conditionals to an already unmanageable template.

```
// Hardcoded conditional nightmare
function OrderForm({ productType }) {
  return (
    <form>
      <input name="quantity" />
      {productType === 'physical' && <input name="shippingAddress" />}
      {productType === 'physical' && shippingMethod === 'express' && <input name="expressAccount" />}
      {productType === 'digital' && <input name="email" />}
      {productType === 'digital' && format === 'custom' && <input name="customFormat" />}
      {productType === 'subscription' && <input name="billingCycle" />}
      {productType === 'subscription' && billingCycle === 'annual' && <input name="fiscalYear" />}
      {/* 30 more conditionals... */}
    </form>
  );
}

// Data-driven: form structure defined as configuration
const formConfig = {
  physical: [
    { name: 'quantity', type: 'number', required: true },
    { name: 'shippingAddress', type: 'address', required: true },
    { name: 'expressAccount', type: 'text', showWhen: { shippingMethod: 'express' } }
  ],
  digital: [
    { name: 'quantity', type: 'number', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'customFormat', type: 'text', showWhen: { format: 'custom' } }
  ]
};

function OrderForm({ productType }) {
  const fields = formConfig[productType];
  return (
    <form>
      {fields.map(field => <DynamicField key={field.name} config={field} />)}
    </form>
  );
}
```

## Recognition Signal
Count the conditional rendering directives in a form template. If there are more than 5-10 visibility conditions, the form is a candidate for a data-driven approach. Look for validation bugs where hidden fields cause submission failures or where values from a previously visible field persist after the field is hidden. Look for forms where adding a new field option requires modifying template logic rather than just adding configuration data.

## Related Concepts
**Controlled vs uncontrolled** matters especially for dynamic forms — when a field appears or disappears, its state must be created or cleaned up correctly. **Validation strategies** must account for dynamic fields: a field that isn't visible shouldn't be validated, and its value shouldn't be submitted. **Form state machines** describe the overall form state, while dynamic forms describe the structure. **Derived state** applies when field visibility is computed from other field values. **State management patterns** guides where the form configuration lives (fetched from a server? computed from local data?).
