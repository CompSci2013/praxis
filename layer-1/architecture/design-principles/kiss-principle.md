---
id: kiss-principle
domain: architecture
category: design-principles
depends_on: []
related:
  - yagni
  - dry-principle
  - separation-of-concerns
  - composition-over-inheritance
anti_pattern_of: null
severity: critical
---

# KISS -- Keep It Simple, Stupid

## Definition
The simplest solution that solves the actual problem is almost always the best one -- complexity should be a last resort, not a first instinct.

## Why It Matters
Complex code has a compounding cost. It takes longer to read, longer to debug, longer to modify, and longer to onboard new developers. Every abstraction layer, every indirection, every clever pattern is a tax on every future reader. Simple code is not unsophisticated -- it is the result of deeply understanding the problem and finding the most direct solution. The real skill is not building complex systems; it is finding simple solutions to complex problems.

Complexity also breeds bugs. Every branch, every indirection, every layer of abstraction is a place where assumptions can be wrong. Simple code has fewer places to hide bugs, and when bugs exist, they are easier to find.

## The Anti-Pattern
A self-taught developer who has been learning design patterns and architecture often over-engineers as a way to prove competence. They reach for patterns before they have a problem that warrants them.

```typescript
// The task: fetch a user by ID and return it

// Over-engineered version
interface UserRepository {
  findById(id: string): Promise<User>;
}

class PostgresUserRepository implements UserRepository {
  constructor(private pool: Pool) {}
  async findById(id: string): Promise<User> {
    return this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
  }
}

class UserRepositoryFactory {
  static create(config: DatabaseConfig): UserRepository {
    switch (config.type) {
      case 'postgres': return new PostgresUserRepository(config.pool);
      case 'mysql': return new MySqlUserRepository(config.pool);
      default: throw new Error('Unknown database type');
    }
  }
}

class GetUserUseCase {
  constructor(private repo: UserRepository) {}
  async execute(id: string): Promise<UserDTO> {
    const user = await this.repo.findById(id);
    return UserMapper.toDTO(user);
  }
}

// Simple version (when you have one database and no plans to change)
async function getUser(id: string): Promise<User> {
  return db.query('SELECT * FROM users WHERE id = $1', [id]);
}
```

The first version is not *wrong* -- it is wrong *for a project that uses one database and has three developers*. Those abstractions cost something, and if they never pay off, the cost was pure waste.

Other shapes this takes:
- Microservices for a project that has 2 developers and 100 users
- Event-driven architecture for synchronous CRUD operations
- Redux/NgRx for state that lives in one component
- Abstract factory patterns when you have one implementation
- GraphQL when you have one client and simple data requirements

## Recognition Signal
- Architecture diagrams that are more complex than the business problem they solve
- More abstraction layers than developers on the team
- "We might need this later" as justification for current complexity
- New developers take weeks to understand the codebase despite the domain being simple
- The ratio of infrastructure/framework code to actual business logic is greater than 2:1
- You need to open 8 files to understand a single feature
- The README is longer than the business logic

## Related Concepts
**YAGNI** is KISS applied to features and capabilities -- don't build what you don't need yet. KISS is broader: even for things you do need, find the simplest way to build them. **DRY** can conflict with KISS when the "don't repeat yourself" solution is more complex than the duplication. In those cases, KISS usually wins -- a little duplication is cheaper than a wrong abstraction. **Composition over inheritance** is often the KISS-compliant way to combine behavior, since deep inheritance hierarchies are a common form of unnecessary complexity. **Separation of concerns** supports KISS: well-separated code is simpler to understand piece by piece, even if the system as a whole is complex.
