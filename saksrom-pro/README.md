# Saksrom Pro

Desktop-first, local-first legal case workspace with source-bound AI, local document control, audit trails, and an optional Spring Boot enterprise control plane.

## Folders

- `desktop-tauri/` - Tauri 2 + React + TypeScript + Rust desktop starter.
- `ai-engine/` - Python local AI/document engine.
- `backend-api/` - FastAPI control-plane starter.
- `services/saksrom-api/` - Spring Boot enterprise backend/control plane.
- `db/` - SQLite schema for the local case store.
- `api/` - OpenAPI sketch.
- `ops/` - PowerShell/Python operator scripts.

## Current status

This is now the active product base copied from the Spring Boot starter zip. It is still a scaffold, but it has been validated and lightly hardened:

- Python AI/backend tests pass.
- Python lint passes.
- Desktop frontend build passes.
- Desktop npm audit has no moderate-or-higher findings.
- Spring Boot tests pass with local Maven.
- Ops scripts now resolve the project root correctly.
- Rust/Cargo, Tesseract OCR, and SQLite CLI are available for build hardening.
- Full Tauri release build has produced MSI and NSIS installers.

## Local setup

From this folder:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e .\ai-engine[dev] -e .\backend-api[dev]

cd .\desktop-tauri
npm.cmd install
cd ..
```

If Maven is not installed globally, use the local Maven distribution under `.tools/apache-maven-3.9.11`.

## Validate

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\ops\run_tests.ps1
```

## Run desktop web shell

```powershell
cd .\desktop-tauri
npm.cmd run dev
```

## Run FastAPI starter

```powershell
cd .\backend-api
..\ .venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Use this corrected command from repo root instead:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --app-dir .\backend-api
```

## Run Spring Boot control plane

```powershell
docker compose up -d postgres
.\.tools\apache-maven-3.9.11\bin\mvn.cmd -f .\services\saksrom-api\pom.xml test
.\.tools\apache-maven-3.9.11\bin\mvn.cmd -f .\services\saksrom-api\pom.xml spring-boot:run
```

## Production hardening still required

- SQLCipher/encrypted DB integration.
- PDF page rendering for OCR of scanned PDFs.
- Tauri permissions/security review.
- Code signing.
- Installer packaging.
- Legal domain eval datasets.
- Provider privacy review before real client data.
