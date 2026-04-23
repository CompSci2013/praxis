---
id: shared-state
domain: frontend
category: state-management
depends_on:
  - state-management-patterns
  - local-component-state
related:
  - global-application-state
  - unidirectional-data-flow
  - separation-of-concerns
anti_pattern_of: null
severity: important
---

# Shared State

## Definition
Shared state is data that two or more components need to read or write, but that doesn't belong to the entire application — it's scoped to a feature, a page, or a subtree of the component hierarchy.

## Why It Matters
Most state-sharing needs fall into this middle tier, not local and not global. Without recognizing this tier, developers face a false binary: either drill props through many layers (painful, fragile) or dump everything into a global store (over-coupled, slow). Shared state mechanisms — context providers, feature-scoped stores, service classes — let you share data exactly where it's needed without polluting the global namespace or creating deep prop chains.

## The Anti-Pattern
The developer has two sibling components that need the same data. Instead of lifting the state to their common parent or using a scoped context, they reach for the global store. Now a filter panel and a results list for a search feature are coupled to the same global store used by authentication, notifications, and user preferences. When the search feature gets refactored, the developer has to carefully avoid breaking the unrelated features that share the store. Alternatively, they prop-drill through 5+ levels, passing data through components that don't use it, creating maintenance burden every time the tree structure changes.

```
// Prop drilling through components that don't use the data
<App>
  <Layout sidebar={sidebar}>          {/* Layout doesn't use sidebar data */}
    <Page sidebar={sidebar}>           {/* Page doesn't use it either */}
      <Content sidebar={sidebar}>      {/* Content is just passing it through */}
        <Sidebar data={sidebar} />     {/* Finally used here */}
      </Content>
    </Page>
  </Layout>
</App>

// Fix: a context scoped to the feature
const SearchContext = createContext();
<SearchContext.Provider value={{ query, results, setQuery }}>
  <FilterPanel />   {/* reads query, calls setQuery */}
  <ResultsList />   {/* reads results */}
</SearchContext.Provider>
```

## Recognition Signal
Count the levels between where state is defined and where it's used. If props pass through 3+ intermediate components that don't use them, that's prop drilling, and the state should be shared via a context or scoped store. If the global store has sections that are only relevant to one page or feature (e.g., `state.searchPage.filters`), that state should be scoped to that feature, not global.

## Related Concepts
**Global application state** is for data that truly every part of the app needs (authenticated user, locale). Shared state fills the gap between that and **local component state**. **Unidirectional data flow** still applies within shared state — the context provider is the single source of truth, and consumers request changes through defined functions, not by mutating the shared data directly. **Separation of concerns** guides which data belongs in which scope.
