# Product Invariants

Invariants are safety contracts. They are not ordinary tests. A first-user release cannot be approved if a critical invariant is broken or untested.

## Critical invariants

| ID | Criticality | Statement | Verification | Failure effect | Owner |
|---|---|---|---|---|---|
| INV-DOC-001 | P0 | A document that fails upload, validation, extraction, OCR, or indexing must not be used as an AI source. | Negative ingestion + AI retrieval test | Block release | Document/AI |
| INV-DOC-002 | P0 | Every accepted document must have a content hash and stable document id. | Upload integration test | Block release | Document |
| INV-DOC-003 | P0 | Every source-bound AI answer must reference source objects derived from accepted documents. | AI citation/source test | Block release | AI |
| INV-DOC-004 | P0 | User must see whether a document is ready, failed, OCR-needed, or excluded. | UI smoke/e2e | Block release | Product/UI |
| INV-DATA-001 | P0 | Sensitive case/document content must not be written to logs. | Log scan/unit test | Block release | Platform/Security |
| INV-DATA-002 | P0 | Local data persistence must survive app restart without corruption. | Restart smoke | Block release | Desktop |
| INV-AI-001 | P0 | AI must not present unsupported factual or legal claims as established facts. | Unsupported-claim eval | Block release | AI |
| INV-AI-002 | P0 | Prompt injection inside uploaded documents must not override system policy. | Prompt injection eval | Block release | AI/Security |
| INV-AUDIT-001 | P0 | Upload, AI answer, export, deletion, and policy changes must create audit events. | Audit integration test | Block release | Platform |
| INV-AUDIT-002 | P0 | Audit tampering must be detectable. | Tamper test | Block release | Platform |
| INV-CONFIG-001 | P0 | External AI raw document upload must be disabled by default. | Config test | Block release | Platform/AI |
| INV-CONFIG-002 | P0 | Prod-unsafe local-dev mode must not be enabled in a first-user release without explicit pilot labeling. | Startup/config test | Block release | Platform |
| INV-EXPORT-001 | P1 | Exported reports must include timestamp, case id, and source basis. | Export smoke | Hold or approve with limitation | Product |
| INV-BACKUP-001 | P1/P0 | Backup/restore must preserve documents, source objects, and audit trail before any real user data is allowed. | Restore test | Block real-data approval | Platform |

## Invariant evaluation values

| Value | Meaning |
|---|---|
| `pass` | Verified with current release candidate |
| `fail` | Broken |
| `incomplete` | Test missing, inconclusive, or not run |
| `deferred` | Outside first-user scope with approved rationale |

## Release rule

P0 invariants cannot be `fail`, `incomplete`, or `deferred`.

P1 invariants may be `incomplete` only if:

- the limitation is outside the approved first-user data policy,
- the user is warned,
- the status bundle records residual risk,
- the approval checklist accepts the risk.

## Suggested artifact

```text
artifacts/first-user/invariant_evaluation.first_user.json
```
