---
id: branching-strategies
domain: discipline
category: git-workflow
depends_on: []
related:
  - commit-hygiene
  - pr-scope
  - technical-debt-identification
anti_pattern_of: null
severity: important
---

# Branching Strategies

## Definition
A branching strategy is a team's agreed convention for how branches are created, named, merged, and deleted -- determining how parallel work stays isolated until it is ready to integrate.

## Why It Matters
Without a branching strategy, a team of three developers will invent three different workflows. One commits directly to main. Another creates long-lived feature branches that drift weeks behind. The third creates branches but never deletes them, leaving 200 stale branches in the remote. The result is merge conflicts that take hours to resolve, broken builds on main because untested code was pushed directly, and releases that cannot be rolled back because nobody knows which commits belong to which feature. A branching strategy is not bureaucracy -- it is the agreement that prevents chaos.

## The Anti-Pattern
A self-taught developer typically falls into one of two extremes:

**No branches at all.** Everything goes straight to main. This works fine for a solo developer on a toy project. It falls apart the moment a second person touches the code, or the moment you need to ship a hotfix while a half-finished feature is sitting in the commit history.

**Branch graveyard.** The developer creates branches but never deletes them. The repo has branches named `test`, `test2`, `new-feature`, `new-feature-v2`, `fix-that-thing`, `johns-branch`, and `temp-do-not-delete`. Nobody knows which are active. The default branch is months ahead of most of them.

**Long-lived feature branches.** A branch lives for three weeks, diverging further from main every day. When merge day arrives, it takes an afternoon to resolve conflicts. Some of the conflicts are semantic -- the code merges cleanly but the behavior is broken because both branches changed the same business logic in incompatible ways.

```
# The branch graveyard
$ git branch -r | wc -l
147

$ git branch -r --merged main | wc -l
119  # 119 branches already merged but never cleaned up
```

## Recognition Signal
- A remote with dozens of stale branches that have not been updated in months
- Developers working on main directly, leading to broken builds and "oops, reverting" commits
- Merge commits that are larger than the feature they contain because of conflict resolution
- Release processes that involve someone manually cherry-picking commits from one branch to another
- Confusion about what code is in production versus what is in development
- Hotfixes that require a full feature freeze because there is no clean path from main to production

## Related Concepts
**Commit hygiene** interacts with branching because clean, atomic commits make rebasing and cherry-picking feasible -- sloppy commits make every branch operation painful. **PR scope** is shaped by the branching model: trunk-based development naturally encourages small, frequent PRs, while Git Flow can encourage large batches. **Technical debt identification** connects because stale branches and inconsistent workflows are themselves a form of process debt.
