---
id: angular-router-setup
layer1_parent: declarative-routing
angular_version: "14"
module: "@angular/router"
---

# Angular Router Setup

## How Angular Implements This

Angular's router turns declarative routing into a concrete system through `RouterModule`. You define routes as an array of `Route` objects — plain data — and hand them to `RouterModule.forRoot()` in your root module or `RouterModule.forChild()` in feature modules. The router reads this configuration, matches URLs to components, and renders them into `<router-outlet>` directives in your templates.

The critical distinction: **`forRoot()` is called exactly once** in `AppModule`. It registers the `Router` service singleton, the route configuration, and optionally configures router-level settings (like hash-based URLs or preloading strategies). **`forChild()` is called in every feature module** that has its own routes. It registers additional routes without creating a second `Router` instance.

This is Angular's implementation of the provider pattern — `forRoot()` returns a `ModuleWithProviders<RouterModule>` that includes both the module and the singleton services. `forChild()` returns only the module with the routes, no duplicate services.

## The Correct Way

```typescript
// app-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { NotFoundComponent } from './not-found/not-found.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)
  },
  {
    path: 'shop',
    loadChildren: () => import('./shop/shop.module').then(m => m.ShopModule)
  },
  { path: '**', component: NotFoundComponent }  // wildcard MUST be last
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      scrollPositionRestoration: 'enabled',  // restore scroll on back nav
      anchorScrolling: 'enabled',            // handle #fragment links
      onSameUrlNavigation: 'reload'          // re-trigger resolvers on same-URL nav
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
```

```typescript
// admin/admin-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminDashboardComponent } from './dashboard/admin-dashboard.component';
import { UserListComponent } from './users/user-list.component';
import { AdminLayoutComponent } from './admin-layout.component';

const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,  // layout with its own <router-outlet>
    children: [
      { path: '', component: AdminDashboardComponent },
      { path: 'users', component: UserListComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],  // forChild — NOT forRoot
  exports: [RouterModule]
})
export class AdminRoutingModule {}
```

```typescript
// admin/admin.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminRoutingModule } from './admin-routing.module';
import { AdminDashboardComponent } from './dashboard/admin-dashboard.component';
import { UserListComponent } from './users/user-list.component';
import { AdminLayoutComponent } from './admin-layout.component';

@NgModule({
  declarations: [AdminDashboardComponent, UserListComponent, AdminLayoutComponent],
  imports: [CommonModule, AdminRoutingModule]
})
export class AdminModule {}
```

```html
<!-- app.component.html -->
<nav>
  <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
  <a routerLink="/admin" routerLinkActive="active">Admin</a>
  <a routerLink="/shop" routerLinkActive="active">Shop</a>
</nav>
<router-outlet></router-outlet>
```

## The Anti-Pattern in Angular

```typescript
// WRONG: forRoot() in a feature module
@NgModule({
  imports: [RouterModule.forRoot(adminRoutes)]  // Creates a SECOND Router singleton
})
export class AdminModule {}
// Result: Two Router instances fighting each other. Navigation breaks silently.
// Angular won't throw an error — it will just behave unpredictably.

// WRONG: Wildcard route before specific routes
const routes: Routes = [
  { path: '**', component: NotFoundComponent },  // Matches EVERYTHING
  { path: 'admin', component: AdminComponent }    // Never reached
];

// WRONG: Importing feature module directly instead of lazy loading
import { AdminModule } from './admin/admin.module';
const routes: Routes = [
  { path: 'admin', loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule) }
];
@NgModule({
  imports: [
    AdminModule,  // Eagerly loaded here — defeats the lazy loading above
    RouterModule.forRoot(routes)
  ]
})
export class AppModule {}
```

## Common Mistakes

1. **Calling `forRoot()` in a lazy-loaded module**: This creates a second `Router` instance. The application will partially work but navigation between the root and feature module will break unpredictably. The fix is always `forChild()` in feature modules.

2. **Route order matters**: Angular evaluates routes top-to-bottom, first match wins. Wildcard (`**`) must be last. More specific paths must come before less specific ones. `/users/:id` must come after `/users/new`, or navigating to `/users/new` will match `:id` with the string "new".

3. **Forgetting to export `RouterModule`**: If your routing module imports `RouterModule.forChild(routes)` but doesn't export `RouterModule`, the feature module's templates won't have access to `routerLink`, `routerLinkActive`, or `<router-outlet>`.

4. **Eagerly importing a lazy module**: If `AppModule` imports `AdminModule` directly (in its `imports` array), the module is bundled into the main chunk even if `loadChildren` is used in the route config. The lazy loading syntax is ignored because the module is already loaded.

5. **Using `href` instead of `routerLink`**: `<a href="/admin">` triggers a full page reload, destroying the entire Angular application state. `<a routerLink="/admin">` navigates within the SPA.

## Testing This

```typescript
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { HomeComponent } from './home/home.component';
import { NotFoundComponent } from './not-found/not-found.component';

describe('App Routing', () => {
  let router: Router;
  let location: Location;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: '', component: HomeComponent },
          { path: '**', component: NotFoundComponent }
        ])
      ],
      declarations: [HomeComponent, NotFoundComponent]
    });

    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    router.initialNavigation();
  });

  it('should navigate to home on empty path', async () => {
    await router.navigate(['']);
    expect(location.path()).toBe('/');
  });

  it('should navigate to not-found on unknown path', async () => {
    await router.navigate(['/unknown']);
    expect(location.path()).toBe('/unknown');
    // Component assertion would use a fixture
  });
});
```

Use `RouterTestingModule` in unit tests — never import the real `AppRoutingModule`. The testing module gives you an in-memory router that doesn't touch the browser's URL bar. Use `router.navigate()` to trigger navigation and assert on `Location.path()` to verify the resulting URL.
