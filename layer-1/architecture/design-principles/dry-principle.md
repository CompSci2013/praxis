---
id: dry-principle
domain: architecture
category: design-principles
depends_on:
  - separation-of-concerns
related:
  - single-responsibility
  - module-boundaries
  - cohesion-coupling
  - kiss-principle
anti_pattern_of: null
severity: important
---

# DRY -- Don't Repeat Yourself

## Definition
Every piece of knowledge should have a single, unambiguous, authoritative representation in the system -- but duplication of *code* is not always duplication of *knowledge*.

## Why It Matters
When the same business rule is expressed in three places, updating it means finding and changing all three. Miss one, and you have a bug that manifests as inconsistency -- the worst kind of bug because it is intermittent and context-dependent. The customer sees a 10% discount on the product page but gets charged full price at checkout because the discount logic lives in two places and only one was updated. DRY prevents this class of defect entirely.

However, DRY is the most commonly *misapplied* principle in software. Developers see two blocks of code that look similar and reflexively extract a shared function. But looking similar is not the same as representing the same knowledge. Two things that happen to look alike today may diverge tomorrow for completely different reasons. Premature DRY creates coupling between unrelated concepts and produces abstractions that are harder to understand than the original duplication.

## The Anti-Pattern
There are two anti-patterns, and self-taught developers hit both:

**Anti-pattern 1: No DRY at all.** Copy-paste the same validation logic into every route handler. Copy-paste the same date formatting into every template. When the business rule changes, play find-and-replace roulette.

**Anti-pattern 2: Aggressive DRY (worse).** Two functions happen to both filter an array, so the developer extracts a "shared" helper with a boolean flag to handle both cases. Over time, the shared function accumulates flags and branches for every caller:

```python
def process_items(items, is_admin=False, include_deleted=False,
                  sort_by_date=False, for_export=False, legacy_mode=False):
    result = items
    if not include_deleted:
        result = [i for i in result if not i.deleted]
    if is_admin:
        result = [i for i in result if True]  # admins see all
    else:
        result = [i for i in result if i.published]
    if sort_by_date:
        result = sorted(result, key=lambda i: i.date)
    if for_export:
        result = [format_for_csv(i) for i in result]
    if legacy_mode:
        result = [to_legacy_format(i) for i in result]
    return result
```

This function serves six different callers, changes for six different reasons, and is harder to understand than six simple, focused functions would be.

## Recognition Signal
- **Missing DRY**: The same magic number, regex, or business rule literal appears in multiple files. Grep reveals duplicates.
- **Over-DRY**: Functions with boolean parameters that toggle behavior for different callers. Shared utilities that require looking at 5 callers to understand what they do. "Helper" or "utils" files that grow endlessly. Abstractions named after their mechanism (`processItems`) rather than their meaning (`filterPublishedForUser`).
- **The test**: If two pieces of code would change for *different reasons* driven by *different stakeholders*, they are not duplication even if they look identical today. Keep them separate.

## Related Concepts
**KISS** is the counterbalance to DRY -- sometimes the simplest solution is to duplicate a small amount of code rather than create a shared abstraction that is hard to understand. **Single responsibility** helps you decide: if the duplicated code belongs to different responsibilities, it is not true duplication. **Module boundaries** determine where shared code should live -- extracting a shared function that crosses module boundaries may create coupling worse than the duplication it removes. **Cohesion and coupling** are the metrics: if DRY-ing something reduces cohesion or increases coupling, the duplication was better.
