---
id: yagni
domain: architecture
category: design-principles
depends_on:
  - kiss-principle
related:
  - dry-principle
  - separation-of-concerns
  - api-versioning
anti_pattern_of: null
severity: important
---

# YAGNI -- You Ain't Gonna Need It

## Definition
Do not build functionality until it is actually needed -- not when you foresee it, not when it would be "easy to add now," not when it "might be useful later."

## Why It Matters
Every line of code you write has ongoing costs: it must be understood, tested, maintained, debugged, and migrated. Code you wrote for a future that never arrives still carries all those costs. Studies of large codebases consistently find that 30-50% of code is dead or nearly dead -- features built speculatively that nobody uses. That is not just wasted development time; it is an ongoing tax on every developer who must navigate around it, every CI pipeline that must compile it, and every security audit that must assess it.

The future you are designing for almost never arrives as predicted. Requirements change, priorities shift, and the "flexibility" you built in is never quite the right flexibility for the actual need that materializes. When you do need something, you will understand the real requirement far better at that point than you do now.

## The Anti-Pattern
A self-taught developer builds a configuration file parser that supports JSON, YAML, TOML, and INI formats because "we might want to switch formats later." The application only uses JSON. The YAML, TOML, and INI code paths have zero tests (because no one uses them), zero production validation, and will certainly have bugs when someone actually tries to use them in two years.

```python
class ConfigLoader:
    def load(self, path: str) -> dict:
        ext = path.rsplit('.', 1)[-1]
        if ext == 'json':
            return self._load_json(path)
        elif ext == 'yaml':
            return self._load_yaml(path)     # Never called in production
        elif ext == 'toml':
            return self._load_toml(path)     # Never called in production
        elif ext == 'ini':
            return self._load_ini(path)      # Never called in production
        else:
            raise ValueError(f'Unknown format: {ext}')

    # 80 more lines of format-specific loading code that adds no value
```

Other common YAGNI violations:
- Building a plugin system before you have a second plugin
- Adding admin role support before you have non-admin users
- Creating a database abstraction layer before you consider switching databases
- Implementing pagination before you have more than 50 records
- Building a multi-tenant system for a single-tenant application

## Recognition Signal
- Code paths that have zero test coverage because no one exercises them
- Features documented in comments but never exposed to users
- Conditional branches based on configuration options that are never set
- Abstraction layers that have exactly one implementation
- "Future-proofing" mentioned in commit messages or code comments
- Classes or modules that were created months ago but never modified after initial commit -- they solved a problem that never materialized
- The word "generic" or "flexible" in class names or documentation for things that serve one use case

## Related Concepts
**KISS** is the parent principle: YAGNI says don't build it, KISS says when you do build it, build it simply. Together they prevent both speculative features and speculative architecture. **DRY** can tempt you into YAGNI violations: you see potential duplication in the future and preemptively abstract, creating complexity for a future that may not arrive. Better to tolerate short-term duplication and extract when the pattern is proven. **API versioning** is a legitimate exception where forward-thinking is warranted -- but even there, YAGNI says don't build v2 of your API until v1 needs to change. **Separation of concerns** makes YAGNI less scary: if concerns are well-separated, adding a feature later is straightforward because you are not fighting tangled code.
