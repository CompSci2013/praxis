---
id: strangler-pattern
domain: discipline
category: refactoring
depends_on:
  - safe-refactoring-techniques
  - when-to-refactor
related:
  - technical-debt-prioritization
  - separation-of-concerns
  - branching-strategies
  - api-documentation
anti_pattern_of: null
severity: important
---

# Strangler Pattern

## Definition
The strangler pattern replaces a legacy system incrementally by building new functionality alongside the old, routing traffic to the new implementation piece by piece, until the old system can be removed entirely -- without ever requiring a big-bang cutover.

## Why It Matters
Large systems cannot be rewritten safely in one shot. The history of software is littered with failed rewrites: the new system takes twice as long as estimated, the old system continues to evolve while the new one is being built, and by launch day the new system is already behind. Meanwhile the team has been split between maintaining the old system and building the new one, and neither gets adequate attention. The strangler pattern sidesteps this entirely. At every point during the migration, the system works. You can stop the migration halfway through if priorities change, and you have a system that is half-old and half-new but fully functional. There is no "go/no-go" decision, no risky cutover weekend, and no rollback plan that has never been tested.

## The Anti-Pattern
A self-taught developer (and many experienced teams) defaults to the "big rewrite":

**The parallel build.** The team starts building "v2" from scratch in a new repository. For six months, two systems exist: the old one serving production and the new one in development. The old system keeps getting patches and new features. The new system keeps falling further behind. Eventually the team realizes v2 will never reach feature parity and either abandons it (wasting months of work) or launches it with missing features (breaking users).

**The flag day migration.** The team builds the replacement, picks a date, switches everything over at once, and prays. If something goes wrong, the rollback is either "switch back to the old system" (which may have been decommissioned) or "fix it in production under pressure." There is no middle ground.

**The eternal migration.** The team starts migrating but never finishes. Both the old and new systems run in parallel indefinitely. Every new feature must be built twice. Every bug must be investigated in two codebases. The migration becomes permanent overhead instead of a temporary cost.

```
# The big rewrite timeline (typical failure)
Month 1-3:  Build v2 core features. "We're making great progress!"
Month 4-6:  Discover edge cases v1 handles that v2 doesn't. Scope grows.
Month 7-9:  v1 gets three new features from business. v2 falls behind.
Month 10:   Team realizes v2 won't be ready for another 6 months.
Month 11:   v2 project is cancelled or scaled back.

# The strangler pattern timeline (typical success)
Week 1-2:   Route /api/search to new service. Old endpoints still work.
Week 3-4:   Route /api/users/profile to new service.
Week 5-8:   Route /api/orders to new service.
...continues until old system has no remaining routes...
Final week:  Decommission old system. Zero downtime.
```

## Recognition Signal
- A repository named something like `project-v2` or `project-rewrite` that has been in development for months
- Two systems running in production for the same purpose with a router or proxy deciding which one to use -- and no timeline for decommissioning the old one
- A migration plan that has a single "cutover date" with no incremental milestones
- Team members split between maintaining the old system and building the new one, with both moving slowly
- The phrase "we'll migrate everything at once when v2 is ready" in planning documents
- Features being built in both the old and new systems because the migration is taking too long

## Related Concepts
**Technical debt prioritization** determines whether a system warrants the strangler pattern -- not all legacy systems need replacement, and the strangler pattern is expensive to set up. It should be reserved for high-impact debt. **Safe refactoring techniques** are the micro-level version of the same idea: just as you refactor a function through small behavior-preserving steps, you replace a system through small traffic-routing steps. **Separation of concerns** makes the strangler pattern possible -- a well-separated system has natural seams where you can route different concerns to different implementations. A monolith with no boundaries has no seams to strangle along. **Branching strategies** support the pattern because each incremental migration is a small, reviewable unit of work on a short-lived branch. **API documentation** becomes essential during migration because both the old and new systems must honor the same contract -- the documentation is the shared truth that both implementations must satisfy.
