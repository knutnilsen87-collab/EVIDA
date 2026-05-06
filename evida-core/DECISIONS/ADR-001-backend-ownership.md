# ADR-001 Backend ownership

Status: accepted

## Decision

Spring Boot (`services/saksrom-api`) is the authoritative enterprise control plane for Evida.

It owns tenant, policy, license, user, audit, provider-routing and enterprise API decisions.

## Consequences

- `backend-api/` is deprecated as an enterprise backend.
- FastAPI must not be used for tenant, policy, license, user, audit or provider-routing decisions.
- Python remains allowed only as a local AI/document processing worker or prototype adapter.
- Desktop-local state remains owned by the Tauri/Rust local app and SQLite database.

## Rationale

Running both FastAPI and Spring Boot as competing backends creates duplicated auth, authorization, policy, audit, API contracts and data models. A single enterprise control plane is required before Evida can move beyond pre-alpha evaluation.
