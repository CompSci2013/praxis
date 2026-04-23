---
id: single-responsibility
domain: architecture
category: design-principles
depends_on:
  - separation-of-concerns
related:
  - cohesion-coupling
  - module-boundaries
  - encapsulation
anti_pattern_of: null
severity: critical
---

# Single Responsibility Principle

## Definition
A class should have one, and only one, reason to change -- meaning it serves exactly one actor or stakeholder in the system.

## Why It Matters
When a class serves multiple stakeholders, a change requested by one stakeholder can break the behavior expected by another. The CFO asks for a change to how overtime is calculated. The CTO asks for a change to how hours are persisted. If both concerns live in the same class, the developer working on the CFO's request can accidentally break the CTO's feature -- and nobody notices until production. SRP prevents unrelated changes from colliding. It also makes classes small enough to hold in your head, which is the real productivity multiplier.

## The Anti-Pattern
A self-taught developer typically creates classes that are organized by *entity* rather than *responsibility*. A `User` class that handles authentication, profile updates, email sending, password hashing, avatar uploads, and notification preferences. It starts small and grows because "it's about the user, so it goes in the User class."

```python
class User:
    def __init__(self, name, email, password):
        self.name = name
        self.email = email
        self.password = password

    def authenticate(self, password):
        return bcrypt.check(self.password, password)

    def hash_password(self, raw):
        self.password = bcrypt.hash(raw)

    def save(self):
        db.execute("INSERT INTO users ...")

    def send_welcome_email(self):
        smtp.send(self.email, "Welcome!", ...)

    def generate_report(self):
        return f"User {self.name} joined on ..."

    def upload_avatar(self, file):
        s3.upload(f"avatars/{self.id}", file)
```

This class changes when: the auth system changes, the database schema changes, the email provider changes, the report format changes, or the storage backend changes. That is five reasons to change.

## Recognition Signal
- Classes with more than ~200 lines (a smell, not a rule)
- Class names that are generic nouns: `User`, `Order`, `Manager`, `Service`, `Helper`, `Utils`
- Methods on a class that don't use the same instance variables -- subgroups of methods that each touch different fields
- Imports at the top of the file spanning many unrelated domains (database, email, file I/O, HTTP, crypto)
- When you describe what the class does, you use the word "and" repeatedly
- Pull requests that touch a single class for completely unrelated feature requests

## Related Concepts
**Separation of concerns** is the broader principle; SRP is its application at the class level. **Cohesion and coupling** are the metrics: a class with a single responsibility has high cohesion (everything inside is related) and enables low coupling (other classes depend on a narrow interface). **Encapsulation** works hand-in-hand with SRP -- once a class has one job, you can hide its internals confidently because those internals serve one purpose. **Module boundaries** scale SRP up from classes to packages and services.
