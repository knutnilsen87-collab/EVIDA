# Golden Test: Restart and Persistence

## Purpose

Verify documents, statuses, source objects, and audit trail persist after restart.

## Priority

P0

## Preconditions

- Fresh or known test workspace.
- Synthetic/redacted fixtures only.
- No real client data.

## Steps

1. Complete upload and AI overview.
2. Close app.
3. Reopen app.
4. Confirm case, docs, statuses, source objects, and audit events remain visible/queryable.

## Expected result

No data loss, status regression, or broken source references after restart.

## Evidence to capture

- persistence test output
- screenshots
- audit inspection

## Pass/fail rule

Pass only if all critical state survives restart.

## Failure handling

If this test fails:

- mark related readiness matrix row as `BLOCKED`,
- create a failure record or issue,
- do not approve first-user release until resolved or explicitly deferred if not P0.
