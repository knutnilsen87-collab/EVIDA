# First User Approval Checklist

This checklist must be completed before a first user receives the release candidate.

## Release candidate

```yaml
release_candidate_id:
commit_sha:
build_artifact:
status_bundle:
date:
release_owner:
```

## P0 approval

| Question | Required answer | Actual | Approved? |
|---|---|---|---|
| Are all P0 rows in readiness matrix PASS? | Yes |  |  |
| Are all P0 invariants pass? | Yes |  |  |
| Are there zero broken critical invariants? | Yes |  |  |
| Are there zero untested critical invariants? | Yes |  |  |
| Is document upload valid path tested? | Yes |  |  |
| Are document upload failure modes tested? | Yes |  |  |
| Are failed docs excluded from AI? | Yes |  |  |
| Is source-bound AI tested? | Yes |  |  |
| Is unsupported claim blocking tested? | Yes |  |  |
| Is prompt injection handling tested? | Yes |  |  |
| Is audit trail verified? | Yes |  |  |
| Is rollback path documented? | Yes |  |  |
| Are known limitations visible to user? | Yes |  |  |

## Data approval

| Data class | Allowed? | Conditions |
|---|---:|---|
| Synthetic data | Yes | Default |
| Redacted test data | Yes | Explicit owner approval |
| Real client data | No by default | Requires separate security/privacy/legal approval |
| Production legal matter | No by default | Requires separate production DoD |

## Required signatures

| Role | Name | Decision | Date |
|---|---|---|---|
| Engineering owner |  | approve/reject |  |
| Product owner |  | approve/reject |  |
| Security/privacy owner |  | approve/reject/N/A |  |
| Legal/compliance owner |  | approve/reject/N/A |  |

## Final decision

```yaml
decision: rejected
allowed_use: none
residual_risk:
  - ""
conditions:
  - ""
```
