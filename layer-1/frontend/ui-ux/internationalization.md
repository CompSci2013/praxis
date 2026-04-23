---
id: internationalization
domain: frontend
category: ui-ux
depends_on: []
related:
  - accessibility-wcag
  - responsive-design
  - css-architecture
anti_pattern_of: null
severity: important
---

# Internationalization (i18n)

## Definition
Internationalization is the practice of designing and building an application so it can be adapted to different languages, regions, and cultures without code changes — separating translatable text, formatting dates/numbers/currencies by locale, and supporting text directionality (LTR/RTL).

## Why It Matters
Retrofitting internationalization onto an application that was built with hardcoded English strings is one of the most expensive refactors in frontend development. Every string in every template, every error message, every date format, every number display, and every pluralization rule must be found and externalized. If the application was built with CSS assumptions about left-to-right text flow, supporting Arabic or Hebrew requires reworking layouts. The cost of adding i18n increases exponentially with application size — a 10-page app might take a day, a 500-page app might take months. Building with i18n from the start costs almost nothing extra.

## The Anti-Pattern
The developer hardcodes all user-facing strings directly in templates: `<h1>Welcome back!</h1>`, `<button>Submit</button>`, `<p>No results found</p>`. Dates are formatted with custom string manipulation: `${month}/${day}/${year}` (incorrect for most of the world). Numbers use hardcoded separators: `number.toFixed(2)` (comma vs period as decimal separator varies by locale). Pluralization is done with ternary operators: `${count} item${count !== 1 ? 's' : ''}` (completely wrong for languages with more than 2 plural forms, like Arabic which has 6). Layout assumes text flows left to right, with `margin-left`, `padding-right`, and absolute positioning based on left/right.

```
// Hardcoded English, unfixable without rewrite
function OrderSummary({ items, total, date }) {
  return (
    <div>
      <h2>Order Summary</h2>
      <p>{items.length} item{items.length !== 1 ? 's' : ''} in your cart</p>
      <p>Total: ${total.toFixed(2)}</p>
      <p>Placed on {date.getMonth()+1}/{date.getDate()}/{date.getFullYear()}</p>
      <p style={{ paddingLeft: '20px' }}>Thank you for your order!</p>
    </div>
  );
}

// Internationalized: all text externalized, locale-aware formatting
function OrderSummary({ items, total, date }) {
  const { t, locale } = useTranslation();
  return (
    <div>
      <h2>{t('order.summary.title')}</h2>
      <p>{t('order.summary.itemCount', { count: items.length })}</p>
      <p>{t('order.summary.total', { amount: formatCurrency(total, locale) })}</p>
      <p>{t('order.summary.date', { date: formatDate(date, locale) })}</p>
      <p style={{ paddingInlineStart: '20px' }}>{t('order.summary.thanks')}</p>
    </div>
  );
}
// paddingInlineStart: adapts to text direction (LTR → left, RTL → right)
```

## Recognition Signal
Search the codebase for hardcoded user-facing strings in templates — any string that the user reads should be externalized. Look for manual date formatting (`.getMonth()`, `.getDate()`, `.toLocaleDateString()` without locale argument). Look for `.toFixed(2)` used for displaying currency. Look for pluralization via ternary (`count === 1 ? '' : 's'`). Look for CSS properties `margin-left`, `margin-right`, `padding-left`, `padding-right`, `text-align: left`, `float: left` — these should be logical properties (`margin-inline-start`, `padding-inline-end`) for RTL support.

## Related Concepts
**Accessibility** interacts with i18n: the `lang` attribute must be set correctly for screen readers to use the right pronunciation rules, and dynamically switching languages must update ARIA labels. **Responsive design** must account for the fact that translated text can be 30-200% longer than English (German is notably verbose), requiring flexible layouts. **CSS architecture** must use logical properties (inline/block) rather than physical properties (left/right) for RTL support.
