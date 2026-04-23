---
id: unit-of-work
domain: backend
category: data-access
depends_on:
  - repository-pattern
  - separation-of-concerns
related:
  - bulk-operations
  - query-builders
  - orm-tradeoffs
anti_pattern_of: null
severity: important
---

# Unit of Work

## Definition
A pattern that tracks all changes made during a business operation and commits or rolls them back as a single atomic transaction, ensuring that either everything succeeds together or nothing changes at all.

## Why It Matters
Business operations rarely involve just one database write. Creating an order means inserting the order record, decrementing inventory for each item, creating a payment record, and updating the customer's last-order timestamp. Without a unit of work, each of these is an independent database call. If the payment insert fails after inventory was already decremented, you have inconsistent data: stock was reduced but no order exists. The customer was charged but the order was lost. You end up writing compensating logic ("if step 3 fails, undo steps 1 and 2") that is fragile, incomplete, and inevitably misses edge cases.

## The Anti-Pattern
A self-taught developer typically commits after each individual operation, or relies on auto-commit mode without thinking about it. Each `save()` or `INSERT` is its own transaction. Error handling attempts to manually undo previous steps, but the undo logic itself can fail, leaving the database in a half-completed state.

```python
def transfer_money(from_account, to_account, amount):
    # Each operation commits independently -- if the second fails,
    # money disappears from from_account but never arrives in to_account
    from_acct = db.query(Account).get(from_account)
    from_acct.balance -= amount
    db.commit()  # Money is gone

    to_acct = db.query(Account).get(to_account)
    to_acct.balance += amount
    db.commit()  # If this fails, money vanished

def create_order(cart, user):
    order = Order(user_id=user.id, total=cart.total)
    db.add(order)
    db.commit()  # Order exists

    for item in cart.items:
        line = OrderLine(order_id=order.id, product_id=item.product_id, qty=item.qty)
        db.add(line)
        db.commit()  # Each line item committed separately

        product = db.query(Product).get(item.product_id)
        product.stock -= item.qty
        db.commit()  # Stock decremented independently
        # If this fails on item 3 of 5: order has 2 line items,
        # stock is wrong for 2 products, 3 products still have old stock
```

The unit of work approach:
```python
def create_order(cart, user):
    with db.transaction() as uow:  # Nothing commits until the block exits
        order = Order(user_id=user.id, total=cart.total)
        uow.add(order)

        for item in cart.items:
            uow.add(OrderLine(order_id=order.id, product_id=item.product_id, qty=item.qty))
            product = uow.query(Product).get(item.product_id)
            product.stock -= item.qty

        # All changes committed atomically here -- or all rolled back on exception
```

## Recognition Signal
- Multiple `db.commit()` or `db.save()` calls within a single business operation
- Error handling that tries to manually reverse previous database writes
- Data inconsistencies that appear after partial failures ("orphaned records")
- Auto-commit mode is on and nobody has explicitly thought about transaction boundaries
- Business logic has no concept of "all or nothing" -- each step is fire-and-forget
- You find yourself writing cleanup scripts to fix half-completed operations
- Money or inventory "disappears" under error conditions

## Related Concepts
**Repository pattern** handles individual entity operations; the unit of work wraps multiple repository calls into a single transaction. They are designed to work together -- repositories track changes, the unit of work decides when to flush them. **Bulk operations** often require unit-of-work thinking at scale: inserting 10,000 records should either fully succeed or fully fail, not leave 6,342 orphaned rows. **ORM tradeoffs** are relevant because most ORMs (SQLAlchemy, Entity Framework, Django ORM) provide built-in unit-of-work implementations through their session/context objects, but you must understand the pattern to use them correctly -- calling `commit()` at the wrong time defeats the purpose.
