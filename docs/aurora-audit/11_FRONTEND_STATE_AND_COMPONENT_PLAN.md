# Frontend State and Component Implementation Plan

## Goal

Implement two improvements safely:

1. Stable Saksrom progress component.
2. Fast Document Control with preview and bulk selection.

This file describes suggested TypeScript types, components, state flow and update sequence.

## Suggested file structure

```text
src/
  features/
    casePreparation/
      CasePreparationProgress.tsx
      casePreparation.types.ts
      casePreparation.logic.ts
      casePreparation.copy.ts
    documentControl/
      DocumentControlScreen.tsx
      DocumentControlQueue.tsx
      DocumentControlQueueItem.tsx
      DocumentPreviewPane.tsx
      DocumentDecisionPanel.tsx
      BulkSelectionBar.tsx
      BulkConfirmDialog.tsx
      documentControl.types.ts
      documentControl.logic.ts
      documentControl.copy.ts
  components/
    ui/
      ProgressBar.tsx
      StatusPill.tsx
      EmptyState.tsx
      Button.tsx
      Dialog.tsx
```

## Case preparation types

```ts
export type CasePreparationState =
  | "idle"
  | "import_running"
  | "extracting_text"
  | "creating_sources"
  | "summarizing"
  | "partial_ready"
  | "ready"
  | "review_required"
  | "failed";

export type SaksromScope =
  | "locked"
  | "controlled_sources_only"
  | "full_case";

export type CasePreparationProgress = {
  state: CasePreparationState;
  totalDocuments: number;
  processedDocuments: number;
  totalPages: number;
  processedPages: number;
  sourceCount: number;
  unreadablePages: number;
  reviewRequiredCount: number;
  excludedCount: number;
  etaSeconds?: number;
  currentPhaseLabel: string;
  canAskSaksrom: boolean;
  saksromScope: SaksromScope;
};
```

## Case preparation copy logic

```ts
export function getNextBestAction(progress: CasePreparationProgress): {
  label: string;
  description?: string;
  action?: "open_document_control" | "ask_saksrom" | "view_progress";
} {
  if (
    progress.state === "import_running" ||
    progress.state === "extracting_text" ||
    progress.state === "creating_sources"
  ) {
    return {
      label: "Import pågår",
      description: `${progress.processedDocuments}/${progress.totalDocuments} dokumenter behandlet`,
      action: "view_progress",
    };
  }

  if (progress.reviewRequiredCount > 0 || progress.state === "review_required") {
    return {
      label: "Kontroller dokumenter",
      description: `${progress.reviewRequiredCount} dokumenter trenger vurdering`,
      action: "open_document_control",
    };
  }

  if (progress.state === "partial_ready") {
    return {
      label: "Spør Saksrom",
      description: "Svar bygger bare på kontrollerte kilder",
      action: "ask_saksrom",
    };
  }

  if (progress.state === "ready") {
    return {
      label: "Spør Saksrom",
      description: "Saksgrunnlaget er klart",
      action: "ask_saksrom",
    };
  }

  if (progress.state === "failed") {
    return {
      label: "Se behandlingsstatus",
      description: "Import eller behandling stoppet",
      action: "view_progress",
    };
  }

  return {
    label: "Importer dokumenter",
  };
}
```

## Chat input copy

```ts
export function getSaksromInputPlaceholder(progress: CasePreparationProgress): string {
  if (progress.saksromScope === "locked") {
    return "Saksrom åpnes når dokumentgrunnlaget er klart nok";
  }

  if (progress.saksromScope === "controlled_sources_only") {
    return "Spør Saksrom — svar bygger bare på kontrollerte kilder";
  }

  return "Spør Saksrom om saken, kildene eller neste steg";
}
```

## CasePreparationProgress component behavior

### Props

```ts
type CasePreparationProgressProps = {
  progress: CasePreparationProgress;
  compact?: boolean;
  onOpenDetails?: () => void;
  onRunInBackground?: () => void;
};
```

### Requirements

- fixed/stable height
- no focus stealing
- progress bar with accessible labels
- ETA displayed when available
- phase chips optional
- "View details" as secondary action only

## Document Control types

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

export type ControlledDocument = {
  id: string;
  fileName: string;
  status: DocumentControlStatus;
  reasonLabel: string;
  reasonDescription: string;
  pages?: number;
  pagesWaitingForText?: number;
  sourceCount?: number;
  sourceCoveragePercent?: number;
  previewAvailable: boolean;
  canUseAsSource: boolean;
  canRunOcr: boolean;
  canUploadReplacement: boolean;
};

export type SelectionState = {
  activeDocumentId: string | null;
  selectedDocumentIds: string[];
  filter: DocumentControlStatus | "all";
};
```

## Document Control actions

```ts
export type DocumentControlAction =
  | "run_ocr"
  | "mark_controlled_use_as_source"
  | "exclude_from_sources"
  | "upload_replacement"
  | "keep_existing"
  | "open_preview";

export type BulkAction =
  | "open_first"
  | "run_ocr_for_selected"
  | "mark_selected_controlled"
  | "exclude_selected"
  | "upload_replacement";
```

## Bulk action logic

```ts
export function getAllowedBulkActions(selectedDocs: ControlledDocument[]): BulkAction[] {
  if (selectedDocs.length === 0) return [];

  if (selectedDocs.some(doc => doc.status === "corrupt" || doc.status === "import_failed")) {
    return ["open_first", "exclude_selected", "upload_replacement"];
  }

  if (selectedDocs.every(doc => doc.status === "needs_ocr")) {
    return ["open_first", "run_ocr_for_selected", "exclude_selected"];
  }

  if (selectedDocs.every(doc => doc.previewAvailable && doc.canUseAsSource)) {
    return ["open_first", "mark_selected_controlled", "exclude_selected"];
  }

  return ["open_first", "exclude_selected"];
}
```

## DocumentControlScreen state flow

### On screen open

- filter defaults to first status with documents requiring action
- active document is first visible document
- selected documents is empty
- preview loads for active document

### On queue item click

- set `activeDocumentId`
- load preview in center pane
- do not select checkbox automatically unless user clicks checkbox

### On checkbox click

- toggle document in `selectedDocumentIds`
- show bulk bar if selection count > 0

### On single-document action

- execute action
- audit log action
- remove document from current queue if resolved
- select next unresolved document
- show toast: `✓ Lagret. Neste dokument åpnet.`

### On bulk action

- show confirmation if action is `mark_selected_controlled`
- execute allowed action
- audit log one bulk event plus per-document events
- remove resolved documents from queue
- clear selection
- select next unresolved document

## Preview pane behavior

Always show one of:

```text
- Select a document
- Loading preview
- Preview available
- Preview error
```

Never leave the central preview pane empty or black.

## Decision panel behavior

Decision panel should be status-aware.

### `needs_ocr`

Primary:

```text
Kjør OCR
```

Secondary:

```text
Marker som kontrollert og bruk som kilde
Hold utenfor kildegrunnlaget
```

### `corrupt` or `import_failed`

Primary:

```text
Last opp ny kopi
```

Secondary:

```text
Hold utenfor kildegrunnlaget
```

Do not show "mark as controlled" as primary.

### `partial_source`

Primary:

```text
Marker som kontrollert og bruk som kilde
```

Secondary:

```text
Kjør OCR
Hold utenfor kildegrunnlaget
```

## Implementation steps

1. Add shared types for preparation and document control.
2. Implement `CasePreparationProgress`.
3. Replace Saksrom screen switching with stable progress + summary placeholder.
4. Implement `DocumentPreviewPane` and wire queue click to active preview.
5. Add checkbox selection to queue items.
6. Add `BulkSelectionBar`.
7. Add `BulkConfirmDialog` for "mark selected controlled".
8. Add audit event wiring.
9. Add tests.

## Acceptance criteria

- Component state is centralized and predictable.
- No duplicate progress calculations across screens.
- No empty central preview area.
- Bulk action availability is derived from selected document statuses.
- Decision panel is status-aware.
- All user-facing copy avoids legal ambiguity.
