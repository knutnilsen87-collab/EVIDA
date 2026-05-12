# Dependency Scan and SBOM Plan

Reviewed: 2026-05-11

## Current local gate

Generate a local dependency inventory:

```powershell
powershell -ExecutionPolicy Bypass -File ops/New-EvidaDependencyInventory.ps1
```

Output:

```text
evida-core/reports/dependency-inventory.json
```

The inventory reads:

- `evida-core/desktop-tauri/package-lock.json`
- `evida-core/desktop-tauri/src-tauri/Cargo.lock`
- `evida-core/services/saksrom-api/pom.xml`

## Before broader pilot

- Add npm audit/SCA in CI.
- Add Cargo dependency audit in CI.
- Add Maven dependency check in CI.
- Store generated SBOM/dependency inventory with release artifacts.

## Before production

- Generate a signed SBOM artifact.
- Block release on critical vulnerable dependencies unless explicitly accepted.
- Attach SBOM and vulnerability summary to every tagged release.

