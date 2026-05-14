# Golden Test: Source-bound AI Overview

## Purpose

Verify case overview is generated only from source-ready documents and includes source references.

## Priority

P0

## Preconditions

- Fresh or known test workspace.
- Synthetic/redacted fixtures only.
- No real client data.

## Steps

1. Use case with at least two source-ready documents.
2. Generate case overview.
3. Inspect each factual claim.
4. Check source references.
5. Save retrieval snapshot if available.

## Expected result

Overview is source-bound; unsupported content is absent or marked unsupported; retrieval snapshot exists.

## Evidence to capture

- AI eval output
- retrieval snapshot path
- screenshot
- audit event

## Pass/fail rule

Pass only if all factual claims are source-bound or explicitly unsupported.

## Failure handling

If this test fails:

- mark related readiness matrix row as `BLOCKED`,
- create a failure record or issue,
- do not approve first-user release until resolved or explicitly deferred if not P0.
