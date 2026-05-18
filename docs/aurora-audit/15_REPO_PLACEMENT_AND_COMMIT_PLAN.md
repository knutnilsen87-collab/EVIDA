# Repo Placement and Commit Plan

## Recommended repo location

Place these files here:

```text
docs/aurora-audit/
  09_DOCUMENT_CONTROL_BULK_PREVIEW_SPEC.md
  10_STABLE_SAKSROM_PROGRESS_SPEC.md
  11_FRONTEND_STATE_AND_COMPONENT_PLAN.md
  12_UX_COPY_DECISION_RULES.md
  13_QA_ACCEPTANCE_TESTS.md
  14_CODEX_IMPLEMENTATION_PROMPT.md
```

## Recommended branch

```text
feat/document-control-progress-ux
```

## Recommended commits

### Commit 1 — docs

```text
docs: add document control and stable progress UX specs
```

### Commit 2 — case preparation progress

```text
feat(saksrom): add stable case preparation progress component
```

### Commit 3 — document preview pane

```text
feat(document-control): open selected document in central preview pane
```

### Commit 4 — bulk selection

```text
feat(document-control): add bulk selection and safe bulk actions
```

### Commit 5 — copy and accessibility

```text
fix(ux): clarify document control copy and progress accessibility
```

### Commit 6 — tests

```text
test: add document control and case progress acceptance coverage
```

## Suggested implementation sequence

1. Add types and copy helpers.
2. Add tests for copy/logic.
3. Add `CasePreparationProgress`.
4. Replace Saksrom screen switching.
5. Add central preview pane state.
6. Add checkboxes and bulk bar.
7. Add confirmation dialog.
8. Add audit wiring.
9. Add Playwright coverage.

## Rollback plan

If changes cause instability:

1. Keep new docs.
2. Feature-flag `CasePreparationProgress`.
3. Feature-flag bulk selection in Document Control.
4. Revert UI wiring while keeping logic helpers/tests.
5. Re-enable incrementally.

## Risk labels

| Area | Risk | Reason |
|---|---|---|
| CasePreparationProgress | Medium | State must remain consistent across screens. |
| Document preview pane | Medium | Preview loading can fail for corrupt files. |
| Bulk actions | High | Affects what Saksrom can use as source material. |
| Copy changes | Low | Improves clarity, little technical risk. |
| Audit wiring | Medium | Must not lose per-document traceability. |

## Required approval before merge

- Product/design approval for copy.
- QA approval for bulk action behavior.
- Security/audit approval for source-inclusion logging.
- Accessibility check for dialogs, progress and keyboard navigation.
