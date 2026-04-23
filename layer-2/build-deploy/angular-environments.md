---
id: angular-environments
layer1_parent: environment-configuration
angular_version: "14"
module: "@angular/cli"
---

# Angular Environments

## How Angular Implements This

Angular handles environment configuration through compile-time file replacement, not runtime environment variables. You create multiple environment files (`environment.ts`, `environment.prod.ts`, `environment.staging.ts`), each exporting the same interface with different values. The Angular CLI physically swaps the file during the build based on the `fileReplacements` configuration in `angular.json`.

This means:
- Your code always imports `environment` from `src/environments/environment.ts`
- At build time, the CLI replaces that file's contents with the configuration-specific version
- The resulting bundle contains only the values for the target environment
- There is no runtime cost -- no `if (env === 'prod')` checks, no environment detection

This is fundamentally different from Node.js-style `process.env.API_URL`. Angular is a browser framework -- there is no `process.env` at runtime. The environment values are baked into the JavaScript bundle at compile time.

## The Correct Way

### Environment file structure

```
src/
└── environments/
    ├── environment.ts           # Development (default)
    ├── environment.prod.ts      # Production
    └── environment.staging.ts   # Staging
```

### Environment interface (for type safety)

```typescript
// src/environments/environment.interface.ts
export interface Environment {
  production: boolean;
  apiUrl: string;
  auth: {
    clientId: string;
    authority: string;
  };
  features: {
    enableBetaDashboard: boolean;
    enableExport: boolean;
  };
  sentryDsn: string | null;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
```

### Development environment

```typescript
// src/environments/environment.ts
import { Environment } from './environment.interface';

export const environment: Environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  auth: {
    clientId: 'dev-client-id',
    authority: 'https://login.dev.example.com'
  },
  features: {
    enableBetaDashboard: true,   // Enabled in dev for testing
    enableExport: true
  },
  sentryDsn: null,               // No error tracking in dev
  logLevel: 'debug'
};
```

### Production environment

```typescript
// src/environments/environment.prod.ts
import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  apiUrl: 'https://api.example.com',
  auth: {
    clientId: 'prod-client-id',
    authority: 'https://login.example.com'
  },
  features: {
    enableBetaDashboard: false,  // Not yet released
    enableExport: true
  },
  sentryDsn: 'https://abc123@sentry.io/456',
  logLevel: 'error'
};
```

### angular.json fileReplacements

```jsonc
// angular.json
{
  "configurations": {
    "production": {
      "fileReplacements": [
        {
          "replace": "src/environments/environment.ts",
          "with": "src/environments/environment.prod.ts"
        }
      ]
    },
    "staging": {
      "fileReplacements": [
        {
          "replace": "src/environments/environment.ts",
          "with": "src/environments/environment.staging.ts"
        }
      ]
    }
  }
}
```

### Using the environment in code

```typescript
// Always import from the base path -- never import the prod or staging file directly
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/users`);
  }
}
```

```typescript
// main.ts -- enable production mode based on the environment flag
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule);
```

```typescript
// feature-flag.service.ts
import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class FeatureFlagService {
  isEnabled(feature: keyof typeof environment.features): boolean {
    return environment.features[feature];
  }
}
```

```typescript
// In a component
@Component({
  template: `
    <app-beta-dashboard *ngIf="featureFlags.isEnabled('enableBetaDashboard')">
    </app-beta-dashboard>
  `
})
export class DashboardComponent {
  constructor(public featureFlags: FeatureFlagService) {}
}
```

### Build commands

```bash
# Development (uses environment.ts -- the default)
ng serve

# Production (swaps in environment.prod.ts)
ng build --configuration production

# Staging (swaps in environment.staging.ts)
ng build --configuration staging
```

## The Anti-Pattern in Angular

**Checking the URL at runtime to detect the environment.**

```typescript
// WRONG -- fragile runtime environment detection
@Injectable({ providedIn: 'root' })
export class ConfigService {
  get apiUrl(): string {
    if (window.location.hostname.includes('staging')) {
      return 'https://api-staging.example.com';
    } else if (window.location.hostname === 'localhost') {
      return 'http://localhost:3000/api';
    } else {
      return 'https://api.example.com';
    }
  }
}
// Breaks when:
// - You change the staging domain
// - You run locally on a different hostname
// - Someone deploys to a new domain
// - You need different auth configs per environment
```

**Importing the wrong environment file directly.**

```typescript
// WRONG -- bypasses the file replacement mechanism
import { environment } from '../environments/environment.prod';
// This always uses prod values, even in development.
// The Angular CLI replaces environment.ts, not environment.prod.ts.
```

**Committing secrets to environment files.**

```typescript
// WRONG -- API keys in source control
export const environment = {
  production: true,
  apiKey: 'sk-live-abc123-real-production-key',
  dbPassword: 'supersecret'
};
// This is in your git history forever, even if you delete it later.
```

Environment files are compiled into the JavaScript bundle that ships to the browser. Even without committing secrets, any value in the environment file is visible to anyone who opens browser DevTools. Secrets belong on the backend, never in the frontend.

## Common Mistakes

1. **Forgetting to add `fileReplacements` for a new configuration**: You create `environment.staging.ts` but forget to add the corresponding `fileReplacements` entry in `angular.json`. The staging build uses the default `environment.ts` values. There is no error -- it silently uses the wrong config.

2. **Not using an interface**: Without a shared interface, the environment files drift apart. `environment.ts` has `apiUrl` but `environment.prod.ts` has `apiURL` (different casing). The production build compiles but `apiUrl` is `undefined` at runtime.

3. **Putting server-side concerns in environment files**: Database connection strings, S3 bucket credentials, and JWT signing keys do not belong in Angular environment files. These are backend concerns. The Angular environment file is for values the browser needs: API URLs, client IDs, feature flags.

4. **Using `environment.production` for feature flags**: `environment.production` should only control framework-level behavior (like `enableProdMode()`). For feature flags, use a dedicated `features` object so you can enable/disable features independently of the build configuration.

5. **Not building with the correct configuration in CI**: Forgetting `--configuration production` in the CI pipeline deploys an unoptimized build with development environment values. This exposes dev API endpoints, enables debug logging, and ships a much larger bundle.

## Testing This

```typescript
// api.service.spec.ts
// Tests should not depend on environment values.
// Mock the environment or inject the base URL.

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should call the correct API URL', () => {
    service.getUsers().subscribe();

    // The URL includes whatever environment.apiUrl is at test time
    // (the default environment.ts values, since tests use the default config)
    const req = httpMock.expectOne(
      r => r.url.endsWith('/users')
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
```

To verify the file replacement works, check the bundle:

```bash
# Build for production
ng build --configuration production

# Search the output for a dev-only value
grep -r "localhost:3000" dist/my-app/
# Should return no results -- the dev URL was replaced

grep -r "api.example.com" dist/my-app/
# Should find the production URL in the compiled JS
```
