# Praxis

*Theory into practice. A structured knowledge graph mapping universal web development principles to Angular 14 implementations.*

## What This Is

Praxis is a standalone knowledge product — not a starter template, not a code scaffold. It is a queryable reference designed for two consumers:

1. **LLMs** (Claude Code, Continue, etc.) — via semantic search over a Qdrant `praxis` collection or direct file reads
2. **Developers** — via file browsing or (future) web visualization

## Structure

```
praxis/
├── layer-1/          # Universal web development principles (technology-agnostic)
│   ├── architecture/     # Design principles, module design, API design
│   ├── frontend/         # Component lifecycle, state, reactive programming, routing, forms, UI/UX
│   ├── backend/          # Data access, caching, search engine, API patterns, bulk operations
│   ├── cross-cutting/    # Error handling, testing, security, performance, observability, build/deploy
│   └── discipline/       # Code review, git workflow, documentation, tech debt, refactoring
├── layer-2/          # Angular 14 implementations of Layer 1 concepts
│   ├── modules-di/       # NgModules, dependency injection, injection tokens
│   ├── components/       # Lifecycle, change detection, inputs/outputs, content projection
│   ├── services/         # Services, singleton vs scoped, services as state containers
│   ├── routing/          # Router setup, lazy loading, guards, params, resolvers
│   ├── rxjs/             # Essential operators, higher-order mapping, subscriptions, sharing, async pipe
│   ├── forms/            # Reactive forms, validation, dynamic forms
│   ├── http/             # HttpClient, interceptors, error handling
│   ├── testing/          # TestBed, component/service/HTTP testing, marble testing, harnesses
│   ├── cdk-material/     # Overlay, virtual scroll, drag-drop, accessibility
│   └── build-deploy/     # CLI, environments, bundle optimization, differential loading
├── GRAPH.md          # Machine-readable adjacency list (auto-generated from frontmatter)
└── README.md         # This file
```

## How to Navigate

### By concept
Every concept is one file with YAML frontmatter containing `id`, `depends_on`, `related`, and `severity`. Follow the `depends_on` links to understand prerequisites. Follow `related` links to explore connected ideas.

### By domain
Browse `layer-1/{domain}/{category}/` for universal principles. Each Layer 2 file has a `layer1_parent` field linking back to the Layer 1 concept it implements.

### By severity
- **critical** — Must understand before writing production code
- **important** — Should understand; ignoring leads to maintenance burden
- **recommended** — Good to know; improves code quality
- **informational** — Context and background

## Counts

- **Layer 1 nodes**: 105 (universal principles)
- **Layer 2 nodes**: 42 (Angular 14 implementations)
- **Total nodes**: 147
- **Total edges**: 545 (depends_on + related + layer1_parent)

## Angular Version

All Layer 2 content targets **Angular 14.2.x**. Post-v14 features (standalone components, signals, `inject()`) are not taught. Where Angular 15+ would change the approach, it is noted as "future migration context."

## Consumption Layers

Per the [architecture decision](../walter-mark-2/memory/engrams/decisions/2026-04-23-praxis-knowledge-graph-architecture.md):

1. **Layer A (File System)** — Markdown files with YAML frontmatter. Source of truth. LLMs with file access read these directly.
2. **Layer B (Vector Index)** — Qdrant `praxis` collection indexed via `index_project.py`. Semantic search for "what concepts apply to this code?"
3. **Layer C (Web Visualization)** — Deferred until content is stable.

## Future Work

- [ ] Index into Qdrant `praxis` collection
- [ ] Reference application architecture (Prompt 2)
- [ ] Static analysis tooling + vvroom gap analysis + teaching curriculum (Prompt 3)
- [ ] Web visualization UI
