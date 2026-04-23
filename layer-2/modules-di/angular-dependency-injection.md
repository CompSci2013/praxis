---
id: angular-dependency-injection
layer1_parent: dependency-inversion
angular_version: "14"
module: "@angular/core"
---

# Angular Dependency Injection

## How Angular Implements This

Angular has a built-in dependency injection (DI) system that is one of the most sophisticated in any frontend framework. Instead of a class creating its own dependencies (violating dependency inversion), it declares what it needs through its constructor, and Angular's injector supplies the concrete instances.

Angular's DI system is hierarchical. There is not one injector but a tree of injectors that mirrors the component tree:

1. **Root injector** -- created when the application bootstraps. Services with `providedIn: 'root'` live here. There is exactly one instance per service (singleton).
2. **Module injectors** -- each lazy-loaded module gets its own child injector. Services provided in a lazy module are scoped to that module.
3. **Element injectors** -- each component has its own injector. Services provided in a component's `providers` array get a new instance per component instance.

When a component or service requests a dependency, Angular walks up the injector hierarchy: element injector, then parent element injector, then module injector, then root injector. The first injector that has a provider for the requested token wins.

This hierarchy is the mechanism for controlling scope and lifetime of dependencies. It replaces manual service locators, global singletons, and factory patterns with a declarative system.

## The Correct Way

```typescript
// === user.service.ts ===
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable({
  providedIn: 'root',  // Tree-shakable singleton. If nothing injects it, it's removed from the bundle.
})
export class UserService {
  private readonly apiUrl = '/api/users';

  constructor(private http: HttpClient) {}
  // Angular injects HttpClient here. UserService doesn't know or care
  // whether it's the real HttpClient or a mock.

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  getUser(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }
}
```

```typescript
// === user-list.component.ts ===
import { Component, OnInit } from '@angular/core';
import { UserService, User } from '../user.service';

@Component({
  selector: 'app-user-list',
  template: `
    <ul>
      <li *ngFor="let user of users">{{ user.name }}</li>
    </ul>
  `,
})
export class UserListComponent implements OnInit {
  users: User[] = [];

  constructor(private userService: UserService) {}
  // Angular injects the UserService singleton. The component does not create it,
  // does not know where it came from, and can be tested with a substitute.

  ngOnInit(): void {
    this.userService.getUsers().subscribe(users => {
      this.users = users;
    });
  }
}
```

```typescript
// === Component-scoped provider example ===
// Each instance of this component gets its own FormStateService.
@Injectable()
export class FormStateService {
  private dirty = false;

  markDirty(): void { this.dirty = true; }
  isDirty(): boolean { return this.dirty; }
  reset(): void { this.dirty = false; }
}

@Component({
  selector: 'app-edit-form',
  providers: [FormStateService],  // New instance per component instance
  template: `...`,
})
export class EditFormComponent {
  constructor(private formState: FormStateService) {}
  // If there are two <app-edit-form> on the page, each gets its own FormStateService.
}
```

## The Anti-Pattern in Angular

The junior dev bypasses DI entirely. They create instances manually, import concrete implementations directly, or use static state.

```typescript
// DO NOT DO THIS
import { HttpClient } from '@angular/common/http';

export class UserService {
  // Creating dependencies manually -- untestable, tightly coupled
  private http = new HttpClient(/* what goes here? you don't even know */);

  getUsers() { ... }
}
```

```typescript
// DO NOT DO THIS -- static singleton, bypasses DI entirely
export class ConfigService {
  private static instance: ConfigService;

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }
}

// Consumer:
const config = ConfigService.getInstance(); // No DI, no testability, no hierarchy
```

Another anti-pattern is providing a service at the wrong level and getting confused by the instance count:

```typescript
// Provided in both root AND a feature module -- two instances exist, bugs ensue
@Injectable({ providedIn: 'root' })  // Singleton at root
export class CartService { ... }

@NgModule({
  providers: [CartService],  // ALSO provided here -- creates a second instance for this module
})
export class CheckoutModule {}
// Components in CheckoutModule get a DIFFERENT CartService than the rest of the app.
// Items added to cart from the product page don't appear in checkout.
```

## Common Mistakes

1. **Forgetting `@Injectable()`.** If a service has no dependencies, Angular 14 may not require the decorator at build time, but the moment you add a constructor dependency, you get `NullInjectorError: No provider for X`. Always add `@Injectable()`.

2. **`NullInjectorError: No provider for X`.** This means Angular cannot find a provider for the requested dependency. Common causes: the service is not decorated with `@Injectable({ providedIn: 'root' })`, it's not listed in any module's `providers` array, or the module that provides it is not imported.

3. **Circular dependency.** Service A injects Service B, and Service B injects Service A. Angular will throw a runtime error. Fix: extract the shared logic into a third service, or use `Injector` to break the cycle as a last resort.

4. **Providing a service in a lazy module and expecting it to be a global singleton.** Services provided in a lazy-loaded module's `providers` array get their own injector. If you want a global singleton, use `providedIn: 'root'` on the service itself.

5. **Confusing `providedIn: 'root'` with providing in `AppModule`.** They both create singletons, but `providedIn: 'root'` is tree-shakable (removed from the bundle if never injected). Providing in `AppModule`'s `providers` array is always included in the bundle.

## Testing This

DI makes services trivially testable because you can substitute any dependency:

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      // UserService uses providedIn: 'root', so it's automatically available.
    });

    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // Ensure no unmatched HTTP requests
  });

  it('should fetch users', () => {
    const mockUsers = [{ id: 1, name: 'Alice', email: 'alice@example.com' }];

    service.getUsers().subscribe(users => {
      expect(users).toEqual(mockUsers);
    });

    const req = httpMock.expectOne('/api/users');
    expect(req.request.method).toBe('GET');
    req.flush(mockUsers);
  });
});
```

To test that a component receives the correct scoped service instance:

```typescript
it('should use component-scoped FormStateService', () => {
  const fixture = TestBed.createComponent(EditFormComponent);
  const componentService = fixture.debugElement.injector.get(FormStateService);
  const rootService = TestBed.inject(FormStateService, null); // null if not at root

  // componentService is a unique instance, not the root singleton
  componentService.markDirty();
  expect(componentService.isDirty()).toBeTrue();
});
```

To substitute a service in tests, use `useValue`, `useClass`, or `useFactory`:

```typescript
TestBed.configureTestingModule({
  providers: [
    {
      provide: UserService,
      useValue: {
        getUsers: () => of([{ id: 1, name: 'Test User', email: 'test@test.com' }]),
      },
    },
  ],
});
```
