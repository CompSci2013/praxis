const express = require('express');
const cors = require('cors');
const { loadContent } = require('./services/content-index');

// Route modules
const nodesRouter = require('./routes/nodes');
const graphRouter = require('./routes/graph');
const taxonomyRouter = require('./routes/taxonomy');
const referenceAppRouter = require('./routes/reference-app');
const searchRouter = require('./routes/search');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Load content index on startup
console.log('Loading content index...');
const contentIndex = loadContent();
app.locals.contentIndex = contentIndex;

console.log(
  `Content loaded: ${contentIndex.nodesById.size} nodes, ${contentIndex.edges.length} edges, ` +
  `${contentIndex.layer1Nodes.length} L1, ${contentIndex.layer2Nodes.length} L2, ` +
  `${contentIndex.referenceAppDocs.length} reference-app docs`
);

// Health endpoint
app.get('/health', (req, res) => {
  const { nodesById, edges } = req.app.locals.contentIndex;
  res.json({
    status: 'ok',
    nodes: nodesById.size,
    edges: edges.length,
  });
});

// API routes
app.use('/api/v1/nodes', nodesRouter);
app.use('/api/v1/graph', graphRouter);
app.use('/api/v1/taxonomy', taxonomyRouter);
app.use('/api/v1/reference-app', referenceAppRouter);
app.use('/api/v1/search', searchRouter);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Praxis API listening on 0.0.0.0:${PORT}`);
  console.log(`  Nodes: ${contentIndex.nodesById.size}`);
  console.log(`  Edges: ${contentIndex.edges.length}`);
});
