---
id: accessibility-wcag
domain: frontend
category: ui-ux
depends_on: []
related:
  - responsive-design
  - validation-strategies
  - loading-error-empty-states
  - internationalization
anti_pattern_of: null
severity: critical
---

# Accessibility (WCAG 2.1 AA)

## Definition
Accessibility means building applications that can be used by people with disabilities — including visual, auditory, motor, and cognitive impairments — following the Web Content Accessibility Guidelines (WCAG) 2.1 at the AA conformance level as the minimum standard.

## Why It Matters
Approximately 15-20% of the population has some form of disability. An inaccessible application excludes them entirely. Beyond the ethical imperative, many organizations are legally required to meet accessibility standards (ADA in the US, EN 301 549 in the EU, AODA in Canada). Lawsuits over inaccessible websites have increased dramatically. And accessibility improvements benefit all users: keyboard navigation helps power users, captions help people in noisy environments, high contrast helps people using screens in sunlight, and clear focus management helps everyone understand where they are in the interface.

## The Anti-Pattern
The developer builds the entire UI with `<div>` and `<span>` elements styled to look like buttons, links, headings, and form fields. None of these elements have semantic meaning — screen readers can't distinguish a "button" div from a "paragraph" div. Click handlers are added to divs but keyboard events (`Enter`, `Space`) are not, so keyboard users can't interact with anything. Focus indicators are removed with `outline: none` because they "look ugly." Color is the only indicator of state (red for error, green for success), which is invisible to colorblind users. Images have no `alt` text. Form inputs have no associated labels.

```html
<!-- Inaccessible: divs everywhere, no semantics -->
<div class="nav">
  <div class="nav-item" onclick="navigate('/home')">Home</div>
  <div class="nav-item" onclick="navigate('/about')">About</div>
</div>
<div class="heading-large">Welcome</div>
<div class="button-looking-div" onclick="submit()">Submit</div>
<div class="input-wrapper">
  <div class="label-text">Email</div>
  <input type="text" />  <!-- No label association, no type="email" -->
</div>
<img src="chart.png" />  <!-- No alt text -->

<!-- Accessible: semantic HTML, ARIA where needed -->
<nav aria-label="Main navigation">
  <a href="/home">Home</a>
  <a href="/about">About</a>
</nav>
<h1>Welcome</h1>
<button type="submit">Submit</button>
<div>
  <label for="email">Email</label>
  <input id="email" type="email" aria-describedby="email-error" />
  <span id="email-error" role="alert">Please enter a valid email</span>
</div>
<img src="chart.png" alt="Revenue chart showing 15% growth in Q3 2025" />
```

## Recognition Signal
Run the application with only a keyboard (no mouse). Can you reach every interactive element with Tab? Can you activate buttons with Enter/Space? Can you see where the focus is? Now turn on a screen reader (VoiceOver on Mac, NVDA on Windows). Does it announce elements correctly — "button, Submit" vs. just "Submit"? Do form fields announce their labels? Do images have descriptions? Run an automated audit with Lighthouse or axe DevTools — these catch approximately 30-40% of accessibility issues (the rest require manual testing). Check color contrast ratios: text must have at least 4.5:1 against its background (3:1 for large text).

## Related Concepts
**Responsive design** overlaps with accessibility: touch targets, text resizing, and zoom support are both responsive and accessible concerns. **Validation strategies** must account for accessibility: error messages must be programmatically associated with fields via `aria-describedby` and announced by screen readers via `role="alert"` or `aria-live`. **Loading, error, and empty states** must be accessible — screen readers should announce when content is loading and when it has arrived. **Internationalization** interacts with accessibility through text direction (RTL languages), dynamic text lengths, and the `lang` attribute for correct screen reader pronunciation.
