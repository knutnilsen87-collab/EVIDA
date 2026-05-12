# DELIVERY_HANDOFF

## Project summary
Build the **Evida Local Evidence Ingestion Engine**: a local, embedded, reusable document/evidence import engine for Evida Desktop. It must ingest files/folders recursively, process documents safely, provide live readiness status, enable AI to use only source-provenanced material, and guide users through manual review of unreadable/problem files and pages.

## Filled-out source documents
This filled pack includes:
- PROJECT_BRIEF.md
- USERS_AND_PERSONAS.md
- MVP_SCOPE.md
- FEATURE_INVENTORY.md
- UX_UI_DIRECTION.md
- TECH_DIRECTION.md
- DATA_API_REQUIREMENTS.md
- DOMAIN_MODEL.md
- INTEGRATIONS_AND_EXTERNAL_SYSTEMS.md
- OBSERVABILITY_AND_OPERATIONS.md
- RISKS_AND_UNKNOWNS.md
- DELIVERY_HANDOFF.md
- GPT_STARTER_PROMPT.txt
- status_bundle.template.txt
- Additional implementation docs:
  - ARCHITECTURE_DECISIONS.md
  - STATE_MACHINE_AND_INVARIANTS.md
  - MANUAL_REVIEW_WORKFLOW.md
  - TEST_AND_BENCHMARK_PLAN.md
  - FAILURE_CODE_CATALOG.md

## Current assumptions
- Evida is a local desktop app.
- Default processing mode is local-only.
- The import engine ships with Evida but is architecturally separate.
- SQLite is acceptable for local persistence.
- OCR is local in MVP or at least behind a local adapter.
- The first production-grade outcome is truthful import/readiness, not perfect extraction of every document.
- AI analysis must be gated by readiness status.

## What is still unknown
- Exact desktop framework.
- Exact OCR engine.
- Exact PDF parser/rendering library.
- Whether originals are copied or referenced.
- Whether local DB encryption is required in MVP.
- Hardware baseline.
- Whether EML/MSG support is mandatory in first release.

## What GPT/developers should do first
1. Create ADR: Local Evidence Ingestion Engine embedded in Evida Desktop.
2. Define canonical schemas.
3. Implement state machine and SQLite migrations.
4. Implement durable import queue.
5. Implement discovery + per-file status.
6. Implement SHA-256 streaming and magic-byte detection.
7. Implement live dashboard counters.
8. Add crash recovery.
9. Only then add parsers/OCR.

## Recommended first implementation steps
### Step 1: Foundation
- Create packages:
  - `packages/local-ingestion-core`
  - `packages/local-ingestion-workers`
  - `packages/evida-ingestion-adapter`
- Add schemas:
  - ImportSession
  - FileImportRecord
  - PageRecord
  - ManualReviewItem
  - ImportVerificationResult
  - CaseReadinessReport

### Step 2: Zero file loss proof
- Drag/drop folder.
- Recursive discovery.
- SQLite file records.
- Per-file status.
- Import dashboard.
- Restart recovery.
- JSON report.

### Step 3: Identity and type safety
- Streaming SHA-256.
- Magic bytes.
- Extension mismatch.
- Unsupported/password/corrupt statuses.
- Failure codes.

### Step 4: Fast extraction
- TXT/MD/CSV/LOG.
- DOCX.
- PDF page count + text layer.
- Basic chunk/source refs.
- Local FTS.

### Step 5: Manual review MVP
- Problem list.
- Open preview.
- Mark reviewed/relevant/not relevant/blank/unreadable.
- Audit actions.
- Readiness updates.

### Step 6: OCR MVP
- Scanned page detection.
- OCR queue.
- Confidence.
- Low-confidence review items.
- Retry OCR.

## Required validation before coding
Before broad implementation, lock:
- state machine
- invariants
- DB schema
- failure code catalog
- manual review action semantics
- AI readiness semantics
- workspace storage model

Before claiming MVP success, prove:
- 10 000 discovered files produce 10 000 statuses
- restart mid-import resumes
- corrupt file isolated
- low-confidence page enters review queue
- manual review updates readiness
- AI cannot use chunk without source ref
- false complete guard blocks completion when unresolved issues remain
