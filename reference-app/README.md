# Reference Application Architecture

## What This Is

This is architecture documentation for a reference application built with Angular 14, Elasticsearch, and a RESTful API. It is not a code scaffold, starter template, or runnable project. It is a worked example showing how Praxis Layer 1 principles and Layer 2 Angular implementations combine into real architectural decisions.

The reference application is a **product catalog with document search** -- a domain-neutral application that demonstrates search, filtering, detail views, and data management against Elasticsearch as the primary data store. There is no authentication layer.

## The Stack

| Layer | Technology | Role |
|---|---|---|
| Front-end | Angular 14.2.x | Single-page application with NgModule-based architecture |
| API | RESTful HTTP | Translates front-end requests into Elasticsearch queries |
| Data | Elasticsearch | Primary data store for all read operations; search, filter, aggregate |

Angular 14 means: NgModules for boundaries, no standalone components, no signals, no `inject()` function. All dependency injection uses constructor injection. All modules use `@NgModule` declarations.

## How to Read This Section

Each document addresses one architectural concern. Within each document, every decision cites the Layer 1 principle it follows and the Layer 2 Angular implementation it uses. Citations are relative links -- click them to read the governing concept.

**Start here**, then read in order:

1. **[Project Structure](project-structure.md)** -- How the Angular workspace is organized. Module boundaries, feature modules, shared module, core module. Where files go and why.

2. **[State Management](state-management.md)** -- Where each type of state lives. URL-first navigation state, component-local UI state, service-held application state, HTTP-delivered server state. The rules that prevent state from ending up in the wrong place.

3. **[Data Flow](data-flow.md)** -- The complete request-response cycle from user action to rendered template. What each layer does, what it must not do, and which Praxis concepts govern it.

## How This Connects to Layer 1 and Layer 2

Layer 1 contains universal principles -- they apply regardless of framework or language. Layer 2 contains Angular-specific implementations of those principles. This reference application shows what happens when you apply both layers to a concrete architecture.

The relationship:

```
Layer 1 (WHY)          Layer 2 (HOW in Angular)        Reference App (HOW in this architecture)
─────────────          ───────────────────────          ────────────────────────────────────────
separation-of-concerns → angular-ngmodule-boundaries  → Feature modules per domain (catalog, search, admin)
url-as-source-of-truth → angular-route-params          → Search query and filters live in URL query params
shared-state           → angular-services-as-state     → CatalogService holds loaded products in BehaviorSubject
middleware-pipelines   → angular-interceptors           → Error interceptor handles API failures globally
layered-architecture   → (cross-layer)                 → Component → Service → API → Elasticsearch pipeline
```

Layer 1 tells you what principle to follow. Layer 2 tells you how Angular implements it. This reference application shows what the result looks like when the principles are applied together in a real project structure.

## Design Constraints

These constraints shape every decision in the reference architecture:

1. **Elasticsearch is the primary data store.** There is no relational database. The API builds Elasticsearch queries directly. This follows [search-engine-as-datastore](../layer-1/backend/search-engine/search-engine-as-datastore.md) -- the application is read-heavy with complex filtering and aggregation requirements that a relational database handles poorly.

2. **No authentication.** The application has no login, no tokens, no user sessions. This keeps the reference focused on data flow and state management rather than auth plumbing. Interceptors still exist (for error handling and logging), but there is no auth interceptor.

3. **Angular 14.2.x only.** NgModule-based architecture. Constructor injection. No standalone components, no signals, no `inject()`. Every module boundary is enforced by `@NgModule` declarations and exports.

4. **URL is the source of truth for navigation state.** Search queries, active filters, selected record IDs, and pagination cursors live in the URL. Components read from route params, not from services. This follows [url-as-source-of-truth](../layer-1/frontend/routing/url-as-source-of-truth.md) and [url-as-state](../layer-1/frontend/state-management/url-as-state.md).

5. **Domain-neutral examples.** Products, documents, categories. Not tied to any specific business domain. The patterns transfer to any search-driven application.
