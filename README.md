# Evida

Evida is a desktop-first, local legal workspace for document import, source-bound case overview and Saksrom dialogue.

Status: pre-alpha technical scaffold. Evida is not production-ready and is not approved for real client data.

Current implementation status and release boundaries are tracked in `CURRENT_STATUS.md`.

## Production boundary

Canonical architecture and security documents:

```text
ARCHITECTURE.md
SECURITY.md
DECISIONS\
```

Backend ownership is defined in `DECISIONS\ADR-001-backend-ownership.md`.

Spring Boot (`evida-core\services\saksrom-api`) is the authoritative enterprise/control-plane backend. The FastAPI starter under `evida-core\backend-api` is deprecated for enterprise/control-plane use and must not own tenants, users, roles, permissions, license policy, audit policy, provider policy or production API authorization.

## Start the app

Double-click:

```text
Start Evida.bat
```

The start file first tries:

```text
Evida Release\Evida.exe
```

Then it tries the developer build:

```text
evida-core\desktop-tauri\src-tauri\target\release\evida-desktop.exe
```

## Where are the program files?

The easiest folder to use is:

```text
Evida Release\
```

It contains:

```text
Evida.exe
Evida installer.exe
Evida installer.msi
```

## Repository structure

```text
.
|-- Start Evida.bat              # only user-facing start file
|-- Evida Release\               # local release output, ignored by git
|-- Evida_Prod_Grade_Spec.md     # prod-grade requirements and checklist
|-- ARCHITECTURE.md              # canonical architecture boundary
|-- SECURITY.md                  # security and data-use boundary
|-- DECISIONS\                   # canonical ADRs
|-- assets\brand\                # logo, icon and intro video
|-- docs\                        # planning and phase documentation
|-- archives\                    # old zip/intake packs, ignored by git
|-- legacy\                      # old analysis/scaffold material
`-- evida-core\                  # active source codebase
```

## Development

Frontend:

```powershell
cd evida-core\desktop-tauri
npm.cmd run build
```

Desktop release:

```powershell
cd evida-core\desktop-tauri
npm.cmd run tauri:build
```

After a release build, `evida-desktop.exe` can be copied to `Evida Release\Evida.exe`.

## Release preparation

Prepare and verify the local evaluation release:

```powershell
powershell -ExecutionPolicy Bypass -File ops\New-EvidaRelease.ps1
powershell -ExecutionPolicy Bypass -File ops\Test-EvidaRelease.ps1
```

This creates:

```text
Evida Release\SHA256SUMS.txt
Evida Release\release-manifest.json
```

## Pilot docs

```text
docs\PILOT_EVALUATION_PLAN.md
docs\ACCEPTANCE_SMOKE_TEST.md
docs\RELEASE_CHECKLIST.md
docs\IMPLEMENTATION_PLAN.md
docs\SPRING_BOOT_VERIFICATION.md
docs\WINDOWS_BUILD_PREREQUISITES.md
docs\CLEAN_MACHINE_SMOKE_RESULT.md
```

## Boundary verification

Check the production-boundary documentation contract:

```powershell
powershell -ExecutionPolicy Bypass -File ops\Verify-ProductionBoundary.ps1
```

Run the current hardening gate:

```powershell
powershell -ExecutionPolicy Bypass -File ops\Test-EvidaHardening.ps1
```
