---
id: when-to-refactor
domain: discipline
category: refactoring
depends_on:
  - technical-debt-identification
related:
  - safe-refactoring-techniques
  - strangler-pattern
  - technical-debt-prioritization
  - commit-hygiene
  - pr-scope
  - code-review-practices
anti_pattern_of: null
severity: critical
---

# When to Refactor

## Definition
Refactoring should happen at specific, strategic moments -- before adding a feature to the code that would be difficult to change, after fixing a bug that revealed structural weakness, or during review when a pattern problem becomes visible -- not as a separate "cleanup phase."

## Why It Matters
Refactoring at the wrong time is almost as bad as not refactoring at all. Refactoring too early -- before you understand the actual usage patterns -- produces premature abstractions that make the code harder to change, not easier. Refactoring too late -- after the code has calcified and accumulated dependents -- is expensive and risky. Refactoring at the right time, integrated into the normal flow of feature work, is nearly free: you improve the structure as a natural part of doing the work, rather than scheduling a separate "tech debt sprint" that never survives contact with business priorities.

## The Anti-Pattern
A self-taught developer typically refactors at exactly the wrong moments:

**Refactoring while building a feature.** The developer starts adding a search feature, notices the data access layer is messy, stops to refactor it, discovers the models are inconsistent, starts restructuring the models, and three days later has not shipped the search feature but has a half-finished refactor across four subsystems. The PR is now 1500 lines and nobody can review it.

**Refactoring code they just wrote.** The developer writes a function, then immediately restructures it before seeing how it is actually used. They introduce an abstraction layer for a single consumer, a strategy pattern with one strategy, or a factory for a class that is instantiated in exactly one place. The abstraction adds complexity without value because the usage pattern has not yet emerged.

**Never refactoring at all.** The developer treats refactoring as a luxury. "We do not have time for refactoring, we have features to ship." The codebase degrades every sprint. Eventually, a feature that should take a day takes a week because the developer spends 80% of the time fighting the existing structure. The team does not connect this slowdown to the accumulated structural problems.

**The "refactoring sprint."** Management allocates two weeks for "cleanup." The team scatters, each person refactoring whatever they personally find annoying. There is no strategic focus. At the end, the codebase has different formatting in some modules, a few renamed variables, and the actual painful code is untouched because it was "too risky to change in two weeks."

## Recognition Signal
- PRs that mix feature code with structural changes, making it impossible to review either independently
- Abstractions with a single implementation (a sign of premature refactoring)
- A team that has "refactoring sprints" but velocity does not improve afterward
- Developers who say "I need to refactor this first" every time they touch a module, but the refactoring never produces a mergeable PR on its own
- Code that was recently refactored but still has the same problems at a different level of abstraction
- The "rule of three" being ignored: the same pattern copied a third time without extracting a shared abstraction

## Related Concepts
**Safe refactoring techniques** are the "how" to this concept's "when" -- knowing the right moment to refactor is useless without knowing how to do it safely. **Strangler pattern** is the approach for large-scale refactoring that cannot fit into normal feature work -- it provides a way to refactor incrementally over weeks or months. **Technical debt prioritization** informs which refactoring produces the most value. **Commit hygiene** requires that refactoring is committed separately from feature work -- this is what makes it safe to revert one without losing the other. **PR scope** reinforces this separation: refactoring gets its own focused PR. **Code review practices** create natural refactoring triggers -- a reviewer who spots a structural problem can suggest refactoring before it gets worse.
