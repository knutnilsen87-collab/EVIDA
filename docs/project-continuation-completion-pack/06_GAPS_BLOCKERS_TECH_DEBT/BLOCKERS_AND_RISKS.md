# Blockers And Risks

## Hard blockers for production
1. No production auth/RBAC/tenant isolation.
2. No verified encrypted local data storage.
3. No fully implemented audit hash-chain storage/verification.
4. No enforced AI provider policy.
5. No release signing/SBOM/security scan gate.
6. Deprecated FastAPI starter still exists and can confuse ownership.

## Product risks
- Users may over-trust generated summaries without enough source/evaluation safeguards.
- Legal workflows can look finished before legal QA is complete.
- Too many docs/phases can cause implementation drift.

## Operational risks
- Local release artifacts may work on the build machine but not clean machines.
- No public vulnerability intake.
- No full backup/restore policy.
