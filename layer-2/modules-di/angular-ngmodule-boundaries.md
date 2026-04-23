---
id: angular-ngmodule-boundaries
layer1_parent: module-boundaries
angular_version: "14"
module: "@angular/core"
---

# NgModule Boundaries

## How Angular Implements This

NgModules are Angular's enforcement mechanism for module boundaries. Unlike JavaScript's import system (where anything exported from a file is importable by any other file), Angular's template compiler only allows a component to use another component, directive, or pipe if both belong to the same module or the consumer's module imports a module that explicitly exports it. This is a compile-time boundary. You cannot accidentally use a component from a module you did not import.

Angular provides two key patterns for structuring module boundaries:

**forRoot / forChild** -- A convention for modules that need to register services only once at the root level while providing declarables at any level. `RouterModule.forRoot()` registers the `Router` service (singleton) and returns the module with its directives. `RouterModule.forChild()` returns only the directives without re-registering the service.

**Core module** -- A module imported exactly once by `AppModule` that contains application-wide singleton services, guards, and interceptors. It should throw if imported a second time.

**Shared module** -- A module that declares and exports commonly reused components, directives, and pipes. It never provides services (to avoid duplicate instances in lazy modules). Any feature module can import it.

These patterns enforce the same principles as `index.ts` barrel files in plain TypeScript, but at the framework level with compile-time guarantees.

## The Correct Way

```typescript
// === core/core.module.ts ===
// Imported ONCE by AppModule. Contains global singletons.
import { NgModule, Optional, SkipSelf } from '@angular/core';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { ErrorInterceptor } from './interceptors/error.interceptor';

@NgModule({
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
  ],
})
export class CoreModule {
  // Guard against re-import. If CoreModule is already in the injector
  // (because AppModule loaded it), a second import throws immediately.
  constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
    if (parentModule) {
      throw new Error('CoreModule is already loaded. Import it only in AppModule.');
    }
  }
}
```

```typescript
// === shared/shared.module.ts ===
// Declares and exports reusable declarables. NO providers.
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ButtonComponent } from './button/button.component';
import { DataTableComponent } from './data-table/data-table.component';
import { TruncatePipe } from './pipes/truncate.pipe';
import { HighlightDirective } from './directives/highlight.directive';

@NgModule({
  declarations: [
    ButtonComponent,
    DataTableComponent,
    TruncatePipe,
    HighlightDirective,
  ],
  imports: [
    CommonModule,
  ],
  exports: [
    // Export everything that consumers need
    CommonModule,         // Re-export so consumers don't need to import it separately
    ButtonComponent,
    DataTableComponent,
    TruncatePipe,
    HighlightDirective,
  ],
  // NO providers here. If SharedModule provided a service, every lazy module
  // that imports SharedModule would get its own instance, breaking singletons.
})
export class SharedModule {}
```

```typescript
// === features/orders/orders.module.ts ===
// A feature module with clear boundaries.
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';

import { OrderListComponent } from './order-list/order-list.component';
import { OrderDetailComponent } from './order-detail/order-detail.component';
import { OrderStatusBadgeComponent } from './order-status-badge/order-status-badge.component';

@NgModule({
  declarations: [
    OrderListComponent,
    OrderDetailComponent,
    OrderStatusBadgeComponent,  // Internal -- not exported
  ],
  imports: [
    SharedModule,  // Gets ButtonComponent, DataTableComponent, TruncatePipe, etc.
    RouterModule.forChild([
      { path: '', component: OrderListComponent },
      { path: ':id', component: OrderDetailComponent },
    ]),
  ],
  exports: [
    OrderStatusBadgeComponent,  // Only this is available to other modules
  ],
})
export class OrdersModule {}
```

```typescript
// === forRoot / forChild pattern for a custom module ===
import { NgModule, ModuleWithProviders } from '@angular/core';
import { ToastComponent } from './toast.component';
import { ToastService } from './toast.service';
import { TOAST_CONFIG, ToastConfig } from './toast-config.token';

@NgModule({
  declarations: [ToastComponent],
  exports: [ToastComponent],
})
export class ToastModule {
  // forRoot: registers the singleton service + config. Call once in AppModule.
  static forRoot(config: ToastConfig): ModuleWithProviders<ToastModule> {
    return {
      ngModule: ToastModule,
      providers: [
        ToastService,
        { provide: TOAST_CONFIG, useValue: config },
      ],
    };
  }

  // forChild: provides only the declarables, no service registration.
  // Feature modules call this to use <app-toast> without creating a new service instance.
  static forChild(): ModuleWithProviders<ToastModule> {
    return {
      ngModule: ToastModule,
      providers: [],  // No providers -- uses the root instance
    };
  }
}
```

## The Anti-Pattern in Angular

The junior dev creates modules but ignores boundaries. Every module exports everything. Modules import each other in circular chains. The "shared module" provides services, creating duplicate instances. There is no core module -- global services are scattered across feature modules.

```typescript
// DO NOT DO THIS -- SharedModule with providers
@NgModule({
  declarations: [ButtonComponent, DataTableComponent],
  exports: [ButtonComponent, DataTableComponent],
  providers: [
    NotificationService,  // BUG: every lazy module gets its own instance
    LoggingService,       // BUG: same problem
  ],
})
export class SharedModule {}
// FeatureAModule imports SharedModule -- gets NotificationService instance #1
// FeatureBModule imports SharedModule -- gets NotificationService instance #2
// Notifications sent from FeatureA are invisible in FeatureB.
```

```typescript
// DO NOT DO THIS -- circular module imports
// orders.module.ts imports UsersModule (to show user names on orders)
// users.module.ts imports OrdersModule (to show order count on user profile)
// Angular throws: "Circular dependency detected"
```

```typescript
// DO NOT DO THIS -- exporting everything, defeating the purpose of boundaries
@NgModule({
  declarations: [
    OrderListComponent,
    OrderDetailComponent,
    OrderInternalHelperComponent,
    OrderPriceCalculatorPipe,
  ],
  exports: [
    OrderListComponent,
    OrderDetailComponent,
    OrderInternalHelperComponent,   // This is an internal implementation detail
    OrderPriceCalculatorPipe,       // This should not be used outside the orders feature
  ],
})
export class OrdersModule {}
```

## Common Mistakes

1. **Providing services in SharedModule.** Every eager and lazy module that imports SharedModule gets its own injector copy if lazy. Use `providedIn: 'root'` on the service itself, or provide it in `CoreModule` / `forRoot()`.

2. **No CoreModule guard.** Without the `@Optional() @SkipSelf()` guard in the constructor, `CoreModule` can be imported by a lazy feature module, creating a second injector scope for its services. The constructor guard fails fast with a clear error message.

3. **Confusing `forRoot` and `forChild`.** Calling `SomeModule.forRoot()` in a lazy feature module registers a second set of singleton services in the lazy injector. `forRoot()` goes in `AppModule`. `forChild()` (or just plain `SomeModule`) goes everywhere else.

4. **Circular module dependencies.** Module A imports Module B, Module B imports Module A. Fix: extract the shared pieces into a third module that both import. Or rethink the feature boundaries -- circular dependencies usually mean the boundary is in the wrong place.

5. **Re-exporting modules you didn't mean to.** If `SharedModule` exports `ReactiveFormsModule`, every module that imports `SharedModule` gets `ReactiveFormsModule` whether it needs it or not. Only re-export modules that genuinely every consumer needs (like `CommonModule`).

## Testing This

Test that the CoreModule guard works:

```typescript
describe('CoreModule', () => {
  it('should throw when imported a second time', () => {
    // Simulate: CoreModule is already loaded (parentModule is truthy)
    expect(() => new CoreModule({} as CoreModule))
      .toThrowError('CoreModule is already loaded. Import it only in AppModule.');
  });

  it('should not throw on first import', () => {
    // Simulate: no parent module (first import)
    expect(() => new CoreModule(null as any)).not.toThrow();
  });
});
```

Test that a feature module's boundary is correct -- exported components are usable, unexported ones are not:

```typescript
@Component({ template: '<app-order-status-badge [status]="\'shipped\'"></app-order-status-badge>' })
class TestHostComponent {}

describe('OrdersModule exports', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestHostComponent],
      imports: [OrdersModule],
    }).compileComponents();
  });

  it('should expose OrderStatusBadgeComponent', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('app-order-status-badge');
    expect(badge).toBeTruthy();
  });
});

// This test verifies the boundary: OrderDetailComponent is NOT exported.
// If you try to use it from outside OrdersModule, the template compiler
// will throw "'app-order-detail' is not a known element" at build time.
// This is the compile-time enforcement that makes Angular module boundaries real.
```

Test the `forRoot` / `forChild` pattern:

```typescript
describe('ToastModule.forRoot', () => {
  it('should provide ToastService as singleton', () => {
    TestBed.configureTestingModule({
      imports: [ToastModule.forRoot({ duration: 3000, position: 'top-right' })],
    });

    const service = TestBed.inject(ToastService);
    expect(service).toBeTruthy();

    const config = TestBed.inject(TOAST_CONFIG);
    expect(config.duration).toBe(3000);
  });
});
```
