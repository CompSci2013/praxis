---
id: angular-ngmodule
layer1_parent: module-boundaries
angular_version: "14"
module: "@angular/core"
---

# NgModule

## How Angular Implements This

Angular uses the `@NgModule` decorator to define organizational units of code. Every Angular 14 application has at least one NgModule -- the root `AppModule` -- and most non-trivial apps have many more. An NgModule is a class decorated with `@NgModule()` that takes a metadata object with four key arrays:

- **declarations**: Components, directives, and pipes that belong to this module. A declarable can only belong to exactly one module.
- **imports**: Other NgModules whose exported declarables this module needs.
- **exports**: The subset of declarations (and re-exported modules) that other modules can use when they import this module.
- **providers**: Services and other injectables scoped to this module's injector.

This is how Angular enforces module boundaries. A component declared in `FeatureAModule` is invisible to `FeatureBModule` unless `FeatureAModule` explicitly exports it and `FeatureBModule` explicitly imports `FeatureAModule`. There is no implicit global namespace. You cannot accidentally use a component from another module -- you will get a template compilation error.

The root module (`AppModule`) bootstraps the application. Feature modules organize related functionality. The module tree defines the dependency graph of the entire application.

## The Correct Way

```typescript
// === users.module.ts ===
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { UserListComponent } from './user-list/user-list.component';
import { UserDetailComponent } from './user-detail/user-detail.component';
import { UserAvatarComponent } from './user-avatar/user-avatar.component';
import { UserService } from './user.service';

@NgModule({
  declarations: [
    UserListComponent,    // Belongs to this module
    UserDetailComponent,  // Belongs to this module
    UserAvatarComponent,  // Belongs to this module
  ],
  imports: [
    CommonModule,         // Provides *ngIf, *ngFor, async pipe, etc.
    RouterModule.forChild([
      { path: '', component: UserListComponent },
      { path: ':id', component: UserDetailComponent },
    ]),
  ],
  exports: [
    UserAvatarComponent,  // Other modules can use this component
    // UserListComponent and UserDetailComponent are NOT exported --
    // they are internal to the users feature, used only via routing.
  ],
  providers: [
    UserService,          // Scoped to this module's injector
  ],
})
export class UsersModule {}
```

```typescript
// === app.module.ts ===
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { AppComponent } from './app.component';
import { UsersModule } from './users/users.module';

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,       // Required once in root module (provides browser-specific services)
    HttpClientModule,    // Provides HttpClient globally
    RouterModule.forRoot([
      { path: 'users', loadChildren: () => import('./users/users.module').then(m => m.UsersModule) },
    ]),
    UsersModule,
  ],
  providers: [],
  bootstrap: [AppComponent],  // Only root module has bootstrap
})
export class AppModule {}
```

Note the structure: `AppModule` is the root, it imports `UsersModule` which is a feature module. `UsersModule` exports only `UserAvatarComponent` -- the rest is internal. `BrowserModule` is imported exactly once in the root; feature modules import `CommonModule` instead.

## The Anti-Pattern in Angular

The junior dev puts everything in `AppModule`. Every component, every service, every pipe -- all declared in a single 200-line module. The app compiles fine, but there are no boundaries. Any component can use any other component. No lazy loading is possible because everything is eagerly loaded in the root. The module conveys zero architectural information.

```typescript
// DO NOT DO THIS
@NgModule({
  declarations: [
    AppComponent,
    UserListComponent,
    UserDetailComponent,
    UserAvatarComponent,
    OrderListComponent,
    OrderDetailComponent,
    InvoiceComponent,
    SharedButtonComponent,
    SharedTableComponent,
    SharedPaginatorComponent,
    FormatDatePipe,
    HighlightDirective,
    // ... 40 more declarations
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forRoot(routes),
  ],
  providers: [
    UserService,
    OrderService,
    InvoiceService,
    AuthService,
    // ... 15 more services
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

Another common mistake: declaring a component in two modules. Angular will throw `Type X is part of the declarations of 2 modules`. The fix is not to declare it in both -- the fix is to create a shared module that declares the component, exports it, and is imported by both consumer modules.

## Common Mistakes

1. **Importing `BrowserModule` in a feature module.** `BrowserModule` must only be imported in the root `AppModule`. Feature modules import `CommonModule`. Importing `BrowserModule` twice causes the error `BrowserModule has already been loaded`.

2. **Forgetting to export a component.** You declare `UserAvatarComponent` in `UsersModule` and try to use `<app-user-avatar>` in `DashboardModule`. Angular throws `'app-user-avatar' is not a known element`. The component must be listed in both `declarations` and `exports` of `UsersModule`.

3. **Forgetting to import a module.** You export `UserAvatarComponent` from `UsersModule` but forget to add `UsersModule` to the `imports` of `DashboardModule`. Same error: `'app-user-avatar' is not a known element`.

4. **Declaring the same pipe/directive in multiple modules.** Angular requires every declarable to belong to exactly one module. If two modules need the same pipe, create a `SharedModule` that declares and exports it.

5. **Not understanding that `providers` create injector scope.** A service provided in a lazy-loaded module gets its own instance, separate from the root injector. This is a feature for scoping state, but a surprise if you expected a singleton.

## Testing This

In unit tests, `TestBed.configureTestingModule` acts as your test module. You declare the component under test and import or mock its dependencies:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserListComponent } from './user-list.component';
import { UserService } from '../user.service';

describe('UserListComponent', () => {
  let component: UserListComponent;
  let fixture: ComponentFixture<UserListComponent>;
  let mockUserService: jasmine.SpyObj<UserService>;

  beforeEach(async () => {
    mockUserService = jasmine.createSpyObj('UserService', ['getUsers']);
    mockUserService.getUsers.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      declarations: [UserListComponent],
      // Do NOT import the entire UsersModule here -- only what the test needs.
      providers: [
        { provide: UserService, useValue: mockUserService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call UserService.getUsers on init', () => {
    fixture.detectChanges(); // triggers ngOnInit
    expect(mockUserService.getUsers).toHaveBeenCalled();
  });
});
```

To test that module boundaries are correct (a component is properly exported), create an integration-level test that imports the feature module and attempts to create a consumer component:

```typescript
@Component({ template: '<app-user-avatar [userId]="1"></app-user-avatar>' })
class TestHostComponent {}

beforeEach(async () => {
  await TestBed.configureTestingModule({
    declarations: [TestHostComponent],
    imports: [UsersModule],  // If UserAvatarComponent is exported, this works.
  }).compileComponents();
});

it('should render user avatar from imported module', () => {
  const fixture = TestBed.createComponent(TestHostComponent);
  fixture.detectChanges();
  const avatar = fixture.nativeElement.querySelector('app-user-avatar');
  expect(avatar).toBeTruthy();
});
```
