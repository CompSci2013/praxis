---
id: cohesion-coupling
domain: architecture
category: module-design
depends_on:
  - separation-of-concerns
  - single-responsibility
related:
  - module-boundaries
  - encapsulation
  - dependency-inversion
  - component-based-architecture
  - dry-principle
anti_pattern_of: null
severity: critical
---

# Cohesion and Coupling

## Definition
Cohesion measures how strongly the elements within a module belong together; coupling measures how strongly modules depend on each other. The goal is high cohesion within modules and low coupling between them.

## Why It Matters
Cohesion and coupling are the quantifiable outcomes of all other design principles. They answer the question "did we actually separate concerns well?" in measurable terms.

Low cohesion means a module contains unrelated things -- changing it requires understanding all of them, testing it requires exercising all of them, and reusing any single part of it requires taking all the rest along. High coupling means a change in one module cascades into changes in many others -- the exact problem modularity was supposed to prevent.

Together, they determine your development speed over time. In the first month, a poorly cohesive, tightly coupled codebase is fine -- it is small. By month six, developers spend more time navigating dependencies and fixing regressions than building features. By year two, the team is afraid to touch anything.

## The Anti-Pattern
Self-taught developers typically create modules with low cohesion (grab bag of unrelated utilities) and high coupling (modules reaching into each other's internals).

**Low cohesion (the utils file):**
```python
# utils.py -- the graveyard of homeless functions
def format_currency(amount): ...
def send_email(to, subject, body): ...
def validate_phone_number(phone): ...
def resize_image(path, width, height): ...
def calculate_shipping_cost(weight, destination): ...
def slugify(text): ...
def parse_csv(file_path): ...
```

None of these functions are related. They share a file only because the developer didn't know where else to put them. This file changes for 7 different reasons driven by 7 different features.

**High coupling (reaching into internals):**
```javascript
// OrderService directly manipulates User internals
class OrderService {
  placeOrder(user, cart) {
    // Reaching into user's internal credit tracking
    if (user._creditBalance >= cart.total) {
      user._creditBalance -= cart.total;
      user._orderHistory.push(cart);
      user._lastOrderDate = new Date();
    }
    // Reaching into inventory internals
    cart.items.forEach(item => {
      item.product._stockCount -= item.quantity;
      item.product._reservations = item.product._reservations
        .filter(r => r.cartId !== cart.id);
    });
  }
}
```

`OrderService` knows the internal field names and data structures of both `User` and `Product`. If any of those internals change, `OrderService` breaks.

## Recognition Signal
**Low cohesion:**
- Files named `utils`, `helpers`, `common`, `misc`, `shared`
- A module where most functions do not call each other or share data
- You cannot summarize what a module does without using "and" multiple times
- Class methods that use completely different subsets of instance variables

**High coupling:**
- Changing a private field name in one class breaks code in another class
- Import graphs that form dense webs rather than clean hierarchies
- Modules that import each other (circular dependencies)
- A "simple" refactoring in one module requires changes in 5+ other modules
- Test setup for one module requires instantiating objects from many other modules
- Shotgun surgery: a single conceptual change requires edits scattered across many files

## Related Concepts
**Separation of concerns** is the principle; cohesion and coupling are how you measure whether you followed it. **Single responsibility** directly produces high cohesion -- if a class has one responsibility, its internals are inherently related. **Module boundaries** are where you enforce low coupling -- a well-defined boundary means modules interact through contracts, not internals. **Encapsulation** is the mechanism that prevents coupling: by hiding internals, you make it impossible for other modules to depend on them. **Dependency inversion** reduces coupling by having modules depend on abstractions rather than concrete implementations. **DRY** can *hurt* cohesion if you extract a shared function that pulls unrelated concepts into a single module just to avoid duplication.
