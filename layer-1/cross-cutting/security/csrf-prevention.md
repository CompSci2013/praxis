---
id: csrf-prevention
domain: cross-cutting
category: security
depends_on: []
related:
  - xss-prevention
  - auth-token-storage
  - injection-prevention
anti_pattern_of: null
severity: critical
---

# CSRF Prevention

## Definition
Cross-Site Request Forgery (CSRF) prevention ensures that state-changing requests to your application genuinely originate from your own frontend -- using synchronizer tokens, SameSite cookie attributes, and origin header validation.

## Why It Matters
When a user is logged into your app, their browser automatically attaches session cookies to every request to your domain -- including requests triggered by a malicious page. An attacker hosts a page containing `<form action="https://yourbank.com/transfer" method="POST"><input name="to" value="attacker"><input name="amount" value="10000">` and tricks a logged-in user into visiting it. The browser sends the request with the user's valid session cookie. The server sees a valid session and processes the transfer. The user never clicked anything on your site. Without CSRF protection, any authenticated action that relies solely on cookies for authorization is vulnerable to this attack.

## The Anti-Pattern
A self-taught developer typically relies exclusively on cookies for authentication and assumes that because the user is "logged in," any request with a valid session must be legitimate. They do not include CSRF tokens in forms or set SameSite attributes on cookies. They might also use GET requests for state-changing operations, making CSRF trivially exploitable via `<img>` tags:

```javascript
// No CSRF token in the form
<form action="/account/change-email" method="POST">
  <input name="email" value="" />
  <button>Change Email</button>
</form>

// Server-side: trusts the cookie alone
app.post('/account/change-email', (req, res) => {
  // req.session exists because the browser sent the cookie automatically
  // But did the request come from OUR form, or an attacker's page?
  const user = await User.findById(req.session.userId);
  user.email = req.body.email;  // Attacker controls this value
  await user.save();
});

// Even worse: state-changing GET request
app.get('/account/delete', (req, res) => {
  // An <img src="https://yourapp.com/account/delete"> on any page deletes the account
  await User.destroy(req.session.userId);
});
```

## Recognition Signal
- Forms that submit POST requests without a hidden CSRF token field
- Session cookies set without `SameSite=Lax` or `SameSite=Strict`
- GET requests that change state (delete, update, transfer) -- anything in a link or `<a>` tag that modifies data
- No middleware for CSRF validation in the server framework (no `csurf`, no `csrf_protect`, no `@csrf_exempt` decorators)
- API endpoints that accept both GET and POST for the same state-changing operation
- A single-page application that sends cookies to the API but never includes a CSRF token header

## Related Concepts
**XSS prevention** is directly connected because a successful XSS attack can defeat CSRF protections -- if an attacker can execute JavaScript on your page, they can read the CSRF token and include it in forged requests. Fix XSS first; CSRF tokens are your second line of defense. **Auth token storage** matters because the CSRF problem exists specifically because cookies are sent automatically; token-based auth stored in memory or localStorage does not have this problem (though it has others). **Injection prevention** addresses the broader principle that user input (or attacker-crafted requests) must never be trusted without validation.
