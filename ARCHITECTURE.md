# CasePilot / Evida Architecture

Status: pre-alpha technical scaffold. This repository is not production-ready and is not approved for real client data.

CasePilot / Evida is treated as a legal-data control system. Architecture decisions must preserve clear ownership for legal documents, case metadata, audit, AI provider policy and enterprise controls.

## Active Codebase

The active source code is under:

```text
evida-core/
```

Root-level documents are the canonical architecture and governance references. More detailed implementation code and local worker code can live under `evida-core/`, but production ownership decisions belong at repository root.

## Backend Ownership

Spring Boot is the authoritative enterprise/control-plane backend:

```text
evida-core/services/saksrom-api
```

It owns:

- tenants
- users
- roles and permissions
- license and policy decisions
- audit policy
- AI provider policy
- production API authorization

The deprecated FastAPI starter is here:

```text
evida-core/backend-api
```

It must not own enterprise/control-plane responsibilities. It may only remain temporarily as a deprecated prototype/local adapter until removed or moved to legacy.

Python remains allowed for local worker functions such as AI/document processing, extraction, evaluation helpers and prototype adapters when those workers do not own enterprise policy or authorization.

## Desktop and Local Data Boundary

The Tauri/Rust desktop application owns local desktop orchestration and local storage behavior for the evaluation build:

```text
evida-core/desktop-tauri
```

Desktop-local state is not an enterprise authorization source. The desktop app can provide local-first workflows, but production tenant/user/policy decisions must come from the authoritative control plane when those features are implemented.

## Data Flow Boundary

Default policy:

```text
local-first processing
no cloud processing without explicit policy and user/admin action
no raw legal documents sent to external AI by default
no document text in logs
```

These are production-boundary requirements. They are not a claim that all production controls are already implemented.

## Canonical ADRs

Canonical architecture decisions live in:

```text
DECISIONS/
```

Current ADRs:

- ADR-001 Backend ownership
- ADR-002 Local-first data policy
- ADR-003 AI provider policy
- ADR-004 Audit hash chain

## Non-Goals for This Baseline

This baseline does not implement:

- encryption
- authentication
- tenant isolation
- audit hash chain storage
- AI provider enforcement
- database migrations
- e2e tests
- SBOM
- release signing
- local storage redesign

Those must be implemented and verified in later, scoped PRs.
