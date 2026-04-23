---
id: request-response-transformation
domain: backend
category: api-patterns
depends_on:
  - separation-of-concerns
  - middleware-pipelines
related:
  - api-gateway-pattern
  - repository-pattern
  - orm-tradeoffs
anti_pattern_of: null
severity: important
---

# Request-Response Transformation

## Definition
The deliberate shaping of data as it crosses API boundaries -- converting raw input into validated internal representations on the way in, and projecting internal state into client-appropriate shapes on the way out -- typically through DTOs (Data Transfer Objects), serializers, or projection layers.

## Why It Matters
Without a transformation layer, your API response shape is coupled directly to your database schema. Adding a column to a table changes your API contract. Internal fields leak to clients: password hashes, internal IDs, soft-delete flags, audit timestamps they don't need. Renaming a database column becomes a breaking API change. Clients receive 40 fields when they need 5, wasting bandwidth and exposing attack surface. Worse, when your request payloads map directly to database models, clients can set fields they shouldn't -- mass assignment vulnerabilities happen exactly this way.

## The Anti-Pattern
A self-taught developer typically returns database objects directly as API responses and accepts request bodies that map 1:1 to database columns. The ORM model IS the API contract. The same Python dictionary or JavaScript object flows from the database query, through business logic, straight into `json.dumps()` and out to the client.

```python
# Database model returned directly -- every internal field exposed
@app.route('/users/<id>')
def get_user(id):
    user = db.query(User).get(id)
    return jsonify(user.__dict__)  # Exposes: password_hash, is_deleted,
                                    # internal_role_flags, login_attempts,
                                    # last_ip, created_by_admin_id...

# Request body mapped directly to model -- mass assignment vulnerability
@app.route('/users', methods=['POST'])
def create_user():
    user = User(**request.json)  # Client can set is_admin=True,
    db.add(user)                 # email_verified=True, role='superadmin'
    db.commit()
    return jsonify(user.__dict__)
```

The fix introduces explicit transformation:
```python
# Explicit input validation and output projection
@app.route('/users/<id>')
def get_user(id):
    user = db.query(User).get(id)
    return jsonify({
        'id': user.id,
        'name': user.name,
        'email': user.email,
        'joined': user.created_at.isoformat()
    })

@app.route('/users', methods=['POST'])
def create_user():
    data = UserCreateSchema.validate(request.json)  # Only allowed fields
    user = User(name=data.name, email=data.email)    # Explicit mapping
    db.add(user)
    db.commit()
    return jsonify(UserResponse.from_model(user))
```

## Recognition Signal
- API responses contain fields like `password_hash`, `_sa_instance_state`, `__v`, or `is_deleted`
- Renaming a database column breaks the API or requires a frontend change
- `jsonify(model.__dict__)` or `res.json(doc.toObject())` appears in route handlers
- No serializer, schema, or DTO classes exist anywhere in the project
- Request handlers create database models directly from `request.json` or `req.body` without filtering fields
- API responses vary in shape depending on which ORM query was used (eager loading changes the output)
- Clients receive 30+ fields when the UI uses 4

## Related Concepts
**Separation of concerns** is the underlying principle -- the API contract is a separate concern from the database schema. **Middleware pipelines** often handle input validation and output serialization as middleware steps. **API gateway pattern** performs transformation at the edge, reshaping requests before they reach services. **Repository pattern** creates a similar boundary at the data layer, meaning transformation happens at both ends: controller-to-service (DTOs) and service-to-database (repositories). **ORM tradeoffs** are relevant because ORMs make it dangerously easy to skip transformation by returning model objects directly.
