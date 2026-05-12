# FEATURE_INVENTORY

## Core features
### Local import session
- Create import session per user import.
- Import session stores `case_id`, `workspace_id`, actor, start time, source type, root paths.
- Supports status: `created | discovering | processing | partial_usable | waiting_manual_review | complete | complete_with_exceptions | cancelled | failed`.

### Drag-and-drop intake
- Single file drag-and-drop.
- Multiple file drag-and-drop.
- Folder drag-and-drop.
- Recursive traversal.
- Preserve original relative folder paths.
- Detect inaccessible files and record failure.

### Durable queue
- Persistent local queue in SQLite.
- Per-job idempotency key.
- Per-job checkpoint.
- Retry/backoff.
- Pause/resume/cancel.
- Worker pool isolated from UI.
- Priority lanes.

### Priority lanes
1. **Inventory lane**: discovery, file record creation.
2. **Identity lane**: hash, size, type detection.
3. **Fast text lane**: TXT/MD/CSV/LOG/DOCX/PDF text-layer.
4. **Structured lane**: XLSX, tables where available.
5. **Preview lane**: thumbnails/page previews.
6. **OCR lane**: scanned pages/images.
7. **Review lane**: unresolved failures/problem pages.
8. **Index lane**: chunk + local index.

### File identity
- SHA-256 streaming.
- Original path/name/size.
- Detected type via magic bytes.
- Claimed extension.
- MIME/type mismatch status.
- Stable file ID derived from import session + path + size + hash, with canonical stable document ID after hash.

### Safety gate
- Quarantine/raw reference.
- Archive inspection before extraction.
- ZIP path traversal protection.
- ZIP bomb heuristic.
- Unsupported/encrypted/password status.
- Macro/active content detection placeholder.
- Malware scanner adapter interface.

### Document extraction
- PDF page count.
- PDF text layer extraction.
- DOCX text extraction.
- TXT/MD/CSV/LOG parsing.
- XLSX sheet inventory and text/table extraction MVP.
- Image files create page-like image records.
- Extraction artifact saved with source provenance.

### OCR
- Image-only pages queued.
- OCR per page.
- Language: Norwegian + English.
- Confidence per page.
- Low-confidence threshold configurable.
- Retry OCR.
- Page status visible.

### Chunking and source provenance
- Page-aware chunks.
- Chunk ID, hash, document ID, page range, char offsets.
- Extraction method: `text_layer | ocr | manual_note | unsupported`.
- Source reference stored for every AI-usable chunk.

### Local search
- Basic full-text search in MVP.
- Filters by file type, status, source quality, manual review status.
- Search result opens original document/page preview.

### Evidence readiness
- Calculate:
  - import progress
  - processing progress
  - verification coverage
  - AI usable coverage
  - manual review remaining
- Produce recommendation:
  - "Vent til importen er fullført"
  - "Foreløpig analyse mulig"
  - "Full analyse anbefales ikke ennå"
  - "Full analyse kan starte med merknader"

### Manual Review Queue
- List problem items.
- Direct preview to file/page.
- Clear non-technical reason.
- User action buttons.
- Audit trail.
- Updates case readiness.

### Import report
- JSON report.
- CSV inventory.
- Failed file list.
- Manual review list.
- Readiness report.

## Supporting features
- Disk-space preflight.
- Resume after crash.
- Temp file cleanup with audit.
- Worker throttling.
- Configurable max file size and max batch policy.
- Import history.
- Import diagnostic view.
- Duplicate summary.
- "Hva har Evida funnet?" screen.
- "Hva mangler?" screen.

## Admin/operator features
Local desktop MVP:
- Debug diagnostics export without raw document content.
- Import session ID.
- Worker status.
- Queue depth.
- Error/failure code counts.
- Version info for parsers/OCR engines.
- Benchmark/test mode later.

## Analytics/reporting needs
Local metrics stored per import:
- time to first usable document
- time to first search result
- files/sec discovery
- MB/sec hashing
- pages/sec OCR
- failure count by type
- retry success rate
- manual review count
- false-complete guard result
- peak memory if measurable

## Notifications/messaging needs
In-app only for MVP:
- Import started.
- Import paused/resumed/cancelled.
- Problem files found.
- Manual review required.
- Import complete.
- Import complete with exceptions.
- Low disk space.
- AI analysis warning when import incomplete.

## Search/filtering needs
Filters:
- status
- document type
- file extension
- detected type
- AI usable yes/no
- OCR needed
- OCR low confidence
- manual review status
- failed/retryable
- duplicate
- large files
- archive parent
- folder path

## Security/privacy-sensitive features
- Local-only default.
- No cloud upload by default.
- Raw documents stay on user machine.
- Secure temp files.
- Clear handling of sensitive data.
- Optional local database encryption later.
- Audit log for manual review actions.
- No active content execution.
- Archive safety before extraction.

## Future features
- EML/MSG full support.
- Bates generation/validation.
- Email thread/attachment families.
- Near-duplicate detection.
- Perceptual image hashing.
- Advanced table extraction.
- Hybrid search with embeddings/reranking.
- Timeline/entity extraction.
- Full chain-of-custody PDF report.
- Evidence package export.
- Import benchmark mode.
- Production diagnostics bundle.
