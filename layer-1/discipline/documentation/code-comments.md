---
id: code-comments
domain: discipline
category: documentation
depends_on: []
related:
  - api-documentation
  - architecture-decision-records
  - code-review-practices
  - separation-of-concerns
anti_pattern_of: null
severity: important
---

# Code Comments

## Definition
Comments should explain why code exists or why it takes an unexpected approach -- never what the code literally does, which should be self-evident from well-named functions and clear structure.

## Why It Matters
Bad comments are worse than no comments. A comment that restates the code adds visual noise and creates a maintenance burden -- when the code changes, the comment must change too, and it usually does not. Over time the comment drifts from the code and becomes actively misleading. Future developers read the comment, trust it, and are confused when the code does something different. But the absence of comments where they are needed is equally damaging. When code contains a workaround for a browser bug, a non-obvious performance optimization, or a business rule that contradicts intuition, the reader has no way to know why the code looks the way it does. They "fix" it, removing the workaround, and reintroduce the bug.

## The Anti-Pattern
A self-taught developer typically does one of two things:

**Over-commenting the obvious.** Every line gets a comment that restates the code in English:

```python
# Set the user's name
user.name = name

# Check if the user is active
if user.is_active:
    # Return the user
    return user

# Increment the counter by one
counter += 1
```

This doubles the amount of text to read without adding any information. It also signals that the developer is not confident enough in their code to let it speak for itself.

**Under-commenting the non-obvious.** The developer writes a clever regex, a bit-manipulation trick, or a workaround for a third-party library bug -- and leaves no comment explaining why. Two months later, they cannot remember why they wrote it. Another developer sees it, assumes it is an accident, and removes it.

```python
# No comment -- why is this here?
if order.total > 0 and order.total < 0.01:
    order.total = 0.01
```

That code exists because the payment processor rejects charges under $0.01 but the system allows fractional discounts. Without a comment, the next developer sees a magic number and "cleans it up."

## Recognition Signal
- Comments that begin with "// Get the..." or "// Set the..." followed by exactly what the code says
- Functions with zero comments that contain non-obvious business logic, workarounds, or performance hacks
- Comments that contradict the code they sit above (a sign the code changed but the comment did not)
- Block comments that disable code (commented-out code) left permanently in the codebase
- TODO comments older than six months with no associated ticket or plan
- Comments that explain _how_ an algorithm works step by step instead of _why_ this algorithm was chosen over alternatives

## Related Concepts
**API documentation** is the external-facing complement to code comments -- comments explain the internals to maintainers, API docs explain the contract to consumers. **Architecture decision records** capture the "why" at a higher level: why the team chose this database, this framework, this approach. Comments capture the micro-level "why" -- why this specific line does something unexpected. **Code review practices** interact here because reviewers should flag both missing comments on non-obvious code and unnecessary comments on obvious code. **Separation of concerns** reduces the need for comments: when each function does one thing and is well-named, the code is largely self-documenting.
