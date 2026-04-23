---
id: angular-bundle-optimization
layer1_parent: bundle-analysis
angular_version: "14"
module: "@angular/cli"
---

# Bundle Optimization

## How Angular Implements This

Angular 14 uses Webpack as its build system. When you run `ng build --configuration production`, the CLI enables a chain of optimizations that reduce bundle size:

1. **Ahead-of-Time (AOT) compilation** -- compiles templates at build time instead of runtime. Eliminates the Angular compiler from the bundle (~120KB of code the browser never needs). Also catches template errors during the build.

2. **Tree shaking** -- Webpack's dead-code elimination. Unused exports are removed from the bundle. This works because Angular (with Ivy) uses top-level function calls that Webpack can statically analyze.

3. **Build optimizer** -- an Angular-specific Webpack plugin that marks Angular decorators and metadata as pure (side-effect-free), allowing Webpack to tree-shake them more aggressively.

4. **Minification and mangling** -- Terser compresses JavaScript, shortens variable names, and removes whitespace.

5. **Lazy loading** -- code splitting at the route level. Modules loaded with `loadChildren` become separate chunks downloaded on demand.

6. **Output hashing** -- file names include content hashes (`main.a1b2c3.js`) for cache busting. When content changes, the hash changes, and browsers fetch the new file.

## The Correct Way

### Analyzing your bundle

```bash
# Install source-map-explorer
npm install --save-dev source-map-explorer

# Build with source maps (needed for analysis)
ng build --configuration production --source-map

# Analyze the main bundle
npx source-map-explorer dist/my-app/main.*.js
# Opens a browser with a treemap visualization showing what is in the bundle
```

Alternatively, use `webpack-bundle-analyzer`:

```bash
npm install --save-dev webpack-bundle-analyzer

# Generate stats.json
ng build --configuration production --stats-json

# Visualize
npx webpack-bundle-analyzer dist/my-app/stats.json
```

### Lazy loading routes for code splitting

```typescript
// app-routing.module.ts
const routes: Routes = [
  { path: '', component: HomeComponent },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)
    // Creates a separate chunk: admin-admin-module.js
    // Downloaded only when user navigates to /admin
  },
  {
    path: 'reports',
    loadChildren: () => import('./reports/reports.module').then(m => m.ReportsModule)
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
```

### Build budgets in angular.json

```jsonc
"budgets": [
  {
    "type": "initial",
    "maximumWarning": "500kb",
    "maximumError": "1mb"
  },
  {
    "type": "anyComponentStyle",
    "maximumWarning": "2kb",
    "maximumError": "4kb"
  },
  {
    "type": "anyScript",
    "maximumWarning": "100kb",
    "maximumError": "200kb"
  }
]
```

Budget types:
- `initial` -- total size of bundles loaded on first page load (before lazy loading)
- `anyComponentStyle` -- any single component's CSS
- `anyScript` -- any single script bundle (includes lazy chunks)
- `any` -- any single file of any type
- `bundle` -- a specific named bundle

### Reducing import size with targeted imports

```typescript
// WRONG -- imports the entire library
import * as moment from 'moment';
// Pulls in all locales: ~300KB

// BETTER -- import only what you need
import moment from 'moment';
import 'moment/locale/en-gb';
// Much smaller, but moment itself is still large

// BEST -- use a smaller alternative
import { format, parseISO } from 'date-fns';
// Tree-shakeable, imports only the functions used: ~5KB
```

```typescript
// WRONG -- imports the entire lodash library
import { debounce } from 'lodash';
// Pulls in the entire lodash: ~70KB

// RIGHT -- import from the specific module
import debounce from 'lodash-es/debounce';
// Or use lodash-es which is tree-shakeable:
import { debounce } from 'lodash-es';
// Only ~2KB for the debounce function
```

```typescript
// WRONG -- importing the entire RxJS
import { Observable, Subject, BehaviorSubject, of, from } from 'rxjs';
import { map, filter, debounceTime, switchMap, tap } from 'rxjs/operators';
// This is FINE in Angular 14 -- RxJS 7 is tree-shakeable.
// Each operator is imported individually and unused ones are removed.
// No special import paths needed.
```

### OnPush change detection to reduce template re-evaluation

```typescript
// Not directly a bundle optimization, but reduces runtime cost
@Component({
  selector: 'app-user-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <h3>{{ user.name }}</h3>
      <p>{{ user.email }}</p>
    </div>
  `
})
export class UserCardComponent {
  @Input() user!: User;
}
```

### Preloading strategy for lazy modules

```typescript
// app-routing.module.ts
import { PreloadAllModules } from '@angular/router';

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules
      // After initial load, preloads all lazy modules in the background.
      // User gets fast initial load + instant navigation to lazy routes.
    })
  ]
})
export class AppRoutingModule {}
```

For more control, write a custom preloading strategy:

```typescript
// selective-preload.strategy.ts
@Injectable({ providedIn: 'root' })
export class SelectivePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    // Only preload routes marked with data.preload = true
    return route.data?.['preload'] ? load() : of(null);
  }
}

// In routes:
{
  path: 'dashboard',
  loadChildren: () => import('./dashboard/dashboard.module').then(m => m.DashboardModule),
  data: { preload: true }  // This one preloads
},
{
  path: 'admin',
  loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)
  // This one loads on demand only
}
```

## The Anti-Pattern in Angular

**Importing a massive library for one function.**

```typescript
// WRONG -- importing moment.js for a single date format
import moment from 'moment';

formatDate(date: Date): string {
  return moment(date).format('YYYY-MM-DD');
}
// Adds ~300KB to the bundle for something Angular's DatePipe does natively.
```

Use Angular's built-in `DatePipe`, or `date-fns` for more complex cases. Check the bundle impact of every new dependency.

**Putting everything in AppModule instead of lazy-loading.**

```typescript
// WRONG -- every feature module imported eagerly
@NgModule({
  imports: [
    AdminModule,       // 200KB -- used by 5% of users
    ReportsModule,     // 150KB -- used once a month
    SettingsModule,    // 100KB -- used rarely
    DashboardModule,   // 50KB  -- the actual landing page
  ]
})
export class AppModule {}
// Initial bundle: 500KB. User waits for everything to download before seeing anything.
```

Lazy-load every module except the one for the landing page. The initial bundle shrinks to 50KB + framework overhead. Other modules load on demand.

**Importing Material modules at the root level.**

```typescript
// WRONG -- importing every Material module in SharedModule
@NgModule({
  imports: [
    MatButtonModule,
    MatInputModule,
    MatSelectModule,
    MatDialogModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    // 20 more modules...
  ],
  exports: [/* same list */]
})
export class SharedModule {}
```

This defeats tree shaking because every Material module is referenced. Import Material modules only in the feature modules that use them. If `MatTableModule` is only used in `ReportsModule`, import it only there.

## Common Mistakes

1. **Skipping the `--source-map` flag when analyzing bundles**: Without source maps, `source-map-explorer` shows minified Webpack chunks instead of your actual modules. You cannot identify which dependency is bloating the bundle.

2. **Not checking the bundle after adding a dependency**: A single `npm install` can add 500KB to your bundle. Always run `source-map-explorer` after adding a new library to verify the impact.

3. **Importing from barrel files of large libraries**: Some libraries re-export everything through a barrel (`index.ts`). Importing from the barrel can pull in the entire library even if Webpack tries to tree-shake. Import from the specific file path when possible.

4. **Using `CommonModule` in every module**: `CommonModule` provides `*ngIf`, `*ngFor`, and pipes. It is small, but importing it in modules that do not use any directives is a signal of cargo-cult coding. In Angular 14 with Ivy, unused declarations are tree-shaken, so the size impact is minimal -- but it clutters the module definition.

5. **Forgetting that CSS counts toward budgets too**: The `anyComponentStyle` budget catches individual component styles, but global styles (`styles.scss`) are not caught by that budget. A 500KB Bootstrap import in global styles blows up the initial bundle. Use the `any` budget type to catch large files of any type.

## Testing This

```bash
# 1. Build and measure
ng build --configuration production
du -sh dist/my-app/

# 2. Check individual bundle sizes
ls -lhS dist/my-app/*.js

# 3. Verify lazy chunks exist
ls dist/my-app/ | grep -E "^[0-9].*\.js$"
# Lazy chunks are numbered (e.g., 123.abc123.js)
# If your lazy-loaded modules do not produce separate chunks,
# you imported them eagerly somewhere.

# 4. Source map analysis
ng build --configuration production --source-map
npx source-map-explorer dist/my-app/main.*.js

# 5. Verify budgets are enforced
# Change the budget to an absurdly small value temporarily:
# "maximumError": "1kb"
# Then build -- it should fail with:
# "Error: budget exceeded for initial"
```

Run the bundle analysis in CI as a gate. If the initial bundle exceeds 500KB, the pipeline fails and forces the developer to investigate before merging.
