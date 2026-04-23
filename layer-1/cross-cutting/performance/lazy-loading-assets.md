---
id: lazy-loading-assets
domain: cross-cutting
category: performance
depends_on:
  - bundle-analysis
related:
  - code-splitting
  - virtualization
  - debouncing-throttling
anti_pattern_of: null
severity: recommended
---

# Lazy Loading Assets

## Definition
Lazy loading defers the loading of non-critical resources -- images, components, scripts, fonts, and data -- until they are needed, typically when they enter or approach the user's viewport.

## Why It Matters
A product listing page with 200 items and high-resolution images might require 50MB of image data. Loading all of it upfront means the user waits for images they will never scroll to, wastes bandwidth (especially costly on mobile data plans), and competes with critical resources for network and rendering time. Lazy loading means the page loads with only the first screenful of images (maybe 500KB), and additional images load as the user scrolls. The page becomes interactive in seconds instead of tens of seconds. This applies to all asset types: below-the-fold components, third-party widgets, video embeds, and heavy libraries that are only needed for specific interactions.

## The Anti-Pattern
A self-taught developer typically loads everything eagerly. Every `<img>` tag has a `src` that the browser immediately fetches. Every component renders fully on mount. Third-party scripts (analytics, chat widgets, social embeds) load in the `<head>` and block rendering:

```html
<!-- Every image loads immediately, even the ones 5000px below the fold -->
<div class="product-grid">
  <img src="/images/product-001-large.jpg" />  <!-- 200KB -->
  <img src="/images/product-002-large.jpg" />  <!-- 200KB -->
  <!-- ... 198 more images ... -->
  <img src="/images/product-200-large.jpg" />  <!-- 200KB -->
</div>

<!-- Third-party scripts in <head> blocking the page -->
<head>
  <script src="https://analytics.example.com/heavy-sdk.js"></script>
  <script src="https://chat.example.com/widget.js"></script>
  <script src="https://social.example.com/share-buttons.js"></script>
</head>
```

The modern fix for images is a single attribute:

```html
<img src="/images/product-001-large.jpg" loading="lazy" />
```

For components and scripts, dynamic imports and Intersection Observer provide the mechanism.

## Recognition Signal
- The Network tab shows dozens or hundreds of image requests firing immediately on page load
- Lighthouse flags "Defer offscreen images" or "Reduce unused JavaScript"
- Page load time is proportional to the number of items on the page (more products = slower load, even though the user only sees the first 10)
- Third-party scripts in the `<head>` without `async` or `defer` attributes
- No use of `loading="lazy"`, `IntersectionObserver`, or dynamic `import()` anywhere in the codebase
- Mobile users report the page is "slow" even though desktop performance seems fine (mobile networks are more bandwidth-constrained)

## Related Concepts
**Code splitting** is lazy loading applied specifically to JavaScript code -- splitting the bundle into chunks and loading them on demand. Lazy loading assets is the broader concept covering images, fonts, data, and any other resource. **Virtualization** is a complementary technique: lazy loading controls when assets are *fetched* from the network, virtualization controls when DOM nodes are *rendered* in the browser. For a list of 10,000 items, virtualization renders only the visible ~50, and lazy loading fetches images only for those ~50. **Debouncing and throttling** can improve lazy loading implementations by controlling the rate of scroll-triggered load events.
