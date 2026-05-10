# Data And API Status

## Current data posture
Evaluation/test data only. Real client data is explicitly out of scope.

## Local app data behavior
The desktop app supports local import and local case/workflow state for evaluation. Production storage guarantees such as encryption, backup/restore and retention policy are not complete.

## API status
- Desktop app has local/frontend API abstractions in `src/lib/api.ts`.
- Spring Boot service is the planned authoritative backend for production control-plane responsibilities.
- FastAPI starter must not own production enterprise policy.

## Missing before production
- Clear database migration story.
- Authenticated API boundary.
- Tenant/user isolation.
- Encrypted data at rest.
- Redacted logging and operational observability policy.
