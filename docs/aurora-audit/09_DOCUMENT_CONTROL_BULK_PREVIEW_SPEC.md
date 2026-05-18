# Document Control — Bulk Selection and Central Preview Spec

## Goal

Make Document Control fast, safe and understandable.

The screen should help users answer:

```text
Can this document be used as source material in Saksrom?
```

The user is **not** approving the legal truth of the content. The user is only deciding whether the document can be included in the case source foundation.

## Current UX issue

The current Document Control direction has the right concept, but it risks becoming too slow when many documents require manual review.

The user needs to:

- click a document
- instantly see preview in the central area
- understand why the document was stopped
- choose a safe action
- bulk-handle multiple similar documents when appropriate

## Target layout

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Document Control                                                     │
│ 13 documents left · 97 ready for Saksrom                             │
│ You are not approving the legal truth of the content.                │
│ You decide only whether the document may be used as source material. │
├───────────────────────┬──────────────────────────────┬───────────────┤
│ Control queue          │ Preview                      │ Decision      │
│                       │                              │               │
│ [ ] IMG_001.jpg       │ [PDF/image preview]          │ Why stopped?  │
│ [ ] IMG_002.jpg       │                              │ What to check │
│ [x] IMG_003.jpg       │ [Text/source excerpts]       │ Safe actions  │
│ [x] IMG_004.jpg       │                              │               │
│                       │                              │ [Run OCR]     │
│ Filter: OCR needed    │                              │ [Use as source]│
│                       │                              │ [Exclude]     │
└───────────────────────┴──────────────────────────────┴───────────────┘
```

## Component structure

```text
DocumentControlScreen
  DocumentControlHeader
  DocumentControlProgressSummary
  DocumentStatusFilter
  BulkSelectionBar
  DocumentControlQueue
    DocumentControlQueueItem
  DocumentPreviewPane
    DocumentPreviewToolbar
    DocumentPreviewContent
    ExtractedTextPanel
    SourceExcerptPanel
    TechnicalDetailsPanel
  DocumentDecisionPanel
  BulkConfirmDialog
  DocumentControlKeyboardShortcuts
```

## Left pane: Control queue

### Requirements

Each row must include:

- checkbox
- filename
- status reason
- compact metadata
- selected/active state
- whether preview is available
- whether bulk actions are allowed

### Example row

```text
[ ] IMG_HARD_0010_scan.jpg
    OCR needed · page lacks machine-readable text
```

Selected active row:

```text
> [x] IMG_HARD_0010_scan.jpg
```

### Filters

Add filter chips at the top:

```text
All 13
OCR needed 8
Missing text 3
Import failed 1
Partial source 1
```

Add a "select visible" option:

```text
Select all in current filter
```

Important copy:

```text
Only documents visible in the current filter will be selected.
```

## Center pane: Preview

The central preview pane is the main work area.

### Default state

```text
Select a document to preview its content.
```

### Loading state

```text
Loading preview…
```

### Preview available

Show:

- PDF/image/text preview
- document filename
- status badge
- pages
- pages waiting for text
- source excerpt count
- source coverage
- tabs:
  - Preview
  - Text excerpt
  - Source excerpts
  - Technical details

### Example

```text
PDF_HARD_0017_økonomi.pdf
Needs OCR or text review

12 pages · 2 pages waiting for text · 10 source excerpts · 83% source coverage

[Preview] [Text] [Sources] [Technical details]

[Document preview here]
```

### Error state

```text
Preview could not be opened.

This may happen if the file is corrupt, missing or unsupported.

[Open externally] [Upload replacement] [Keep outside source material]
```

## Right pane: Decision panel

The decision panel must explain:

1. why Evida stopped the document
2. what the user should check
3. what each action means

### Base copy

```text
Decision

Why does this need control?
Evida found pages without machine-readable text. Saksrom cannot use the entire document safely yet.

What should you check?
Open the preview. If this is the right document and it belongs in the case, run OCR or mark it as manually controlled. If the document is wrong, unreadable or irrelevant, keep it outside the source material.

Important:
You are not approving the content as legally true.
You are deciding whether the document may be used as source material in Saksrom.
```

### Actions

Default actions:

```text
[Run OCR]
[Mark as controlled and use as source]
[Keep outside source material]
```

For corrupt/import-failed documents:

```text
[Upload replacement]
[Keep outside source material]
```

Do not show "use as source" as a primary action when the document is corrupt, unavailable or has no preview.

## Bulk selection

### When to show bulk bar

Show `BulkSelectionBar` when one or more documents are checked.

### Bulk bar copy

```text
4 documents selected

[Open first] [Run OCR for selected] [Mark selected as controlled] [Keep selected outside]
```

### Allowed bulk actions

Bulk actions should be status-aware.

```ts
type BulkAction =
  | "open_first"
  | "run_ocr_for_selected"
  | "mark_selected_controlled"
  | "exclude_selected"
  | "upload_replacement";
```

### Safe bulk rules

Bulk "mark selected as controlled" is allowed when:

- all selected documents are explicitly selected by the user
- none are corrupt
- none are missing preview
- none have hard import failure
- action is confirmed

Bulk "run OCR for selected" is preferred when all selected documents have `needs_ocr`.

Bulk "exclude selected" is allowed for most problem states, but still logged.

### Bulk rules pseudocode

```ts
function getAllowedBulkActions(selectedDocs: ControlledDocument[]): BulkAction[] {
  if (selectedDocs.length === 0) return [];

  if (selectedDocs.some(doc => doc.status === "corrupt" || doc.status === "import_failed")) {
    return ["open_first", "exclude_selected", "upload_replacement"];
  }

  if (selectedDocs.every(doc => doc.status === "needs_ocr")) {
    return ["open_first", "run_ocr_for_selected", "exclude_selected"];
  }

  if (selectedDocs.every(doc => doc.previewAvailable)) {
    return ["open_first", "mark_selected_controlled", "exclude_selected"];
  }

  return ["open_first", "exclude_selected"];
}
```

## Bulk confirmation dialog

Use confirmation only for actions that make documents available to Saksrom.

### Dialog

```text
Mark 7 documents as controlled?

This means:
- These documents may be used as source material in Saksrom.
- The content is not approved as legally true.
- The action will be recorded in the audit log.

Selected documents:
- IMG_HARD_0010_scan.jpg
- IMG_HARD_0009_scan.jpg
- IMG_HARD_0008_scan.jpg
...

[ ] I have checked that these documents may be included in the case source material.

[Mark 7 as controlled] [Cancel]
```

### Do not require confirmation for every single-document action

Single-document action should be fast:

```text
✓ Saved. Next document opened.
```

## Keyboard shortcuts

Add optional shortcut hints for power users:

```text
↑ / ↓       Previous/next document
Space       Select/unselect
Enter       Open preview
O           Run OCR
B           Mark as controlled/use as source
H           Keep outside source material
A           Select all in current filter
Esc         Clear selection/close dialog
```

Show discreetly:

```text
Shortcuts: Space select · O OCR · B use as source · H keep outside
```

## State types

```ts
export type DocumentControlStatus =
  | "needs_ocr"
  | "missing_text"
  | "partial_source"
  | "import_failed"
  | "corrupt"
  | "duplicate"
  | "ready"
  | "excluded"
  | "manually_controlled";

export type DocumentControlAction =
  | "run_ocr"
  | "mark_controlled_use_as_source"
  | "exclude_from_sources"
  | "upload_replacement"
  | "keep_existing"
  | "open_preview";

export type SelectionState = {
  selectedDocumentIds: string[];
  activeDocumentId: string | null;
  filter: DocumentControlStatus | "all";
};
```

## Audit requirements

Every decision must be audit logged:

```text
document_control.action
document_id
case_id
previous_status
new_status
action
user_id or local actor
timestamp
reason
bulk_action_id if applicable
selected_count if bulk
```

## Acceptance criteria

- User can click a document and see preview in the center pane without navigating away.
- User can select multiple documents with checkboxes.
- Bulk bar appears when one or more documents are selected.
- Bulk actions are status-aware.
- Bulk "mark as controlled" requires confirmation and explanatory copy.
- Corrupt/import-failed documents cannot be bulk-marked as controlled.
- After single-document decision, next document opens automatically.
- Decision language never implies legal approval of truth.
- All decisions are audit logged.
