---
id: query-dsl
domain: backend
category: search-engine
depends_on:
  - inverted-index-concepts
  - mapping-design
related:
  - aggregations
  - search-engine-as-datastore
  - query-builders
anti_pattern_of: null
severity: important
---

# Query DSL

## Definition
A structured query language for search engines -- typically expressed as nested JSON objects -- that separates full-text queries (scored by relevance) from filters (binary yes/no), and composes them through boolean logic, enabling precise control over what matches and how results are ranked.

## Why It Matters
The query DSL is the interface between your application and the search engine's capabilities. Using it wrong means either getting irrelevant results (poor ranking, wrong query type) or crippling performance (scoring when filtering would suffice, not using caching). The most important distinction it enforces is between queries (which calculate relevance scores and are expensive) and filters (which are binary and cacheable). A developer who doesn't understand this distinction puts everything in `must` clauses, making every search slower and less accurate than it needs to be.

## The Anti-Pattern
A self-taught developer typically writes one of two kinds of bad search queries:

**Pattern 1: Everything is a match query.** They use full-text `match` on fields that need exact matching. Searching for status:"active" also returns documents containing "actively" or "activation." SKU lookups return partial matches. Email searches match fragments.

**Pattern 2: Everything is crammed into `must`.** Filters that don't affect relevance (category, date range, in-stock status) are placed in `must` instead of `filter`, meaning Elasticsearch calculates relevance scores for conditions that are purely binary. This wastes CPU and prevents filter caching.

```json
// BAD: Everything in must, wrong query types
{
  "query": {
    "bool": {
      "must": [
        { "match": { "status": "active" } },
        { "match": { "category": "electronics" } },
        { "range": { "price": { "gte": 10, "lte": 100 } } },
        { "match": { "name": "wireless headphones" } }
      ]
    }
  }
}
// Problems:
// 1. status "active" uses match (full-text) on what should be a term (exact) filter
// 2. category, status, and price range are filters (binary) but placed in must (scored)
// 3. All four clauses are scored, wasting CPU
// 4. Filters aren't cached because they're in a scoring context

// GOOD: Scored queries separated from cacheable filters
{
  "query": {
    "bool": {
      "must": [
        { "match": { "name": "wireless headphones" } }
      ],
      "filter": [
        { "term": { "status": "active" } },
        { "term": { "category": "electronics" } },
        { "range": { "price": { "gte": 10, "lte": 100 } } }
      ]
    }
  }
}
// Only "name" is scored for relevance. Filters are cached and reused.
```

## Recognition Signal
- All search clauses are in `must` -- the `filter` context is never used
- `match` queries on `keyword` fields (status, category, email) instead of `term` queries
- No awareness of the query/filter distinction or its performance implications
- Search results have confusing relevance ordering because filters are contributing to scores
- Wildcard queries (`*search*`) used instead of proper full-text `match` or `match_phrase` queries
- Query strings built by concatenating JSON as strings (the search-engine version of SQL injection)
- No use of `bool` query composition -- just a single `match` or `query_string` for everything

## Related Concepts
**Inverted index concepts** explain why full-text queries and term queries behave differently -- `match` queries go through the analyzer (tokenize, stem, lowercase) while `term` queries hit the inverted index directly. **Mapping design** determines which query types are valid for each field: `match` only works meaningfully on `text` fields, `term` on `keyword` fields. **Aggregations** are often combined with query DSL: the query filters the document set, then aggregations compute summaries over the filtered results. **Query builders** in relational databases solve the same problem of structured query composition -- the search engine query DSL is its equivalent, replacing string concatenation with structured objects.
