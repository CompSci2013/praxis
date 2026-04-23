---
id: architecture-decision-records
domain: discipline
category: documentation
depends_on: []
related:
  - code-comments
  - api-documentation
  - technical-debt-identification
  - technical-debt-prioritization
anti_pattern_of: null
severity: important
---

# Architecture Decision Records

## Definition
An Architecture Decision Record (ADR) is a short document that captures one significant technical decision -- the context that motivated it, the options considered, the choice made, and the consequences accepted.

## Why It Matters
Every codebase is full of decisions that look wrong in hindsight. "Why are we using MongoDB here when everything else is Postgres?" "Why does this service have its own auth system instead of using the shared one?" "Why is this written in Python when the rest of the platform is Node?" Without a record of why, each of these decisions gets relitigated every time a new developer encounters it. Teams waste hours debating whether to change something without knowing why it was chosen in the first place. Worse, they sometimes "fix" the decision -- migrating away from MongoDB, ripping out the custom auth -- only to rediscover the original constraint that forced the choice. ADRs prevent this cycle by making the reasoning explicit, permanent, and searchable.

## The Anti-Pattern
A self-taught developer (and many teams) typically does not record decisions at all. The reasoning lives in:

- A Slack thread that has scrolled off-screen and is unsearchable
- The memory of the person who made the decision (who may have left the company)
- A vague comment in the code: `// we use Redis here for performance reasons`
- A confluence page titled "Architecture" that is a sprawling, unmaintained overview document where individual decisions are buried in paragraph 47

The result is that decisions get revisited constantly. A new developer joins, sees something that looks wrong, proposes a change, and the team spends a meeting reconstructing why the original choice was made. This happens for the same decisions repeatedly across team turnovers.

Another common failure: recording the decision but not the alternatives considered. "We chose Kafka for event streaming" tells you what. It does not tell you that RabbitMQ was rejected because of its single-node throughput ceiling, or that SQS was rejected because of FIFO ordering constraints. Without alternatives and their trade-offs, the record does not help someone evaluate whether the original reasoning still holds.

```
# BAD: Decision without context
We use PostgreSQL for the user service.

# GOOD: ADR format
## ADR-007: PostgreSQL for User Service

### Status
Accepted (2024-03-15)

### Context
The user service needs ACID transactions for account balance
operations. We considered PostgreSQL, MySQL, and DynamoDB.

### Decision
PostgreSQL, because:
- Native JSON column support for flexible profile fields
- Row-level locking sufficient for our concurrency model
- Team has operational experience running it

### Rejected Alternatives
- MySQL: no native JSON indexing at the time of evaluation
- DynamoDB: eventual consistency unacceptable for balance operations

### Consequences
- We accept the operational cost of managing a stateful database
- Schema migrations required for profile field changes (mitigated by JSON columns)
- Must monitor connection pool exhaustion under load
```

## Recognition Signal
- The same architectural debate happening for the third time in six months
- New developers asking "why do we do X?" and nobody having a confident answer
- Fear of changing anything foundational because nobody knows what constraints drove the original choice
- Comments in code like `// don't change this, it broke last time` with no further explanation
- Wikis or docs where the "Architecture" page is a single monolithic document, never updated
- Post-mortems that reveal "we did not know this system worked that way because the decision was never documented"

## Related Concepts
**Code comments** capture micro-level "why" (why this line, this workaround, this specific approach). ADRs capture macro-level "why" (why this technology, this pattern, this architectural boundary). They complement each other at different scales. **API documentation** describes the current contract; ADRs explain why the contract looks the way it does. **Technical debt identification** benefits directly from ADRs because intentional debt is often the consequence section of a decision ("we accept this trade-off for now"). **Technical debt prioritization** becomes easier when you can read the original ADR and evaluate whether the constraints that forced the compromise still hold.
