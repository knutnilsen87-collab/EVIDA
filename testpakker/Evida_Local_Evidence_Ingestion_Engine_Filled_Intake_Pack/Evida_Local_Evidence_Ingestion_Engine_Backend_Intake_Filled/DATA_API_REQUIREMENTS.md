# DATA_API_REQUIREMENTS

## Core entities / data objects
### ImportSession
Represents one import run.

Required fields:
- `import_session_id`
- `case_id`
- `workspace_id`
- `actor_id`
- `source_type`
- `status`
- `created_at`
- `started_at`
- `updated_at`
- `completed_at`
- `cancel_requested`
- `pause_requested`
- `summary_counts`
- `readiness_state`
- `current_recommendation`

### ImportSource
Represents a root file/folder/archive source selected by user.

Required fields:
- `source_id`
- `import_session_id`
- `source_kind`: `file | folder | archive | retry | restored_session`
- `original_path`
- `display_name`
- `status`
- `discovered_file_count`
- `discovered_folder_count`
- `estimated_total_bytes`
- `created_at`

### FileImportRecord
Represents every discovered file or explicit rejection.

Required fields:
- `file_id`
- `import_session_id`
- `case_id`
- `source_id`
- `parent_file_id`
- `archive_parent_id`
- `original_path`
- `original_relative_path`
- `original_name`
- `original_extension`
- `original_size_bytes`
- `filesystem_modified_at`
- `sha256`
- `hash_status`
- `detected_mime`
- `detected_file_type`
- `magic_bytes_signature`
- `type_confidence`
- `type_mismatch`
- `status`
- `phase`
- `failure_code`
- `failure_reason_user`
- `failure_reason_technical`
- `retryable`
- `ai_usable`
- `fully_verified`
- `manual_review_required`
- `created_at`
- `updated_at`

### DocumentRecord
Canonical logical document after type detection/extraction.

Fields:
- `document_id`
- `file_id`
- `case_id`
- `document_kind`
- `document_title`
- `page_count_expected`
- `page_count_detected`
- `has_text_layer`
- `has_scanned_pages`
- `has_mixed_content`
- `extraction_status`
- `ocr_required`
- `ai_usable`
- `source_quality`
- `created_at`
- `updated_at`

### PageRecord
Per-page truth.

Fields:
- `page_id`
- `document_id`
- `file_id`
- `page_number`
- `bates_number`
- `width`
- `height`
- `rotation_detected`
- `blank_detected`
- `low_contrast_detected`
- `text_layer_present`
- `ocr_status`
- `ocr_confidence`
- `page_status`
- `preview_artifact_ref`
- `thumbnail_artifact_ref`
- `page_fingerprint`
- `manual_review_status`

### ExtractionResult
Fields:
- `extraction_result_id`
- `document_id`
- `file_id`
- `method`
- `status`
- `text_artifact_ref`
- `metadata_artifact_ref`
- `warnings`
- `error_code`
- `created_at`

### OcrResult
Fields:
- `ocr_result_id`
- `page_id`
- `document_id`
- `engine`
- `engine_version`
- `languages`
- `status`
- `confidence`
- `text_artifact_ref`
- `blocks_artifact_ref`
- `warnings`
- `created_at`

### ChunkRecord
Fields:
- `chunk_id`
- `document_id`
- `file_id`
- `page_start`
- `page_end`
- `char_start`
- `char_end`
- `text_artifact_ref`
- `chunk_hash`
- `extraction_method`
- `ocr_confidence_min`
- `source_ref`
- `index_status`
- `ai_usable`

### ManualReviewItem
Fields:
- `review_item_id`
- `case_id`
- `import_session_id`
- `target_type`: `file | document | page | archive | chunk`
- `target_id`
- `reason_code`
- `user_facing_reason`
- `technical_reason`
- `severity`
- `status`
- `recommended_actions`
- `created_at`
- `resolved_at`

### ManualReviewAction
Fields:
- `review_action_id`
- `review_item_id`
- `actor_id`
- `action`
- `note`
- `created_at`
- `resulting_status`

### ImportVerificationResult
Fields:
- `verification_id`
- `import_session_id`
- `status`
- `files_discovered`
- `files_with_status`
- `files_missing_status`
- `sha256_coverage`
- `source_ref_coverage`
- `page_status_coverage`
- `manual_review_open_count`
- `broken_invariants`
- `untested_invariants`
- `false_complete_risk`
- `created_at`

### CaseReadinessReport
Fields:
- `case_readiness_report_id`
- `case_id`
- `import_session_id`
- `status`
- `case_complete`
- `ai_ready`
- `ai_usable_document_percent`
- `ai_usable_page_percent`
- `manual_review_remaining`
- `blocking_issues`
- `warnings`
- `recommended_next_action`
- `created_at`

## Relationships between them
```text
Case
  └── ImportSession
        ├── ImportSource
        ├── FileImportRecord
        │     └── DocumentRecord
        │           ├── PageRecord
        │           │     └── OcrResult
        │           ├── ExtractionResult
        │           └── ChunkRecord
        ├── ManualReviewItem
        │     └── ManualReviewAction
        ├── ImportVerificationResult
        └── CaseReadinessReport
```

## CRUD needs
### Create
- import session
- source
- file record
- jobs
- document/page/chunk records
- review item/action
- reports

### Read
- status dashboard
- file status list
- page status
- review queue
- readiness report
- import history
- diagnostics

### Update
- job state
- file/page/document status
- manual review state
- readiness state
- retry count
- progress counters

### Delete
Generally avoid deletion. Use status:
- cancelled
- excluded_by_user
- superseded
- cleanup_done
- cleanup_failed

## API consumers
- Evida Desktop UI
- Evida AI/chat layer
- Evida case document viewer
- local worker runtime
- diagnostics/export module
- future reusable projects via adapter

## External APIs / integrations
None required in MVP.

Optional future:
- local malware scanner
- cloud OCR under explicit consent
- external document management import connectors
- cloud backup/sync under explicit consent

## Search/filtering/sorting requirements
Search documents by:
- full text
- file name
- folder path
- status
- document type
- page status
- manual review status
- AI usable status
- OCR confidence
- failure code
- duplicate group
- import session

Sorting:
- priority
- filename
- folder
- status
- created/imported time
- pages remaining
- review severity

## Reporting/analytics requirements
Reports:
- import summary
- document inventory
- failed files
- unsupported files
- manual review report
- OCR quality report
- duplicate report
- chain-of-custody later
- diagnostics bundle later

Metrics:
- discovered count
- processed count
- AI-ready count
- manual review count
- failure count by code
- retry count
- OCR pages/min
- time to first usable document
- time to complete import
- false complete risk

## Privacy/sensitive data considerations
- Raw document content must not be included in logs by default.
- Diagnostics export must separate content-free technical data from content-bearing artifacts.
- User must explicitly choose if exporting content-bearing evidence package.
- Local-only by default.
- Manual review notes may contain sensitive info and must be treated as case data.

## Data retention / audit considerations
- Import event log is append-only for the import session.
- Manual review actions are audit events.
- Generated artifacts should have lineage.
- Failed temporary files should be cleaned or recorded.
- Retention follows case workspace lifecycle.
