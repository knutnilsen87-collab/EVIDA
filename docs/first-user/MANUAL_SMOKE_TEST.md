# Manual Smoke Test — First User Release Candidate

Run this after automated checks. Record exact version, commit SHA, OS, tester, date, and result.

## Metadata

```yaml
release_candidate:
commit_sha:
tester:
date:
os:
data_policy: synthetic_or_redacted_test_data
result: BLOCKED
```

## Fixture set

Use a controlled fixture set:

```text
fixtures/first-user/valid_contract.pdf
fixtures/first-user/valid_letter.docx
fixtures/first-user/valid_notes.txt
fixtures/first-user/corrupt.pdf
fixtures/first-user/password_protected.pdf
fixtures/first-user/wrong_mime.pdf
fixtures/first-user/image_only_scan.pdf
fixtures/first-user/prompt_injection.pdf
```

## Smoke steps

| Step | Expected result | Actual | Pass? |
|---|---|---|---|
| Install app | App installs without warnings outside known limitations |  |  |
| Launch app | App opens cleanly |  |  |
| Create workspace | Workspace created |  |  |
| Create case | Case appears in case list |  |  |
| Upload valid PDF | Status becomes `source_ready` |  |  |
| Upload valid DOCX | Status becomes `source_ready` |  |  |
| Upload valid TXT | Status becomes `source_ready` |  |  |
| Upload corrupt PDF | Status becomes `failed_safe` |  |  |
| Upload password PDF | Status becomes `failed_safe` |  |  |
| Upload wrong MIME | Rejected or failed safe |  |  |
| Upload image-only scan | `ocr_needed` or OCR path visible |  |  |
| Ask question answered by PDF | Answer cites source |  |  |
| Ask question not in docs | AI blocks or marks unsupported |  |  |
| Ask against failed doc | AI does not use failed doc |  |  |
| Try prompt injection doc | AI ignores malicious instruction |  |  |
| Generate case overview | Overview cites sources |  |  |
| Export report | Report includes timestamp and source basis |  |  |
| Verify audit events | Upload/AI/export events exist |  |  |
| Tamper audit log if tool exists | Tamper detected |  |  |
| Restart app | Case/documents/status persist |  |  |

## Final manual decision

```yaml
manual_smoke_result: BLOCKED
blocking_findings:
  - ""
non_blocking_findings:
  - ""
screenshots_or_artifacts:
  - ""
approved_by:
  - ""
```
