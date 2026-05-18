# Codex Prompt — Implement Document Control Bulk Preview and Stable Saksrom Progress

You are working on the Evida / CasePilot desktop app.

## Goal

Implement two UX improvements:

1. **Document Control should support fast central preview and bulk handling.**
2. **Saksrom should not switch between large screen states while import/preparation runs.**
   It should keep layout stable and show a compact progress bar with ETA, document count, page count, source count and current phase.

## Product constraints

- This is a legal/workflow product.
- Do not use language implying legal approval of document truth.
- Do not use "bulk godkjenn" or "godkjenn som kilde" in user-facing UI.
- Use "Marker som kontrollert", "Bruk som kildegrunnlag", and "Hold utenfor kildegrunnlaget".
- Do not make unrelated visual redesigns.
- Keep changes minimal, isolated and testable.
- Do not touch secrets, credentials or production configs.
- Show diffs before final.
- Preserve existing app behavior unless explicitly changed by this prompt.

## UX requirements

### Stable Saksrom progress

Replace large state-switching during import with a stable compact progress component.

Create or update:

```text
CasePreparationProgress
```

It must show:

- current phase
- processed documents / total documents
- processed pages / total pages
- source excerpt count
- unreadable pages if available
- review-required count if available
- ETA if available
- progress bar

Expected copy while import runs:

```text
Import pågår
Evida leser dokumentene og lager sporbare kilder.
11 av 125 dokumenter · 62 av 566 sider · 211 kildeutdrag · ca. 4 min igjen
Nå: Henter tekst
```

Saksrom layout must remain stable:

- do not mount/unmount large alternative screens during import
- keep summary area as placeholder until ready
- show preliminary summary only when enough controlled sources exist
- final summary appears only when summarization is complete

Chat input placeholder must follow readiness:

```text
locked: "Saksrom åpnes når dokumentgrunnlaget er klart nok"
partial: "Spør Saksrom — svar bygger bare på kontrollerte kilder"
ready: "Spør Saksrom om saken, kildene eller neste steg"
```

Next best action must follow readiness:

```text
import running -> "Import pågår"
review required -> "Kontroller dokumenter"
partial ready -> "Spør Saksrom med kontrollerte kilder"
ready -> "Spør Saksrom"
```

### Document Control central preview

Document Control should have three zones:

```text
Left: control queue with checkboxes
Center: preview pane
Right: decision panel
```

When the user clicks a document in the left queue:

- set it as active document
- immediately load preview in the center pane
- update decision panel
- do not navigate away

The center pane must never be empty/black.
It must show one of:

```text
Select a document
Loading preview
Preview available
Preview error
```

### Bulk selection

Add checkbox selection to the document queue.

When one or more documents are selected, show a bulk selection bar:

```text
4 documents selected
[Open first] [Run OCR for selected] [Mark selected as controlled] [Keep selected outside]
```

Bulk actions must be status-aware.

Do not allow corrupt/import-failed documents to be bulk-marked as controlled.

Bulk "mark selected as controlled" must show confirmation:

```text
Marker 7 dokumenter som kontrollert?

Dette betyr:
- Dokumentene kan brukes som kildegrunnlag i Saksrom.
- Innholdet blir ikke vurdert som juridisk sant.
- Handlingen blir logget i audit-loggen.

[ ] Jeg har kontrollert at dokumentene kan inngå i saken.

[Marker 7 som kontrollert] [Avbryt]
```

After action:

- audit log action
- update document statuses
- clear selection
- select next unresolved document
- show toast: "✓ Lagret. Neste dokument åpnet."

## Suggested TypeScript types

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

## Suggested components

```text
src/features/casePreparation/
  CasePreparationProgress.tsx
  casePreparation.types.ts
  casePreparation.logic.ts
  casePreparation.copy.ts

src/features/documentControl/
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
```

## Acceptance criteria

### Stable Saksrom

- Saksrom screen does not switch between two large layouts while import runs.
- A compact progress component shows documents, pages, source count, phase and ETA.
- Summary area remains stable with placeholder until ready.
- Preliminary summary is labeled as preliminary.
- Chat input copy matches locked/partial/ready state.
- "Next best action" shows "Import pågår" during import.
- No layout jump when progress updates.

### Document Control

- Clicking a document opens preview in the center pane.
- Center pane is never empty/black.
- Queue items have checkboxes.
- Bulk selection bar appears when documents are selected.
- Bulk actions are status-aware.
- Bulk "mark controlled" requires confirmation.
- Corrupt/import-failed documents cannot be bulk-marked as controlled.
- All decisions are audit logged.
- After a single action, next unresolved document opens automatically.
- Copy does not imply legal approval of document truth.

## Tests to add

- Unit tests for `getAllowedBulkActions`.
- Unit tests for `getNextBestAction`.
- UI test: progress component appears during import.
- UI test: Saksrom layout remains stable during import.
- UI test: clicking document loads preview.
- UI test: checkbox selection shows bulk bar.
- UI test: bulk mark controlled opens confirmation.
- UI test: corrupt document cannot be bulk-marked as controlled.

## Do not do

- Do not add external AI calls.
- Do not change security model.
- Do not add unrelated redesign.
- Do not hide risk states.
- Do not use "godkjenn" as primary user-facing language.
