# First User Definition of Done

## Purpose

This is the release gate for allowing the first user to try the application in practice.

A first-user release is not approved because the app starts. It is approved only when critical user journeys have evidence.

## Required terminal state

First-user release may proceed only when:

```yaml
terminal_state: approved_for_controlled_first_user
p0_status: PASS
critical_invariants:
  broken: []
  untested: []
manual_approval: true
status_bundle_final_exists: true
```

## P0 gates

All P0 gates must be `PASS`.

| Gate | Required evidence |
|---|---|
| App starts reliably | Clean install/start smoke |
| Workspace/case persistence | Automated or manual restart test |
| Document upload works | Valid PDF/DOCX/TXT golden tests |
| Document upload fails safely | Corrupt, wrong MIME, oversized, password-protected tests |
| Source objects created | Assertion that uploaded docs produce source refs |
| Failed documents excluded from AI | Negative test |
| AI answers are source-bound | Citation/source coverage eval |
| Unsupported claims blocked | Adversarial eval |
| Audit chain works | Upload/AI/export/deletion audit events + tamper check |
| Sensitive data not leaked to logs | Log scan or structured logger test |
| Prod-unsafe config blocked | Prod mode gate or explicit pilot-only config |
| Release status bundle exists | `status_bundle.first_user.final.json` |

## P1 gates

P1 may be `PARTIAL` only if the release is explicitly constrained and the limitation is visible to the user.

| Gate | Required evidence |
|---|---|
| Export report | Smoke test |
| Backup/restore | Required before real data |
| OCR fallback | Required if scanned docs are in scope |
| Accessibility baseline | Keyboard/navigation smoke |
| Error reporting | User-visible safe errors |

## P2 gates

P2 may be deferred if outside first-user scope.

| Gate | Notes |
|---|---|
| Full dashboard polish | Not first-user critical |
| Advanced analytics | Not first-user critical |
| Multi-user workflows | Deferred unless pilot needs it |
| Full compliance reporting | Required before broader production |

## Go/no-go decision matrix

| Condition | Decision |
|---|---|
| Any P0 `BLOCKED` | NO-GO |
| Any P0 `PARTIAL` | NO-GO |
| Any critical invariant broken | NO-GO |
| Any critical invariant untested | NO-GO |
| AI can answer from unsupported documents | NO-GO |
| Document upload can silently fail | NO-GO |
| Audit cannot prove core actions | NO-GO |
| All P0 pass, P1 limitations documented | GO for controlled first user only |

## Closure rule

The release owner must create or update:

```text
artifacts/first-user/status_bundle.first_user.final.json
```

The bundle must include:

- release candidate id,
- commit SHA,
- tested platforms,
- P0/P1/P2 summary,
- evidence refs,
- broken invariants,
- untested invariants,
- residual risk,
- approval decision,
- rollback path.

## Required approval

Before first user:

- Engineering owner approval
- Product owner approval
- Security/privacy approval if any real user data is allowed
- Legal/compliance approval if any real legal matter is allowed

## Residual risk language

Use exact language:

```text
Approved for controlled first-user evaluation with synthetic/redacted test data only.
Not approved for real client data or production legal work unless separately approved.
```
