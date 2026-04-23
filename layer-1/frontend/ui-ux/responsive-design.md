---
id: responsive-design
domain: frontend
category: ui-ux
depends_on: []
related:
  - css-architecture
  - accessibility-wcag
  - loading-error-empty-states
anti_pattern_of: null
severity: critical
---

# Responsive Design

## Definition
Responsive design is the practice of building interfaces that adapt their layout, typography, and interaction patterns to work across the full range of screen sizes — from mobile phones to ultrawide monitors — using fluid grids, flexible media, and breakpoint-driven layout changes.

## Why It Matters
Over 50% of web traffic comes from mobile devices. An application that is only usable on desktop excludes half its potential users. But responsive design is not just "make it work on phones" — it's about ensuring every screen size gets a usable experience. A dashboard designed only for 1920px monitors is unusable on a 1366px laptop. A mobile-optimized form is cramped on a tablet in landscape mode. Users access applications from devices the developer never tested on, and the layout must accommodate that gracefully.

## The Anti-Pattern
The developer builds for their own screen size (usually a large desktop monitor), then discovers the app is broken on mobile and adds media queries as patches. Fixed pixel widths (`width: 1200px`) don't adapt to smaller screens. Navigation menus overflow off-screen. Text becomes microscopic or requires horizontal scrolling. The developer adds a single `@media (max-width: 768px)` breakpoint and tries to force the entire desktop layout into mobile, resulting in either a tiny desktop layout on a phone screen or a simplistic mobile layout with most features hidden. Images are served at desktop resolution on mobile, consuming bandwidth on slow connections.

```css
/* Anti-pattern: fixed widths, no adaptation */
.container {
  width: 1200px;  /* Overflows on anything smaller */
  margin: 0 auto;
}
.sidebar {
  width: 300px;   /* Takes 40% of screen on small laptops */
  float: left;
}
.content {
  width: 900px;   /* Doesn't fit on tablets */
  float: left;
}

/* Responsive: fluid layout with breakpoints */
.container {
  max-width: 1200px;
  width: 100%;       /* Fluid: fills available space */
  margin: 0 auto;
  padding: 0 1rem;   /* Breathing room on small screens */
}
.layout {
  display: grid;
  grid-template-columns: 1fr;  /* Mobile: single column */
  gap: 1rem;
}
@media (min-width: 768px) {
  .layout {
    grid-template-columns: 250px 1fr;  /* Tablet+: sidebar + content */
  }
}
@media (min-width: 1200px) {
  .layout {
    grid-template-columns: 300px 1fr 250px;  /* Desktop: sidebar + content + aside */
  }
}
```

## Recognition Signal
Open the application and resize the browser window from full width down to 320px. If content overflows horizontally (horizontal scrollbar appears), if text becomes unreadable, if buttons become too small to tap, or if entire sections disappear without a way to access them, responsive design is missing. Test on an actual phone — desktop browser resizing misses touch target sizes, viewport meta tags, and real mobile rendering behavior. Check for the viewport meta tag: `<meta name="viewport" content="width=device-width, initial-scale=1">` — without it, mobile browsers render the page at desktop width and zoom out.

## Related Concepts
**CSS architecture** determines how responsive styles are organized — utility-first frameworks like Tailwind have responsive prefixes built in, while BEM requires separate responsive modifier classes. **Accessibility** overlaps with responsive design: touch targets must be at least 44x44 CSS pixels, text must be resizable without breaking layout, and zoom to 200% must remain functional. **Loading, error, and empty states** may need different layouts at different breakpoints.
