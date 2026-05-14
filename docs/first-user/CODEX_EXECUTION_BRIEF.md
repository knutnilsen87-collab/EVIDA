# Codex Execution Brief — First User Readiness

## Objective

Make the repository first-user ready without false green.

## Bounded plan

When asked to work on first-user readiness, Codex should prefer this order:

1. Establish missing tests and docs before broad refactors.
2. Make document upload testable and safe.
3. Make source-bound AI testable and safe.
4. Make audit/provenance testable.
5. Make release gate repeatable.
6. Only then polish UI.

## Mandatory repo-health check before coding

Answer these before changing files:

```yaml
correct_package_or_layer:
canonical_contract_preserved:
duplicate_abstraction_risk:
dead_code_to_remove:
boundary_violation_risk:
new_file_justified:
easier_for_next_engineer:
```

## Mandatory validation after coding

At minimum:

```yaml
targeted_tests:
lint_or_format:
typecheck_or_build:
manual_smoke_if_ui:
status_bundle_or_matrix_updated:
repo_health_verdict: preserved
```

## Document upload work contract

If touching document upload:

- update or add a valid fixture test,
- update or add a failure-mode fixture test,
- assert the document status transition,
- assert source object creation only for ready docs,
- assert failed docs are excluded from AI,
- assert audit event is written,
- assert sensitive body text is not logged.

## AI work contract

If touching AI:

- add or update source-bound answer tests,
- add unsupported-claim blocking test,
- add prompt-injection test when relevant,
- record retrieval snapshot,
- do not rely on "model probably behaves" as evidence.

## Release gate work contract

If touching release scripts:

- keep script safe to run locally,
- do not delete existing CI behavior without replacement,
- produce machine-readable output where possible,
- fail closed on missing required artifacts.

## Response format for Codex/human handoff

```markdown
## What changed
## Why
## Tests
## Evidence
## Invariants
## Residual risk
## Rollback
## Repo-health verdict
## Recommended next action
## Fallback action
```
