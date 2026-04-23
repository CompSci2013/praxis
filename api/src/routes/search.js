const { Router } = require('express');
const fetch = require('node-fetch');

const router = Router();

const RAG_URL = process.env.RAG_URL || 'http://thor:30800';

/**
 * POST / - Semantic search via RAG service.
 * Accepts { query, top_k (default 10) }.
 * Proxies to RAG /search endpoint, enriches results with node metadata.
 */
router.post('/', async (req, res) => {
  const { query, top_k = 10 } = req.body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'Query string is required' });
  }

  try {
    const response = await fetch(`${RAG_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query.trim(),
        collection_name: 'praxis',
        top_k,
      }),
      timeout: 10000,
    });

    if (!response.ok) {
      throw new Error(`RAG returned ${response.status}`);
    }

    const data = await response.json();
    const results = data.results || data || [];

    // Enrich results with node metadata by matching file paths
    const { nodesById } = req.app.locals.contentIndex;

    const enrichedResults = (Array.isArray(results) ? results : []).map(result => {
      const filePath = result.file_path || result.metadata?.file_path || null;

      // Try to find a matching node by path
      let nodeMetadata = null;
      if (filePath) {
        for (const node of nodesById.values()) {
          // Match on the tail of the path (content-relative)
          if (node.path.endsWith(filePath) || filePath.endsWith(node.path.split('/').slice(-3).join('/'))) {
            nodeMetadata = {
              id: node.id,
              layer: node.layer,
              domain: node.domain,
              category: node.category,
              severity: node.severity,
              title: node.title,
            };
            break;
          }
        }
      }

      return {
        ...result,
        node: nodeMetadata,
      };
    });

    res.json({ results: enrichedResults });
  } catch (err) {
    // RAG unreachable or errored -- return graceful degradation
    res.json({
      results: [],
      warning: 'Search service unavailable',
    });
  }
});

module.exports = router;
