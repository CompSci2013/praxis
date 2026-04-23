---
id: angular-differential-loading
layer1_parent: null
angular_version: "14"
module: "@angular/cli"
---

# Differential Loading

## How Angular Implements This

Differential loading is Angular's strategy for serving different JavaScript bundles to modern and legacy browsers. When you run a production build, the CLI produces two sets of bundles:

1. **ES2015+ bundles** (`.js`) -- for modern browsers (Chrome 61+, Firefox 60+, Safari 10.1+, Edge 79+). Smaller because they use native `async/await`, arrow functions, `class`, `let`/`const`, destructuring, and other features that do not need polyfills or transpilation.

2. **ES5 bundles** (`-es5.js`) -- for legacy browsers (IE11, older mobile browsers). Larger because every modern feature is transpiled to ES5 equivalents, and polyfills are included.

The HTML file includes both bundles using `<script>` tags with `type="module"` and `nomodule` attributes:

```html
<!-- Modern browsers execute this (type="module") -->
<script src="main.abc123.js" type="module"></script>

<!-- Legacy browsers execute this (nomodule) -->
<script src="main-es5.def456.js" nomodule></script>
```

Modern browsers understand `type="module"` and ignore `nomodule`. Legacy browsers ignore `type="module"` (unknown type) and execute `nomodule`. Each browser downloads only its own bundle. Modern browsers get a smaller, faster payload.

The decision of which browsers to support is controlled by the `.browserslistrc` file (or `browserslist` field in `package.json`).

## The Correct Way

### Browserslist configuration

```
# .browserslistrc
# This file controls which browsers Angular targets for differential loading.

# Support the last 2 versions of major browsers
last 2 Chrome versions
last 2 Firefox versions
last 2 Safari versions
last 2 Edge versions

# Support iOS Safari 13+ (many users still on older iPhones)
iOS >= 13

# Do NOT support IE11 (drops the ES5 bundle entirely if no query matches IE)
not IE 11
```

### Checking what browsers your config targets

```bash
# Show all browsers matched by your .browserslistrc
npx browserslist
# Output example:
# chrome 110
# chrome 109
# edge 110
# edge 109
# firefox 110
# firefox 109
# ios_saf 16.3
# ios_saf 16.2
# safari 16.3
# safari 16.2
```

### Understanding the build output

```bash
ng build --configuration production
```

With differential loading enabled:

```
dist/my-app/
├── index.html               # Contains both <script type="module"> and <script nomodule>
├── main.abc123.js            # ES2015+ bundle (smaller)
├── main-es5.def456.js        # ES5 bundle (larger, only for legacy browsers)
├── polyfills.ghi789.js       # ES2015+ polyfills (minimal)
├── polyfills-es5.jkl012.js   # ES5 polyfills (includes core-js, zone.js full)
├── runtime.mno345.js         # Webpack runtime
├── runtime-es5.pqr678.js     # Webpack runtime (ES5)
├── 1.stu901.js               # Lazy chunk (ES2015+)
├── 1-es5.vwx234.js           # Lazy chunk (ES5)
├── styles.yza567.css         # Compiled CSS
└── 3rdpartylicenses.txt
```

### Dropping IE11 support to eliminate ES5 bundles

If you do not need IE11 support (and in 2024+ you almost certainly do not):

```
# .browserslistrc
last 2 Chrome versions
last 2 Firefox versions
last 2 Safari versions
last 2 Edge versions
not IE 11
```

With this configuration, Angular may skip the ES5 bundle entirely because all targeted browsers support ES2015+. This cuts build time (no second compilation pass) and simplifies deployment (half the files).

### TypeScript target alignment

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2017",     // Aligns with modern bundle output
    "module": "es2020",     // Enable ES module syntax for tree shaking
    "lib": ["es2020", "dom"]
  }
}
```

The `target` in `tsconfig.json` should align with what your browserslist supports. If your browserslist only targets modern browsers, set `target` to `ES2017` or higher. The Angular CLI reads both `tsconfig.json` and `.browserslistrc` to decide what to compile.

## The Anti-Pattern in Angular

**Targeting IE11 "just in case."**

```
# .browserslistrc
# WRONG -- supporting IE11 when you don't need to
> 0.5%
last 2 versions
IE 11
```

Supporting IE11 doubles your build output, adds ~100KB of polyfills to the legacy bundle, and prevents you from using modern CSS features (CSS Grid, custom properties) without fallbacks. Check your analytics. If less than 0.1% of users are on IE11, remove it.

**Ignoring browserslist and hardcoding the target.**

```jsonc
// tsconfig.json
// WRONG -- overriding the browserslist-driven target
{
  "compilerOptions": {
    "target": "es5"  // Forces ES5 output for ALL bundles
  }
}
```

The Angular CLI uses `.browserslistrc` to determine the TypeScript target for each bundle. Manually setting `"target": "es5"` in `tsconfig.json` forces ES5 for the modern bundle too, making it larger than necessary. Let the CLI decide based on browserslist.

**Not testing in targeted legacy browsers.**

```
# You support "last 2 Safari versions" but never test in Safari.
# Safari has different Promise behavior, different CSS rendering,
# and different Web API support. The ES2015+ bundle for Safari
# may need polyfills you didn't realize were missing.
```

If you include a browser in `.browserslistrc`, you must test in it. Otherwise, remove it from the list.

## Common Mistakes

1. **Build takes twice as long and you do not know why**: Differential loading compiles the application twice -- once for ES2015+ and once for ES5. If your build time doubled after upgrading Angular, check if `.browserslistrc` is targeting legacy browsers. Dropping IE11 cuts build time almost in half.

2. **CDN caching issues with `nomodule`**: Some CDNs or proxies strip or modify `<script>` attributes. If the `type="module"` or `nomodule` attributes are removed, both bundles may execute, causing duplicate initialization. Test your CDN configuration.

3. **Polyfills.ts includes unnecessary polyfills**: The `src/polyfills.ts` file may include `import 'core-js/...'` entries for features your targeted browsers already support. Review it after changing `.browserslistrc`. With modern-only targets, you can remove most polyfill imports.

4. **Safari-specific issues**: Safari is often the browser where ES2015+ code behaves differently. Async iteration, `globalThis`, and certain regex features may need polyfills even in the modern bundle. The Angular CLI handles some of this, but edge cases exist.

5. **Forgetting that `.browserslistrc` affects CSS too**: Autoprefixer (used by Angular's CSS processing) also reads `.browserslistrc`. If you target older browsers, more CSS vendor prefixes are added. If you drop old browsers, the CSS gets smaller too.

## Testing This

```bash
# 1. Verify differential loading is active
ng build --configuration production
ls dist/my-app/ | grep es5
# If es5 files exist, differential loading is producing both bundles.
# If no es5 files, all targeted browsers support ES2015+ and only modern bundles are produced.

# 2. Check which browsers are targeted
npx browserslist

# 3. Compare bundle sizes
ls -lh dist/my-app/main*.js
# main.abc.js      -- ES2015+ bundle (should be smaller)
# main-es5.def.js  -- ES5 bundle (larger)

# 4. Verify index.html has correct script tags
grep 'type="module"' dist/my-app/index.html
grep 'nomodule' dist/my-app/index.html

# 5. Test in actual browsers
# Open in Chrome DevTools → Network tab → verify only type="module" scripts are loaded
# Open in IE11 (or IE11 emulation) → verify only nomodule scripts are loaded
```

To verify the size savings of dropping IE11:

```bash
# Before: with IE11
echo "IE 11" >> .browserslistrc
ng build --configuration production
du -sh dist/my-app/

# After: without IE11
# Remove "IE 11" from .browserslistrc
ng build --configuration production
du -sh dist/my-app/
# Expect 30-50% reduction in total output size
```
