# OPERATIONS_AND_HANDOFF

## Source of truth
This folder is the source of truth for the first implementation planning of **Evida Local Evidence Ingestion Engine**.

Runtime truth inside the product must be:
1. local SQLite database state
2. import events/audit log
3. generated artifacts/reports
4. case readiness report

UI is not source of truth.

## Expected local project root
Assumed monorepo-style structure:

```text
/evida
  /apps
    /evida-desktop
  /packages
    /schemas
    /local-ingestion-core
    /local-ingestion-workers
    /local-storage
    /local-search
    /evida-case-domain
    /evida-ingestion-adapter
  /docs
    /architecture
    /adr
    /runbooks
  /tests
    /unit
    /integration
    /golden-import
    /performance
```

## Who will work on this
Required responsibilities:
- Product/UX: import dashboard and review queue
- Desktop engineer: local file access, worker runtime, packaging
- Backend/domain engineer: schemas, queue, state machine, verification
- Document processing engineer: parsers, OCR, previews
- QA: golden import suite and corrupt/edge tests
- Security/privacy reviewer: local-only, logs, archive safety

## How status should be tracked
Implementation status should use a compact `status_bundle` updated at each meaningful transition.

Required fields:
- facts
- assumptions
- ambiguity_flags
- verification_state
- progress_tracking
- scope_lock
- locked_decisions
- recommended_next_action
- fallback_action
- repo_health
- closure_readiness

## What must be documented as implementation proceeds
- ADRs for core decisions
- schema definitions
- state transition table
- failure code catalog
- manual review action catalog
- worker/job contracts
- artifact layout
- test manifest
- performance baseline
- known parser/OCR limitations

## What a new developer must know first
1. This is not a normal upload feature.
2. All discovered files must receive explicit status.
3. AI cannot use material without source provenance.
4. Manual review does not equal machine-read text.
5. Import can be partial usable without being complete.
6. UI must never infer success.
7. False 100 % is a release blocker.
8. Local-only default is non-negotiable.
9. Worker isolation and crash recovery are core requirements.
10. Golden import tests define release readiness.

## Runbook expectations
Create runbooks for:
- import stuck
- OCR unavailable
- parser failure spike
- app restart recovery
- low disk space
- manual review queue workflow
- diagnostics export
- corrupt file handling
- archive safety block

## Environment/credentials/access notes
MVP should require no cloud credentials.

Local requirements:
- workspace path
- file system permissions
- bundled parser binaries/libraries
- bundled OCR binaries/models if selected
- SQLite DB path
- artifact directory path
