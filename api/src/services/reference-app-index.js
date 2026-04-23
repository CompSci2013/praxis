const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * Extract the first # heading from markdown body text.
 */
function extractTitle(body) {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

/**
 * Derive a slug from a filename (e.g., "project-structure.md" -> "project-structure").
 */
function slugFromFilename(filename) {
  return path.basename(filename, '.md');
}

/**
 * Scan reference-app/*.md and reference-app/diagrams/*.md.
 * No YAML frontmatter expected -- title is extracted from first # heading.
 * Returns an ordered list of { slug, title, body, path, order }.
 */
function loadReferenceAppDocs(contentRoot) {
  const refAppDir = path.join(contentRoot, 'reference-app');

  if (!fs.existsSync(refAppDir)) {
    return [];
  }

  // Gather top-level and diagrams subdirectory markdown files
  const patterns = [
    path.join(refAppDir, '*.md'),
    path.join(refAppDir, 'diagrams', '*.md'),
  ];

  const files = [];
  for (const pattern of patterns) {
    const matched = glob.sync(pattern);
    files.push(...matched);
  }

  const docs = files.map((filePath, index) => {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const title = extractTitle(raw);
    const slug = slugFromFilename(filePath);
    // Determine a relative subpath for ordering: diagrams come after top-level
    const relPath = path.relative(refAppDir, filePath);
    const isNested = relPath.includes(path.sep);

    return {
      slug,
      title,
      body: raw.trim(),
      path: filePath,
      order: index,
      _isNested: isNested,
      _relPath: relPath,
    };
  });

  // Sort: top-level docs first (alphabetically), then diagrams (alphabetically)
  docs.sort((a, b) => {
    if (a._isNested !== b._isNested) {
      return a._isNested ? 1 : -1;
    }
    return a._relPath.localeCompare(b._relPath);
  });

  // Reassign order after sorting and strip internal fields
  return docs.map((doc, idx) => {
    const { _isNested, _relPath, ...rest } = doc;
    return { ...rest, order: idx };
  });
}

module.exports = { loadReferenceAppDocs };
