# Golden Test: Backup and Restore

## Purpose

Verify backup/restore preserves case data, documents, source objects, and audit trail.

## Priority

P1/P0 before real data

## Preconditions

- Fresh or known test workspace.
- Synthetic/redacted fixtures only.
- No real client data.

## Steps

1. Create populated test case.
2. Create backup.
3. Restore into clean profile/environment.
4. Inspect case, docs, source objects, AI source basis, and audit chain.

## Expected result

Restored workspace is complete and audit remains verifiable.

## Evidence to capture

- restore test output
- restored workspace path
- audit verification output

## Pass/fail rule

P1 for synthetic-only first user; P0 before real user data.

## Failure handling

If this test fails:

- mark related readiness matrix row as `BLOCKED`,
- create a failure record or issue,
- do not approve first-user release until resolved or explicitly deferred if not P0.
