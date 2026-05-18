# CasePilot / Evida — Follow-up UX Implementation Specs

**Purpose:** Developer-ready Markdown package for the two latest UX decisions:

1. **Document Control should support fast preview + checkbox/bulk actions.**
2. **Saksrom should not switch between two large screen states while import/preparation runs.**
   It should keep the layout stable and show a compact progress bar with ETA, document count, page count, source count and current phase.

Recommended repo placement:

```text
docs/aurora-audit/
  09_DOCUMENT_CONTROL_BULK_PREVIEW_SPEC.md
  10_STABLE_SAKSROM_PROGRESS_SPEC.md
  11_FRONTEND_STATE_AND_COMPONENT_PLAN.md
  12_UX_COPY_DECISION_RULES.md
  13_QA_ACCEPTANCE_TESTS.md
  14_CODEX_IMPLEMENTATION_PROMPT.md
  15_REPO_PLACEMENT_AND_COMMIT_PLAN.md
```

## Product principle

Evida should feel like a calm, legally careful desktop workspace.

The user should always understand:

```text
What is happening?
What can I do now?
Why is this the safe next action?
What will happen if I click?
```

## Main problems observed

### 1. Document Control is too slow for many documents

Current direction is good, but the workflow needs to support:

- selecting multiple documents with checkboxes
- bulk handling similar documents
- clicking a document and seeing the preview immediately in the central preview area
- making one clear decision per document
- moving automatically to the next document after action

### 2. Saksrom changes between two large visual states during import

The user sees one screen while the case is being prepared, then a different screen when the summary appears. This creates layout shift and makes the app feel unstable.

Desired behavior:

- keep Saksrom layout stable
- show a compact progress component
- keep the summary area as a placeholder until ready
- show a preliminary summary only when there are enough controlled sources
- make chat availability clear: locked, partial, or ready

## Recommended implementation order

1. Implement `CasePreparationProgress` and stable Saksrom preparation state.
2. Replace large screen-state switching with stable placeholder/skeleton.
3. Implement Document Control preview pane in the central area.
4. Add checkboxes and bulk selection bar.
5. Add safe bulk confirmation dialog for "mark as controlled".
6. Add copy/state rules so "Next best action" always matches the actual state.
7. Add QA tests for progress, layout stability, preview, bulk handling and copy.

## Non-goals

- Do not redesign the whole app again.
- Do not add new AI behavior before the control flow is clear.
- Do not hide risk states.
- Do not use "bulk godkjenn" as user-facing language.

## Key language rule

Avoid:

```text
Godkjenn dokumenter
Bulk godkjenn
Godkjenn som kilde
```

Prefer:

```text
Marker som kontrollert
Bruk som kildegrunnlag
Marker valgte som kontrollert
Hold utenfor kildegrunnlaget
Kjør OCR for valgte
```

## Definition of Done

- The user can control 20+ documents quickly without opening separate pages/modals for each one.
- Clicking a document immediately loads preview in the center pane.
- Selecting multiple documents shows a bulk action bar.
- Bulk "mark controlled" requires clear confirmation.
- Saksrom does not visually jump between large states during import.
- Import/preparation progress always shows: documents, pages, sources, phase and ETA if available.
- Chat input explains whether Saksrom is locked, partial or ready.
- "Next best action" never contradicts import/preparation state.
