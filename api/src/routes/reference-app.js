const { Router } = require('express');

const router = Router();

/**
 * GET / - List all reference app docs (slug, title, order). No body.
 */
router.get('/', (req, res) => {
  const { referenceAppDocs } = req.app.locals.contentIndex;

  res.json(
    referenceAppDocs.map(doc => ({
      slug: doc.slug,
      title: doc.title,
      order: doc.order,
    }))
  );
});

/**
 * GET /:slug - Single doc with full body. 404 if not found.
 */
router.get('/:slug', (req, res) => {
  const { referenceAppDocs } = req.app.locals.contentIndex;
  const doc = referenceAppDocs.find(d => d.slug === req.params.slug);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found', slug: req.params.slug });
  }

  res.json(doc);
});

module.exports = router;
