# DOMAIN_MODEL

## Core domain concepts
### Evidence ingestion
The act of turning local files/folders into verified, source-traceable Evida evidence objects.

### Import truth
The persisted state of what has been discovered, processed, verified, blocked, failed, or manually reviewed.

### AI usable material
Material that Evida AI is allowed to use because it has text or structured data with source provenance and sufficient quality.

### Manual review
A user action that records that a file/page/problem was manually inspected. Manual review does not mean the engine has machine-read the content.

### Case readiness
A computed status describing whether the case material is sufficiently imported and reviewed for full AI-assisted analysis.

## Entities
See `DATA_API_REQUIREMENTS.md` for full field-level detail.

Primary entities:
- `ImportSession`
- `ImportSource`
- `FileImportRecord`
- `DocumentRecord`
- `PageRecord`
- `ExtractionResult`
- `OcrResult`
- `ChunkRecord`
- `ManualReviewItem`
- `ManualReviewAction`
- `ImportVerificationResult`
- `CaseReadinessReport`

## Relationships
- A case can have many import sessions.
- An import session can have many sources.
- A source can produce many file records.
- A file can produce zero or one primary document record.
- A document can have many pages.
- A page can have zero or more OCR results over time.
- A document/page/file can produce manual review items.
- Manual review items can have many actions but only one active resolution state.
- A chunk must map back to document/file/page provenance.
- A readiness report summarizes latest import session or whole case.

## Business rules
### BR-001: No silent file loss
Every discovered path must become one of:
- `FileImportRecord`
- explicit rejection record
- inaccessible source record

### BR-002: Hash before trusted processing
A readable file must be SHA-256 hashed before it can be marked verified or AI-usable.

### BR-003: Extension is not truth
File extension may inform UX, but detected file type must use magic bytes/signature where possible.

### BR-004: Safety before extraction
Archives and risky file types must pass safety gate before extraction.

### BR-005: AI source provenance required
No chunk may be AI-usable without source reference to file/document/page and extraction method.

### BR-006: Manual review is distinct from machine reading
Manual review can resolve user attention, but must not convert unreadable content into machine-readable text unless user provides manual transcription later.

### BR-007: Low confidence is not silently accepted
Low-confidence OCR must be marked, filtered, or manually reviewed.

### BR-008: Case complete requires all issues resolved or explicitly accepted
A case can be `complete_with_exceptions`, but not silently `complete` if blocking issues remain.

### BR-009: Full AI analysis should warn if import incomplete
If import status is not complete or complete_with_exceptions, Evida AI must mark analysis as preliminary unless user explicitly overrides.

### BR-010: Cancel does not delete truth
Cancel stops future work. Already discovered/processed state remains auditable.

## State transitions
### ImportSession states
```text
created
→ discovering
→ processing
→ partial_usable
→ waiting_manual_review
→ verifying
→ complete
| complete_with_exceptions
| cancelled
| failed
```

### FileImportRecord states
```text
discovered
→ queued
→ hashing
→ type_detected
→ safety_pending
→ safety_passed
→ extracting
→ extracted
→ ocr_pending
→ ocr_running
→ ocr_done
→ chunking
→ indexing
→ verified
```

Terminal alternatives:
```text
unsupported
security_blocked
password_protected
corrupt
failed_retryable
failed_final
cancelled
excluded_by_user
manual_review_required
manual_reviewed
```

### PageRecord states
```text
created
→ text_layer_detected
→ text_extracted
→ ocr_pending
→ ocr_running
→ ocr_done
→ low_confidence_review
→ manually_reviewed
→ verified
```

Terminal alternatives:
```text
blank
unreadable
excluded_by_user
failed
```

### ManualReviewItem states
```text
open
→ opened_by_user
→ resolved_seen
| resolved_relevant
| resolved_not_relevant
| resolved_blank
| resolved_unreadable_but_seen
| resolved_excluded
| retry_requested
| requires_followup
```

## Ownership and permissions
### Ingestion core owns
- import state machine
- file/document/page/chunk records
- worker orchestration
- parser/OCR result contracts
- import verification
- import reports

### Evida case domain owns
- case creation
- legal workflow
- AI analysis modes
- user-facing case document organization
- evidence matrix/timeline later

### Evida adapter owns
- mapping ingestion records to Evida case/document/source models
- gating AI analysis based on readiness
- UI event mapping

### UI owns
- presentation
- commands
- user interaction
- manual review UX

UI does not own truth.
