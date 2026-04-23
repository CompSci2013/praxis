---
id: css-architecture
domain: frontend
category: ui-ux
depends_on:
  - separation-of-concerns
related:
  - responsive-design
  - internationalization
  - accessibility-wcag
anti_pattern_of: null
severity: important
---

# CSS Architecture

## Definition
CSS architecture is the strategy for organizing styles to prevent specificity conflicts, enable maintainable reuse, and ensure that styling one component doesn't accidentally break another — including methodologies like BEM, CSS Modules, utility-first (Tailwind), and CSS-in-JS.

## Why It Matters
CSS scales terribly by default. Every style is global. A class named `.title` in the header conflicts with `.title` in the footer. Specificity wars lead developers to add `!important` to override previous `!important` declarations. Over time, nobody dares remove any CSS because they can't be sure what it affects — the stylesheet grows monotonically. A new developer adding a feature writes new styles instead of finding existing reusable ones. The result is a 50,000-line CSS file where 60% of the rules are unused but nobody knows which 60%.

## The Anti-Pattern
The developer writes CSS in one large stylesheet with generic class names. Styles are written in the order features were built, with no organizational principle. To fix a specificity conflict, they add more specific selectors (`.page .section .content .title`) or `!important`. They don't namespace or scope styles, so changing `.button` affects every button in the app. They duplicate styles across components because they can't find or trust existing styles. The stylesheet becomes append-only: new styles are always added at the bottom, old styles are never removed, and the cognitive load of understanding the cascade is unsustainable.

```css
/* Anti-pattern: global names, specificity wars, no organization */
.title { font-size: 24px; color: blue; }
/* Later, different developer: */
.title { font-size: 18px; color: red; }  /* Conflicts with above */
/* Fix: */
.page-header .title { font-size: 24px; color: blue; }  /* More specific */
.sidebar .content .title { font-size: 18px; color: red !important; }  /* !important war */

/* BEM: namespaced, flat specificity */
.header__title { font-size: 24px; color: blue; }
.sidebar__title { font-size: 18px; color: red; }
/* No conflicts. One class = one element. Specificity is always 0,1,0. */

/* CSS Modules: locally scoped by build tool */
/* Header.module.css */
.title { font-size: 24px; color: blue; }
/* Compiles to: .Header_title_a1b2c { ... } — unique, no conflicts */

/* Utility-first (Tailwind): composition over custom classes */
<h2 class="text-2xl text-blue-600">Header Title</h2>
<h3 class="text-lg text-red-600">Sidebar Title</h3>
/* No custom CSS written. Utilities compose. No specificity issues. */
```

## Recognition Signal
Search the stylesheet for `!important` — more than a handful indicates specificity problems. Look for overly specific selectors with 3+ levels of nesting: `.page .content .section .card .title`. Check if the same visual style (same font size, color, spacing) is defined in multiple places with different class names. Try deleting a CSS rule and see if anything breaks — if you can't tell, the stylesheet has a discoverability problem. Check the CSS file size: if it's over 100KB and the app has fewer than 50 pages, there's significant bloat and duplication.

## Related Concepts
**Responsive design** must be organized within the CSS architecture — media queries should follow a consistent pattern (mobile-first or desktop-first) and be co-located with their component styles, not gathered in a separate file. **Internationalization** requires the architecture to use CSS logical properties (`inline-start`/`inline-end`) instead of physical properties (`left`/`right`). **Accessibility** interacts through focus styles — an architecture that strips `outline` globally and doesn't replace it creates accessibility failures. **Separation of concerns** is the guiding principle — each component's styles should be isolated from every other component's styles.
