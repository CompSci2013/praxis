---
id: mapping-design
domain: backend
category: search-engine
depends_on:
  - inverted-index-concepts
  - search-engine-as-datastore
related:
  - query-dsl
  - aggregations
anti_pattern_of: null
severity: critical
---

# Mapping Design

## Definition
The mapping is the schema definition for a search engine index -- it specifies field types, analyzers, and indexing options that determine how data is stored, tokenized, and queried, and changing it after data is indexed requires a full reindex.

## Why It Matters
In a relational database, you can `ALTER TABLE ADD COLUMN` and it's done. In Elasticsearch, the mapping is baked into the index at creation time. If you define a field as `text` but later realize you need exact-match filtering, you must create a new index with the correct mapping and reindex all your data. For a 500GB index, that's hours of downtime. Poor mapping design doesn't just slow you down -- it makes entire categories of queries impossible. A `text` field can't be used for sorting or exact-match aggregation. A `keyword` field can't do full-text search with relevance scoring. The mapping is the most consequential decision you make with a search engine, and it's the hardest to change later.

## The Anti-Pattern
A self-taught developer typically lets Elasticsearch auto-detect (dynamic mapping) the field types from the first document indexed. This creates mappings that are wrong in predictable ways: strings become both `text` and `keyword` (wasting disk), numbers embedded in strings stay as strings, dates in unusual formats aren't recognized, and nested objects are flattened in ways that corrupt queries.

```json
// Developer indexes a document without defining a mapping first
PUT /products/_doc/1
{
  "name": "Red Running Shoes",
  "sku": "SHOE-RUN-001",
  "price": "29.99",        // String! Should be float
  "tags": ["running", "sale"],
  "attributes": {
    "color": "red",
    "size": "10"            // String! Can't do range queries (size > 8)
  },
  "created": "04/23/2026"  // Not recognized as a date with this format
}

// Later: "Why can't I sort by price?"
// Because price is mapped as text. "9.99" sorts after "29.99" alphabetically.

// Later: "Why does filtering by color:red AND size:10 also match
// a product with color:blue AND size:10?"
// Because flattened objects lose the association between color and size.
```

The correct approach defines the mapping explicitly before indexing:
```json
PUT /products
{
  "mappings": {
    "properties": {
      "name":    { "type": "text", "analyzer": "english" },
      "sku":     { "type": "keyword" },
      "price":   { "type": "float" },
      "tags":    { "type": "keyword" },
      "attributes": { "type": "nested",
        "properties": {
          "color": { "type": "keyword" },
          "size":  { "type": "integer" }
        }
      },
      "created": { "type": "date", "format": "MM/dd/yyyy" }
    }
  }
}
```

## Recognition Signal
- Dynamic mapping is relied upon in production (no explicit mapping definition in code or config)
- Price or quantity fields stored as strings, causing sort and range query bugs
- Dates stored as strings, preventing date math and range filtering
- Nested object queries returning incorrect results because `object` type was used instead of `nested`
- A reindex is needed but nobody has done one before and there's no zero-downtime strategy (index aliases)
- Fields are both `text` and `keyword` (the dynamic mapping default) when only one is needed, doubling storage
- The mapping was never reviewed, and nobody on the team can explain what each field's type implies

## Related Concepts
**Inverted index concepts** explain why mapping decisions matter at such a deep level -- the mapping controls how the inverted index is built, and the inverted index determines what queries are possible. **Query DSL** is directly constrained by the mapping: you can only write full-text queries against `text` fields and term-level queries against `keyword` fields. **Aggregations** require `keyword`, numeric, or `date` fields to work -- aggregating on an analyzed `text` field either fails or produces nonsensical token-level buckets. Getting the mapping right is a prerequisite for everything else in the search engine working correctly.
