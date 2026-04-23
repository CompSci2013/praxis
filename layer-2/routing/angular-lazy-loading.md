---
id: angular-lazy-loading
layer1_parent: lazy-loading-routes
angular_version: "14"
module: "@angular/router"
---

# Angular Lazy Loading

## How Angular Implements This

Angular lazy loads feature modules using the `loadChildren` property in route configuration. When the user navigates to a lazy route, Angular fetches the module's JavaScript chunk from the server, instantiates the module and its providers, and renders the target component. Until that navigation happens, the code is not downloaded or parsed.

Under the hood, Angular's build system (webpack via the Angular CLI) sees the dynamic `import()` expression in `loadChildren` and creates a separate bundle chunk for that module and all its transitive dependencies. At runtime, the router calls the factory function, which triggers the dynamic import, which fetches the chunk over HTTP.

Angular 14 uses the arrow-function syntax for `loadChildren`: `() => import('./path').then(m => m.ModuleName)`. The older string-based syntax (`loadChildren: './path#ModuleName'`) was removed in Angular 9.

Preloading strategies control **when** lazy chunks are fetched. By default, chunks are fetched on demand (when the user navigates). `PreloadAllModules` fetches all lazy chunks immediately after the initial load completes. Custom strategies let you decide per-route — for example, preloading only routes the user is likely to visit.

## The Correct Way

```typescript
// app-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes, PreloadAllModules } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadChildren: () => import('./dashboard/dashboard.module').then(m => m.DashboardModule)
  },
  {
    path: 'reports',
    loadChildren: () => import('./reports/reports.module').then(m => m.ReportsModule),
    data: { preload: true }  // Custom flag for selective preloading
  },
  {
    path: 'settings',
    loadChildren: () => import('./settings/settings.module').then(m => m.SettingsModule),
    data: { preload: false }
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules  // Preload all lazy modules after initial load
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
```

```typescript
// Custom preloading strategy — preload only routes with data.preload === true
import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SelectivePreloadingStrategy implements PreloadingStrategy {
  preloadedModules: string[] = [];

  preload(route: Route, load: () => Observable<any>): Observable<any> {
    if (route.data?.['preload'] === true) {
      this.preloadedModules.push(route.path ?? '');
      return load();
    }
    return of(null);
  }
}
```

```typescript
// Using the custom strategy
@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: SelectivePreloadingStrategy
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
```

```typescript
// dashboard/dashboard.module.ts — the lazy-loaded module
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardComponent } from './dashboard.component';
import { WidgetComponent } from './widget/widget.component';

@NgModule({
  declarations: [DashboardComponent, WidgetComponent],
  imports: [CommonModule, DashboardRoutingModule]
})
export class DashboardModule {}
```

```typescript
// dashboard/dashboard-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './dashboard.component';

const routes: Routes = [
  { path: '', component: DashboardComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardRoutingModule {}
```

## The Anti-Pattern in Angular

```typescript
// WRONG: Importing the lazy module eagerly in AppModule
import { DashboardModule } from './dashboard/dashboard.module';

@NgModule({
  imports: [
    DashboardModule,  // This defeats lazy loading — the module is already bundled
    RouterModule.forRoot([
      { path: 'dashboard', loadChildren: () => import('./dashboard/dashboard.module').then(m => m.DashboardModule) }
    ])
  ]
})
export class AppModule {}
// The loadChildren will still "work" but the chunk is already in the main bundle.
// No code splitting benefit. Initial load is larger for no reason.

// WRONG: Declaring a lazy-loaded component in a shared module
@NgModule({
  declarations: [DashboardComponent],  // Declared in SharedModule
  exports: [DashboardComponent]
})
export class SharedModule {}
// DashboardComponent is now in the shared bundle, not the lazy chunk.

// WRONG: Not having a default route in the lazy module
// dashboard-routing.module.ts
const routes: Routes = [
  { path: 'overview', component: DashboardComponent }
  // Missing: { path: '', redirectTo: 'overview', pathMatch: 'full' }
  // Navigating to /dashboard shows a blank <router-outlet>
];
```

## Common Mistakes

1. **Eagerly importing the lazy module**: If `AppModule` or any eagerly-loaded module imports `DashboardModule`, the entire module tree is pulled into the main bundle. The `loadChildren` route still "works" (the component renders) but there is zero code-splitting benefit. Check your module dependency graph — a single import anywhere in the eager chain nullifies lazy loading.

2. **Cross-module component sharing**: If a component from a lazy module is declared in or exported from an eagerly-loaded module (like `SharedModule`), that component is pulled into the eager bundle. Each lazy module must declare its own components.

3. **Shared services duplicated in lazy modules**: Services provided in a lazy module's `providers` array get their own instance, scoped to that module's injector. If you expect a singleton (like an auth service), provide it in the root injector using `@Injectable({ providedIn: 'root' })`, not in the module's `providers`.

4. **No default route**: When a lazy module loads, the router tries to match the empty path within that module. If there is no route for `path: ''`, the `<router-outlet>` renders nothing. Always include either a default component route or a redirect.

5. **Verifying lazy loading works**: Open Chrome DevTools Network tab, navigate to the lazy route, and confirm a new JS chunk is fetched. If nothing new loads, the module is eagerly bundled. Run `ng build --stats-json` and use `webpack-bundle-analyzer` to visualize chunk boundaries.

## Testing This

```typescript
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Component, NgModule } from '@angular/core';

@Component({ template: '<p>lazy works</p>' })
class LazyComponent {}

@NgModule({
  declarations: [LazyComponent],
  imports: [
    RouterTestingModule.withRoutes([
      { path: '', component: LazyComponent }
    ])
  ]
})
class LazyTestModule {}

describe('Lazy Loading', () => {
  let router: Router;
  let location: Location;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          {
            path: 'lazy',
            loadChildren: () => Promise.resolve(LazyTestModule)
          }
        ])
      ]
    });

    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    router.initialNavigation();
  });

  it('should load lazy module on navigation', fakeAsync(() => {
    router.navigate(['/lazy']);
    tick();  // Resolve the lazy import promise
    expect(location.path()).toBe('/lazy');
  }));
});
```

In tests, replace the dynamic `import()` with `Promise.resolve(ModuleClass)` so the test doesn't need actual webpack chunk resolution. Use `fakeAsync` and `tick()` to resolve the promise synchronously within the test. Assert on the resulting URL and rendered component.
