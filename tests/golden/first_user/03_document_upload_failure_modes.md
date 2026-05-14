# Golden Test: Document Upload — Failure Modes

## Purpose

Verify unsafe or unsupported files fail safely and are excluded from AI retrieval.

## Priority

P0

## Preconditions

- Fresh or known test workspace.
- Synthetic/redacted fixtures only.
- No real client data.

## Steps

1. Upload corrupt PDF.
2. Upload password-protected PDF.
3. Upload wrong MIME/extension mismatch.
4. Upload oversized fixture if available.
5. Upload image-only scan.
6. Check visible status for each.
7. Ask AI question that would require failed docs.

## Expected result

Bad files are rejected or marked `failed_safe`; image-only scan is `ocr_needed` or processed by OCR; AI does not use failed/incomplete docs.

## Evidence to capture

- negative test output
- UI screenshot
- AI retrieval exclusion assertion
- audit events

## Pass/fail rule

Pass only if every failure is explicit, safe, visible, audited, and excluded from AI.

## Failure handling

If this test fails:

- mark related readiness matrix row as `BLOCKED`,
- create a failure record or issue,
- do not approve first-user release until resolved or explicitly deferred if not P0.
