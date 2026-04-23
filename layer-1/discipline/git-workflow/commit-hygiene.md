---
id: commit-hygiene
domain: discipline
category: git-workflow
depends_on: []
related:
  - branching-strategies
  - pr-scope
  - code-review-practices
  - when-to-refactor
anti_pattern_of: null
severity: critical
---

# Commit Hygiene

## Definition
Each commit should represent one atomic, self-contained change with a message that explains why the change was made -- producing a history that serves as a navigable record of the project's evolution.

## Why It Matters
Git history is not a backup system. It is a debugging tool, an audit trail, and a communication channel. When something breaks in production, `git bisect` can find the exact commit that introduced the regression -- but only if each commit is a single logical change. When a new developer asks "why does this code do X?", `git blame` should lead them to a commit message that explains the reasoning -- not a message that says "stuff" or "WIP." When you need to revert a change, one clean commit reverts cleanly. A commit that bundles three unrelated changes forces you to either revert all three or manually unpick the one you want to undo.

## The Anti-Pattern
A self-taught developer typically treats commits as save points rather than semantic units. The history looks like:

```
a1b2c3d WIP
d4e5f6g more changes
h7i8j9k fix
l0m1n2o final fix
p3q4r5s actually final fix
t6u7v8w forgot to add file
x9y0z1a update
```

Every commit touches random files. Some commits contain half-finished work that does not compile. The developer commits everything at once at the end of the day with `git add .` and a message like "today's work." Or worse, they work for days without committing and then push a single commit with 80 changed files.

Another common variant: the commit that mixes a bug fix with a formatting change. The diff shows 200 lines changed, but 190 of them are whitespace adjustments and only 10 are the actual fix. Reviewers and future debuggers have to find the needle in the haystack.

```
# The "end of day dump" commit
$ git diff --stat HEAD~1
 src/auth/login.ts       |  45 +++--
 src/api/orders.ts       | 120 ++++++++++---
 src/utils/format.ts     |  12 +-
 src/styles/global.css   |  30 ++-
 package.json            |   3 +-
 README.md               |  15 ++
 tests/auth.test.ts      |  60 ++++++
 .env.example            |   2 +
 8 files changed, 287 insertions(+)
 # Commit message: "updates"
```

## Recognition Signal
- Commit messages that are single words: "fix", "update", "WIP", "stuff", "changes"
- Commits that touch files in unrelated directories for unrelated reasons
- Running `git log --oneline` and not being able to tell what the project did last week
- `git bisect` is useless because every commit changes too many things to isolate the cause
- Commits that break the build -- code that does not compile or tests that fail at that point in history
- `git add .` as the habitual staging method instead of `git add -p` or staging specific files
- The need to read the full diff to understand what a commit did because the message provides no information

## Related Concepts
**Branching strategies** depend on clean commits -- rebasing a feature branch is painless with atomic commits and agonizing with WIP dumps. **PR scope** and commit hygiene reinforce each other: a well-scoped PR is made of well-crafted commits, and atomic commits make it natural to split work into small PRs. **Code review practices** benefit directly because reviewers can walk through commits one by one to understand the author's reasoning. **When to refactor** connects because refactoring should always be its own commit, never mixed with feature work -- this makes it safe to revert one without losing the other.
