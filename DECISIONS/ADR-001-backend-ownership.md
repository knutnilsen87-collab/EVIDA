# ADR-001 Backend Ownership

Status: accepted

Date: 2026-05-07

## Context

The repository contains multiple backend-related areas:

```text
evida-core/services/saksrom-api
evida-core/backend-api
evida-core/ai-engine
```

Without a clear boundary, the project can drift into duplicate implementations for authentication, tenant isolation, provider policy, audit, license decisions and production APIs.

Legal-data systems cannot safely have competing sources of authority for identity, policy or audit.

## Decision

Spring Boot is the authoritative enterprise/control-plane backend:

```text
evida-core/services/saksrom-api
```

It owns:

- tenants
- users
- roles and permissions
- license policy
- provider policy
- audit policy
- production API authorization

The FastAPI starter is deprecated for enterprise/control-plane use:

```text
evida-core/backend-api
```

It must not own tenant, user, role, permission, license, audit, provider-routing or production authorization decisions.

Python remains allowed for local worker functions and prototype adapters when those components do not own enterprise policy or authorization.

## Consequences

- Root-level ADRs are canonical.
- `evida-core/backend-api` must be described as deprecated/prototype/local-adapter only.
- New enterprise API work must target `evida-core/services/saksrom-api`.
- AI/document workers must be adapters, not policy owners.
- Any conflicting backend ownership must be removed, moved to legacy or explicitly deprecated.

## Not Implemented By This ADR

This ADR does not implement authentication, authorization, tenant isolation, audit policy, provider policy or migration work. It only defines ownership.
