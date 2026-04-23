---
id: encapsulation
domain: architecture
category: module-design
depends_on:
  - separation-of-concerns
  - single-responsibility
related:
  - cohesion-coupling
  - module-boundaries
  - interface-segregation
  - component-based-architecture
  - api-error-contracts
anti_pattern_of: null
severity: critical
---

# Encapsulation

## Definition
Hide internal implementation details behind a stable public interface, so that consumers depend on *what* a module does, never on *how* it does it.

## Why It Matters
Without encapsulation, every consumer of your code becomes coupled to its internal structure. When you change the internal implementation -- renaming a field, restructuring data, optimizing an algorithm -- every consumer breaks. This creates a situation where the more successful your code is (the more consumers it has), the harder it is to improve.

Encapsulation gives you the freedom to change your mind. You can restructure internal data, optimize algorithms, fix bugs in private methods, and swap storage mechanisms -- all without breaking any code that depends on you. The public interface is a contract. The internals are your business.

In languages without access modifiers (Python, JavaScript), encapsulation is a discipline rather than an enforcement. But it matters just as much -- arguably more, because there is nothing stopping someone from reaching inside.

## The Anti-Pattern
A self-taught developer exposes everything. All fields are public. Internal helper methods sit alongside API methods with no distinction. Consumers reach directly into data structures because it is the fastest path.

```python
class ShoppingCart:
    def __init__(self):
        self.items = []           # Public mutable list
        self.discount_code = None # Public field
        self.applied = False      # Internal state, exposed

    def add_item(self, product, qty):
        self.items.append({'product': product, 'qty': qty, 'subtotal': product.price * qty})

# Consumer reaches into internals
cart = ShoppingCart()
cart.add_item(widget, 3)

# Direct manipulation bypasses all business rules
cart.items[0]['subtotal'] = 0           # Free items hack
cart.items.append({'product': None})    # Invalid state
cart.applied = True                     # Skips discount validation
del cart.items[:]                       # Empties cart without cleanup

# Another file sorts cart internals directly
cart.items.sort(key=lambda x: x['subtotal'])  # Depends on internal dict structure
```

When you later want to change the internal data structure from a list of dicts to a list of `CartItem` objects, every file that touches `cart.items` directly must be rewritten.

The encapsulated version:

```python
class ShoppingCart:
    def __init__(self):
        self._items = []
        self._discount_code = None

    def add_item(self, product, qty):
        self._items.append(CartItem(product, qty))

    def remove_item(self, product_id):
        self._items = [i for i in self._items if i.product.id != product_id]

    def apply_discount(self, code):
        if not self._validate_discount(code):
            raise InvalidDiscountError(code)
        self._discount_code = code

    @property
    def total(self):
        subtotal = sum(item.subtotal for item in self._items)
        return self._apply_discount(subtotal)

    @property
    def item_count(self):
        return len(self._items)
```

Now consumers cannot corrupt internal state. You can change `_items` from a list to a linked list, a database-backed collection, or anything else -- as long as `add_item`, `remove_item`, `total`, and `item_count` still work, no consumer breaks.

## Recognition Signal
- Objects with all public fields that are mutated directly by other modules
- No private/protected members (or in Python, no leading underscores convention)
- Consumer code that accesses nested internal structures: `order.cart.items[0].product.category.name`
- Tests that assert on internal state rather than observable behavior: `assert cart.items == [...]` instead of `assert cart.item_count == 3`
- Refactoring a class's internal representation requires changing files across the entire codebase
- No distinction between "this is the API" and "this is a helper" -- all methods are equally accessible
- In frontend: components that expose refs to internal DOM elements, or parent components that directly manipulate children's state

## Related Concepts
**Module boundaries** are encapsulation at the directory/package level -- the `index.ts` or `__init__.py` is the module's public interface. **Interface segregation** ensures the public interface is minimal -- clients get only what they need. **Cohesion and coupling** improve with encapsulation: hidden internals cannot create coupling, and cohesive internals are easier to hide behind a clean interface. **Single responsibility** makes encapsulation natural: if a class has one job, its public interface is obvious (the things that job provides) and its internals are obvious (the things needed to do that job). **Component-based architecture** applies encapsulation to UI: a component's internal state and DOM structure are hidden behind its props and events interface. **API error contracts** are encapsulation for HTTP APIs: the error format is the public interface, the internal exception structure is hidden.
