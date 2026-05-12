# STATE_MACHINE_AND_INVARIANTS

## Purpose
This document defines the operational truth model for the ingestion engine. Developers must implement these transitions and invariants before claiming import success.

## ImportSession state machine
```text
created
→ discovering
→ processing
→ partial_usable
→ waiting_manual_review
→ verifying
→ complete
```

Terminal alternatives:
```text
complete_with_exceptions
cancelled
failed
blocked
```

## FileImportRecord state machine
```text
discovered
→ queued
→ hashing
→ hashed
→ type_detecting
→ type_detected
→ safety_pending
→ safety_passed
→ extracting
→ extracted
→ page_processing
→ ocr_pending
→ ocr_running
→ ocr_done
→ chunking
→ indexing
→ verifying
→ verified
```

Terminal alternatives:
```text
unsupported
password_protected
encrypted
security_blocked
corrupt
failed_retryable
failed_final
cancelled
excluded_by_user
manual_review_required
manual_reviewed
```

## PageRecord state machine
```text
created
→ inspected
→ text_layer_detected
→ text_extracted
→ ocr_pending
→ ocr_running
→ ocr_done
→ verified
```

Terminal alternatives:
```text
blank_detected
low_confidence_review
unreadable
manual_review_required
manual_reviewed_seen
manual_reviewed_relevant
manual_reviewed_not_relevant
manual_reviewed_blank
manual_reviewed_unreadable_but_seen
excluded_by_user
failed
```

## ManualReviewItem state machine
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

## Critical invariants
### INV-001: No discovered file without status
Every discovered file path must have a `FileImportRecord` or explicit rejection/inaccessible record.

Release blocker if broken.

### INV-002: Hash required for verified file
A readable file cannot be `verified` without SHA-256.

Release blocker if broken.

### INV-003: Source provenance required for AI use
No chunk can be `ai_usable=true` without:
- file ID
- document ID
- page range where applicable
- extraction method
- artifact ref or text source ref

Release blocker if broken.

### INV-004: Safety before archive extraction
Archives cannot be extracted before archive safety decision.

Release blocker if broken.

### INV-005: Low-confidence OCR is not high-confidence source
OCR below threshold must be marked low confidence and routed to review or filtered from high-trust retrieval.

Release blocker if broken.

### INV-006: Manual review is distinct from machine-readable
Manual review can resolve attention, but cannot create machine-readable extracted text unless user provides transcription.

Release blocker if AI treats manual review as OCR text.

### INV-007: Complete status requires verification
ImportSession cannot be `complete` unless ImportVerificationResult passes all critical checks.

Release blocker if broken.

### INV-008: Complete with exceptions must list exceptions
If unresolved blocked/unsupported/unreadable items remain, session may only be `complete_with_exceptions` and must include exception counts.

### INV-009: UI cannot mutate core status directly
UI actions must call engine commands. Engine writes state.

### INV-010: Cancel is not delete
Cancelled sessions preserve discovered/processed state and produce cancellation summary.

## Readiness states
### not_ready
No AI usage recommended.

### partial_usable
Some source-provenanced material is available. AI responses must be preliminary.

### waiting_manual_review
Processing may be mostly complete but user must review problem items.

### ready_with_exceptions
Full analysis can start, but AI must mention unresolved/manual exceptions when relevant.

### ready
Import complete, critical checks pass, no blocking manual review items.

## Completion rules
### `complete`
Allowed only when:
- all discovered files have terminal or verified status
- no open manual review items
- no critical broken invariants
- source provenance coverage is 100 % for AI-usable chunks
- verification result passes

### `complete_with_exceptions`
Allowed when:
- all discovered files have explicit status
- exceptions are known and reported
- user has resolved or accepted manual review items
- AI readiness report includes limitations

### `partial_usable`
Allowed when:
- at least one chunk/document is source-provenanced and indexed
- remaining work is explicit
- AI warning banner is active

### `failed`
Allowed when:
- import session cannot continue due to unrecoverable system state
- failure report is generated

### `blocked`
Allowed when:
- policy/security/storage condition prevents safe processing
- user action required
