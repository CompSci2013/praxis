---
id: aggregations
domain: backend
category: search-engine
depends_on:
  - query-dsl
  - mapping-design
  - inverted-index-concepts
related:
  - search-engine-as-datastore
  - application-caching
anti_pattern_of: null
severity: important
---

# Aggregations

## Definition
Aggregations compute summaries, statistics, and groupings over search results -- the search engine equivalent of SQL's GROUP BY, COUNT, SUM, and AVG -- enabling faceted navigation, analytics dashboards, and histogram visualizations directly from the search engine without post-processing in application code.

## Why It Matters
Without aggregations, building a product search page with filter counts ("Electronics (142), Books (37), Clothing (89)") requires either multiple database queries (one COUNT per category) or fetching all results and counting in application code. Both approaches collapse at scale. Aggregations compute these counts in a single request alongside the search results, directly from the search engine's columnar doc_values data structure, which is purpose-built for this. They also enable analytics that would require complex SQL subqueries: histograms of price distributions, date histograms for time-series, percentile calculations, and nested sub-aggregations.

## The Anti-Pattern
A self-taught developer typically computes aggregation-like results in application code. They fetch all matching documents, loop through them, and build counts or averages in Python or JavaScript. For small datasets this works. For anything beyond a few thousand records, it means transferring massive amounts of data over the network and consuming application memory to do work the search engine can do in milliseconds.

```python
# Application-side aggregation -- fetching everything to count it
def get_search_facets(query):
    # Fetch ALL matching products (could be 50,000 documents)
    results = es.search(index='products', body={
        'query': {'match': {'name': query}},
        'size': 50000  # Hope this is enough...
    })

    # Count categories in Python
    category_counts = {}
    price_sum = 0
    for hit in results['hits']['hits']:
        cat = hit['_source']['category']
        category_counts[cat] = category_counts.get(cat, 0) + 1
        price_sum += hit['_source']['price']

    avg_price = price_sum / len(results['hits']['hits'])
    return {
        'categories': category_counts,
        'average_price': avg_price,
        'total': results['hits']['total']['value']
    }
    # Problems: transfers all 50K docs, O(n) memory, misses docs beyond size limit,
    # and Elasticsearch already has a purpose-built feature for exactly this
```

The aggregation approach:
```python
def get_search_facets(query):
    results = es.search(index='products', body={
        'query': {'match': {'name': query}},
        'size': 10,  # Only return 10 actual results
        'aggs': {
            'categories': {
                'terms': {'field': 'category', 'size': 20}
            },
            'avg_price': {
                'avg': {'field': 'price'}
            },
            'price_ranges': {
                'range': {
                    'field': 'price',
                    'ranges': [
                        {'to': 25},
                        {'from': 25, 'to': 100},
                        {'from': 100}
                    ]
                }
            }
        }
    })
    # Categories, avg price, and price range counts all computed server-side
    # in one request, using doc_values (columnar), on any number of matching docs
```

## Recognition Signal
- Application code loops through search results to count categories, compute averages, or build histograms
- Faceted search requires multiple separate queries to the database or search engine
- `size` is set to a very large number to "get all results" so the application can aggregate them
- No `aggs` or `aggregations` key appears anywhere in the codebase's Elasticsearch queries
- Analytics dashboards make dozens of separate queries that could be a single aggregation request
- Developers don't know that nested aggregations exist (sub-aggregations within buckets)
- Date histograms or statistical summaries are computed in application code from raw result lists

## Related Concepts
**Query DSL** provides the filter context that scopes which documents aggregations run over -- the query narrows the set, the aggregation summarizes it. They work together in every search request. **Mapping design** constrains aggregations: you can only aggregate on `keyword`, numeric, or `date` fields, not on analyzed `text` fields (which would give you token-level buckets, not meaningful categories). **Search engine as datastore** is the architectural context: aggregations are a primary reason to adopt a search engine, as they provide analytics capabilities that relational databases struggle to match at scale. **Application caching** can reduce the need for repeated aggregation queries, but the search engine's built-in filter cache already handles this for filter-context aggregations.
