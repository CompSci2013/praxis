---
id: angular-injection-tokens
layer1_parent: interface-segregation
angular_version: "14"
module: "@angular/core"
---

# Injection Tokens

## How Angular Implements This

Angular's DI system identifies providers by a token. For classes, the class itself is the token (`UserService`). But not everything you want to inject is a class. You might need to inject a configuration object, a string, a function, or an interface. TypeScript interfaces are erased at runtime -- there is no `UserRepository` token at runtime if it was defined as `interface UserRepository { ... }`. `InjectionToken<T>` solves this: it creates a unique, typed, runtime token that Angular can use to look up a provider.

Injection tokens are how Angular implements interface segregation in the DI system. Instead of a component depending on a concrete `ApiService` class with 30 methods, you define a narrow `InjectionToken<(id: number) => Observable<User>>` or `InjectionToken<UserRepository>` that specifies exactly the capability the consumer needs. Different modules can provide different implementations for the same token.

This pattern is also how Angular itself provides configuration: `APP_INITIALIZER`, `HTTP_INTERCEPTORS`, `LOCALE_ID`, and `APP_BASE_HREF` are all injection tokens.

## The Correct Way

```typescript
// === api-config.token.ts ===
import { InjectionToken } from '@angular/core';

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryCount: number;
}

// Create a typed token. The string is a description for debugging.
export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG');
```

```typescript
// === app.module.ts ===
import { NgModule } from '@angular/core';
import { API_CONFIG, ApiConfig } from './api-config.token';
import { environment } from '../environments/environment';

const apiConfig: ApiConfig = {
  baseUrl: environment.apiUrl,
  timeout: 30000,
  retryCount: 3,
};

@NgModule({
  providers: [
    { provide: API_CONFIG, useValue: apiConfig },
  ],
  // ...
})
export class AppModule {}
```

```typescript
// === user.service.ts ===
import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_CONFIG, ApiConfig } from './api-config.token';

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(
    private http: HttpClient,
    @Inject(API_CONFIG) private config: ApiConfig,  // Inject the token, not a class
  ) {}

  getUsers() {
    return this.http.get(`${this.config.baseUrl}/users`);
  }
}
```

### Abstracting Implementations with Tokens

```typescript
// === storage.token.ts ===
// Define a narrow interface for what consumers need
export interface StorageProvider {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const STORAGE = new InjectionToken<StorageProvider>('STORAGE');
```

```typescript
// === local-storage.provider.ts ===
import { StorageProvider } from './storage.token';

export class LocalStorageProvider implements StorageProvider {
  get(key: string): string | null {
    return localStorage.getItem(key);
  }
  set(key: string, value: string): void {
    localStorage.setItem(key, value);
  }
  remove(key: string): void {
    localStorage.removeItem(key);
  }
}
```

```typescript
// === app.module.ts ===
import { STORAGE } from './storage.token';
import { LocalStorageProvider } from './local-storage.provider';

@NgModule({
  providers: [
    { provide: STORAGE, useClass: LocalStorageProvider },
  ],
})
export class AppModule {}
```

```typescript
// === auth.service.ts ===
import { Injectable, Inject } from '@angular/core';
import { STORAGE, StorageProvider } from './storage.token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(@Inject(STORAGE) private storage: StorageProvider) {}
  // AuthService has no idea if storage is localStorage, sessionStorage,
  // an in-memory map, or a cookie-based implementation.

  getToken(): string | null {
    return this.storage.get('auth_token');
  }

  setToken(token: string): void {
    this.storage.set('auth_token', token);
  }

  clearToken(): void {
    this.storage.remove('auth_token');
  }
}
```

### Multi-providers (Array Injection)

```typescript
// === plugin.token.ts ===
export interface Plugin {
  name: string;
  initialize(): void;
}

export const APP_PLUGINS = new InjectionToken<Plugin[]>('APP_PLUGINS');
```

```typescript
// === app.module.ts ===
import { APP_PLUGINS } from './plugin.token';
import { AnalyticsPlugin } from './plugins/analytics.plugin';
import { LoggingPlugin } from './plugins/logging.plugin';

@NgModule({
  providers: [
    { provide: APP_PLUGINS, useClass: AnalyticsPlugin, multi: true },
    { provide: APP_PLUGINS, useClass: LoggingPlugin, multi: true },
    // multi: true means Angular collects all providers into an array.
    // Injecting APP_PLUGINS gives you [AnalyticsPlugin, LoggingPlugin].
  ],
})
export class AppModule {}
```

```typescript
// === app.component.ts ===
import { Component, Inject, OnInit } from '@angular/core';
import { APP_PLUGINS, Plugin } from './plugin.token';

@Component({ selector: 'app-root', template: '...' })
export class AppComponent implements OnInit {
  constructor(@Inject(APP_PLUGINS) private plugins: Plugin[]) {}

  ngOnInit(): void {
    this.plugins.forEach(plugin => plugin.initialize());
  }
}
```

### Tree-shakable Tokens with Factory

```typescript
// === logger.token.ts ===
import { InjectionToken } from '@angular/core';

export interface Logger {
  log(message: string): void;
  error(message: string): void;
}

// Factory-based token: tree-shakable, provides a default implementation.
export const LOGGER = new InjectionToken<Logger>('LOGGER', {
  providedIn: 'root',
  factory: () => ({
    log: (msg: string) => console.log(`[APP] ${msg}`),
    error: (msg: string) => console.error(`[APP ERROR] ${msg}`),
  }),
});
// If nobody injects LOGGER, the factory is never called and it's tree-shaken out.
// Any module can override it with { provide: LOGGER, useClass: SentryLogger }.
```

## The Anti-Pattern in Angular

The junior dev avoids injection tokens and depends on concrete classes everywhere. Configuration is hardcoded. Swapping implementations requires rewriting consumers.

```typescript
// DO NOT DO THIS -- hardcoded configuration
@Injectable({ providedIn: 'root' })
export class UserService {
  private baseUrl = 'https://api.example.com';  // Hardcoded, untestable
  private timeout = 30000;                        // Can't change per environment

  constructor(private http: HttpClient) {}
}
```

```typescript
// DO NOT DO THIS -- depending on concrete storage
@Injectable({ providedIn: 'root' })
export class AuthService {
  getToken(): string | null {
    return localStorage.getItem('auth_token');  // Directly coupled to localStorage
    // Can't test without a browser environment.
    // Can't switch to sessionStorage or cookies without rewriting.
  }
}
```

```typescript
// DO NOT DO THIS -- using string tokens
@NgModule({
  providers: [
    { provide: 'API_URL', useValue: 'https://api.example.com' },
  ],
})
export class AppModule {}

// Consumer:
constructor(@Inject('API_URL') private apiUrl: string) {}
// String tokens have no type safety, can collide, and can't be tree-shaken.
```

## Common Mistakes

1. **Forgetting `@Inject()` when using an InjectionToken.** For class tokens, Angular can infer the token from the type annotation. For `InjectionToken`, you must use `@Inject(MY_TOKEN)` explicitly. Without it, Angular throws `NullInjectorError`.

2. **String tokens instead of InjectionToken.** Angular allows `provide: 'some-string'` but string tokens are not type-safe, not tree-shakable, and can collide. Always use `InjectionToken<T>`.

3. **Forgetting `multi: true` when adding to a multi-provider.** If you provide `HTTP_INTERCEPTORS` without `multi: true`, you replace all existing interceptors instead of adding to the list.

4. **Providing the wrong thing for the token.** The TypeScript type parameter on `InjectionToken<ApiConfig>` is only compile-time. If you accidentally provide a string for an `InjectionToken<ApiConfig>`, TypeScript won't catch the mismatch in the module metadata. You get a runtime error when the consumer tries to access `.baseUrl` on a string.

5. **Not providing a token at all.** If no module provides a value for a token and the token has no `factory` in its definition, injecting it throws `NullInjectorError`. Use `@Optional()` if the dependency is truly optional:

```typescript
constructor(@Optional() @Inject(ANALYTICS_CONFIG) private config: AnalyticsConfig | null) {
  if (this.config) {
    // Analytics is configured
  }
}
```

## Testing This

Injection tokens make testing straightforward because you can substitute any implementation:

```typescript
describe('AuthService', () => {
  let service: AuthService;
  let mockStorage: jasmine.SpyObj<StorageProvider>;

  beforeEach(() => {
    mockStorage = jasmine.createSpyObj('StorageProvider', ['get', 'set', 'remove']);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: STORAGE, useValue: mockStorage },
      ],
    });

    service = TestBed.inject(AuthService);
  });

  it('should retrieve token from storage', () => {
    mockStorage.get.and.returnValue('abc123');

    expect(service.getToken()).toBe('abc123');
    expect(mockStorage.get).toHaveBeenCalledWith('auth_token');
  });

  it('should clear token from storage', () => {
    service.clearToken();
    expect(mockStorage.remove).toHaveBeenCalledWith('auth_token');
  });
});
```

Testing multi-providers:

```typescript
describe('Plugin initialization', () => {
  it('should initialize all registered plugins', () => {
    const plugin1 = { name: 'test1', initialize: jasmine.createSpy('init1') };
    const plugin2 = { name: 'test2', initialize: jasmine.createSpy('init2') };

    TestBed.configureTestingModule({
      declarations: [AppComponent],
      providers: [
        { provide: APP_PLUGINS, useValue: plugin1, multi: true },
        { provide: APP_PLUGINS, useValue: plugin2, multi: true },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges(); // triggers ngOnInit

    expect(plugin1.initialize).toHaveBeenCalled();
    expect(plugin2.initialize).toHaveBeenCalled();
  });
});
```

Testing with environment-specific configuration:

```typescript
describe('UserService with custom config', () => {
  const testConfig: ApiConfig = {
    baseUrl: 'http://localhost:3000',
    timeout: 5000,
    retryCount: 0,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: API_CONFIG, useValue: testConfig },
      ],
    });
  });

  it('should use the injected base URL', () => {
    const service = TestBed.inject(UserService);
    const httpMock = TestBed.inject(HttpTestingController);

    service.getUsers().subscribe();

    const req = httpMock.expectOne('http://localhost:3000/users');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
```
