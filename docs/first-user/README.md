# First User Readiness Pack

This folder defines what must be tested, verified, and approved before the first user can try the application in practice.

The goal is not to prove that every future feature is complete. The goal is to prove that the first-user scope is safe, understandable, and verifiable.

## Read order

1. `FIRST_USER_SCOPE.md`
2. `FIRST_USER_DOD.md`
3. `PRODUCT_INVARIANTS.md`
4. `DOCUMENT_UPLOAD_READINESS.md`
5. `FIRST_USER_READINESS_MATRIX.md`
6. `MANUAL_SMOKE_TEST.md`
7. `APPROVAL_CHECKLIST.md`
8. `CODEX_EXECUTION_BRIEF.md`

## Release rule

First-user release is blocked unless all P0 items in `FIRST_USER_READINESS_MATRIX.md` are `PASS`.

Allowed statuses:

| Status | Meaning | First-user release impact |
|---|---|---|
| `PASS` | Automated evidence and required manual smoke are complete | Allowed |
| `PARTIAL` | Some evidence exists, but coverage or approval is incomplete | Blocks P0 |
| `BLOCKED` | Unsafe, unimplemented, or unverified | Blocks |
| `DEFERRED` | Explicitly outside first-user scope | Allowed only if not P0 |
| `N/A` | Not applicable to this release | Allowed only with rationale |

## Evidence model

A checkbox is not evidence. Evidence means at least one of:

- automated test name and result,
- CI job URL or local command output,
- artifact path,
- screenshot/video for manual UI smoke,
- status bundle path,
- reviewer approval tied to a concrete commit or release candidate.

## Expected repo placement

```text
docs/first-user/
tests/golden/first_user/
configs/first-user/
scripts/
```

This keeps first-user readiness visible without mixing release governance into product code.
