# Evida Release Checklist

## Current Channel

`0.1.0-alpha` / pre-alpha evaluation build.

Boundary: testdata only. Do not use real client data, and do not describe this build as production-ready.

## Required Commands

```powershell
cd evida-core\desktop-tauri
npm.cmd run build
cargo test --manifest-path src-tauri\Cargo.toml
npm.cmd run tauri:build
cd ..\..
powershell -ExecutionPolicy Bypass -File ops\New-EvidaRelease.ps1 -SkipBuild
powershell -ExecutionPolicy Bypass -File ops\Test-EvidaRelease.ps1
```

Spring Boot:

```powershell
cd evida-core\services\saksrom-api
mvn test
```

If Maven is not installed locally, this must pass in CI before a tagged release.

Rust local status:

```text
docs/RUST_TEST_EXECUTION_STATUS.md
```

If local Windows policy blocks Cargo build-script execution, Rust tests must pass in CI or on another machine before release verification is claimed.

Repository hardening gate:

```powershell
powershell -ExecutionPolicy Bypass -File ops\Test-EvidaHardening.ps1
```

Release hardening gate:

```powershell
powershell -ExecutionPolicy Bypass -File ops\Test-EvidaReleaseHardening.ps1
```

Smoke preflight:

```powershell
powershell -ExecutionPolicy Bypass -File ops\Test-EvidaSmokePreflight.ps1
```

## Artifacts

Expected local artifacts:

- `Evida Release/Evida.exe`
- `Evida Release/Evida installer.exe`
- `Evida Release/Evida installer.msi`
- `Evida Release/SHA256SUMS.txt`
- `Evida Release/release-manifest.json`
- `Evida Release/LES_MEG.txt`

## Clean-Machine / Clean-Folder Smoke

Current status is tracked in:

```text
docs/CLEAN_MACHINE_SMOKE_RESULT.md
```

A broader evaluator handoff requires a clean-machine or clean-profile smoke pass for:

```text
Start app -> create test case -> import approved test material -> open Saksrom -> ask question -> open source -> open workroom -> delete test case
```

The import smoke must include both multiple selected files and a folder of approved test documents.

## Known Release Gaps

- Build is not code-signed.
- SBOM/dependency scan gate has a local inventory check, but not a signed production SBOM yet.
- Full encrypted local database storage is not verified.
- Maven is missing in the current local environment, so Spring Boot must pass in CI or on a Maven-equipped machine before control-plane claims.

## Security Review Pointers

```text
docs/CSP_AND_CONNECT_SOURCES.md
docs/RELEASE_ARTIFACT_REVIEW.md
docs/RELEASE_HARDENING_STATUS.md
docs/DEPENDENCY_AND_SBOM_PLAN.md
docs/RELEASE_SIGNING_DECISION.md
```

## GitHub Release Notes Template

```md
# Evida 0.1.0-alpha

Pre-alpha evaluation build. Test data only.

## Included

- Guided intro/case/import/Saksrom flow without login
- Local document import with PDF/DOCX/TXT/image support
- Source-bound Saksrom Q&A with safe local mode
- Kontrollgrunnlag for OCR, coverage, audit and source basis
- Soft delete for test cases
- Local audit hash chain
- Windows exe, NSIS installer and MSI package

## Not For

- Real client data
- Production legal work
- Unsigned public distribution

## Verification

See `SHA256SUMS.txt` and `release-manifest.json`.
```
