# Security Foundation Status

Reviewed: 2026-05-11

## Current evaluation-build controls

- Sensitive legal text fields are encrypted with AES-256-GCM before storage.
- Key resolution prefers Windows Credential Manager, then environment variable, then local fallback file.
- Audit events are hash-chained per case and can be verified.
- External AI is off by default.
- Sending source excerpts is off by default.
- Full document sending is off by default.
- Settings copy states that the build is not approved for real client data.
- Diagnostics are redacted by design and must not include full document text or sensitive chat content.

## Current production blockers

- Full-file SQLCipher/database encryption is not complete.
- Production auth/RBAC/tenant isolation is not complete.
- External provider policy is documented and locally gated, but not an enterprise policy service yet.
- Backup/restore policy is not complete.

## Release rule

Evaluation builds may ship with this status only if the release notes say:

```text
Testdata only. Not approved for real client data. Sensitive fields are encrypted, but full database encryption and enterprise controls are not complete.
```

Production or real-client-data builds must not ship until the blockers above are closed or formally accepted by CTO/product owner.

