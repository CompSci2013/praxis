---
id: bundle-analysis
domain: cross-cutting
category: performance
depends_on: []
related:
  - code-splitting
  - lazy-loading-assets
  - ci-cd-pipelines
anti_pattern_of: null
severity: important
---

# Bundle Analysis

## Definition
Bundle analysis is the practice of inspecting your application's compiled output to understand exactly what code ships to the browser, how large each module is, and what dependencies contribute the most to download size.

## Why It Matters
Most developers have no idea how large their application is or why. They install a date library for one formatting function and ship 72KB of locale data. They import a utility library for a single function and bundle the entire package. They include three different icon libraries because different components use different ones. Without analyzing the bundle, you are optimizing blind -- guessing at what makes the app slow instead of measuring. Bundle size directly correlates with load time, especially on mobile networks. Every 100KB of JavaScript adds roughly 300ms of parse and execute time on a mid-range phone. A 2MB bundle means a 6-second blank screen on a 3G connection.

## The Anti-Pattern
A self-taught developer adds dependencies freely without considering their size impact. They `npm install moment` for date formatting, `lodash` for a single utility, `@mui/icons-material` for one icon. They never run a bundle analyzer, so they have no visibility into the cost of each decision. When the app feels slow, they add a loading spinner instead of reducing what loads:

```javascript
// Importing an entire library for one function
import _ from 'lodash';  // ~71KB minified + gzipped
const sorted = _.sortBy(users, 'name');
// Could be: users.sort((a, b) => a.name.localeCompare(b.name))

// Importing an entire icon library for one icon
import { Search } from '@mui/icons-material';  // Pulls in every icon at build time
// Should be: import Search from '@mui/icons-material/Search'

// moment.js with all locales -- 232KB minified for one date format
import moment from 'moment';
const formatted = moment(date).format('YYYY-MM-DD');
// Could be: date.toISOString().split('T')[0]
// Or: import { format } from 'date-fns' (5KB for format alone)
```

## Recognition Signal
- `node_modules` is huge but nobody has run `npx webpack-bundle-analyzer` or `npx vite-bundle-visualizer`
- The production bundle is over 500KB gzipped and nobody can explain why
- Multiple libraries that do the same thing (moment + date-fns + dayjs, lodash + underscore + ramda)
- `import X from 'library'` rather than `import { specificThing } from 'library/specificThing'`
- The `package.json` has 40+ dependencies but the app has 5 pages
- No bundle size check in CI -- the bundle grows unchecked with every PR
- Lighthouse performance score below 50 on mobile

## Related Concepts
**Code splitting** is the primary action you take after analyzing the bundle -- splitting large chunks into smaller pieces loaded on demand. **Lazy loading assets** is the mechanism for deferring non-critical chunks identified by bundle analysis. **CI/CD pipelines** should include bundle size checks (tools like `bundlesize` or `size-limit`) to prevent regressions -- once you fix the bundle, you need a gate to keep it fixed.
