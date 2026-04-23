const { Router } = require('express');

const router = Router();

/**
 * Strip body from a node to return metadata only.
 */
function metadataOnly(node) {
  const { body, ...meta } = node;
  return meta;
}

/**
 * GET / - List all nodes (metadata only, no body).
 * Query params: layer (1|2), domain, category, severity
 */
router.get('/', (req, res) => {
  const { nodesById } = req.app.locals.contentIndex;
  let nodes = Array.from(nodesById.values());

  // Filter by layer
  if (req.query.layer) {
    const layer = parseInt(req.query.layer, 10);
    nodes = nodes.filter(n => n.layer === layer);
  }

  // Filter by domain
  if (req.query.domain) {
    nodes = nodes.filter(n => n.domain === req.query.domain);
  }

  // Filter by category
  if (req.query.category) {
    nodes = nodes.filter(n => n.category === req.query.category);
  }

  // Filter by severity
  if (req.query.severity) {
    nodes = nodes.filter(n => n.severity === req.query.severity);
  }

  res.json(nodes.map(metadataOnly));
});

/**
 * GET /:id - Single node with full body. 404 if not found.
 */
router.get('/:id', (req, res) => {
  const { nodesById } = req.app.locals.contentIndex;
  const node = nodesById.get(req.params.id);

  if (!node) {
    return res.status(404).json({ error: 'Node not found', id: req.params.id });
  }

  res.json(node);
});

/**
 * GET /:id/neighbors - Nodes connected to this node.
 * Optional depth param (default 1, max 3). BFS traversal through edges.
 */
router.get('/:id/neighbors', (req, res) => {
  const { nodesById, edges } = req.app.locals.contentIndex;
  const startNode = nodesById.get(req.params.id);

  if (!startNode) {
    return res.status(404).json({ error: 'Node not found', id: req.params.id });
  }

  const depth = Math.min(Math.max(parseInt(req.query.depth, 10) || 1, 1), 3);

  // Build adjacency from edges (bidirectional for traversal)
  const adjacency = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, []);
    adjacency.get(edge.source).push({ id: edge.target, edge });
    adjacency.get(edge.target).push({ id: edge.source, edge });
  }

  // BFS
  const visited = new Set([req.params.id]);
  const queue = [{ id: req.params.id, d: 0 }];
  const neighborIds = [];

  while (queue.length > 0) {
    const { id, d } = queue.shift();
    if (d >= depth) continue;

    const neighbors = adjacency.get(id) || [];
    for (const { id: neighborId } of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        neighborIds.push(neighborId);
        queue.push({ id: neighborId, d: d + 1 });
      }
    }
  }

  // Collect neighbor nodes (metadata only)
  const result = neighborIds
    .map(id => nodesById.get(id))
    .filter(Boolean)
    .map(metadataOnly);

  res.json(result);
});

module.exports = router;
