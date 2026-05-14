# Document Upload Readiness

Document upload is P0-critical.

The first user must be able to upload documents and trust the resulting document status. AI must never use a document that failed, is incomplete, or lacks source objects.

## Required upload states

The implementation must expose or internally track these states:

| State | Meaning | AI usable? |
|---|---|---:|
| `selected` | User selected file, not yet accepted | No |
| `validated` | Type/size/basic checks passed | No |
| `rejected` | File failed validation | No |
| `hashed` | Content hash stored | No |
| `stored` | File persisted in controlled storage | No |
| `extracting` | Text extraction running | No |
| `ocr_needed` | Image/scanned doc requires OCR | No unless OCR completed |
| `extracted` | Text extracted | Not yet |
| `chunked` | Chunks created | Not yet |
| `source_ready` | Source objects created and indexed | Yes |
| `failed_safe` | Failure recorded without unsafe side effects | No |
| `deleted` | Removed or tombstoned | No |

## Accepted file types for first user

Minimum:

- PDF
- DOCX
- TXT

Optional only if explicitly tested:

- PNG/JPG scanned documents with OCR
- EML
- XLSX
- HTML

## Mandatory validations

| Check | Required behavior |
|---|---|
| Extension allowlist | Reject unsupported types |
| MIME sniffing | Reject mismatch or mark unsafe |
| File size limit | Reject or require explicit override |
| Empty file | Reject safely |
| Duplicate file hash | Detect and show duplicate status |
| Password-protected PDF | Fail safe with user-visible status |
| Corrupt PDF | Fail safe with user-visible status |
| Image-only scan | `ocr_needed` or OCR path, not silent success |
| Huge document | Bounded processing, no UI freeze |
| Path traversal filename | Sanitize filename |
| Malicious embedded prompt | Must not override AI policy |
| Malware hook | Stub or real hook must exist; first-user limitation must be explicit |

## Required automated tests

Create or map these tests:

```text
tests/golden/first_user/02_document_upload_valid_files.md
tests/golden/first_user/03_document_upload_failure_modes.md
```

Recommended implementation-level tests:

```text
document_upload_accepts_pdf_docx_txt
document_upload_rejects_unsupported_extension
document_upload_rejects_mime_mismatch
document_upload_hashes_every_accepted_file
document_upload_detects_duplicate_hash
document_upload_password_pdf_fails_safe
document_upload_corrupt_pdf_fails_safe
document_upload_image_only_pdf_sets_ocr_needed
document_upload_never_marks_failed_doc_source_ready
document_upload_failed_doc_excluded_from_retrieval
document_upload_creates_audit_event
document_upload_does_not_log_sensitive_text
```

## Required manual smoke

Use at least these fixture documents:

| Fixture | Expected result |
|---|---|
| `valid_contract.pdf` | `source_ready` |
| `valid_letter.docx` | `source_ready` |
| `valid_notes.txt` | `source_ready` |
| `corrupt.pdf` | `failed_safe` |
| `password_protected.pdf` | `failed_safe` |
| `wrong_mime.pdf` | `rejected` |
| `image_only_scan.pdf` | `ocr_needed` or `source_ready` after OCR |
| `prompt_injection.pdf` | `source_ready`, but injection ignored by AI |

## Source object requirements

For every `source_ready` document:

- document id exists,
- content hash exists,
- one or more source objects exist,
- source object points to document id,
- source span/page/chunk reference exists where applicable,
- source status is queryable,
- source object is usable by AI retrieval,
- source object is shown or traceable in UI.

## AI exclusion rule

AI retrieval must exclude:

- `selected`
- `validated`
- `rejected`
- `hashed`
- `stored`
- `extracting`
- `ocr_needed`
- `extracted`
- `chunked`
- `failed_safe`
- `deleted`

Only `source_ready` is eligible.

## Audit requirements

Every upload attempt must record:

- event id,
- document id if assigned,
- file name or sanitized display name,
- file hash if accepted,
- result state,
- failure reason if failed,
- user/session id if available,
- timestamp,
- no raw sensitive document body.

## UI requirements

The user must see:

- uploaded documents,
- current document status,
- failed documents and reason,
- OCR-needed documents,
- whether document is available to AI,
- source coverage/confidence if available.

## First-user approval rule

Document upload is approved only when:

```yaml
valid_upload_path: PASS
failure_modes: PASS
source_object_creation: PASS
ai_exclusion_for_failed_docs: PASS
audit_events: PASS
ui_status_visibility: PASS
sensitive_log_leak_check: PASS
```
