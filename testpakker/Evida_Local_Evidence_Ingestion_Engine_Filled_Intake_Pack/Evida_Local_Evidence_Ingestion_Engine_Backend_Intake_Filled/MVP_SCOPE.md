# MVP_SCOPE

## MVP goal
Bygg en lokal importmotor for Evida Desktop som beviser det viktigste: **null stille filtap, korrekt status per fil/side, trygg tidlig AI-bruk, og enkel manuell review av problemfiler/sider**.

## Must-have capabilities
### Import intake
- Drag-and-drop av enkeltfiler.
- Drag-and-drop av mapper.
- Rekursiv mappeimport.
- Import session opprettes for hver import.
- Import kan pauses, resumes og kanselleres.
- Import kan gjenopptas etter app-restart/krasj.
- Alle oppdagede filer får eksplisitt status.

### Queue/workers
- Lokal durable queue.
- Worker pool uten UI-freeze.
- Prioritering av raske/enkle filer før tunge OCR-filer.
- Backpressure på CPU, RAM, disk og køstørrelse.
- Retry av retryable failures med backoff.
- Timeout per fil/jobbsteg.
- Failure isolation per fil.

### File identity and safety
- Streaming SHA-256 for alle filer.
- Original file path, file name, file size, extension og timestamps lagres.
- Magic-byte based file type detection.
- Extension mismatch detection.
- 0-byte detection.
- Locked/unreadable file detection.
- Password/encrypted detection der mulig.
- Unsupported file status.
- Basic archive safety for ZIP:
  - path traversal check
  - compression ratio / bomb heuristic
  - nested archive limit
  - file count limit
- Ingen aktivt innhold kjøres.

### Supported MVP file types
MVP must support:
- PDF
- DOCX
- TXT
- MD
- CSV
- LOG
- PNG
- JPG/JPEG
- TIFF/TIF
- BMP
- XLSX
- ZIP

MVP should mark these with explicit status if not yet fully supported:
- EML
- MSG
- XLS
- ODS
- PPTX
- 7Z/RAR

### PDF and page handling
- PDF page count.
- Text-layer extraction where available.
- Per-page status.
- Detection of scanned/image-only pages.
- Detection of mixed PDFs: some pages text, some scans.
- Page preview or thumbnail generation for manual review.
- Basic rotated page detection if available; otherwise mark for review.
- Low-confidence / unreadable page status.

### OCR MVP
- OCR queue for image-only pages and image files.
- Per-page OCR status.
- OCR confidence per page.
- Norwegian + English OCR configuration where practical.
- OCR retry command.
- Low-confidence pages go to manual review queue.
- OCR artifacts persisted with provenance.

### Manual Review Queue
- Simple list of items needing review:
  - unreadable file
  - unreadable page
  - low OCR confidence
  - password protected
  - unsupported type
  - corrupt file
  - safety blocked archive
- Click item opens document/page preview.
- User can mark:
  - manually seen
  - relevant
  - not relevant
  - blank / no significance
  - unreadable but seen
  - requires follow-up
  - retry OCR
  - exclude from AI use
- All manual review actions are audit logged.
- Manual review status must be separate from machine-readable status.

### Progress and ETA
Dashboard must show:
- files discovered
- files processed
- files AI-ready
- files remaining
- pages discovered
- pages processed
- pages OCR pending/running/done
- manual review count
- ETA range, not exact promise
- recommendation to wait before full case analysis

### AI-readiness control
- Evida AI must know whether import is:
  - not started
  - processing
  - partial usable
  - needs manual review
  - complete
  - complete with exceptions
- If import is not complete, AI responses must be marked preliminary.
- Full case analysis should recommend waiting until import and review are complete.

### Reports
MVP must produce:
- ImportReport.json
- DocumentInventory.csv
- FailedFiles.csv
- ManualReviewReport.csv or JSON
- CaseReadinessReport.json

### Verification
MVP cannot mark import as fully successful unless:
- every discovered file has terminal or active status
- every AI-usable chunk has source reference
- every verified file has SHA-256
- every failed/problem file has failure code and reason
- every manual review item is resolved or still explicitly pending
- false complete rate is zero in tests

## Should-have
- Exact duplicate detection using SHA-256.
- Basic near-duplicate placeholder structure.
- Basic local full-text index.
- Basic chunking with file/page provenance.
- Simple source preview from search result.
- Duplicate summary in import report.
- Disk-space preflight check.
- CPU/RAM throttling controls.
- User-facing "Hva mangler?" screen.

## Explicitly deferred
- Full legal classification.
- Full semantic search and embeddings.
- Full Bates generation.
- Full near-duplicate detection.
- Email thread reconstruction.
- MSG parsing if not available locally.
- Full XLS legacy support.
- Full ODS/PPTX support.
- Advanced table extraction.
- Handwriting OCR.
- Signature/stamp detection.
- Digital signature validation.
- PDF/A validation.
- Full malware engine if not bundled; MVP supports scanner adapter.
- Multi-user cloud sync.

## Nice-to-have later
- Bates number generation and validation.
- Existing Bates preservation.
- Email parent-child attachment grouping.
- Advanced entity extraction.
- Document families.
- Case timeline hints.
- Source coverage analysis.
- Evidence matrix generation.
- Hybrid retrieval with reranking.
- Import benchmark mode.
- Production diagnostics bundle export.
- Local vector index with embeddings.
- Managed OCR fallback under explicit user consent.

## What must NOT be built in v1
- A UI-only import implementation.
- A parser running in the UI thread.
- Silent failure handling.
- "100 % complete" status that ignores unreadable/problem files.
- AI use of files/pages/chunks without source provenance.
- Uploading sensitive documents to cloud by default.
- Broad generic helper modules with unclear ownership.
- Evida-specific legal logic inside ingestion core.
- Destructive cleanup without checkpoint/audit.

## MVP success criteria
### Functional
- 10 000-file mixed folder import completes with zero files missing status.
- App restart during import resumes without corrupting queue.
- Corrupt PDF does not stop import.
- Low-confidence OCR page appears in manual review queue.
- User can open problem page, mark it manually reviewed, and see updated readiness.
- Evida AI can distinguish partial import from complete import.

### Quality
- `silent_failure_rate = 0`
- `file_status_coverage = 100%`
- `sha256_coverage = 100% for readable files`
- `false_complete_rate = 0`
- `ai_usable_chunks_without_source_ref = 0`
- `manual_review_action_audit_coverage = 100%`

### Performance targets for MVP benchmark
Targets are initial and may be calibrated after first real implementation:
- 1 000 mixed small files: first usable documents within seconds, complete basic import within practical desktop limits.
- 10 000 files: UI remains responsive; progress and ETA update continuously.
- 1 000-page text PDF: page count and text extraction without OOM.
- Scanned PDF: OCR queued per page; partial progress visible.

## MVP cut line
MVP ends when Evida can safely ingest local case material, report truthfully what is ready, guide user through manual review of failures, and prevent false full-analysis readiness.
