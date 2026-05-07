# Implementation Plan

Status: pre-alpha technical scaffold. This plan does not claim production readiness.

## Scope of CP-P0-001B

Goal: complete the production-boundary and backend-ownership documentation baseline.

In scope:

- root `ARCHITECTURE.md`
- root `SECURITY.md`
- root canonical ADRs 001-004
- backend ownership cleanup for `evida-core/backend-api`
- root implementation plan
- boundary verification script

Out of scope:

- encryption
- authentication
- tenant isolation
- audit hash chain implementation
- AI provider enforcement
- frontend refactor
- database migrations
- e2e tests
- SBOM
- release signing
- local storage redesign

## P0 Sequence

1. Boundary documentation and backend ownership cleanup.
2. Secure-by-default configuration.
3. Authentication and authorization design/implementation.
4. Tenant/user isolation.
5. Local data encryption design/implementation.
6. Tamper-evident audit hash chain.
7. AI provider policy enforcement.
8. Source-grounding verification and prompt-injection controls.
9. Backup/restore procedure.
10. Production release and operations controls.

## Current Authoritative Backend

Spring Boot is the authoritative enterprise/control-plane backend:

```text
evida-core/services/saksrom-api
```

Deprecated enterprise/control-plane backend:

```text
evida-core/backend-api
```

The FastAPI starter must not own tenant, policy, license, user, audit, provider-routing or production authorization decisions.

## Verification

Run the boundary verifier:

```powershell
powershell -ExecutionPolicy Bypass -File ops\Verify-ProductionBoundary.ps1
```

Run relevant existing checks as available:

```powershell
cd evida-core\desktop-tauri
npm.cmd run build

cd src-tauri
cargo check --locked
cargo test --locked

cd ..\..\services\saksrom-api
mvn test
```

This plan intentionally avoids claiming that production controls are complete.
