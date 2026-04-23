---
id: api-versioning
domain: architecture
category: api-design
depends_on:
  - rest-principles
  - module-boundaries
  - encapsulation
related:
  - api-error-contracts
  - yagni
  - dependency-inversion
anti_pattern_of: null
severity: important
---

# API Versioning

## Definition
API versioning is a strategy for evolving an API's contract over time without breaking existing clients -- allowing old clients to keep working while new clients adopt new behavior.

## Why It Matters
Once an API has consumers, its response shape is a promise. Renaming a field from `userName` to `user_name` breaks every client that reads `userName`. Removing a deprecated field breaks every client that still uses it. Changing the semantics of an endpoint (different filtering behavior, different default sort order) breaks client assumptions silently -- the response succeeds but the client processes it wrong.

Without versioning strategy, you face an impossible choice: never improve your API (stagnation), or break clients with every change (chaos). Versioning lets you make breaking changes in a new version while keeping the old version alive for existing clients, with a clear timeline for migration.

However, versioning is also one of the most over-engineered aspects of API design. Many teams build elaborate versioning systems for APIs that have one consumer (their own frontend). YAGNI applies: if you control both sides of the API, you do not need formal versioning -- you need coordinated deployment.

## The Anti-Pattern
Self-taught developers typically do one of two things:

**Anti-pattern 1: No versioning.** They change the API response shape and deploy, breaking mobile apps in the field that cannot be force-updated. Or they add a required field to a request and break every integration partner simultaneously.

```python
# V1: shipped to production, mobile apps depend on this
GET /api/users/123
{
    "userName": "alice",
    "email": "alice@example.com"
}

# "Quick fix" -- renamed field, no version bump
GET /api/users/123
{
    "name": "alice",           # Breaking: was "userName"
    "emailAddress": "alice@example.com"  # Breaking: was "email"
}
# Every mobile app in the field is now broken
```

**Anti-pattern 2: Over-versioning.** They create a new API version for every non-breaking change, ending up with v1 through v17, each requiring its own controller, tests, and documentation. Non-breaking changes (adding a new optional field, adding a new endpoint) do not require a new version.

**What requires a new version (breaking changes):**
- Removing a field from a response
- Renaming a field
- Changing a field's type (string to number)
- Changing required/optional status of request fields
- Changing the semantics of an existing endpoint

**What does NOT require a new version (additive changes):**
- Adding a new optional field to a response
- Adding a new endpoint
- Adding a new optional query parameter
- Adding a new enum value to a field

## Common Versioning Strategies

```
# URL path versioning (most common, most visible)
GET /api/v1/users/123
GET /api/v2/users/123

# Header versioning (cleaner URLs, less discoverable)
GET /api/users/123
Accept: application/vnd.myapi.v2+json

# Query parameter versioning (easy but ugly)
GET /api/users/123?version=2
```

URL path versioning is the pragmatic choice for most teams. It is visible, cacheable, and requires no special client configuration.

## Recognition Signal
- API consumers pinned to specific response shapes with no way to migrate gradually
- Mobile apps or third-party integrations breaking after deployments
- Every response includes a mix of old field names and new field names (half-migrated state)
- No deprecation warnings in responses or documentation
- 15 API versions maintained simultaneously because no one sunset the old ones
- Breaking changes deployed on Friday afternoons

## Related Concepts
**REST principles** provide the foundation: versioning builds on top of standard REST resource modeling. **Module boundaries** apply to API versions: each version's handlers, serializers, and validators should be a cohesive module, not scattered conditionals. **Encapsulation** means that internal model changes should not automatically become API changes -- the serialization layer is the boundary. **API error contracts** should be versioned too, or better, designed to be stable across versions. **YAGNI** is the essential counterbalance: do not build a versioning system until you need one. If your only consumer is your own frontend and you can deploy both simultaneously, you do not need versioning -- you need coordination. **Dependency inversion** helps implement versioning: version-specific serializers depend on the same business logic abstractions, preventing duplication of domain code across versions.
