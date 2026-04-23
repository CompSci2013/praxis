---
id: angular-cli
layer1_parent: ci-cd-pipelines
angular_version: "14"
module: "@angular/cli"
---

# Angular CLI

## How Angular Implements This

The Angular CLI (`ng`) is the official command-line tool for creating, developing, building, and testing Angular projects. It wraps Webpack (in Angular 14), TypeScript compilation, Karma/Jasmine test execution, and code generation behind a unified interface. The configuration lives in `angular.json` at the project root.

The commands you will use daily:
- `ng serve` -- starts a dev server with hot reload (Webpack dev server)
- `ng build` -- compiles the app into static files for deployment
- `ng test` -- runs unit tests via Karma
- `ng generate` (or `ng g`) -- scaffolds components, services, modules, pipes, guards
- `ng lint` -- runs ESLint (if configured)

The commands you will use occasionally:
- `ng build --configuration production` -- production build with AOT, optimization, and tree shaking
- `ng e2e` -- runs end-to-end tests (requires a separate e2e framework)
- `ng update` -- updates Angular packages and runs migration schematics

Everything is configured in `angular.json`, which defines build targets, file replacements, budgets, and asset paths.

## The Correct Way

### Project structure after `ng new`

```
my-app/
├── angular.json          # Build and project configuration
├── tsconfig.json         # Base TypeScript config
├── tsconfig.app.json     # App-specific TS config (extends base)
├── tsconfig.spec.json    # Test-specific TS config
├── package.json
├── src/
│   ├── main.ts           # Application entry point
│   ├── index.html        # Single page shell
│   ├── styles.scss        # Global styles
│   ├── environments/     # Environment-specific config
│   │   ├── environment.ts
│   │   └── environment.prod.ts
│   └── app/
│       ├── app.module.ts
│       ├── app.component.ts
│       └── ...
└── e2e/                  # End-to-end tests
```

### Key angular.json sections

```jsonc
// angular.json (simplified)
{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:browser",
          "options": {
            "outputPath": "dist/my-app",
            "index": "src/index.html",
            "main": "src/main.ts",
            "polyfills": "src/polyfills.ts",
            "tsConfig": "tsconfig.app.json",
            "assets": [
              "src/favicon.ico",
              "src/assets"
            ],
            "styles": ["src/styles.scss"],
            "scripts": []
          },
          "configurations": {
            "production": {
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
                }
              ],
              "fileReplacements": [
                {
                  "replace": "src/environments/environment.ts",
                  "with": "src/environments/environment.prod.ts"
                }
              ],
              "outputHashing": "all",
              "optimization": true,
              "sourceMap": false,
              "extractCss": true,
              "namedChunks": false,
              "aot": true,
              "extractLicenses": true,
              "vendorChunk": false,
              "buildOptimizer": true
            },
            "staging": {
              "fileReplacements": [
                {
                  "replace": "src/environments/environment.ts",
                  "with": "src/environments/environment.staging.ts"
                }
              ],
              "optimization": true,
              "sourceMap": true
            }
          }
        },
        "serve": {
          "builder": "@angular-devkit/build-angular:dev-server",
          "options": {
            "browserTarget": "my-app:build"
          },
          "configurations": {
            "production": {
              "browserTarget": "my-app:build:production"
            }
          }
        }
      }
    }
  }
}
```

### Common generation commands

```bash
# Component in a specific module's folder
ng generate component features/users/user-list --module=features/users/users.module

# Service
ng generate service core/services/auth

# Module with routing
ng generate module features/products --routing

# Guard
ng generate guard core/guards/auth

# Pipe
ng generate pipe shared/pipes/truncate

# Dry run -- see what would be created without writing files
ng generate component features/dashboard --dry-run
```

### Build budgets

```jsonc
// angular.json -- budgets section
"budgets": [
  {
    "type": "initial",           // The main bundle loaded on first page load
    "maximumWarning": "500kb",   // Warning threshold
    "maximumError": "1mb"        // Build FAILS if exceeded
  },
  {
    "type": "anyComponentStyle", // Per-component CSS
    "maximumWarning": "2kb",
    "maximumError": "4kb"
  }
]
```

Budgets enforce bundle size limits at build time. When the production build exceeds the `maximumError` threshold, the build fails with a clear error. This prevents accidental import of massive libraries.

### CI/CD build command

```bash
# Production build for deployment
ng build --configuration production

# Output goes to dist/my-app/ -- serve this with nginx, S3, etc.
# Key production flags (set in angular.json, not CLI):
# - AOT compilation (--aot)
# - Tree shaking (automatic with AOT)
# - Build optimizer (--buildOptimizer)
# - Minification (--optimization)
# - Output hashing (--outputHashing=all) for cache busting
```

## The Anti-Pattern in Angular

**Skipping the CLI and manually configuring Webpack.**

```javascript
// WRONG -- ejecting or creating a custom Webpack config from scratch
module.exports = {
  entry: './src/main.ts',
  module: { rules: [/* ... */] },
  // 300 lines of Webpack config you now maintain forever
};
```

Angular CLI's Webpack configuration is complex and handles dozens of concerns (AOT, differential loading, lazy chunk naming, asset copying, CSS extraction, polyfills). Ejecting means you take ownership of all of it. You miss security patches, performance improvements, and migration schematics. If you need custom Webpack config, use `@angular-builders/custom-webpack` to extend the CLI's config without ejecting.

**Not using build configurations for different environments.**

```typescript
// WRONG -- hardcoded environment checks
if (window.location.hostname === 'staging.myapp.com') {
  apiUrl = 'https://api-staging.myapp.com';
} else {
  apiUrl = 'https://api.myapp.com';
}
```

Use Angular's `fileReplacements` in `angular.json` and `environment.ts` files. The build system swaps the file at compile time -- no runtime environment detection needed.

**Running `ng serve` in production.**

```bash
# WRONG -- ng serve is a dev server, not a production server
ng serve --host 0.0.0.0 --port 80
```

`ng serve` uses Webpack dev server with no caching, no compression, and memory-based storage. It is designed for development. For production, run `ng build --configuration production` and serve the output with nginx, Apache, or a CDN.

## Common Mistakes

1. **Forgetting `--module` on `ng generate component`**: Without specifying which module the component belongs to, the CLI either declares it in the nearest module (which may be wrong) or errors if it cannot determine the module. Always specify.

2. **Ignoring budget warnings**: Budget warnings mean your bundle is growing. If you ignore them until they become errors, you have a much harder problem. Investigate every warning immediately.

3. **Not using `--dry-run`**: Before generating files with unfamiliar schematics, use `--dry-run` (or `-d`) to preview what will be created. This prevents polluting the project with unwanted files.

4. **Building without `--configuration production`**: A default `ng build` (no configuration) produces an unoptimized, unminified, AOT-disabled build. This is fine for debugging but 3-5x larger than a production build. CI pipelines must use `--configuration production`.

5. **Circular dependency warnings**: The CLI warns about circular imports at build time. These warnings indicate architectural problems that cause unpredictable behavior (undefined imports at runtime). Fix them immediately -- do not suppress the warning.

## Testing This

Verify your build pipeline:

```bash
# Check that production build succeeds
ng build --configuration production

# Check output size
ls -la dist/my-app/*.js | sort -k5 -n

# Verify no circular dependency warnings in output
ng build --configuration production 2>&1 | grep "Circular dependency"

# Run tests
ng test --watch=false --browsers=ChromeHeadless

# Run tests with code coverage
ng test --watch=false --browsers=ChromeHeadless --code-coverage
# Coverage report goes to coverage/ directory
```

In CI, always use `--watch=false` for both `ng test` and `ng build`. Without it, the process never exits because it watches for file changes.
