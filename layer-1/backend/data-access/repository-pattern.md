---
id: repository-pattern
domain: backend
category: data-access
depends_on:
  - separation-of-concerns
  - single-responsibility
related:
  - unit-of-work
  - query-builders
  - orm-tradeoffs
  - request-response-transformation
anti_pattern_of: null
severity: important
---

# Repository Pattern

## Definition
An abstraction that encapsulates data access behind a collection-like interface, so that the rest of your application asks for domain objects without knowing whether they come from a database, an API, a cache, or a file.

## Why It Matters
Without repositories, database queries are scattered throughout your business logic. Your service layer knows it's using PostgreSQL. Your controller knows the table is called `user_accounts` and that you need a LEFT JOIN to get roles. When you need to add caching in front of the database, you modify twenty files. When you want to test your business logic, you need a running database because every function contains raw SQL or ORM calls. The repository creates a seam: above it, code speaks in domain language ("find active users in this region"); below it, code speaks in storage language ("SELECT * FROM users WHERE status = 'active' AND region_id = ?").

## The Anti-Pattern
A self-taught developer typically puts database queries directly in route handlers or service functions. There's no single place that knows "how to get a user." Instead, slightly different versions of the same query exist in five files, each with its own bugs and edge cases. When the schema changes, you grep for the table name and hope you found them all.

```python
# Queries scattered everywhere -- no single source of truth

# In the auth handler
@app.route('/login', methods=['POST'])
def login():
    user = db.execute(
        "SELECT * FROM users WHERE email = %s AND deleted_at IS NULL", [email]
    ).fetchone()
    # ... auth logic

# In the profile handler (forgot the deleted_at check)
@app.route('/profile/<id>')
def profile(id):
    user = db.execute("SELECT * FROM users WHERE id = %s", [id]).fetchone()
    # Returns deleted users!

# In the admin handler (different column selection)
@app.route('/admin/users')
def admin_users():
    users = db.execute(
        "SELECT id, email, created_at FROM users ORDER BY created_at DESC"
    ).fetchall()

# In a background job (yet another variant)
def send_weekly_digest():
    users = db.execute(
        "SELECT * FROM users WHERE email_opt_in = TRUE AND deleted_at IS NULL"
    ).fetchall()
```

With a repository, there's one place that knows the rules:
```python
class UserRepository:
    def find_by_email(self, email):
        return db.execute(
            "SELECT * FROM users WHERE email = %s AND deleted_at IS NULL", [email]
        ).fetchone()

    def find_active(self, **filters):
        query = "SELECT * FROM users WHERE deleted_at IS NULL"
        # Apply filters consistently
        ...

    def find_by_id(self, id):
        return self.find_active(id=id)  # Soft-delete is always respected
```

## Recognition Signal
- The same table is queried in 5+ files with slightly different WHERE clauses
- Some queries check `deleted_at IS NULL` and others don't
- Business logic functions import the database connection directly
- Testing requires a live database because you can't stub out data access
- Switching from raw SQL to an ORM (or vice versa) would touch every file in the project
- You find duplicate queries that have diverged: one was updated for a schema change, the other wasn't
- There's no obvious place to add "always filter by tenant_id" for multi-tenant queries

## Related Concepts
**Unit of work** pairs with repository to manage transactions -- the repository handles individual queries, the unit of work coordinates committing or rolling back groups of changes. **Query builders** are often used inside repositories to construct queries programmatically rather than concatenating strings. **ORM tradeoffs** directly affect repository design: with an ORM, the repository wraps ORM calls; without one, it wraps raw SQL. Either way, the rest of your code doesn't know the difference. **Separation of concerns** and **single responsibility** are the principles this pattern embodies -- data access is one concern, and the repository is the single place responsible for it.
