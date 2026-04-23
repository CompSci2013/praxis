---
id: composition-over-inheritance
domain: architecture
category: design-principles
depends_on:
  - single-responsibility
  - dependency-inversion
related:
  - interface-segregation
  - encapsulation
  - component-based-architecture
  - cohesion-coupling
anti_pattern_of: null
severity: critical
---

# Composition Over Inheritance

## Definition
Favor assembling behavior by combining simple, independent objects rather than building behavior through class inheritance hierarchies.

## Why It Matters
Inheritance creates the tightest coupling possible between two classes. The subclass depends on the internal implementation of its parent -- not just its public interface, but the order of method calls, the meaning of protected fields, the side effects of constructor logic. Change the parent, break every child. Add a feature that doesn't fit the hierarchy, and you either shove it in awkwardly or duplicate code across branches. Inheritance hierarchies deeper than two levels become nearly impossible to reason about because behavior is spread across multiple files and resolved at runtime through method resolution order. Composition lets you mix and match capabilities without these constraints.

## The Anti-Pattern
A self-taught developer learns about inheritance and uses it as the primary code reuse mechanism. The result is deep hierarchies that model "is-a" relationships that aren't actually "is-a."

```python
class Animal:
    def move(self): ...
    def eat(self): ...

class Bird(Animal):
    def fly(self): ...
    def lay_eggs(self): ...

class Penguin(Bird):
    def fly(self):
        raise Exception("Penguins can't fly")  # Violates parent's contract

    def swim(self): ...

class FlyingFish(Animal):
    # Needs fly() from Bird but isn't a Bird
    # Needs swim() from... nowhere in the hierarchy
    # Developer copies code or creates bizarre multiple inheritance
```

In frontend code, this appears as deeply nested component inheritance (`BaseForm` -> `ValidatedForm` -> `StyledValidatedForm` -> `UserProfileStyledValidatedForm`). In backend code, it appears as `BaseService` -> `AuthenticatedService` -> `LoggingAuthenticatedService` chains where each level adds one concern and you cannot get logging without authentication.

## Recognition Signal
- Class hierarchies deeper than 2 levels
- Abstract base classes with many methods, some of which subclasses override with no-ops or exceptions
- The "diamond problem" -- needing behavior from two different branches of a hierarchy
- Classes named with prefixes/suffixes stacked: `CachingValidatingAuthenticatedUserService`
- `super()` calls scattered through methods, often in fragile order
- You want to reuse one method from a class but inheritance forces you to take all of its baggage
- Subclasses that override parent methods to do nothing (`pass` or `return None`)

## Related Concepts
**Component-based architecture** is composition applied to UI: components compose smaller components rather than inheriting from base components. **Dependency inversion** enables composition by injecting abstract dependencies rather than inheriting concrete ones. **Interface segregation** keeps the composed pieces small and focused. **Single responsibility** is easier to achieve through composition because each composed piece has one job. **Encapsulation** is stronger with composition because composed objects interact only through public interfaces, while inheritance exposes protected internals.
