---
id: code-review-practices
domain: discipline
category: code-review
depends_on: []
related:
  - pr-scope
  - commit-hygiene
  - code-comments
  - separation-of-concerns
  - single-responsibility
anti_pattern_of: null
severity: critical
---

# Code Review Practices

## Definition
Code review is the systematic examination of source code by someone other than the author, focused on correctness, clarity, and maintainability -- not style preferences.

## Why It Matters
Without code review, knowledge of the codebase concentrates in individual developers. When that person leaves, entire subsystems become black boxes nobody dares touch. Bugs that a second pair of eyes would catch in five minutes ship to production and cost days to debug. Design decisions go unchallenged, and bad patterns replicate because nobody saw the first instance. Teams without review culture accumulate architectural drift -- each developer builds things slightly differently, and the codebase becomes a patchwork of incompatible styles and approaches.

## The Anti-Pattern
A self-taught developer typically does one of two things: they either skip review entirely ("I'm the only one who works on this") or they treat review as a gatekeeping ritual focused on the wrong things. The bad review looks like:

- Commenting on brace placement, variable naming style, or whitespace instead of logic
- Rubber-stamping with "LGTM" after a 30-second glance at a 500-line diff
- Rewriting the author's code in comments ("I would have done it this way...") without explaining why
- Blocking merges over personal preferences disguised as best practices
- Reviewing only the lines that changed, ignoring the context they sit in

The missing review looks like a solo developer who merges straight to main, discovers bugs weeks later in production, and has no one who understands the code well enough to help debug it.

## Recognition Signal
- Pull requests merged with zero comments and a single approval within minutes of opening
- Review comments that are exclusively about formatting, naming, or style -- nothing about logic, edge cases, or error handling
- A team where only one person understands any given subsystem
- PRs that sit open for days because reviewers do not know what to look for and avoid engaging
- Post-merge bug fixes that would have been caught by reading the diff carefully once
- Review comments that say "nit:" on every line but never ask "what happens when this input is null?"

## Related Concepts
**PR scope** directly determines whether review is effective -- a 2000-line PR defeats the purpose because no reviewer can maintain focus across that much change. **Commit hygiene** makes review easier because atomic commits let the reviewer follow the author's reasoning step by step. **Code comments** complement review: well-placed comments explain the "why" so reviewers can focus on the "how." **Separation of concerns** and **single responsibility** are what good reviewers actually check for -- whether the change is in the right place, doing one thing well.
