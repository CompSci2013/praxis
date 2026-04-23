---
id: technical-debt-identification
domain: discipline
category: technical-debt
depends_on: []
related:
  - technical-debt-prioritization
  - when-to-refactor
  - code-review-practices
  - architecture-decision-records
  - separation-of-concerns
anti_pattern_of: null
severity: critical
---

# Technical Debt Identification

## Definition
Technical debt is the implied cost of future rework caused by choosing an expedient solution now instead of a better approach that would take longer -- and identifying it means distinguishing intentional trade-offs from accidental neglect.

## Why It Matters
Technical debt that is not identified cannot be managed. It accumulates silently, compounding like financial debt, until the codebase reaches a point where every change takes three times longer than it should. Features that should take a day take a week because the developer spends most of their time navigating around fragile code, deciphering unclear interfaces, or working around limitations that were "temporary" two years ago. The most dangerous debt is the kind nobody knows exists -- the team just thinks "our codebase is slow to work in" without understanding that specific, identifiable decisions are causing the friction.

## The Anti-Pattern
A self-taught developer typically does not recognize technical debt as a concept. They experience the symptoms -- "this code is hard to change," "adding features keeps getting slower," "every bug fix introduces another bug" -- but attribute it to the inherent complexity of software rather than to specific, fixable decisions.

Common forms of unidentified debt:

**Copy-paste duplication.** The same logic exists in four places because it was faster to copy than to extract a shared function. Now a bug fix requires finding and updating all four copies, and the developer invariably misses one.

```python
# In orders.py
def calculate_tax(amount, state):
    if state in ['CA', 'NY', 'TX']:
        return amount * 0.08
    return amount * 0.05

# In invoices.py (copied, slightly different)
def calc_tax(total, region):
    if region in ['CA', 'NY', 'TX']:
        return total * 0.08
    return total * 0.05

# In reports.py (copied again, now diverged)
def get_tax(amount, state):
    if state in ['CA', 'NY', 'TX', 'WA']:  # WA added here but not elsewhere
        return amount * 0.08
    return amount * 0.05
```

**Hardcoded values.** Configuration that belongs in environment variables or config files is embedded in source code: database URLs, API keys, timeout values, feature flags, and business rules.

**Missing abstraction layers.** Database queries scattered directly in route handlers. HTTP client calls embedded in business logic. File system operations mixed into domain objects. The code works but changing any infrastructure component requires touching every file.

**Accumulated TODO comments.** The codebase has 200 TODO comments, some years old, with no tracking system connecting them to actual work items.

## Recognition Signal
- Velocity that decreases over time despite a stable team -- features take longer each sprint
- "Shotgun surgery" -- a single logical change requires edits in many unrelated files
- Developers who are afraid to touch certain parts of the codebase
- Large blocks of commented-out code preserved "just in case"
- Functions with boolean parameters that toggle between completely different behaviors
- Test suites that are frequently skipped or ignored because they are too slow, too brittle, or too confusing to maintain
- `grep -r "TODO\|FIXME\|HACK\|WORKAROUND" src/ | wc -l` returning a number that surprises you
- The phrase "nobody understands how that works" said about a production system

## Related Concepts
**Technical debt prioritization** is the necessary next step after identification -- not all debt needs to be paid immediately, and some is cheaper to live with than to fix. **When to refactor** provides the timing discipline: debt is identified continuously but addressed at strategic moments. **Code review practices** are the primary prevention mechanism -- reviewers who flag shortcuts, duplication, and missing abstractions prevent debt from accumulating unnoticed. **Architecture decision records** distinguish intentional debt (we chose this trade-off knowingly, here is why) from accidental debt (nobody planned this, it just happened). **Separation of concerns** violations are one of the most common sources of debt -- tangled code is expensive code.
