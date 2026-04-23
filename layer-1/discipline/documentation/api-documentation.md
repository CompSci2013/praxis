---
id: api-documentation
domain: discipline
category: documentation
depends_on: []
related:
  - code-comments
  - architecture-decision-records
  - interface-segregation
  - code-review-practices
anti_pattern_of: null
severity: important
---

# API Documentation

## Definition
API documentation describes the contract between a service and its consumers -- what endpoints exist, what inputs they accept, what outputs they return, and what errors they produce -- written for the person calling the API, not the person who built it.

## Why It Matters
An undocumented API forces every consumer to reverse-engineer its behavior. They read the source code (if they have access), poke at the endpoint with curl, or message the author on Slack and wait hours for a response. This multiplies across every developer, every integration, and every new team member. A change to an undocumented API breaks consumers silently because there was no contract to check against. Documentation is not a nice-to-have for APIs -- it is the interface. An API without documentation is a function without a signature: technically callable, practically unusable.

## The Anti-Pattern
A self-taught developer typically documents APIs in one of these broken ways:

**No documentation at all.** The API exists as code and nothing else. New consumers ask the author directly. When the author leaves, the tribal knowledge evaporates. The remaining team reverse-engineers behavior from integration tests (if they exist) or production logs.

**Stale documentation.** A README or wiki page was written once when the API launched and never updated. It describes endpoints that have been renamed, parameters that have been removed, and response shapes that have changed. Developers learn to distrust the docs and go straight to the source, making the docs even less likely to be maintained.

**Implementation-focused docs.** The documentation describes internal details the consumer does not need: which database table backs this endpoint, how the data is cached internally, what queue processes the request. Meanwhile, the docs omit what the consumer actually needs: valid parameter ranges, error response formats, rate limits, pagination behavior, and authentication requirements.

```
# BAD: tells you how it works internally
POST /api/orders
This endpoint inserts a row into the orders table and publishes
an event to the RabbitMQ exchange. The worker picks it up and
calls the Stripe API.

# GOOD: tells you how to use it
POST /api/orders
Creates a new order. Returns 201 with the order object on success.

Request body:
  items: array of { product_id: string, quantity: integer (1-100) }
  currency: string, ISO 4217 (default: "USD")

Errors:
  400 - Invalid input (missing items, quantity out of range)
  402 - Payment failed (includes `payment_error` field with Stripe error code)
  409 - Duplicate order (idempotency key already used)
```

## Recognition Signal
- Developers asking "what does this endpoint return?" in Slack or stand-ups
- Integration code that includes comments like "// not sure what this field is for but it breaks without it"
- Consumer code that handles the response with overly defensive parsing because the shape is not guaranteed
- A docs page with a "last updated" date from months or years ago
- Tests that are the de facto documentation because nothing else describes the expected behavior
- API responses that include fields no consumer uses, because nobody knows if removing them would break something

## Related Concepts
**Code comments** serve the internal audience (maintainers); API documentation serves the external audience (consumers). They are complementary and should not overlap -- internal implementation details belong in comments, not API docs. **Architecture decision records** explain why the API was designed this way; API docs explain how to use it as-is. **Interface segregation** intersects because a well-segregated API is easier to document -- each endpoint does one thing with a clear contract. **Code review practices** should verify that API changes include documentation updates as part of the review checklist.
