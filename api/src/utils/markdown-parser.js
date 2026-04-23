const fs = require('fs');
const matter = require('gray-matter');

/**
 * Read a markdown file and parse YAML frontmatter.
 * Returns { frontmatter, body, path } where body is the markdown content
 * after the frontmatter block.
 */
function parseMarkdownFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return {
    frontmatter: data,
    body: content.trim(),
    path: filePath,
  };
}

module.exports = { parseMarkdownFile };
