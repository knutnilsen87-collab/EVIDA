# Auth And Security Status

## Current status
Security is documented as a boundary, not fully implemented as production control.

## Existing security truth
- `SECURITY.md` prohibits real client data.
- Root ADRs define local-first and provider-policy expectations.
- Tauri CSP is configured in `src-tauri/tauri.conf.json`.
- Production-boundary verifier exists and passes.

## Missing production controls
- Real authentication.
- Authorization/RBAC.
- Tenant/user isolation.
- Encrypted local storage.
- Tamper-evident audit logs.
- AI provider enforcement.
- Secret scanning and dependency scanning gates.
- Release signing and vulnerability intake.

## Security conclusion
Safe for local evaluation with approved test material only. Not safe for real legal client data.
