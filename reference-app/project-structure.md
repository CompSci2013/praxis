# Project Structure

## Governing Principles

Every structural decision in this workspace follows two rules:

1. **A Layer 1 principle defines the constraint** -- why the boundary exists, what problem it solves.
2. **A Layer 2 Angular implementation enforces it** -- the Angular-specific mechanism that makes the boundary real at compile time or runtime.

The primary principles governing project structure are:

- [separation-of-concerns](../layer-1/architecture/design-principles/separation-of-concerns.md) -- each module addresses one concern
- [module-boundaries](../layer-1/architecture/module-design/module-boundaries.md) -- explicit public APIs between modules
- [encapsulation](../layer-1/architecture/module-design/encapsulation.md) -- hide internal implementation details
- [cohesion-coupling](../layer-1/architecture/module-design/cohesion-coupling.md) -- high cohesion within modules, low coupling between them
- [single-responsibility](../layer-1/architecture/design-principles/single-responsibility.md) -- each module serves one actor or stakeholder
- [layered-architecture](../layer-1/architecture/module-design/layered-architecture.md) -- presentation, logic, and data access in distinct layers

The Angular implementations that enforce these:

- [angular-ngmodule](../layer-2/modules-di/angular-ngmodule.md) -- NgModule as the unit of compilation and dependency organization
- [angular-ngmodule-boundaries](../layer-2/modules-di/angular-ngmodule-boundaries.md) -- exports, imports, and the Core/Shared/Feature pattern
- [angular-dependency-injection](../layer-2/modules-di/angular-dependency-injection.md) -- constructor injection and provider scoping
- [angular-lazy-loading](../layer-2/routing/angular-lazy-loading.md) -- code splitting aligned to module boundaries

---

## Directory Tree

```
src/
├── app/
│   ├── app.module.ts                    # Root module
│   ├── app.component.ts                 # Shell component (layout, router-outlet)
│   ├── app-routing.module.ts            # Top-level routes with lazy loading
│   │
│   ├── core/                            # Imported ONCE by AppModule
│   │   ├── core.module.ts               # Guard against re-import
│   │   ├── interceptors/
│   │   │   ├── error.interceptor.ts     # Global HTTP error handling
│   │   │   ├── logging.interceptor.ts   # Request/response logging
│   │   │   └── api-prefix.interceptor.ts # Prepend /api base URL
│   │   └── services/
│   │       └── notification.service.ts  # Global toast/snackbar notifications
│   │
│   ├── shared/                          # Imported by any feature module
│   │   ├── shared.module.ts             # Declares and exports reusable declarables
│   │   ├── components/
│   │   │   ├── data-table/
│   │   │   │   ├── data-table.component.ts
│   │   │   │   ├── data-table.component.html
│   │   │   │   └── data-table.component.scss
│   │   │   ├── loading-spinner/
│   │   │   │   └── loading-spinner.component.ts
│   │   │   ├── empty-state/
│   │   │   │   └── empty-state.component.ts
│   │   │   ├── error-message/
│   │   │   │   └── error-message.component.ts
│   │   │   └── paginator/
│   │   │       └── paginator.component.ts
│   │   ├── pipes/
│   │   │   ├── truncate.pipe.ts
│   │   │   └── highlight.pipe.ts        # Highlight search terms in results
│   │   └── directives/
│   │       └── debounce-input.directive.ts
│   │
│   ├── features/
│   │   ├── catalog/                     # Product browsing and search
│   │   │   ├── catalog.module.ts
│   │   │   ├── catalog-routing.module.ts
│   │   │   ├── models/
│   │   │   │   ├── product.model.ts
│   │   │   │   └── search-params.model.ts
│   │   │   ├── services/
│   │   │   │   ├── catalog.service.ts   # HTTP calls to product API
│   │   │   │   └── catalog-state.service.ts  # BehaviorSubject state
│   │   │   ├── components/
│   │   │   │   ├── product-list/
│   │   │   │   │   ├── product-list.component.ts
│   │   │   │   │   └── product-list.component.html
│   │   │   │   ├── product-detail/
│   │   │   │   │   ├── product-detail.component.ts
│   │   │   │   │   └── product-detail.component.html
│   │   │   │   ├── product-card/
│   │   │   │   │   └── product-card.component.ts
│   │   │   │   ├── search-bar/
│   │   │   │   │   └── search-bar.component.ts
│   │   │   │   └── filter-panel/
│   │   │   │       └── filter-panel.component.ts
│   │   │   └── resolvers/
│   │   │       └── product.resolver.ts
│   │   │
│   │   ├── documents/                   # Document search and viewing
│   │   │   ├── documents.module.ts
│   │   │   ├── documents-routing.module.ts
│   │   │   ├── models/
│   │   │   │   └── document.model.ts
│   │   │   ├── services/
│   │   │   │   └── document.service.ts
│   │   │   └── components/
│   │   │       ├── document-search/
│   │   │       │   └── document-search.component.ts
│   │   │       └── document-viewer/
│   │   │           └── document-viewer.component.ts
│   │   │
│   │   └── admin/                       # Data management (CRUD)
│   │       ├── admin.module.ts
│   │       ├── admin-routing.module.ts
│   │       ├── services/
│   │       │   └── admin.service.ts
│   │       └── components/
│   │           ├── product-form/
│   │           │   └── product-form.component.ts
│   │           └── product-management/
│   │               └── product-management.component.ts
│   │
│   └── models/                          # App-wide shared interfaces
│       ├── api-response.model.ts        # Generic paginated response shape
│       ├── search-result.model.ts       # Elasticsearch hit wrapper
│       └── aggregation.model.ts         # Elasticsearch aggregation buckets
│
├── environments/
│   ├── environment.ts                   # dev defaults
│   └── environment.prod.ts              # production overrides
│
├── assets/
├── styles/
│   └── _variables.scss
├── index.html
└── main.ts
```

---

## Module Architecture

### Root Module (`AppModule`)

The root module bootstraps the application. It imports `CoreModule` (once), declares the shell component, and sets up top-level routing with lazy-loaded feature modules.

**Principle**: The root module is thin. It wires things together but contains no business logic. This follows [single-responsibility](../layer-1/architecture/design-principles/single-responsibility.md) -- AppModule's one job is application bootstrap.

```typescript
// app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    CoreModule,       // Imported once. Never again.
    AppRoutingModule,  // Top-level routes with lazy loading
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

```typescript
// app-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes, PreloadAllModules } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: 'catalog', pathMatch: 'full' },
  {
    path: 'catalog',
    loadChildren: () =>
      import('./features/catalog/catalog.module').then(m => m.CatalogModule),
  },
  {
    path: 'documents',
    loadChildren: () =>
      import('./features/documents/documents.module').then(m => m.DocumentsModule),
  },
  {
    path: 'admin',
    loadChildren: () =>
      import('./features/admin/admin.module').then(m => m.AdminModule),
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules,
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
```

**Why `PreloadAllModules`**: After the initial page loads, Angular fetches all lazy chunks in the background. This gives the best of both worlds: small initial bundle (following [code-splitting](../layer-1/cross-cutting/performance/code-splitting.md)) with near-instant subsequent navigations. For larger applications, use a custom `PreloadingStrategy` that preloads only likely-to-visit routes (see [angular-lazy-loading](../layer-2/routing/angular-lazy-loading.md)).

---

### Core Module

The Core Module is imported exactly once by `AppModule`. It provides application-wide singletons -- interceptors, global services, and infrastructure that should never be duplicated.

**Principles**: Core Module enforces [encapsulation](../layer-1/architecture/module-design/encapsulation.md) for global services and implements the Core Module pattern from [angular-ngmodule-boundaries](../layer-2/modules-di/angular-ngmodule-boundaries.md).

```typescript
// core/core.module.ts
import { NgModule, Optional, SkipSelf } from '@angular/core';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { ErrorInterceptor } from './interceptors/error.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { ApiPrefixInterceptor } from './interceptors/api-prefix.interceptor';

@NgModule({
  providers: [
    // Order matters. See data-flow.md for the full interceptor pipeline.
    { provide: HTTP_INTERCEPTORS, useClass: ApiPrefixInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: LoggingInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
  ],
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
    if (parentModule) {
      throw new Error(
        'CoreModule is already loaded. Import it only in AppModule.'
      );
    }
  }
}
```

**What goes in Core**:
- HTTP interceptors (error handling, logging, API base URL)
- Application-wide singleton services (notification service, global configuration)
- Nothing that is declared (no components, directives, pipes)

**What does NOT go in Core**:
- Feature-specific services (those belong in the feature module)
- Reusable UI components (those belong in Shared)
- Services that use `providedIn: 'root'` (they are tree-shakable singletons already -- no module needed)

**Why the guard**: Without the `@Optional() @SkipSelf()` constructor guard, a lazy-loaded feature module could accidentally import `CoreModule`, creating a second injector scope. The guard fails fast with an explicit error message. This is documented in [angular-ngmodule-boundaries](../layer-2/modules-di/angular-ngmodule-boundaries.md).

---

### Shared Module

The Shared Module declares and exports reusable UI components, pipes, and directives. Any feature module can import it. It **never** provides services.

**Principles**: Shared Module implements [dry-principle](../layer-1/architecture/design-principles/dry-principle.md) by centralizing reusable declarables, and follows the Shared Module pattern from [angular-ngmodule-boundaries](../layer-2/modules-di/angular-ngmodule-boundaries.md).

```typescript
// shared/shared.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { DataTableComponent } from './components/data-table/data-table.component';
import { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from './components/empty-state/empty-state.component';
import { ErrorMessageComponent } from './components/error-message/error-message.component';
import { PaginatorComponent } from './components/paginator/paginator.component';
import { TruncatePipe } from './pipes/truncate.pipe';
import { HighlightPipe } from './pipes/highlight.pipe';
import { DebounceInputDirective } from './directives/debounce-input.directive';

@NgModule({
  declarations: [
    DataTableComponent,
    LoadingSpinnerComponent,
    EmptyStateComponent,
    ErrorMessageComponent,
    PaginatorComponent,
    TruncatePipe,
    HighlightPipe,
    DebounceInputDirective,
  ],
  imports: [
    CommonModule,
    RouterModule, // For routerLink in shared components
  ],
  exports: [
    // Re-export CommonModule so consumers don't need to import it separately
    CommonModule,
    // Export all declarables
    DataTableComponent,
    LoadingSpinnerComponent,
    EmptyStateComponent,
    ErrorMessageComponent,
    PaginatorComponent,
    TruncatePipe,
    HighlightPipe,
    DebounceInputDirective,
  ],
  // NO providers. If SharedModule provided a service, every lazy module
  // that imports SharedModule would get its own instance, breaking singletons.
  // See: angular-ngmodule-boundaries "Common Mistakes" #1.
})
export class SharedModule {}
```

**Why no providers**: When a lazy-loaded module imports SharedModule, Angular creates a child injector for that module. If SharedModule has `providers`, each lazy module gets its own instance. A notification service in SharedModule means notifications sent from the catalog feature are invisible to the admin feature. This is the most common NgModule mistake, documented in [angular-ngmodule-boundaries](../layer-2/modules-di/angular-ngmodule-boundaries.md).

---

### Feature Modules

Each feature module owns one domain concern. It has its own routing, components, services, and models. It imports SharedModule for reusable UI and declares only the components specific to its feature.

**Principles**: Feature modules enforce [separation-of-concerns](../layer-1/architecture/design-principles/separation-of-concerns.md) by isolating domain logic. They implement [module-boundaries](../layer-1/architecture/module-design/module-boundaries.md) through Angular's compile-time declaration checking. They enable [code-splitting](../layer-1/cross-cutting/performance/code-splitting.md) via [angular-lazy-loading](../layer-2/routing/angular-lazy-loading.md).

```typescript
// features/catalog/catalog.module.ts
import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { CatalogRoutingModule } from './catalog-routing.module';

import { ProductListComponent } from './components/product-list/product-list.component';
import { ProductDetailComponent } from './components/product-detail/product-detail.component';
import { ProductCardComponent } from './components/product-card/product-card.component';
import { SearchBarComponent } from './components/search-bar/search-bar.component';
import { FilterPanelComponent } from './components/filter-panel/filter-panel.component';

@NgModule({
  declarations: [
    ProductListComponent,
    ProductDetailComponent,
    ProductCardComponent,   // Internal -- not exported
    SearchBarComponent,     // Internal -- not exported
    FilterPanelComponent,   // Internal -- not exported
  ],
  imports: [
    SharedModule,
    CatalogRoutingModule,
  ],
  // No exports. No other module should use these components directly.
  // If another feature needs product display, that's a sign to extract
  // the shared piece into SharedModule or create a new shared module.
})
export class CatalogModule {}
```

```typescript
// features/catalog/catalog-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProductListComponent } from './components/product-list/product-list.component';
import { ProductDetailComponent } from './components/product-detail/product-detail.component';
import { ProductResolver } from './resolvers/product.resolver';

const routes: Routes = [
  {
    path: '',
    component: ProductListComponent,
    // No resolver here -- search results are fetched reactively from query params.
    // See state-management.md: URL-First pattern.
  },
  {
    path: ':id',
    component: ProductDetailComponent,
    resolve: { product: ProductResolver },
    // Resolver fetches the product BEFORE the route activates.
    // See: angular-route-resolvers for when to use resolvers vs component loading.
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CatalogRoutingModule {}
```

### Feature Module Boundaries: What Goes Where

| Belongs in Feature Module | Does NOT Belong in Feature Module |
|---|---|
| Components specific to this feature | Reusable UI components (those go in Shared) |
| Services that call APIs for this domain | Application-wide singleton services (use `providedIn: 'root'`) |
| Models/interfaces for this domain's data | Generic response wrappers (those go in `app/models/`) |
| Resolvers for this feature's routes | Interceptors (those go in Core) |
| Feature-specific pipes and directives | Cross-cutting pipes used by multiple features (Shared) |

### How Feature Modules Communicate

Feature modules do **not** import each other. This prevents circular dependencies and maintains [cohesion-coupling](../layer-1/architecture/module-design/cohesion-coupling.md) -- low coupling between modules.

When features need to communicate:

1. **Via the URL**: One feature navigates to another using `Router.navigate()`. The target feature reads route params. This is the primary communication path, following [url-as-source-of-truth](../layer-1/frontend/routing/url-as-source-of-truth.md).

2. **Via a shared service**: A `providedIn: 'root'` service acts as a mediator. The service lives outside any feature module (or uses tree-shakable `providedIn: 'root'`). Both features inject it. This follows [shared-state](../layer-1/frontend/state-management/shared-state.md) and [angular-services-as-state](../layer-2/services/angular-services-as-state.md).

3. **Via SharedModule components**: Both features import SharedModule and use the same data table, paginator, or other UI components. No direct dependency between features.

```typescript
// WRONG: Feature modules importing each other
// catalog.module.ts
import { DocumentsModule } from '../documents/documents.module'; // Circular risk

// CORRECT: Navigate via URL
// In catalog component:
this.router.navigate(['/documents'], {
  queryParams: { relatedTo: product.id }
});

// In documents component -- reads the param, no knowledge of catalog module:
this.route.queryParamMap.pipe(
  map(params => params.get('relatedTo'))
);
```

---

## Barrel Exports

Barrel files (`index.ts`) re-export a module's public API from a single entry point. They serve the same purpose as [module-boundaries](../layer-1/architecture/module-design/module-boundaries.md) in file-system terms: they define what is public and what is internal.

### When to Use Barrels

Use barrel exports for the **shared module** and **app-wide models**, where multiple consumers import from the same place:

```typescript
// shared/components/index.ts
export { DataTableComponent } from './data-table/data-table.component';
export { LoadingSpinnerComponent } from './loading-spinner/loading-spinner.component';
export { PaginatorComponent } from './paginator/paginator.component';

// shared/pipes/index.ts
export { TruncatePipe } from './truncate.pipe';
export { HighlightPipe } from './highlight.pipe';

// models/index.ts
export { ApiResponse } from './api-response.model';
export { SearchResult } from './search-result.model';
export { AggregationBucket } from './aggregation.model';
```

This lets consumers write clean imports:

```typescript
import { DataTableComponent, PaginatorComponent } from '../../shared/components';
import { ApiResponse, SearchResult } from '../../models';
```

### When Barrels Cause Problems

Barrels create circular dependency issues when two modules re-export symbols that reference each other, or when a barrel in a feature module re-exports things that depend on other feature modules.

**Rule**: Do not create barrel files for feature modules. Feature module internals are never imported from outside the module (because no other module imports the feature module). A barrel is pointless if there is no external consumer.

```typescript
// DO NOT create: features/catalog/index.ts
// There is no consumer outside CatalogModule that should import these.
// If another module needs something from catalog, the boundary is wrong --
// extract the shared piece into SharedModule.

// DO NOT create barrels that re-export across features:
// features/index.ts
export * from './catalog';    // These re-exports
export * from './documents';  // create import chains
export * from './admin';      // that cause circular deps
```

**Anti-pattern**: Deep barrel chains where `index.ts` re-exports from another `index.ts` which re-exports from another. Webpack and the Angular compiler resolve these recursively. If any chain forms a cycle, you get `TypeError: Cannot read properties of undefined` at runtime with no useful error message. Keep barrels shallow (one level) and limited to truly shared code.

---

## Lazy Loading Boundaries

Every feature module is lazy-loaded. The lazy loading boundary aligns exactly with the feature module boundary -- this is not a coincidence but a design constraint.

**Principles**: Lazy loading implements [code-splitting](../layer-1/cross-cutting/performance/code-splitting.md) through [angular-lazy-loading](../layer-2/routing/angular-lazy-loading.md). The lazy boundary must align with the [module-boundaries](../layer-1/architecture/module-design/module-boundaries.md) to work correctly.

### What This Means in Practice

1. **Each feature module has its own routing module** that uses `RouterModule.forChild()`. The top-level `AppRoutingModule` uses `loadChildren` to point to the feature module.

2. **Feature module code is not imported eagerly anywhere.** If any eagerly-loaded module (AppModule, CoreModule, SharedModule) has an `import` statement for a feature module's class, the code gets pulled into the main bundle. The `loadChildren` dynamic import still "works" but produces zero code-splitting benefit.

3. **SharedModule is in the main bundle.** It is imported by every feature module, so webpack puts it in the common chunk. This is correct -- shared components should be available immediately, and duplicating them across lazy chunks would be worse.

4. **Feature-scoped services stay in the lazy chunk.** A service declared in `CatalogModule.providers` (not `providedIn: 'root'`) is bundled with the catalog chunk. It is instantiated only when the user navigates to the catalog.

```
Initial load:
  main.js       → AppModule, CoreModule, SharedModule, AppComponent
  vendor.js     → Angular framework, RxJS, common dependencies

On navigation to /catalog:
  catalog.js    → CatalogModule, CatalogRoutingModule, all catalog components/services

On navigation to /documents:
  documents.js  → DocumentsModule, all documents components/services

On navigation to /admin:
  admin.js      → AdminModule, all admin components/services
```

### Verifying Lazy Loading

Open Chrome DevTools Network tab. Navigate to a lazy route. A new JavaScript chunk should appear. If nothing loads, the module is eagerly bundled. Run `ng build --stats-json` and use `webpack-bundle-analyzer` to visualize chunk boundaries. This verification step is documented in [angular-lazy-loading](../layer-2/routing/angular-lazy-loading.md).
