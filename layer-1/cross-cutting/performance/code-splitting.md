---
id: code-splitting
domain: cross-cutting
category: performance
depends_on:
  - bundle-analysis
related:
  - lazy-loading-assets
  - virtualization
anti_pattern_of: null
severity: important
---

# Code Splitting

## Definition
Code splitting divides your application's JavaScript bundle into smaller chunks that are loaded independently, so the browser downloads only the code needed for the current view rather than the entire application upfront.

## Why It Matters
A single-page application with 50 pages, an admin panel, a rich text editor, a charting library, and a PDF generator might compile to a 3MB bundle. A user who visits the homepage downloads and parses all 3MB before seeing anything -- including the admin panel they will never access and the PDF generator they might use once. Code splitting turns that 3MB initial load into a 200KB shell that loads instantly, with additional chunks fetched on demand as the user navigates. The effect on perceived performance is dramatic: first meaningful paint drops from seconds to sub-second. The effect on real performance is just as significant: less code to parse means faster time-to-interactive, lower memory usage, and better performance on constrained devices.

## The Anti-Pattern
A self-taught developer typically builds a single-page application with a single entry point that imports everything eagerly. Every route, every feature, every library is pulled into one bundle. They might not even know that code splitting exists as a concept -- the bundler produces one file, the app loads it, and that is the assumed architecture:

```javascript
// Everything imported eagerly at the top level
import { Dashboard } from './pages/Dashboard';
import { AdminPanel } from './pages/AdminPanel';
import { UserProfile } from './pages/UserProfile';
import { ReportGenerator } from './pages/ReportGenerator';  // Uses chart.js (500KB)
import { PDFExport } from './pages/PDFExport';              // Uses pdfkit (400KB)
import { RichTextEditor } from './pages/RichTextEditor';    // Uses tiptap (300KB)

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/profile" element={<UserProfile />} />
      <Route path="/reports" element={<ReportGenerator />} />
      <Route path="/export" element={<PDFExport />} />
      <Route path="/editor" element={<RichTextEditor />} />
    </Routes>
  );
}
// Every user downloads chart.js, pdfkit, and tiptap even if they only visit the dashboard
```

The fix is typically one line per route:

```javascript
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
// Now each page is a separate chunk, loaded when the route is visited
```

## Recognition Signal
- Only one or two `.js` files in the production build output
- The Network tab shows a single large JavaScript download on initial page load
- Users on slow connections see a blank screen for several seconds
- Features that require heavy libraries (charts, PDF generation, rich text) are loaded even when not used
- The bundler config has no dynamic `import()` calls or `React.lazy()` usage
- Every page transition is instant (because everything is already loaded) but the first load is painfully slow

## Related Concepts
**Bundle analysis** is the prerequisite -- you need to know what is in your bundle before you can split it intelligently. Splitting blindly creates too many small chunks that cause waterfall loading. **Lazy loading assets** is the broader concept: code splitting is specifically about JavaScript chunks, while lazy loading also applies to images, fonts, and other assets. **Virtualization** addresses a related performance concern at the rendering level -- just as code splitting avoids loading code you do not need yet, virtualization avoids rendering DOM you cannot see yet.
