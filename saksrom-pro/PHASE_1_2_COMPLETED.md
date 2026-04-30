# PHASE_1_2_COMPLETED

## Phase 1: Core MVP

Implemented:
- Local case creation.
- Local document registry.
- SHA-256 document hashing.
- Audit event creation for case/document actions.
- SQLite schema expansion for pages, chunks, source objects.
- Case source coverage updates.
- UI for creating cases and registering documents.

## Phase 2: Document Engine

Implemented:
- Python ingestion engine for text and PDF files.
- PDF page counting through `pypdf`.
- PDF text extraction when text layer exists.
- OCR-needed status for scanned/blank PDF pages.
- Text chunking.
- Source object generation.
- Ingestion tests for text documents and PDFs.
- Desktop web UI showing page count, OCR status, source count, source coverage, audit trail, and source panel.

## Validation

Passing:
- Python AI engine tests.
- Backend API tests.
- Python lint.
- Desktop TypeScript/Vite build.
- Desktop npm audit.
- Spring Boot tests.

## Known gaps

- Full Tauri Rust compilation was not run because Rust/Cargo is not installed in this environment.
- OCR is not implemented yet; scanned PDFs are correctly marked as `needs_ocr`.
- SQLite encryption/SQLCipher remains a later hardening task.

## Next phase

Phase 3 should add source-bound AI/control mode:
- Citation validation.
- Unsupported fact detection.
- Contradiction/risk extraction.
- Control report generation.
- Final/export gate behavior.
