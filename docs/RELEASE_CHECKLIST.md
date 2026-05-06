# Evida Release Checklist

## Current Channel

`0.1.0-alpha` / pre-alpha evaluation build.

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

## Artifacts

Expected local artifacts:

- `Evida Release/Evida.exe`
- `Evida Release/Evida installer.exe`
- `Evida Release/Evida installer.msi`
- `Evida Release/SHA256SUMS.txt`
- `Evida Release/release-manifest.json`
- `Evida Release/LES_MEG.txt`

## GitHub Release Notes Template

```md
# Evida 0.1.0-alpha

Pre-alpha evaluation build. Test data only.

## Included

- Guided intro/login/case/import/Saksrom flow
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
