---
id: dependency-inversion
domain: architecture
category: design-principles
depends_on:
  - separation-of-concerns
  - interface-segregation
related:
  - composition-over-inheritance
  - encapsulation
  - layered-architecture
  - module-boundaries
  - testing-pyramid
anti_pattern_of: null
severity: critical
---

# Dependency Inversion Principle

## Definition
High-level modules should not depend on low-level modules -- both should depend on abstractions; and abstractions should not depend on details -- details should depend on abstractions.

## Why It Matters
Without dependency inversion, your business logic is welded to your infrastructure. Your order processing code directly imports your PostgreSQL client. Your notification system directly instantiates an SMTP connection. This means you cannot test business logic without a running database. You cannot swap email providers without rewriting business code. You cannot reuse your domain logic in a different context (CLI tool, background worker, different project). The dependency arrows point downward from policy to mechanism, which means the important code (business rules) is hostage to the unimportant code (which database driver you chose this month).

## The Anti-Pattern
A self-taught developer typically has high-level code directly instantiate and call low-level code. The business logic *knows* it is talking to PostgreSQL, *knows* it is using SendGrid, *knows* it is writing to S3.

```python
# Business logic directly coupled to infrastructure
class OrderService:
    def __init__(self):
        self.db = psycopg2.connect("postgresql://localhost/mydb")
        self.mailer = SendGridClient(api_key="SG.xxx")
        self.storage = boto3.client('s3')

    def place_order(self, cart):
        # Business rule buried in infrastructure calls
        cursor = self.db.cursor()
        cursor.execute("INSERT INTO orders ...")
        self.mailer.send(to=cart.user.email, subject="Order confirmed")
        self.storage.put_object(Bucket='invoices', Key=f'{order_id}.pdf', Body=pdf)
```

Testing this requires a real database, a real email service, and a real S3 bucket. Swapping PostgreSQL for DynamoDB means rewriting `OrderService`. The fix is to depend on abstractions:

```python
class OrderService:
    def __init__(self, repo: OrderRepository, notifier: Notifier, storage: FileStorage):
        self.repo = repo
        self.notifier = notifier
        self.storage = storage

    def place_order(self, cart):
        order = self.repo.save(Order.from_cart(cart))
        self.notifier.send(cart.user.email, "Order confirmed")
        self.storage.save(f'{order.id}.pdf', generate_invoice(order))
```

Now `OrderService` has no idea what database, email provider, or storage backend is behind those abstractions.

## Recognition Signal
- Business logic files that import database drivers, HTTP clients, or SDK packages directly
- Constructor bodies that create their own dependencies (`self.db = connect(...)`)
- Test files that need environment variables, running services, or network access to test business rules
- You cannot reuse a module in a different project without dragging its infrastructure along
- Changing an infrastructure detail (upgrading a library, switching providers) requires editing business logic files

## Related Concepts
**Layered architecture** is built on dependency inversion -- each layer depends on abstractions provided by the layer below, not on concrete implementations. **Interface segregation** ensures those abstractions are small and focused rather than bloated. **Composition over inheritance** is the mechanism: you compose behavior by injecting dependencies rather than inheriting from concrete base classes. **Encapsulation** hides the implementation details behind those abstractions. **Testing pyramid** becomes achievable because unit tests can substitute fast fakes for slow infrastructure.
