# TECH_DIRECTION

## Preferred stack if already decided
### Product context
Evida is a local desktop application. The ingestion engine must be shipped with and run inside the Evida desktop software.

### Recommended architecture
Use a local modular architecture:

```text
Evida Desktop
  ├── UI / Renderer
  ├── Evida Case Domain
  ├── Local Evidence Ingestion Engine
  ├── Local Worker Runtime
  ├── Local SQLite Database
  ├── Local Artifact Store
  └── Local Search Index
```

### Fixed architectural decisions
- Local-first.
- Offline-capable.
- No cloud upload by default.
- UI must not own import truth.
- UI must not run heavy parsing/OCR.
- Import core must be separate from Evida case/AI logic.
- Evida integrates via adapter.
- Every state change must persist before UI reports it as truth.

### Preferred runtime
Depends on Evida stack. Acceptable options:

If Electron:
- Main process owns local APIs and file access.
- Node worker threads / child processes for hashing/parsing.
- Separate OCR worker process where needed.
- SQLite in main/local backend layer.

If Tauri:
- Rust backend owns file access, queue, hashing, archive safety.
- Sidecar/worker for OCR and parsers if needed.
- SQLite via Rust or local backend.

If Python sidecar is already accepted:
- Python worker for OCR/PDF/document parsing.
- Desktop shell communicates via local command bus.
- Must be packaged reliably for desktop.

### Recommended MVP technology choices
- Database: SQLite with WAL mode.
- Queue: SQLite-backed durable queue or embedded job runner.
- Search MVP: SQLite FTS5 or equivalent local full-text search.
- Blob/artifact storage: local workspace folder.
- OCR: local OCR adapter with Tesseract/PaddleOCR/equivalent behind interface.
- PDF: parser adapter abstraction; choose one reliable default and allow fallback later.
- Hashing: native streaming SHA-256.
- Archive: safe ZIP library with explicit path traversal protection.

## Backend preference
Local backend/engine inside desktop app. It should expose an internal API/command interface, not a public internet API.

Required internal commands:
- `createImportSession`
- `enqueueImportSource`
- `pauseImport`
- `resumeImport`
- `cancelImport`
- `retryFailed`
- `getImportSessionStatus`
- `getFileStatus`
- `getManualReviewQueue`
- `submitManualReviewAction`
- `getCaseReadiness`
- `generateImportReport`

## Frontend preference
Desktop UI that subscribes to import events and reads status from local state.

UI responsibilities:
- send commands
- render status
- render previews
- let user perform manual review
- warn when full AI analysis is premature

UI must not:
- be source of truth
- mutate file status directly
- do heavy parsing/OCR
- infer completion without verification result

## Database preference
SQLite WAL mode for MVP.

Core tables:
- `import_sessions`
- `import_sources`
- `file_import_records`
- `document_records`
- `page_records`
- `extraction_results`
- `ocr_results`
- `chunk_records`
- `import_jobs`
- `import_events`
- `manual_review_items`
- `manual_review_actions`
- `import_verification_results`
- `case_readiness_reports`

## Hosting/deployment preference
Bundled with Evida Desktop. No external hosting required for MVP.

## Auth preference
Local desktop MVP can use local app user identity. All manual actions still need actor metadata.

Later:
- workspace users
- case owner/reviewer/support roles
- encrypted workspace unlock

## File/media/storage needs
Workspace layout recommendation:

```text
<case_workspace>/.evida/
  db.sqlite
  artifacts/
    raw_refs/
    extracted_text/
    ocr/
    previews/
    thumbnails/
    reports/
  indexes/
  temp/
  audit/
```

Rules:
- Never overwrite original source files.
- Store references to originals and/or controlled copies based on product decision.
- All generated artifacts must have lineage to import session, file ID and job ID.
- Temp files must be cleaned after successful processing or recorded if cleanup fails.

## Third-party integrations
MVP should not require cloud APIs.

Optional adapter interfaces:
- malware scanner adapter
- OCR engine adapter
- PDF parser adapter
- embedding engine adapter later
- cloud OCR adapter later under explicit user consent

## CI/CD expectations
- Unit tests for schema/state transitions.
- Integration tests for import pipeline.
- Golden import tests.
- Corrupt file tests.
- Archive bomb/path traversal tests.
- Crash recovery tests.
- Desktop packaging smoke test.
- Performance benchmark jobs where possible.

## Logging/monitoring expectations
Local structured logs:
- import event log
- job execution log
- failure code log
- manual review audit log
- performance metrics
- diagnostics export

No raw sensitive content in logs by default.

## Performance expectations
- UI remains responsive during import.
- Discovery and hashing stream, never load huge files into memory.
- OCR limited by worker pool.
- Backpressure prevents runaway temp files or memory.
- Early indexing enables first usable documents before entire import is complete.
- ETA is range-based and recalculated.

## Security expectations
- Local-only default.
- No active content execution.
- Archive extraction safety.
- Sandboxed parser boundary where practical.
- Least privilege file access.
- No raw document content in diagnostic logs.
- Optional local encryption later.
- Clear policy if external services are ever introduced.

## What is fixed vs what GPT should recommend
### Fixed
- Must be local and embedded in Evida.
- Must be architecturally separate/reusable.
- Must provide manual review queue.
- Must prevent false complete/false 100 %.
- Must preserve provenance and status.
- Must support progressive readiness.

### GPT/developers may recommend
- specific parser libraries
- exact OCR engine
- Electron/Tauri implementation details
- exact queue implementation
- database migration tooling
- preview rendering library
- packaging strategy
