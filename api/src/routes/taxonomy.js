const { Router } = require('express');

const router = Router();

/**
 * GET / - Browsing hierarchy.
 * For each layer, list domains, each with categories, each with node summaries.
 * Layer 2 uses layer1_parent's domain for grouping, and "module" as category.
 */
router.get('/', (req, res) => {
  const { nodesById, layer1Nodes, layer2Nodes } = req.app.locals.contentIndex;

  // Build Layer 1 hierarchy: domain -> category -> nodes
  const layer1Hierarchy = {};
  for (const node of layer1Nodes) {
    const domain = node.domain || 'uncategorized';
    const category = node.category || 'uncategorized';

    if (!layer1Hierarchy[domain]) layer1Hierarchy[domain] = {};
    if (!layer1Hierarchy[domain][category]) layer1Hierarchy[domain][category] = [];

    layer1Hierarchy[domain][category].push({
      id: node.id,
      title: node.title,
      severity: node.severity,
    });
  }

  // Build Layer 2 hierarchy: use parent's domain for grouping, module as category
  const layer2Hierarchy = {};
  for (const node of layer2Nodes) {
    let domain = 'uncategorized';

    // Look up parent's domain
    if (node.layer1_parent) {
      const parent = nodesById.get(node.layer1_parent);
      if (parent && parent.domain) {
        domain = parent.domain;
      }
    }

    const category = node.module || 'uncategorized';

    if (!layer2Hierarchy[domain]) layer2Hierarchy[domain] = {};
    if (!layer2Hierarchy[domain][category]) layer2Hierarchy[domain][category] = [];

    layer2Hierarchy[domain][category].push({
      id: node.id,
      title: node.title,
      severity: node.severity,
    });
  }

  // Format output
  function formatLayer(hierarchy) {
    return Object.entries(hierarchy)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([domain, categories]) => ({
        domain,
        categories: Object.entries(categories)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([category, nodes]) => ({
            category,
            nodes: nodes.sort((a, b) => a.title.localeCompare(b.title)),
          })),
      }));
  }

  res.json({
    layer1: formatLayer(layer1Hierarchy),
    layer2: formatLayer(layer2Hierarchy),
  });
});

/**
 * GET /stats - Summary statistics.
 */
router.get('/stats', (req, res) => {
  const { nodesById, edges, layer1Nodes, layer2Nodes, nodesByDomain, nodesBySeverity } = req.app.locals.contentIndex;

  // Count edges by type
  const edgesByType = {};
  for (const edge of edges) {
    edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
  }

  // Domain counts
  const domainCounts = {};
  for (const [domain, nodes] of nodesByDomain) {
    domainCounts[domain] = nodes.length;
  }

  // Severity counts
  const severityCounts = {};
  for (const [severity, nodes] of nodesBySeverity) {
    severityCounts[severity] = nodes.length;
  }

  res.json({
    totalNodes: nodesById.size,
    layer1Count: layer1Nodes.length,
    layer2Count: layer2Nodes.length,
    edgesByType,
    domainCounts,
    severityCounts,
  });
});

module.exports = router;
