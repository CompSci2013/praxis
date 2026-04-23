---
id: injection-prevention
domain: cross-cutting
category: security
depends_on: []
related:
  - xss-prevention
  - csrf-prevention
  - error-typing
  - user-vs-developer-errors
anti_pattern_of: null
severity: critical
---

# Injection Prevention

## Definition
Injection prevention is the practice of ensuring that user-supplied data is always treated as data, never as executable code -- through parameterized queries, prepared statements, and input validation at every boundary where user input meets an interpreter (SQL, NoSQL, OS commands, LDAP, XML).

## Why It Matters
SQL injection has been the single most destructive class of web vulnerability for over two decades. It allows an attacker to read your entire database (user credentials, payment information, private messages), modify or delete data, and in some cases execute operating system commands on your database server. A single injectable query can compromise every record in the database. The same class of vulnerability applies to NoSQL databases (MongoDB query injection), operating system commands (command injection), and any other system where strings are assembled and interpreted. It is trivially exploitable -- automated tools scan the internet for injectable endpoints 24 hours a day.

## The Anti-Pattern
A self-taught developer typically builds queries by concatenating strings. They might know that SQL injection exists as a concept but believe their input validation (checking for quotes, using `escape()` functions) is sufficient. String escaping is not sufficient -- there are encoding tricks, double-encoding attacks, and database-specific bypass techniques that defeat manual escaping. Only parameterized queries provide reliable protection:

```python
# SQL injection via string concatenation
def get_user(username):
    # If username is: ' OR '1'='1' --
    # The query becomes: SELECT * FROM users WHERE name = '' OR '1'='1' --'
    # This returns ALL users
    query = f"SELECT * FROM users WHERE name = '{username}'"
    return db.execute(query)

# Command injection
def convert_image(filename):
    # If filename is: "; rm -rf / #"
    # The command becomes: convert "; rm -rf / #" output.png
    os.system(f"convert {filename} output.png")

# MongoDB NoSQL injection
def find_user(req):
    # If req.body is: { "username": {"$gt": ""}, "password": {"$gt": ""} }
    # This matches ANY user with a non-empty username and password
    user = db.users.find_one({
        "username": req.body["username"],
        "password": req.body["password"]
    })
```

The fix is always the same pattern -- separate code from data:

```python
# Parameterized query -- username is ALWAYS treated as data
query = "SELECT * FROM users WHERE name = %s"
db.execute(query, (username,))
```

## Recognition Signal
- String concatenation or f-strings used to build SQL queries
- `os.system()`, `subprocess.call(shell=True)`, or backtick execution with user input
- MongoDB queries that pass `req.body` or `req.query` directly into `find()` or `findOne()`
- An `escape()` or `sanitize()` function used instead of parameterized queries
- Raw SQL strings anywhere in controller or route handler code
- ORMs bypassed with raw queries for "performance" or "flexibility" without parameterization

## Related Concepts
**XSS prevention** is injection into the browser's HTML/JS interpreter; SQL injection is injection into the database's query interpreter. The root cause is identical: mixing user data with code in the same string. **CSRF prevention** addresses a different axis -- CSRF is about who sends the request, injection is about what the request contains. **User vs developer errors** matters because injection-vulnerable code often exposes database errors to the user, and those error messages help attackers refine their injection payloads (error-based SQL injection). **Error typing** connects because well-typed database errors can be caught and transformed before they leak schema information.
