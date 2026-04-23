---
id: search-engine-as-datastore
domain: backend
category: search-engine
depends_on:
  - separation-of-concerns
related:
  - inverted-index-concepts
  - mapping-design
  - query-dsl
  - aggregations
  - repository-pattern
  - cache-invalidation
anti_pattern_of: null
severity: important
---

# Search Engine as Datastore

## Definition
Using a search engine like Elasticsearch or OpenSearch as a primary or significant data store for read-heavy workloads, not merely as a search index bolted onto a relational database -- understanding that this architectural choice trades transactional safety for query flexibility and speed.

## Why It Matters
Most developers learn databases through PostgreSQL or MySQL. When they encounter Elasticsearch, they treat it as "a database with a search bar." But search engines have fundamentally different guarantees. They are eventually consistent, not ACID-compliant. They are optimized for reads, not writes. They excel at full-text search, filtering, and aggregation in ways relational databases cannot match -- but they lose at transactions, relational joins, and referential integrity. Using a search engine as a datastore without understanding these tradeoffs leads to either underutilizing its strengths or relying on guarantees it doesn't provide.

## The Anti-Pattern
A self-taught developer typically does one of two things:

**Pattern 1: Relational database for everything.** Full-text search is implemented with `LIKE '%search term%'`, which doesn't use indexes, can't rank by relevance, and crawls on large datasets. Faceted search (showing category counts alongside results) requires multiple expensive queries. The developer has never considered that a different storage engine exists for this workload.

```python
# PostgreSQL doing a job it's bad at
def search_products(query, category=None, min_price=None):
    sql = "SELECT * FROM products WHERE name LIKE %s"
    params = [f'%{query}%']  # Full table scan, no relevance ranking

    if category:
        sql += " AND category = %s"
        params.append(category)

    # Want to also show: "Electronics (42), Books (17), Clothing (8)"?
    # That's a separate COUNT(*) GROUP BY query. On every search.
    # And another for price ranges. And another for brands.

    return db.execute(sql, params).fetchall()
```

**Pattern 2: Elasticsearch for everything.** The developer discovers Elasticsearch and uses it as the primary database, including for writes that need ACID guarantees. Orders are stored only in Elasticsearch. When a document update and a read happen simultaneously, stale data is served and nobody understands why.

## Recognition Signal
- `LIKE '%term%'` queries in a relational database for user-facing search
- Search results have no relevance ranking -- they're just filtered alphabetically
- Faceted navigation (filter counts) requires multiple expensive GROUP BY queries
- Alternatively: critical business data (orders, payments) lives only in Elasticsearch with no relational backup
- The team doesn't understand why data "disappears" briefly after writes (near-real-time refresh delay)
- No strategy for keeping Elasticsearch in sync with the source-of-truth database

## Related Concepts
**Inverted index concepts** explain why search engines are fast at text search and slow at things relational databases handle well -- understanding the underlying data structure clarifies the tradeoffs. **Mapping design** determines what's possible to query and how, making it the schema-design equivalent for search engines. **Query DSL** is how you leverage the search engine's strengths -- without understanding it, you end up writing Elasticsearch queries that are just inefficient rewrites of SQL. **Aggregations** are a core reason to adopt a search engine: they provide faceted search, analytics, and statistics that would require complex subqueries in SQL. **Repository pattern** helps manage the dual-datastore pattern: one repository for relational writes, another for search reads, with the sync mechanism hidden behind the abstraction. **Cache invalidation** is relevant because the search index is effectively a read-optimized cache of your relational data, and keeping it in sync is the same fundamental problem.
