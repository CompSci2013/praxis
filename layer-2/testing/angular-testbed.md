---
id: angular-testbed
layer1_parent: testing-pyramid
angular_version: "14"
module: "@angular/core/testing"
---

# TestBed

## How Angular Implements This

TestBed is Angular's testing module compiler. It creates an isolated Angular module for each test, giving you control over exactly which dependencies, declarations, and providers exist. Every Angular test that touches the framework -- components, services with dependencies, pipes that inject services -- goes through TestBed.

TestBed replaces the `@NgModule` decorator you use in production. Instead of importing your entire `AppModule` (which would pull in hundreds of dependencies, HTTP calls, routing, and database connections), you call `TestBed.configureTestingModule()` with only what the unit under test actually needs. This is how Angular enforces the testing pyramid: you control the boundary.

The core lifecycle is:
1. `TestBed.configureTestingModule({...})` -- declare what exists in the test universe
2. `TestBed.compileComponents()` -- compile any components with external templates (async)
3. `TestBed.inject(ServiceClass)` -- pull instances from the test injector
4. `TestBed.createComponent(ComponentClass)` -- get a `ComponentFixture` for component tests

TestBed resets between tests automatically when you use `beforeEach`, giving you a clean dependency injection container every time.

## The Correct Way

```typescript
// user.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { UserService } from './user.service';
import { LoggerService } from '../logger/logger.service';

describe('UserService', () => {
  let service: UserService;
  let loggerSpy: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    // Create a spy for the dependency
    loggerSpy = jasmine.createSpyObj('LoggerService', ['info', 'error']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],   // Replaces HttpClientModule
      providers: [
        UserService,                         // The real service under test
        { provide: LoggerService, useValue: loggerSpy }  // Mock dependency
      ]
    });

    service = TestBed.inject(UserService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
```

```typescript
// user-list.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserListComponent } from './user-list.component';
import { UserService } from '../services/user.service';
import { of } from 'rxjs';

describe('UserListComponent', () => {
  let component: UserListComponent;
  let fixture: ComponentFixture<UserListComponent>;
  let userServiceSpy: jasmine.SpyObj<UserService>;

  beforeEach(async () => {
    userServiceSpy = jasmine.createSpyObj('UserService', ['getUsers']);
    userServiceSpy.getUsers.and.returnValue(of([{ id: 1, name: 'Alice' }]));

    await TestBed.configureTestingModule({
      declarations: [UserListComponent],
      providers: [
        { provide: UserService, useValue: userServiceSpy }
      ]
    }).compileComponents();
    // compileComponents() is async -- it compiles external templates and CSS.
    // Required when components use templateUrl or styleUrls.

    fixture = TestBed.createComponent(UserListComponent);
    component = fixture.componentInstance;
  });

  it('should load users on init', () => {
    fixture.detectChanges();  // Triggers ngOnInit
    expect(component.users.length).toBe(1);
    expect(userServiceSpy.getUsers).toHaveBeenCalledTimes(1);
  });
});
```

## The Anti-Pattern in Angular

**Importing the real module instead of a testing substitute.**

```typescript
// WRONG -- pulls in the real HttpClientModule, which makes actual HTTP calls
beforeEach(() => {
  TestBed.configureTestingModule({
    imports: [HttpClientModule],  // Real HTTP! Tests will fail or hit real APIs
    declarations: [UserListComponent]
  });
});
```

```typescript
// WRONG -- importing the entire feature module
beforeEach(() => {
  TestBed.configureTestingModule({
    imports: [SharedModule, CoreModule, UserModule]  // Massive dependency graph
  });
});
// This creates slow tests that break when unrelated code changes.
// It also hides which dependencies the component actually needs.
```

**Using `TestBed.get()` instead of `TestBed.inject()`.**

```typescript
// WRONG -- deprecated in Angular 9, removed later
const service = TestBed.get(UserService);  // Returns `any`, no type safety

// RIGHT
const service = TestBed.inject(UserService);  // Returns UserService, type-safe
```

## Common Mistakes

1. **Forgetting `compileComponents()`**: If your component uses `templateUrl` (external template file) and you skip `compileComponents()`, you get: `Error: This test module uses the component UserListComponent which is using a "templateUrl" ... but they were never compiled.`

2. **Forgetting `fixture.detectChanges()`**: TestBed does not call `ngOnInit` automatically. The component sits inert until you call `fixture.detectChanges()` for the first time. Junior devs write tests where `ngOnInit` logic never runs and wonder why assertions fail.

3. **Overriding providers after compilation**: Once `TestBed.compileComponents()` or `TestBed.createComponent()` has been called, the module is sealed. Calling `TestBed.overrideProvider()` after that point silently does nothing.

4. **Not resetting TestBed between tests**: If you configure TestBed in a `beforeAll` instead of `beforeEach`, state leaks between tests. One test's spy return values affect the next test.

5. **Providing too many real dependencies**: Each real dependency you provide is a dependency your test now implicitly tests. If `UserService` depends on `AuthService` which depends on `TokenStore` which depends on `LocalStorageWrapper`, you are not writing a unit test -- you are writing an integration test with extra steps.

## Testing This

TestBed itself is infrastructure, not something you test directly. To verify your TestBed setup works:

```typescript
it('should create the component', () => {
  expect(component).toBeTruthy();
});

it('should inject the mocked service', () => {
  const injected = TestBed.inject(UserService);
  expect(injected).toBe(userServiceSpy);  // Confirms the mock was wired
});
```

If your TestBed configuration is wrong, the test fails at creation time with clear errors:
- `NullInjectorError: No provider for X!` -- you forgot to provide a dependency
- `'X' is not a known element` -- you forgot to declare or import a component
- Template compilation errors -- structural directive or binding issues
