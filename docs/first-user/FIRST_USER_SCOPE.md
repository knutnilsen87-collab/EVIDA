# First User Scope

## Purpose

This document locks what the first user is allowed to test. Anything outside this scope must not be treated as release-blocking unless it affects safety, privacy, document upload, AI grounding, audit, or data integrity.

## First-user profile

The first user is a controlled pilot/evaluation user.

They may use:

- synthetic data,
- redacted sample documents,
- explicitly approved non-sensitive test data.

They must not use:

- real client documents,
- production legal matters,
- unredacted personal data,
- privileged case material,
- regulated production workflows,

unless every P0 privacy/security/compliance gate is already green and explicitly approved.

## In scope for first user

| Area | Required? | Notes |
|---|---:|---|
| App install/start | Yes | Clean machine or clean profile smoke required |
| Local workspace creation | Yes | Must persist after restart |
| Case creation | Yes | Basic metadata and case list |
| Document upload | Yes, P0 | PDF, DOCX, TXT minimum; safe failure modes required |
| Document status visibility | Yes, P0 | User must see upload/extraction/indexing/source status |
| Source object creation | Yes, P0 | AI cannot use documents without source objects |
| Case overview from sources | Yes, P0 | Must show source basis |
| Ask questions against uploaded documents | Yes, P0 | Answers must be source-bound or blocked |
| Unsupported claim blocking | Yes, P0 | AI must not invent facts/legal conclusions |
| Audit trail | Yes, P0 | Upload, AI, export, deletion events |
| Export | Yes, P1 | Export must identify sources and generated timestamp |
| Restart/persistence | Yes, P0 | Data must survive restart |
| Backup/restore | Yes, P1/P0 if real data | Must be P0 before real user data |

## Explicitly out of scope for first user

| Area | Status | Rationale |
|---|---|---|
| Multi-tenant production use | Deferred | Requires full auth/tenant verification |
| External AI with raw document upload | Deferred | Requires provider policy, DPA, redaction, audit |
| Automated legal filing | Deferred | High compliance risk |
| Payment or billing | Deferred | Not needed for first pilot |
| Full enterprise RBAC | Deferred | Basic gated access is enough for controlled pilot |
| Real legal advice automation | Blocked | Product must assist, not issue unsupported legal conclusions |

## Data policy

Default first-user data policy:

```yaml
data_class: synthetic_or_redacted_test_data
external_ai_raw_upload: false
real_client_data_allowed: false
audit_required: true
document_upload_required: true
source_bound_ai_required: true
```

## Scope-change rule

Any change to this scope must update:

- `FIRST_USER_READINESS_MATRIX.md`
- `PRODUCT_INVARIANTS.md` if safety is affected
- `status_bundle.first_user.final.json` before release approval
