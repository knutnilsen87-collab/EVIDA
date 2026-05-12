# Evida Developer / Investor Pack

This repository pack is intended for a technical reviewer, developer or investor who needs to understand how Evida works without receiving generated build output, dependency folders or release binaries.

## Start here

Read in this order:

```text
CURRENT_STATUS.md
README.md
ARCHITECTURE.md
SECURITY.md
DECISIONS/
docs/project-continuation-completion-pack/README_MASTER.md
docs/project-continuation-completion-pack/02_REALITY_CHECK/
docs/project-continuation-completion-pack/04_PRODUCT_SCOPE_STATUS/
docs/project-continuation-completion-pack/06_GAPS_BLOCKERS_TECH_DEBT/
docs/project-continuation-completion-pack/07_COMPLETION_PLAN/
docs/RELEASE_CHECKLIST.md
docs/ACCEPTANCE_SMOKE_TEST.md
```

## Current honest status

Evida is a pre-alpha local Windows desktop evaluation build. It demonstrates a local-first legal workspace with document import, Saksrom, source-bound answers and legal workrooms.

It is not approved for real client data or production legal work.

## Active code areas

```text
evida-core/desktop-tauri/       Tauri + React desktop app
evida-core/services/saksrom-api/ Spring Boot control-plane direction
evida-core/ai-engine/           Local AI/document-processing primitives
evida-core/db/                  Database schema/seed material
evida-core/ops/                 Local verification scripts
ops/                            Repo-level release and boundary scripts
docs/                           Product, architecture, release and readiness docs
DECISIONS/                      Architecture decision records
```

## Excluded from the zip

The pack intentionally excludes:

- `.git/`
- `node_modules/`
- Rust `target/`
- frontend `dist/`
- Python virtual environments and caches
- release binaries/installers
- archive zip files
- generated reports
- heavy video/media that is not needed to review the architecture

## Useful verification commands

```powershell
powershell -ExecutionPolicy Bypass -File ops/Verify-ProductionBoundary.ps1
powershell -ExecutionPolicy Bypass -File ops/Test-EvidaSmokePreflight.ps1
cd evida-core/desktop-tauri
npm.cmd test
npm.cmd run build
```

Spring Boot control plane:

```powershell
cd evida-core/services/saksrom-api
mvn test
```

If Maven is missing locally, the Spring Boot verification must pass in CI or on a Maven-equipped machine before any control-plane readiness claim.

