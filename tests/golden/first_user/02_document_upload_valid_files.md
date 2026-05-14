# Golden Test: Document Upload — Valid Files

## Purpose

Verify valid PDF, DOCX, and TXT files upload, extract, and become source-ready.

## Priority

P0

## Preconditions

- Fresh or known test workspace.
- Synthetic/redacted fixtures only.
- No real client data.

## Steps

1. Create/open case.
2. Upload valid PDF fixture.
3. Upload valid DOCX fixture.
4. Upload valid TXT fixture.
5. Wait for processing.
6. Inspect document status.
7. Inspect source objects or source coverage UI.

## Expected result

Each valid document reaches `source_ready`; each has id, hash, status, and source object(s).

## Evidence to capture

- upload test output
- source object assertion
- UI screenshot
- audit event list

## Pass/fail rule

Pass only if all three file types become source-ready and source objects exist.

## Failure handling

If this test fails:

- mark related readiness matrix row as `BLOCKED`,
- create a failure record or issue,
- do not approve first-user release until resolved or explicitly deferred if not P0.
