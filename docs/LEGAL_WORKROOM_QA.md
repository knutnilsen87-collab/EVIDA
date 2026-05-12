# Legal Workroom QA

Reviewed: 2026-05-11

## Workrooms in scope

- Chronology
- Evidence
- Arguments
- Contradictions
- Risk
- Litigation simulation

## Quality requirements

- Every generated workroom item must remain tied to the active case.
- Workroom output must be marked as draft/control material.
- Source-backed items must carry source IDs.
- Risk and quality-control surfaces must require stronger readiness than simple chronology/evidence drafting.
- Export-ready output must include source coverage and known limitations.

## Current implementation status

The product surfaces exist and are covered by local command/workflow tests. They are suitable for evaluation with test material.

They still need legal subject-matter review before production use.

## Manual QA path

```text
Create test case -> import approved test material -> open Saksrom -> ask a question -> open source -> build chronology -> build evidence -> find contradictions -> assess risk -> inspect export/control copy
```

Expected result: the same active case remains scoped throughout, no duplicate write window is created for the same case, and every view states or implies draft/control status.

