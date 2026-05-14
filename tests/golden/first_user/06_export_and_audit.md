# Golden Test: Export and Audit

## Purpose

Verify source-based report export and audit event creation.

## Priority

P1

## Preconditions

- Fresh or known test workspace.
- Synthetic/redacted fixtures only.
- No real client data.

## Steps

1. Use a case with source-ready docs and source-bound overview.
2. Export report.
3. Open report.
4. Confirm timestamp, case id, and source basis.
5. Inspect audit event.

## Expected result

Export exists, is readable, includes source basis and timestamp, and audit event is recorded.

## Evidence to capture

- exported file path
- audit event
- screenshot

## Pass/fail rule

Pass if export is correct and audited. Block only if export is in first-user scope.

## Failure handling

If this test fails:

- mark related readiness matrix row as `BLOCKED`,
- create a failure record or issue,
- do not approve first-user release until resolved or explicitly deferred if not P0.
