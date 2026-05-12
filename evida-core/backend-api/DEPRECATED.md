# Deprecated FastAPI Starter

Status: deprecated for enterprise/control-plane use.

This folder may remain temporarily as a local AI/document-processing prototype, but it must not own production API authorization or enterprise policy.

Do not add or rely on FastAPI endpoints for:

- tenants
- users
- roles
- permissions
- license policy
- audit policy
- provider policy
- production case access control

Canonical backend authority:

```text
../services/saksrom-api
../../DECISIONS/ADR-001-backend-ownership.md
../../CURRENT_STATUS.md
```

Before production, either remove this starter, move it to `legacy/`, or clearly retain only worker/prototype code that cannot be confused with the enterprise backend.

