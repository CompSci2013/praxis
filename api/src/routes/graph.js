const { Router } = require('express');

const router = Router();

/**
 * Build a graph-format node object (metadata only, with label).
 */
function graphNode(node) {
  return {
    id: node.id,
    label: node.title,
    layer: node.layer,
    domain: node.domain,
    category: node.category,
    severity: node.severity,
  };
}

/**
 * Filter edges by type if edgeType query param is provided.
 * edgeType is comma-separated (e.g., "depends_on,related").
 */
function filterEdges(edges, edgeTypeParam) {
  if (!edgeTypeParam) return edges;
  const types = edgeTypeParam.split(',').map(t => t.trim());
  return edges.filter(e => types.includes(e.type));
}

/**
 * GET / - Full graph { nodes, edges }.
 * Query params: layer, domain, severity, edgeType (comma-separated).
 */
router.get('/', (req, res) => {
  const { nodesById, edges } = req.app.locals.contentIndex;

  let nodes = Array.from(nodesById.values());

  // Filter nodes
  if (req.query.layer) {
    const layer = parseInt(req.query.layer, 10);
    nodes = nodes.filter(n => n.layer === layer);
  }
  if (req.query.domain) {
    nodes = nodes.filter(n => n.domain === req.query.domain);
  }
  if (req.query.severity) {
    nodes = nodes.filter(n => n.severity === req.query.severity);
  }

  // Build set of included node IDs for edge filtering
  const includedIds = new Set(nodes.map(n => n.id));

  // Filter edges: only include edges where both source and target are in the node set
  let filteredEdges = edges.filter(e => includedIds.has(e.source) && includedIds.has(e.target));

  // Filter by edge type
  filteredEdges = filterEdges(filteredEdges, req.query.edgeType);

  res.json({
    nodes: nodes.map(graphNode),
    edges: filteredEdges.map(e => ({ source: e.source, target: e.target, type: e.type })),
  });
});

/**
 * GET /neighborhood/:id - Subgraph within N hops.
 * Param depth (default 2, max 4). Returns same shape as full graph.
 */
router.get('/neighborhood/:id', (req, res) => {
  const { nodesById, edges } = req.app.locals.contentIndex;
  const startNode = nodesById.get(req.params.id);

  if (!startNode) {
    return res.status(404).json({ error: 'Node not found', id: req.params.id });
  }

  const depth = Math.min(Math.max(parseInt(req.query.depth, 10) || 2, 1), 4);

  // Build adjacency from edges (bidirectional)
  const adjacency = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, []);
    adjacency.get(edge.source).push(edge.target);
    adjacency.get(edge.target).push(edge.source);
  }

  // BFS to find all nodes within depth
  const visited = new Set([req.params.id]);
  const queue = [{ id: req.params.id, d: 0 }];

  while (queue.length > 0) {
    const { id, d } = queue.shift();
    if (d >= depth) continue;

    const neighbors = adjacency.get(id) || [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ id: neighborId, d: d + 1 });
      }
    }
  }

  // Collect nodes and edges within the neighborhood
  const neighborhoodNodes = [];
  for (const id of visited) {
    const node = nodesById.get(id);
    if (node) neighborhoodNodes.push(node);
  }

  const neighborhoodEdges = edges.filter(
    e => visited.has(e.source) && visited.has(e.target)
  );

  res.json({
    nodes: neighborhoodNodes.map(graphNode),
    edges: neighborhoodEdges.map(e => ({ source: e.source, target: e.target, type: e.type })),
  });
});

module.exports = router;
