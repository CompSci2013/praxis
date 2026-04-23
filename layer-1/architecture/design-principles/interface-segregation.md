---
id: interface-segregation
domain: architecture
category: design-principles
depends_on:
  - single-responsibility
  - separation-of-concerns
related:
  - dependency-inversion
  - cohesion-coupling
  - encapsulation
  - api-error-contracts
anti_pattern_of: null
severity: important
---

# Interface Segregation Principle

## Definition
No client should be forced to depend on methods it does not use -- prefer many small, specific interfaces over one large, general-purpose one.

## Why It Matters
When a client depends on a fat interface, it becomes coupled to methods it never calls. When any of those unused methods change signature, the client's code must be recompiled, redeployed, or at minimum re-tested -- even though nothing it cares about changed. In dynamic languages, the cost is more subtle: fat interfaces make it unclear what a function actually needs, which makes testing harder (you mock 12 methods when the function only calls 2) and makes refactoring terrifying (you don't know which consumers use which methods). Fat interfaces are the reason developers say "I'm afraid to change this because I don't know what depends on it."

## The Anti-Pattern
A self-taught developer typically creates a single large interface (or in dynamically typed languages, a single large object/class) that every consumer receives in full, even if each consumer only needs a fraction of it.

```typescript
// One fat interface for all "machines"
interface Machine {
  print(doc: Document): void;
  scan(): Image;
  fax(doc: Document, number: string): void;
  staple(doc: Document): void;
  collate(docs: Document[]): Document;
}

// A basic printer is forced to implement methods it can't do
class BasicPrinter implements Machine {
  print(doc: Document) { /* works */ }
  scan() { throw new Error('Cannot scan'); }
  fax() { throw new Error('Cannot fax'); }
  staple() { throw new Error('Cannot staple'); }
  collate() { throw new Error('Cannot collate'); }
}
```

In frontend code, this manifests as components that receive a massive props object or context when they only need one or two fields. In backend code, it looks like service classes injected everywhere that have 30 methods, of which each consumer uses 2.

## Recognition Signal
- Classes that implement an interface but throw `NotImplementedError` or return `null` for several methods
- Mock objects in tests that stub out 10 methods when the function under test only calls 2
- Components that receive a large context object but only read one property from it
- A change to one method on an interface triggers test failures in code that never calls that method
- Functions that accept a `user` object but only read `user.email` -- they should accept an email string or a smaller interface

## Related Concepts
**Dependency inversion** pairs with ISP: you depend on abstractions, but those abstractions should be small and focused. A fat abstraction is barely better than a concrete dependency. **Single responsibility** at the class level naturally produces segregated interfaces -- if a class has one job, its public interface is inherently narrow. **Cohesion and coupling** again measure the result: segregated interfaces mean consumers are coupled only to what they actually use (low coupling). **API error contracts** apply ISP thinking to HTTP APIs -- clients should get consistent, minimal error shapes rather than a dump of every possible internal error field.
