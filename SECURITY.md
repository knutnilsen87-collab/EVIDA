# Security

Status: pre-alpha technical scaffold. This repository is not production-ready and is not approved for real client data.

Evida handles legal data. Treat all documents, extracted text, chunks, embeddings, prompts, answers and audit records as sensitive unless explicitly proven otherwise.

## Current Allowed Data

Use only:

- synthetic test data
- sample documents approved for testing
- non-client evaluation material

Do not use:

- real client documents
- regulated legal matters
- confidential client information
- production secrets

## Security Boundary

The production boundary is documented in:

- `ARCHITECTURE.md`
- `DECISIONS/ADR-001-backend-ownership.md`
- `DECISIONS/ADR-002-local-first-data-policy.md`
- `DECISIONS/ADR-003-ai-provider-policy.md`
- `DECISIONS/ADR-004-audit-hash-chain.md`

## Required Production Controls

Before production use, the project must implement and verify:

- secure-by-default configuration
- authentication and authorization
- tenant/user isolation
- encrypted local data storage
- tamper-evident audit logs
- controlled AI provider policy
- source-grounded AI answers
- prompt-injection resistance
- backup and restore procedures
- dependency and secret scanning

Some CI scanning exists, but this does not make the product production-ready.

## AI and Cloud Processing

Default rule:

```text
No raw legal documents, document text, chunks or embeddings may be sent to external AI/cloud services without an explicit approved policy and user/admin action.
```

AI provider policy is owned by the Spring Boot control plane when production controls are implemented.

## Secrets

Do not commit:

- API keys
- `.env` files
- private keys
- production database credentials
- client data
- generated logs containing document content

Use `.env.example` only for non-secret placeholders.

## Logging

Logs must not contain:

- document text
- chunks
- embeddings
- personal data
- client names or legal strategy

Diagnostics must be redacted before sharing.

## Reporting Security Issues

This repository currently has no public vulnerability intake process. For now, report security issues to the repository owner privately and do not open public issues containing sensitive details.
