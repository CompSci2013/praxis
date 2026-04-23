---
id: pr-scope
domain: discipline
category: code-review
depends_on:
  - code-review-practices
related:
  - commit-hygiene
  - separation-of-concerns
  - single-responsibility
  - when-to-refactor
anti_pattern_of: null
severity: important
---

# Pull Request Scope

## Definition
A pull request should contain exactly one logical change -- a single feature, bug fix, or refactor -- small enough that a reviewer can hold the full context in their head.

## Why It Matters
Large pull requests do not get reviewed. They get skimmed. A study by SmartBear found that review effectiveness drops sharply after 400 lines of change -- beyond that, the defect detection rate collapses. A 2000-line PR gets a rubber stamp because no reviewer has the time or cognitive bandwidth to trace every interaction. This means the code review process exists in name only. Worse, large PRs are hard to revert. When a big merge introduces a bug, you cannot surgically remove the broken part without also removing five unrelated features. You either revert everything or try to hotfix forward under pressure.

## The Anti-Pattern
A self-taught developer typically works on a feature branch for days or weeks, touching dozens of files across multiple concerns, and then opens a single pull request with the entire batch. The PR title is something like "Add user dashboard" but the diff also includes:

- A database migration to add three new tables
- A refactor of the authentication middleware (because it was "in the way")
- CSS changes to the global layout
- A bug fix for an unrelated API endpoint discovered while testing
- New utility functions that could be their own PR
- Updated test fixtures for the refactored auth code

The developer thinks they are being efficient by bundling everything. In reality, they have made it impossible for anyone to review the auth refactor independently of the dashboard feature, and if the dashboard feature gets rejected or delayed, the auth fix is trapped in the same branch.

## Recognition Signal
- PRs with more than ~400 changed lines (excluding generated files, lockfiles, and test fixtures)
- PR descriptions that use bullet lists with five or more unrelated items
- Reviews where the conversation about one file has nothing to do with the conversation about another file
- PRs that take more than a day to review because the reviewer keeps losing their place
- Branch names like `feature/everything-for-sprint-4` or `fix/various-issues`
- Merge conflicts that span multiple subsystems because the branch has been alive too long
- PRs where the reviewer approves with "I reviewed the API changes but didn't have time to look at the frontend parts"

## Related Concepts
**Commit hygiene** enables small PRs -- if you make atomic commits, you can split a large branch into multiple PRs along commit boundaries. **Code review practices** depend on scope; even the best reviewer cannot do good work on a 2000-line diff. **Separation of concerns** is the design principle that makes small PRs natural: if your feature touches five concerns, that is five PRs, not one. **When to refactor** intersects here because opportunistic refactoring should be a separate PR from the feature that motivated it.
