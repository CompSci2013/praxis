---
id: module-boundaries
domain: architecture
category: module-design
depends_on:
  - separation-of-concerns
  - single-responsibility
  - cohesion-coupling
related:
  - encapsulation
  - layered-architecture
  - dependency-inversion
  - api-versioning
anti_pattern_of: null
severity: critical
---

# Module Boundaries

## Definition
A module boundary is the explicit line between one self-contained unit of code and another -- defining what is inside (private implementation) and what is outside (public interface), and enforcing that the boundary is crossed only through defined contracts.

## Why It Matters
Without clear boundaries, a codebase becomes a single tangled mass where everything can reach into everything else. A change in one area causes failures in distant, seemingly unrelated areas. The technical term is "big ball of mud" and it is the default outcome of every project that does not actively define and enforce module boundaries.

Boundaries determine the blast radius of change. When module A only interacts with module B through a defined interface, changes to B's internals cannot break A. This is not theoretical -- it is the difference between "I can refactor this file safely" and "I have no idea what will break if I change this."

Boundaries also determine team scalability. Two developers can work on two modules simultaneously without conflict if the boundary between them is clear. Without boundaries, every pull request risks merge conflicts and behavioral regressions in code the developer never touched.

## The Anti-Pattern
Self-taught developers typically organize code by *technical layer* (all controllers together, all models together, all services together) rather than by *domain boundary* (all user-related code together, all billing-related code together). This creates a structure where every feature change requires touching files in 4 different directories.

```
# Organized by layer (fragile boundaries)
src/
  controllers/
    userController.ts
    orderController.ts
    billingController.ts
  services/
    userService.ts
    orderService.ts
    billingService.ts
  models/
    user.ts
    order.ts
    invoice.ts
  repositories/
    userRepo.ts
    orderRepo.ts
    billingRepo.ts
```

The `orderService` imports from `userRepo` directly. The `billingController` reaches into `orderService` internals. There are no real boundaries -- every file can import every other file.

```
# Organized by domain (clear boundaries)
src/
  users/
    index.ts          # Public API -- only this is importable from outside
    userService.ts     # Internal
    userRepo.ts        # Internal
    user.model.ts      # Internal
  orders/
    index.ts           # Public API
    orderService.ts
    orderRepo.ts
    order.model.ts
  billing/
    index.ts           # Public API
    billingService.ts
    invoiceRepo.ts
    invoice.model.ts
```

Now `billing/` can only use `orders/` through `orders/index.ts`. Internal refactoring of `orders/` never breaks `billing/` as long as the public API is stable.

## Recognition Signal
- No `index.ts` or `__init__.py` files defining public APIs -- everything is directly importable
- Import statements that reach deep into another module's internals (`import { helper } from '../orders/internal/utils/helpers'`)
- Circular dependencies between directories (A imports from B, B imports from A)
- A feature change requires modifying files in 4+ directories
- You cannot describe what a directory "does" in one sentence
- No lint rules or conventions preventing cross-boundary imports
- Renaming an internal function triggers import errors in distant modules

## Related Concepts
**Separation of concerns** tells you *why* to draw boundaries. **Single responsibility** tells you the *granularity* -- each module should have one reason to exist. **Cohesion and coupling** measure whether your boundaries are in the right place: high cohesion within, low coupling across. **Encapsulation** is the enforcement mechanism -- public exports are the module's interface, everything else is hidden. **Layered architecture** is one way to organize boundaries vertically (by technical concern), while domain boundaries organize horizontally (by business concept). The best architectures use both. **Dependency inversion** ensures boundaries point in the right direction -- high-level modules define interfaces that low-level modules implement. **API versioning** applies boundary thinking to external APIs: the boundary between your system and its consumers.
