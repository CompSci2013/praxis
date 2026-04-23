const path = require('path');
const glob = require('glob');
const { parseMarkdownFile } = require('../utils/markdown-parser');
const { loadReferenceAppDocs } = require('./reference-app-index');

/**
 * Extract the first # heading from markdown body text.
 */
function extractTitle(body) {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

/**
 * Determine the layer number from a file path.
 */
function layerFromPath(filePath) {
  if (filePath.includes('/layer-1/') || filePath.includes('\\layer-1\\')) return 1;
  if (filePath.includes('/layer-2/') || filePath.includes('\\layer-2\\')) return 2;
  return null;
}

/**
 * Scan layer-1 and layer-2 markdown files, build in-memory indexes,
 * and return the full content graph.
 *
 * Content root defaults to CONTENT_PATH env or three directories up from this file
 * (api/src/services -> api/src -> api -> praxis root).
 */
function loadContent() {
  const contentRoot = process.env.CONTENT_PATH || path.resolve(__dirname, '../../..');

  // Collect all markdown files from layer-1 and layer-2
  const layer1Pattern = path.join(contentRoot, 'layer-1', '**', '*.md');
  const layer2Pattern = path.join(contentRoot, 'layer-2', '**', '*.md');

  const layer1Files = glob.sync(layer1Pattern);
  const layer2Files = glob.sync(layer2Pattern);

  // Primary indexes
  const nodesById = new Map();
  const nodesByDomain = new Map();
  const nodesBySeverity = new Map();
  const edges = [];

  // Parse all layer-1 files
  for (const filePath of layer1Files) {
    const { frontmatter, body } = parseMarkdownFile(filePath);
    if (!frontmatter.id) continue;

    const node = {
      id: frontmatter.id,
      layer: 1,
      domain: frontmatter.domain || null,
      category: frontmatter.category || null,
      severity: frontmatter.severity || null,
      depends_on: frontmatter.depends_on || [],
      related: frontmatter.related || [],
      anti_pattern_of: frontmatter.anti_pattern_of || null,
      layer1_parent: null,
      angular_version: null,
      module: null,
      title: extractTitle(body),
      body,
      path: filePath,
      dependents: [],
      children: [],
    };

    nodesById.set(node.id, node);

    // Index by domain
    if (node.domain) {
      if (!nodesByDomain.has(node.domain)) {
        nodesByDomain.set(node.domain, []);
      }
      nodesByDomain.get(node.domain).push(node);
    }

    // Index by severity
    if (node.severity) {
      if (!nodesBySeverity.has(node.severity)) {
        nodesBySeverity.set(node.severity, []);
      }
      nodesBySeverity.get(node.severity).push(node);
    }
  }

  // Parse all layer-2 files
  for (const filePath of layer2Files) {
    const { frontmatter, body } = parseMarkdownFile(filePath);
    if (!frontmatter.id) continue;

    const node = {
      id: frontmatter.id,
      layer: 2,
      domain: null,
      category: null,
      severity: null,
      depends_on: [],
      related: [],
      anti_pattern_of: null,
      layer1_parent: frontmatter.layer1_parent || null,
      angular_version: frontmatter.angular_version || null,
      module: frontmatter.module || null,
      title: extractTitle(body),
      body,
      path: filePath,
      dependents: [],
      children: [],
    };

    nodesById.set(node.id, node);
  }

  // Build edges and reverse indexes
  for (const [id, node] of nodesById) {
    // depends_on edges
    if (node.depends_on && Array.isArray(node.depends_on)) {
      for (const targetId of node.depends_on) {
        edges.push({ source: id, target: targetId, type: 'depends_on' });

        // Reverse index: target gains this node as a dependent
        const targetNode = nodesById.get(targetId);
        if (targetNode) {
          targetNode.dependents.push(id);
        }
      }
    }

    // related edges
    if (node.related && Array.isArray(node.related)) {
      for (const targetId of node.related) {
        edges.push({ source: id, target: targetId, type: 'related' });
      }
    }

    // layer1_parent edge
    if (node.layer1_parent) {
      edges.push({ source: id, target: node.layer1_parent, type: 'layer1_parent' });

      // Reverse index: parent gains this node as a child
      const parentNode = nodesById.get(node.layer1_parent);
      if (parentNode) {
        parentNode.children.push(id);
      }
    }
  }

  // Collect layer-specific lists
  const layer1Nodes = [];
  const layer2Nodes = [];
  for (const node of nodesById.values()) {
    if (node.layer === 1) layer1Nodes.push(node);
    else if (node.layer === 2) layer2Nodes.push(node);
  }

  // Load reference app docs
  const referenceAppDocs = loadReferenceAppDocs(contentRoot);

  return {
    nodesById,
    nodesByDomain,
    nodesBySeverity,
    edges,
    layer1Nodes,
    layer2Nodes,
    referenceAppDocs,
  };
}

module.exports = { loadContent };
