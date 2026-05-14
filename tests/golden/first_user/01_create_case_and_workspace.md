# Golden Test: Create Workspace and Case

## Purpose

Verify that the app can create a local workspace and a case that persists after restart.

## Priority

P0

## Preconditions

- Fresh or known test workspace.
- Synthetic/redacted fixtures only.
- No real client data.

## Steps

1. Launch app.
2. Create workspace.
3. Create a new case.
4. Add minimal case metadata.
5. Close app.
6. Reopen app.
7. Confirm workspace and case are still present.

## Expected result

Workspace and case exist after restart without corruption or duplicate records.

## Evidence to capture

- screenshot or e2e output
- persistence test output
- audit event if implemented

## Pass/fail rule

Pass only if restart preserves the case and no unsafe error appears.

## Failure handling

If this test fails:

- mark related readiness matrix row as `BLOCKED`,
- create a failure record or issue,
- do not approve first-user release until resolved or explicitly deferred if not P0.
