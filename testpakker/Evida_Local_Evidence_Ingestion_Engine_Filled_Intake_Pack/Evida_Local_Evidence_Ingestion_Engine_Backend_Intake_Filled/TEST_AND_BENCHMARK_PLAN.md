# TEST_AND_BENCHMARK_PLAN

## Release principle
Do not claim MVP success until the engine passes zero-file-loss, crash recovery, manual review and false-complete tests.

## Test categories
### Unit tests
- schema validation
- status transitions
- invariant checks
- failure code mapping
- readiness calculation
- ETA calculation boundaries
- source provenance validation

### Integration tests
- folder discovery
- recursive import
- SQLite queue recovery
- hashing
- type detection
- archive safety
- extraction
- OCR job lifecycle
- manual review action flow
- report generation

### Golden import tests
Create `/tests/golden-import` with:
```text
/simple_text_files
/pdf_text_layer
/scanned_pdf
/mixed_pdf_text_and_scan
/corrupt_pdf
/zero_byte_files
/long_filenames
/unicode_filenames
/nested_folders
/zip_safe
/zip_path_traversal
/zip_bomb_candidate
/password_protected
/duplicate_files
/low_confidence_scan
/app_restart_mid_import
```

Each golden case should include:
- `truth_manifest.json`
- `expected_inventory.csv`
- `expected_failures.json`
- `expected_review_items.json`
- `expected_readiness.json`

## Critical tests
### T-001: Zero file loss
Input: folder with 10 000 files.  
Expected: every discovered file has status.  
Pass condition: `files_discovered == file_records_count` and `missing_status_count == 0`.

### T-002: Crash recovery
Input: active import. Kill app mid-import. Restart.  
Expected: session resumes or asks user to resume; no duplicate corruption.  
Pass condition: final report has consistent counts.

### T-003: Corrupt file isolation
Input: corrupt PDF among valid files.  
Expected: corrupt file failed with reason; valid files continue.  
Pass condition: no session-wide failure.

### T-004: Low OCR confidence review
Input: poor scan.  
Expected: page gets ManualReviewItem.  
Pass condition: user can open preview and resolve.

### T-005: Source provenance guard
Input: extracted chunks.  
Expected: no AI-usable chunk without source ref.  
Pass condition: invariant passes.

### T-006: False complete guard
Input: unresolved manual review item.  
Expected: session cannot be `complete`; only `waiting_manual_review` or `complete_with_exceptions` if accepted.  
Pass condition: verification blocks false complete.

### T-007: Archive path traversal
Input: ZIP with `../evil.txt`.  
Expected: extraction blocked.  
Pass condition: no file written outside workspace.

### T-008: Duplicate detection
Input: same file in multiple folders.  
Expected: same SHA-256 duplicate group.  
Pass condition: duplicate report lists both paths.

### T-009: User starts AI analysis early
Input: import partial.  
Expected: AI displays preliminary warning.  
Pass condition: no full-analysis ready state.

## Benchmark targets
Initial benchmark suite:
- 1 000 mixed files
- 10 000 mixed files
- 1 000-page text PDF
- 1 000-page scanned PDF
- nested folder depth stress
- Unicode filename set
- archive stress set

Metrics to record:
- time to first usable document
- time to first search result
- total import time
- OCR pages/min
- peak memory
- disk temp usage
- queue depth
- retry success
- UI responsiveness

## Exit criteria for MVP
MVP may be considered implementation-complete only when:
- all critical tests pass
- all critical invariants pass
- benchmark report generated
- manual review flow works end to end
- AI readiness gating works
- import report generated
- repo-health review says preserved or improved
