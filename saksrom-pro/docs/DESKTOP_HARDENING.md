# DESKTOP_HARDENING

## Implemented now

- Tauri CSP is no longer null.
- Release readiness script added: `ops/check_release_readiness.ps1`.
- Runtime/test gate remains `ops/run_tests.ps1`.
- Local legal documents remain local-first by architecture.
- Raw cloud upload remains policy-gated in backend defaults.

## Required before real legal data

- Install Rust/Cargo and run full `npm run tauri:build`.
- Add SQLCipher or equivalent encrypted local database.
- Add Tauri capability allowlist review.
- Add installer signing.
- Add OCR engine integration and OCR confidence tracking.
- Add secure local log redaction policy.
- Run manual threat-model review for file import and source export.

## Current release blockers in this environment

- Rust/Cargo are installed and pinned through `desktop-tauri/src-tauri/rust-toolchain.toml`.
- Tesseract is installed.
- `sqlite3.exe` is available through `.tools/bin`.
- SQLCipher/encrypted DB is still not implemented.

## Recommended hardening sequence

1. Run full Tauri compile.
2. Add encrypted SQLite layer.
3. Add PDF page rendering for OCR of scanned PDFs.
4. Build signed installer.
5. Run release readiness script.
