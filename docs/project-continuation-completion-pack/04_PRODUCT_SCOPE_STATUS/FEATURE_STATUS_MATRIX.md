# Feature Status Matrix

| Feature | Status | Notes |
| --- | --- | --- |
| Desktop app shell | Implemented | Tauri + React, build passes. |
| Intro/login/guided flow | Implemented for evaluation | Not production auth. |
| Document import | Implemented locally | Needs production storage/security hardening. |
| Processing progress/ETA | Implemented | Covered by processing tests. |
| Saksrom chat | Implemented | Chat-first behavior documented. |
| Saksrom readable summary | Implemented | Recent readability pass done. |
| Source-bound answer metadata | Implemented/partial | Needs stronger evaluation before production. |
| Suggested actions/adaptive workstyle | Implemented | Covered by adaptive Saksrom tests. |
| Legal commands | Implemented | Covered by legal command tests. |
| Workrooms | Implemented as product surfaces | Need deeper legal QA and export workflow. |
| Settings/security screens | Implemented/partial | Not equivalent to production security. |
| Spring Boot control plane | Planned/partial | Canonical owner, not fully productized. |
| Auth/RBAC/tenant isolation | Missing | Required before production. |
| Encryption/audit hash chain enforcement | Missing/partial | Required before real client data. |
| Release signing/SBOM | Missing | Required before public production distribution. |
