# OBSERVABILITY_AND_OPERATIONS

## Logging expectations
Use structured logs/events. No raw document text in logs by default.

### Event categories
- import session events
- source discovery events
- file state transition events
- job lifecycle events
- parser warnings/errors
- OCR warnings/errors
- manual review actions
- verification results
- readiness changes
- cleanup events

### Required event fields
- `event_id`
- `event_type`
- `timestamp`
- `case_id`
- `import_session_id`
- `file_id` if applicable
- `document_id` if applicable
- `page_id` if applicable
- `job_id` if applicable
- `actor_id` or `system`
- `status_before`
- `status_after`
- `reason_code`
- `artifact_refs`

## Metrics expectations
### Product metrics
- `files_discovered`
- `files_processed`
- `files_ai_usable`
- `files_failed`
- `files_blocked`
- `manual_review_items_open`
- `manual_review_items_resolved`
- `pages_total`
- `pages_ocr_pending`
- `pages_ocr_done`
- `pages_low_confidence`
- `ai_usable_page_percent`
- `case_readiness_status`

### Performance metrics
- `time_to_first_usable_document`
- `time_to_first_search_result`
- `discovery_files_per_second`
- `hash_mb_per_second`
- `ocr_pages_per_minute`
- `queue_depth_by_lane`
- `worker_active_count`
- `peak_memory_estimate`
- `temp_disk_usage_bytes`
- `retry_success_rate`

### Integrity metrics
- `file_status_coverage`
- `sha256_coverage`
- `source_ref_coverage`
- `page_status_coverage`
- `silent_failure_count`
- `false_complete_guard_status`
- `ai_usable_chunks_without_source_ref`

## Health/readiness endpoints
Internal/local health checks:
- database available
- workspace writable
- artifact store writable
- queue operational
- worker runtime operational
- OCR available/configured
- parser adapters available
- disk space sufficient
- temp cleanup status

## Alerting expectations
In-app alerts:
- low disk space
- import stalled
- too many failures
- OCR unavailable
- database write failure
- workspace not writable
- manual review required before full analysis
- import complete with exceptions

## Audit/log retention needs
- Import events retained with case.
- Manual review events retained with case.
- Diagnostic logs rotate locally.
- Raw document content excluded from logs.
- Reports can be regenerated from persisted state where possible.

## Operational runbooks needed
### Runbook: Import stuck
Steps:
1. Check queue depth and active job.
2. Check last event timestamp.
3. Check disk space.
4. Check worker process health.
5. Mark stalled job retryable or failed with reason.
6. Resume queue.

### Runbook: OCR unavailable
Steps:
1. Detect missing OCR binary/model.
2. Mark OCR jobs as blocked_ocr_unavailable.
3. Keep document/page status intact.
4. Put affected pages in manual review or pending OCR.
5. Show user-facing message.

### Runbook: Corrupt file
Steps:
1. Record failure code.
2. Preserve file identity/hash if readable.
3. Continue import.
4. Add manual review item if preview possible.
5. Include in failed file report.

### Runbook: User cancels import
Steps:
1. Set session cancel_requested.
2. Let active jobs stop at safe checkpoints.
3. Mark queued jobs cancelled.
4. Preserve completed/imported state.
5. Generate cancellation summary.

### Runbook: App restart during import
Steps:
1. On startup, scan sessions with non-terminal status.
2. Reconcile active jobs as interrupted.
3. Requeue idempotent jobs.
4. Validate file records.
5. Resume or ask user.

### Runbook: False complete guard triggered
Steps:
1. Prevent complete status.
2. Generate verification failure.
3. Show unresolved invariant to user/developer.
4. Requeue verification or create manual review items.
