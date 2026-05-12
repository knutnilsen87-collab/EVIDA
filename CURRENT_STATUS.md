# Current Status

Last reviewed: 2026-05-11

## Product channel

Evida is currently a **pre-alpha local evaluation build**.

It is suitable for:

- approved test material
- internal/local evaluation
- demonstrating the local import -> Saksrom -> source-bound workroom loop

It is **not** suitable for:

- real client data
- production legal work
- public distribution as a trusted legal-data system

## Current source of truth

Read these first before changing scope or making release claims:

```text
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
docs/WINDOWS_BUILD_PREREQUISITES.md
docs/SPRING_BOOT_VERIFICATION.md
```

## Implemented now

- Tauri/React desktop shell.
- Local guided intro/login/case/import/Saksrom flow for evaluation.
- Local document import and processing progress states.
- Source-bound Saksrom answer surfaces and golden answer tests.
- Legal workroom product surfaces.
- Settings/security screens with local-first defaults.
- Production-boundary verifier.
- Desktop test suite.
- Frontend production build.

## Not implemented / not production-ready

- Real production auth/RBAC/tenant isolation.
- Verified encrypted local database storage.
- Fully enforced audit hash-chain storage and verification.
- Enforced external provider policy for real legal data.
- Signed release, SBOM and dependency/security scan gate.
- Clean-machine installer smoke result for the current build.
- Fully productized Spring Boot control plane.

## Backend authority

Spring Boot under `evida-core/services/saksrom-api` is the canonical enterprise/control-plane backend.

The FastAPI starter under `evida-core/backend-api` is deprecated for enterprise/control-plane use and must not own tenants, users, roles, permissions, license policy, audit policy, provider policy or production API authorization.

For the current local evaluation build, Spring Boot is a control-plane milestone unless a release explicitly states that it is included and verified.

## Green checks to keep green

```powershell
powershell -ExecutionPolicy Bypass -File ops/Verify-ProductionBoundary.ps1
powershell -ExecutionPolicy Bypass -File ops/Test-EvidaSmokePreflight.ps1
cd evida-core/desktop-tauri
npm.cmd test
npm.cmd run build
```

Run Spring Boot tests before any release that claims the control plane:

```powershell
cd evida-core/services/saksrom-api
mvn test
```

