# Windows Build Prerequisites

## Required for desktop build

Install or verify:

- Node.js and npm
- Rust toolchain with `cargo` and `rustc`
- Tauri v2 build prerequisites for Windows
- WebView2 runtime
- Visual Studio Build Tools with Windows SDK
- Tesseract OCR, if OCR flows are included in the build
- SQLite CLI, for release-readiness checks

## Required for enterprise backend verification

- Java 21
- Maven
- Docker Desktop or compatible Docker engine, when running PostgreSQL-backed local tests

## Verification commands

```powershell
node --version
npm --version
cargo --version
rustc --version
tesseract --version
sqlite3 --version
java -version
mvn --version
```

Repo-level readiness:

```powershell
powershell -ExecutionPolicy Bypass -File evida-core/ops/check_release_readiness.ps1
```

## Current local prerequisite status

As of 2026-05-11, the current local machine has:

- Node/npm
- Java
- Cargo/rustc
- Tesseract
- SQLite

Maven is missing locally, so Spring Boot test verification must run in CI or after Maven is installed.

