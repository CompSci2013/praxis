# Praxis Knowledge Graph — Adjacency List

Auto-generated from YAML frontmatter. Do not edit manually.

## Statistics

- **Layer 1 nodes**: 105
- **Layer 2 nodes**: 42
- **Total nodes**: 147
- **depends_on edges**: 139
- **related edges**: 370
- **layer1_parent edges**: 36
- **Total edges**: 545

---

## Layer 1 — Universal Principles

### architecture

| id | category | severity | depends_on | related | path |
|---|---|---|---|---|---|
| api-error-contracts | api-design | important | rest-principles, encapsulation | interface-segregation, layered-architecture, error-boundaries, idempotency | layer-1/architecture/api-design/api-error-contracts.md |
| api-versioning | api-design | important | rest-principles, module-boundaries, encapsulation | api-error-contracts, yagni, dependency-inversion | layer-1/architecture/api-design/api-versioning.md |
| idempotency | api-design | critical | rest-principles | api-error-contracts, api-versioning, state-management-patterns | layer-1/architecture/api-design/idempotency.md |
| pagination-strategies | api-design | important | rest-principles | api-versioning, api-error-contracts, idempotency | layer-1/architecture/api-design/pagination-strategies.md |
| rest-principles | api-design | critical | separation-of-concerns, layered-architecture | api-error-contracts, api-versioning, idempotency, pagination-strategies, module-boundaries | layer-1/architecture/api-design/rest-principles.md |
| composition-over-inheritance | design-principles | critical | single-responsibility, dependency-inversion | interface-segregation, encapsulation, component-based-architecture, cohesion-coupling | layer-1/architecture/design-principles/composition-over-inheritance.md |
| dependency-inversion | design-principles | critical | separation-of-concerns, interface-segregation | composition-over-inheritance, encapsulation, layered-architecture, module-boundaries, testing-pyramid | layer-1/architecture/design-principles/dependency-inversion.md |
| dry-principle | design-principles | important | separation-of-concerns | single-responsibility, module-boundaries, cohesion-coupling, kiss-principle | layer-1/architecture/design-principles/dry-principle.md |
| interface-segregation | design-principles | important | single-responsibility, separation-of-concerns | dependency-inversion, cohesion-coupling, encapsulation, api-error-contracts | layer-1/architecture/design-principles/interface-segregation.md |
| kiss-principle | design-principles | critical | — | yagni, dry-principle, separation-of-concerns, composition-over-inheritance | layer-1/architecture/design-principles/kiss-principle.md |
| separation-of-concerns | design-principles | critical | — | single-responsibility, cohesion-coupling, module-boundaries, layered-architecture | layer-1/architecture/design-principles/separation-of-concerns.md |
| single-responsibility | design-principles | critical | separation-of-concerns | cohesion-coupling, module-boundaries, encapsulation | layer-1/architecture/design-principles/single-responsibility.md |
| yagni | design-principles | important | kiss-principle | dry-principle, separation-of-concerns, api-versioning | layer-1/architecture/design-principles/yagni.md |
| cohesion-coupling | module-design | critical | separation-of-concerns, single-responsibility | module-boundaries, encapsulation, dependency-inversion, component-based-architecture, dry-principle | layer-1/architecture/module-design/cohesion-coupling.md |
| component-based-architecture | module-design | critical | separation-of-concerns, composition-over-inheritance, encapsulation | module-boundaries, cohesion-coupling, single-responsibility, component-lifecycle, state-management-patterns | layer-1/architecture/module-design/component-based-architecture.md |
| encapsulation | module-design | critical | separation-of-concerns, single-responsibility | cohesion-coupling, module-boundaries, interface-segregation, component-based-architecture, api-error-contracts | layer-1/architecture/module-design/encapsulation.md |
| layered-architecture | module-design | critical | separation-of-concerns, dependency-inversion, module-boundaries | cohesion-coupling, encapsulation, rest-principles, api-error-contracts, testing-pyramid | layer-1/architecture/module-design/layered-architecture.md |
| module-boundaries | module-design | critical | separation-of-concerns, single-responsibility, cohesion-coupling | encapsulation, layered-architecture, dependency-inversion, api-versioning | layer-1/architecture/module-design/module-boundaries.md |
### backend

| id | category | severity | depends_on | related | path |
|---|---|---|---|---|---|
| api-gateway-pattern | api-patterns | important | separation-of-concerns, middleware-pipelines | request-response-transformation, http-caching, application-caching | layer-1/backend/api-patterns/api-gateway-pattern.md |
| middleware-pipelines | api-patterns | critical | separation-of-concerns | api-gateway-pattern, request-response-transformation, error-boundaries | layer-1/backend/api-patterns/middleware-pipelines.md |
| request-response-transformation | api-patterns | important | separation-of-concerns, middleware-pipelines | api-gateway-pattern, repository-pattern, orm-tradeoffs | layer-1/backend/api-patterns/request-response-transformation.md |
| background-jobs | bulk-operations | critical | separation-of-concerns, middleware-pipelines | bulk-operations, cache-invalidation, application-caching, unit-of-work | layer-1/backend/bulk-operations/background-jobs.md |
| bulk-operations | bulk-operations | important | unit-of-work, repository-pattern | background-jobs, pagination-deep-dive, orm-tradeoffs, aggregations | layer-1/backend/bulk-operations/bulk-operations.md |
| pagination-deep-dive | bulk-operations | important | query-builders, repository-pattern | bulk-operations, http-caching, query-dsl, aggregations | layer-1/backend/bulk-operations/pagination-deep-dive.md |
| application-caching | caching | important | separation-of-concerns | http-caching, cache-invalidation, repository-pattern, background-jobs | layer-1/backend/caching/application-caching.md |
| cache-invalidation | caching | critical | application-caching, http-caching | unit-of-work, background-jobs, search-engine-as-datastore | layer-1/backend/caching/cache-invalidation.md |
| http-caching | caching | important | middleware-pipelines | application-caching, cache-invalidation, api-gateway-pattern | layer-1/backend/caching/http-caching.md |
| orm-tradeoffs | data-access | important | repository-pattern, query-builders | unit-of-work, request-response-transformation, bulk-operations, search-engine-as-datastore | layer-1/backend/data-access/orm-tradeoffs.md |
| query-builders | data-access | important | repository-pattern | orm-tradeoffs, unit-of-work, search-engine-as-datastore, query-dsl | layer-1/backend/data-access/query-builders.md |
| repository-pattern | data-access | important | separation-of-concerns, single-responsibility | unit-of-work, query-builders, orm-tradeoffs, request-response-transformation | layer-1/backend/data-access/repository-pattern.md |
| unit-of-work | data-access | important | repository-pattern, separation-of-concerns | bulk-operations, query-builders, orm-tradeoffs | layer-1/backend/data-access/unit-of-work.md |
| aggregations | search-engine | important | query-dsl, mapping-design, inverted-index-concepts | search-engine-as-datastore, application-caching | layer-1/backend/search-engine/aggregations.md |
| inverted-index-concepts | search-engine | important | search-engine-as-datastore | mapping-design, query-dsl, aggregations | layer-1/backend/search-engine/inverted-index-concepts.md |
| mapping-design | search-engine | critical | inverted-index-concepts, search-engine-as-datastore | query-dsl, aggregations | layer-1/backend/search-engine/mapping-design.md |
| query-dsl | search-engine | important | inverted-index-concepts, mapping-design | aggregations, search-engine-as-datastore, query-builders | layer-1/backend/search-engine/query-dsl.md |
| search-engine-as-datastore | search-engine | important | separation-of-concerns | inverted-index-concepts, mapping-design, query-dsl, aggregations, repository-pattern, cache-invalidation | layer-1/backend/search-engine/search-engine-as-datastore.md |
### cross-cutting

| id | category | severity | depends_on | related | path |
|---|---|---|---|---|---|
| ci-cd-pipelines | build-deploy | critical | — | testing-pyramid, environment-configuration, feature-flags, semantic-versioning, bundle-analysis, metrics | layer-1/cross-cutting/build-deploy/ci-cd-pipelines.md |
| environment-configuration | build-deploy | critical | separation-of-concerns | ci-cd-pipelines, auth-token-storage, feature-flags | layer-1/cross-cutting/build-deploy/environment-configuration.md |
| feature-flags | build-deploy | recommended | environment-configuration, ci-cd-pipelines | semantic-versioning, testing-pyramid | layer-1/cross-cutting/build-deploy/feature-flags.md |
| semantic-versioning | build-deploy | important | — | ci-cd-pipelines, feature-flags, environment-configuration | layer-1/cross-cutting/build-deploy/semantic-versioning.md |
| error-boundaries | error-handling | critical | separation-of-concerns | error-propagation, user-vs-developer-errors, error-typing, component-lifecycle | layer-1/cross-cutting/error-handling/error-boundaries.md |
| error-propagation | error-handling | critical | separation-of-concerns, error-boundaries | error-typing, user-vs-developer-errors, structured-logging | layer-1/cross-cutting/error-handling/error-propagation.md |
| error-typing | error-handling | important | error-boundaries, error-propagation | user-vs-developer-errors, structured-logging | layer-1/cross-cutting/error-handling/error-typing.md |
| user-vs-developer-errors | error-handling | important | error-boundaries, error-propagation | error-typing, structured-logging, xss-prevention | layer-1/cross-cutting/error-handling/user-vs-developer-errors.md |
| distributed-tracing | observability | recommended | structured-logging, metrics | error-propagation, error-boundaries | layer-1/cross-cutting/observability/distributed-tracing.md |
| metrics | observability | important | — | structured-logging, distributed-tracing, ci-cd-pipelines | layer-1/cross-cutting/observability/metrics.md |
| structured-logging | observability | important | separation-of-concerns | metrics, distributed-tracing, error-propagation, user-vs-developer-errors | layer-1/cross-cutting/observability/structured-logging.md |
| bundle-analysis | performance | important | — | code-splitting, lazy-loading-assets, ci-cd-pipelines | layer-1/cross-cutting/performance/bundle-analysis.md |
| code-splitting | performance | important | bundle-analysis | lazy-loading-assets, virtualization | layer-1/cross-cutting/performance/code-splitting.md |
| debouncing-throttling | performance | important | — | virtualization, lazy-loading-assets, metrics | layer-1/cross-cutting/performance/debouncing-throttling.md |
| lazy-loading-assets | performance | recommended | bundle-analysis | code-splitting, virtualization, debouncing-throttling | layer-1/cross-cutting/performance/lazy-loading-assets.md |
| virtualization | performance | recommended | — | lazy-loading-assets, code-splitting, debouncing-throttling | layer-1/cross-cutting/performance/virtualization.md |
| auth-token-storage | security | critical | xss-prevention, csrf-prevention | injection-prevention, environment-configuration | layer-1/cross-cutting/security/auth-token-storage.md |
| csrf-prevention | security | critical | — | xss-prevention, auth-token-storage, injection-prevention | layer-1/cross-cutting/security/csrf-prevention.md |
| injection-prevention | security | critical | — | xss-prevention, csrf-prevention, error-typing, user-vs-developer-errors | layer-1/cross-cutting/security/injection-prevention.md |
| xss-prevention | security | critical | separation-of-concerns | csrf-prevention, injection-prevention, user-vs-developer-errors | layer-1/cross-cutting/security/xss-prevention.md |
| e2e-testing | testing | important | testing-pyramid, integration-testing | unit-testing, test-boundaries | layer-1/cross-cutting/testing/e2e-testing.md |
| integration-testing | testing | important | testing-pyramid, unit-testing | e2e-testing, test-boundaries, error-boundaries | layer-1/cross-cutting/testing/integration-testing.md |
| test-boundaries | testing | important | testing-pyramid, unit-testing, integration-testing | e2e-testing, separation-of-concerns, single-responsibility | layer-1/cross-cutting/testing/test-boundaries.md |
| testing-pyramid | testing | critical | separation-of-concerns | unit-testing, integration-testing, e2e-testing, test-boundaries | layer-1/cross-cutting/testing/testing-pyramid.md |
| unit-testing | testing | critical | testing-pyramid, separation-of-concerns | integration-testing, test-boundaries, single-responsibility | layer-1/cross-cutting/testing/unit-testing.md |
### discipline

| id | category | severity | depends_on | related | path |
|---|---|---|---|---|---|
| code-review-practices | code-review | critical | — | pr-scope, commit-hygiene, code-comments, separation-of-concerns, single-responsibility | layer-1/discipline/code-review/code-review-practices.md |
| pr-scope | code-review | important | code-review-practices | commit-hygiene, separation-of-concerns, single-responsibility, when-to-refactor | layer-1/discipline/code-review/pr-scope.md |
| api-documentation | documentation | important | — | code-comments, architecture-decision-records, interface-segregation, code-review-practices | layer-1/discipline/documentation/api-documentation.md |
| architecture-decision-records | documentation | important | — | code-comments, api-documentation, technical-debt-identification, technical-debt-prioritization | layer-1/discipline/documentation/architecture-decision-records.md |
| code-comments | documentation | important | — | api-documentation, architecture-decision-records, code-review-practices, separation-of-concerns | layer-1/discipline/documentation/code-comments.md |
| branching-strategies | git-workflow | important | — | commit-hygiene, pr-scope, technical-debt-identification | layer-1/discipline/git-workflow/branching-strategies.md |
| commit-hygiene | git-workflow | critical | — | branching-strategies, pr-scope, code-review-practices, when-to-refactor | layer-1/discipline/git-workflow/commit-hygiene.md |
| safe-refactoring-techniques | refactoring | important | when-to-refactor, technical-debt-identification | strangler-pattern, commit-hygiene, separation-of-concerns, single-responsibility, code-review-practices | layer-1/discipline/refactoring/safe-refactoring-techniques.md |
| strangler-pattern | refactoring | important | safe-refactoring-techniques, when-to-refactor | technical-debt-prioritization, separation-of-concerns, branching-strategies, api-documentation | layer-1/discipline/refactoring/strangler-pattern.md |
| when-to-refactor | refactoring | critical | technical-debt-identification | safe-refactoring-techniques, strangler-pattern, technical-debt-prioritization, commit-hygiene, pr-scope, code-review-practices | layer-1/discipline/refactoring/when-to-refactor.md |
| technical-debt-identification | technical-debt | critical | — | technical-debt-prioritization, when-to-refactor, code-review-practices, architecture-decision-records, separation-of-concerns | layer-1/discipline/technical-debt/technical-debt-identification.md |
| technical-debt-prioritization | technical-debt | important | technical-debt-identification | when-to-refactor, strangler-pattern, architecture-decision-records, code-review-practices | layer-1/discipline/technical-debt/technical-debt-prioritization.md |
### frontend

| id | category | severity | depends_on | related | path |
|---|---|---|---|---|---|
| cleanup-on-destroy | component-lifecycle | critical | component-lifecycle | subscription-management, memory-leak-prevention, observables-and-subscriptions | layer-1/frontend/component-lifecycle/cleanup-on-destroy.md |
| component-lifecycle | component-lifecycle | critical | — | cleanup-on-destroy, initialization-timing, local-component-state, subscription-management | layer-1/frontend/component-lifecycle/component-lifecycle.md |
| initialization-timing | component-lifecycle | important | component-lifecycle | loading-error-empty-states, local-component-state, route-resolvers | layer-1/frontend/component-lifecycle/initialization-timing.md |
| controlled-vs-uncontrolled | forms | important | local-component-state, unidirectional-data-flow | validation-strategies, form-state-machines, single-responsibility | layer-1/frontend/forms/controlled-vs-uncontrolled.md |
| dynamic-forms | forms | recommended | controlled-vs-uncontrolled, validation-strategies, form-state-machines | state-management-patterns, derived-state, declarative-routing | layer-1/frontend/forms/dynamic-forms.md |
| form-state-machines | forms | recommended | controlled-vs-uncontrolled, validation-strategies | local-component-state, loading-error-empty-states, derived-state | layer-1/frontend/forms/form-state-machines.md |
| validation-strategies | forms | important | controlled-vs-uncontrolled | form-state-machines, loading-error-empty-states, accessibility-wcag | layer-1/frontend/forms/validation-strategies.md |
| backpressure | reactive-programming | recommended | reactive-programming-intro, observables-and-subscriptions | subscription-management, hot-vs-cold-observables | layer-1/frontend/reactive-programming/backpressure.md |
| hot-vs-cold-observables | reactive-programming | recommended | observables-and-subscriptions | subscription-management, backpressure, reactive-programming-intro | layer-1/frontend/reactive-programming/hot-vs-cold-observables.md |
| observables-and-subscriptions | reactive-programming | important | reactive-programming-intro | subscription-management, hot-vs-cold-observables, cleanup-on-destroy | layer-1/frontend/reactive-programming/observables-and-subscriptions.md |
| reactive-programming-intro | reactive-programming | important | — | observables-and-subscriptions, subscription-management, backpressure, hot-vs-cold-observables, unidirectional-data-flow | layer-1/frontend/reactive-programming/reactive-programming-intro.md |
| subscription-management | reactive-programming | critical | observables-and-subscriptions, cleanup-on-destroy | component-lifecycle, memory-leak-prevention, hot-vs-cold-observables | layer-1/frontend/reactive-programming/subscription-management.md |
| declarative-routing | routing | important | separation-of-concerns | route-guards, route-resolvers, lazy-loading-routes, url-as-source-of-truth, url-as-state | layer-1/frontend/routing/declarative-routing.md |
| deep-linking | routing | important | url-as-source-of-truth, url-as-state | declarative-routing, route-resolvers | layer-1/frontend/routing/deep-linking.md |
| lazy-loading-routes | routing | important | declarative-routing | route-resolvers, route-guards, separation-of-concerns | layer-1/frontend/routing/lazy-loading-routes.md |
| route-guards | routing | important | declarative-routing | route-resolvers, global-application-state, separation-of-concerns | layer-1/frontend/routing/route-guards.md |
| route-resolvers | routing | recommended | declarative-routing, route-guards | initialization-timing, loading-error-empty-states, lazy-loading-routes | layer-1/frontend/routing/route-resolvers.md |
| url-as-source-of-truth | routing | critical | declarative-routing | url-as-state, deep-linking, unidirectional-data-flow | layer-1/frontend/routing/url-as-source-of-truth.md |
| derived-state | state-management | important | state-management-patterns, unidirectional-data-flow | local-component-state, state-normalization, single-responsibility | layer-1/frontend/state-management/derived-state.md |
| global-application-state | state-management | important | state-management-patterns, shared-state | unidirectional-data-flow, state-normalization, url-as-state | layer-1/frontend/state-management/global-application-state.md |
| local-component-state | state-management | important | state-management-patterns, component-lifecycle | shared-state, derived-state, controlled-vs-uncontrolled, single-responsibility | layer-1/frontend/state-management/local-component-state.md |
| shared-state | state-management | important | state-management-patterns, local-component-state | global-application-state, unidirectional-data-flow, separation-of-concerns | layer-1/frontend/state-management/shared-state.md |
| state-management-patterns | state-management | critical | separation-of-concerns | local-component-state, shared-state, global-application-state, unidirectional-data-flow, derived-state, state-normalization, url-as-state | layer-1/frontend/state-management/state-management-patterns.md |
| state-normalization | state-management | recommended | state-management-patterns, global-application-state | derived-state, unidirectional-data-flow | layer-1/frontend/state-management/state-normalization.md |
| unidirectional-data-flow | state-management | critical | state-management-patterns | local-component-state, shared-state, global-application-state, separation-of-concerns | layer-1/frontend/state-management/unidirectional-data-flow.md |
| url-as-state | state-management | important | state-management-patterns | url-as-source-of-truth, deep-linking, declarative-routing, global-application-state | layer-1/frontend/state-management/url-as-state.md |
| accessibility-wcag | ui-ux | critical | — | responsive-design, validation-strategies, loading-error-empty-states, internationalization | layer-1/frontend/ui-ux/accessibility-wcag.md |
| css-architecture | ui-ux | important | separation-of-concerns | responsive-design, internationalization, accessibility-wcag | layer-1/frontend/ui-ux/css-architecture.md |
| internationalization | ui-ux | important | — | accessibility-wcag, responsive-design, css-architecture | layer-1/frontend/ui-ux/internationalization.md |
| loading-error-empty-states | ui-ux | critical | component-lifecycle, initialization-timing | optimistic-updates, form-state-machines, accessibility-wcag, route-resolvers | layer-1/frontend/ui-ux/loading-error-empty-states.md |
| optimistic-updates | ui-ux | recommended | loading-error-empty-states, unidirectional-data-flow | local-component-state, global-application-state, form-state-machines | layer-1/frontend/ui-ux/optimistic-updates.md |
| responsive-design | ui-ux | critical | — | css-architecture, accessibility-wcag, loading-error-empty-states | layer-1/frontend/ui-ux/responsive-design.md |

---

## Layer 2 — Angular 14 Implementation

### build-deploy

| id | layer1_parent | module | path |
|---|---|---|---|
| angular-bundle-optimization | bundle-analysis | @angular/cli | layer-2/build-deploy/angular-bundle-optimization.md |
| angular-cli | ci-cd-pipelines | @angular/cli | layer-2/build-deploy/angular-cli.md |
| angular-differential-loading | (Angular-specific) | @angular/cli | layer-2/build-deploy/angular-differential-loading.md |
| angular-environments | environment-configuration | @angular/cli | layer-2/build-deploy/angular-environments.md |
### cdk-material

| id | layer1_parent | module | path |
|---|---|---|---|
| angular-cdk-accessibility | accessibility-wcag | @angular/cdk/a11y | layer-2/cdk-material/angular-cdk-accessibility.md |
| angular-cdk-drag-drop | (Angular-specific) | @angular/cdk/drag-drop | layer-2/cdk-material/angular-cdk-drag-drop.md |
| angular-cdk-overlay | (Angular-specific) | @angular/cdk/overlay | layer-2/cdk-material/angular-cdk-overlay.md |
| angular-cdk-virtual-scroll | virtualization | @angular/cdk/scrolling | layer-2/cdk-material/angular-cdk-virtual-scroll.md |
### components

| id | layer1_parent | module | path |
|---|---|---|---|
| angular-change-detection | (Angular-specific) | @angular/core | layer-2/components/angular-change-detection.md |
| angular-component-lifecycle | component-lifecycle | @angular/core | layer-2/components/angular-component-lifecycle.md |
| angular-content-projection | composition-over-inheritance | @angular/core | layer-2/components/angular-content-projection.md |
| angular-input-output | unidirectional-data-flow | @angular/core | layer-2/components/angular-input-output.md |
| angular-view-encapsulation | encapsulation | @angular/core | layer-2/components/angular-view-encapsulation.md |
### forms

| id | layer1_parent | module | path |
|---|---|---|---|
| angular-dynamic-forms | dynamic-forms | @angular/forms | layer-2/forms/angular-dynamic-forms.md |
| angular-form-validation | validation-strategies | @angular/forms | layer-2/forms/angular-form-validation.md |
| angular-reactive-forms | controlled-vs-uncontrolled | @angular/forms | layer-2/forms/angular-reactive-forms.md |
### http

| id | layer1_parent | module | path |
|---|---|---|---|
| angular-error-handling-http | error-boundaries | @angular/common/http | layer-2/http/angular-error-handling-http.md |
| angular-httpclient | request-response-transformation | @angular/common/http | layer-2/http/angular-httpclient.md |
| angular-interceptors | middleware-pipelines | @angular/common/http | layer-2/http/angular-interceptors.md |
### modules-di

| id | layer1_parent | module | path |
|---|---|---|---|
| angular-dependency-injection | dependency-inversion | @angular/core | layer-2/modules-di/angular-dependency-injection.md |
| angular-injection-tokens | interface-segregation | @angular/core | layer-2/modules-di/angular-injection-tokens.md |
| angular-ngmodule-boundaries | module-boundaries | @angular/core | layer-2/modules-di/angular-ngmodule-boundaries.md |
| angular-ngmodule | module-boundaries | @angular/core | layer-2/modules-di/angular-ngmodule.md |
### routing

| id | layer1_parent | module | path |
|---|---|---|---|
| angular-lazy-loading | lazy-loading-routes | @angular/router | layer-2/routing/angular-lazy-loading.md |
| angular-route-guards | route-guards | @angular/router | layer-2/routing/angular-route-guards.md |
| angular-route-params | url-as-source-of-truth | @angular/router | layer-2/routing/angular-route-params.md |
| angular-route-resolvers | route-resolvers | @angular/router | layer-2/routing/angular-route-resolvers.md |
| angular-router-setup | declarative-routing | @angular/router | layer-2/routing/angular-router-setup.md |
### rxjs

| id | layer1_parent | module | path |
|---|---|---|---|
| angular-async-pipe | subscription-management | @angular/common | layer-2/rxjs/angular-async-pipe.md |
| angular-higher-order-mapping | (Angular-specific) | rxjs | layer-2/rxjs/angular-higher-order-mapping.md |
| angular-rxjs-essentials | reactive-programming-intro | rxjs | layer-2/rxjs/angular-rxjs-essentials.md |
| angular-sharing-operators | hot-vs-cold-observables | rxjs | layer-2/rxjs/angular-sharing-operators.md |
| angular-subscription-management | subscription-management | rxjs | layer-2/rxjs/angular-subscription-management.md |
### services

| id | layer1_parent | module | path |
|---|---|---|---|
| angular-services-as-state | shared-state | @angular/core | layer-2/services/angular-services-as-state.md |
| angular-services | separation-of-concerns | @angular/core | layer-2/services/angular-services.md |
| angular-singleton-vs-scoped | single-responsibility | @angular/core | layer-2/services/angular-singleton-vs-scoped.md |
### testing

| id | layer1_parent | module | path |
|---|---|---|---|
| angular-component-harness | test-boundaries | @angular/cdk/testing | layer-2/testing/angular-component-harness.md |
| angular-component-testing | integration-testing | @angular/core/testing | layer-2/testing/angular-component-testing.md |
| angular-http-testing | integration-testing | @angular/common/http/testing | layer-2/testing/angular-http-testing.md |
| angular-marble-testing | (Angular-specific) | rxjs/testing | layer-2/testing/angular-marble-testing.md |
| angular-service-testing | unit-testing | @angular/core/testing | layer-2/testing/angular-service-testing.md |
| angular-testbed | testing-pyramid | @angular/core/testing | layer-2/testing/angular-testbed.md |
