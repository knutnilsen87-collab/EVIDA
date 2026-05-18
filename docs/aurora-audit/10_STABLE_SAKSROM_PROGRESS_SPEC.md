# Stable Saksrom Progress — No Large Screen Switching

## Goal

Saksrom should not switch between large visual states while import/preparation runs.

Instead, keep the Saksrom layout stable and show a compact, persistent progress component with:

- phase
- document count
- page count
- source count
- unreadable pages
- review count
- ETA
- current safe user action

## Current UX issue

The app currently appears to switch between:

1. a large "Saksoppsummering genereres / saken klargjøres" state
2. a finished "Saksoppsummering" state

This creates layout shift and makes the app feel unstable or confusing.

The desired progress display:

```text
Import pågår · 11/125 dokumenter · 62/566 sider · 211 kilder · ca. 4 min igjen
██████░░░░░░░░░░░ 9%
```

## UX principle

The user should always understand:

```text
What is happening now?
How far has it progressed?
Can I ask Saksrom yet?
What happens next?
```

## Target behavior

### While import/preparation is running

Keep the layout stable.

Show:

```text
Import pågår

Evida leser dokumentene og lager sporbare kilder.

11 av 125 dokumenter behandlet
62 av 566 sider analysert
211 kildeutdrag laget
Ca. 4 min igjen

Nå: Henter tekst fra dokumenter
[████████░░░░░░░░░░░] 9 %
```

### Summary area while not ready

Do not show a fake or unstable summary.

Show a placeholder:

```text
Saksoppsummering kommer her

Evida lager saksoppsummeringen når dokumentgrunnlaget er klart nok.
Du kan følge importen over.
```

### Partial ready

When some controlled sources are available:

```text
Foreløpig saksoppsummering

Bygger på 11 kontrollerte dokumenter.
114 dokumenter behandles fortsatt.
Svar fra Saksrom bygger bare på kontrollerte kilder.
```

### Ready

When summary is complete:

```text
Saksoppsummering
...
```

## Component

Create:

```text
CasePreparationProgress
```

Use it in:

```text
Saksrom
Documents
Document Control
```

The same progress data should drive all views.

## Recommended placement

In Saksrom, place it inside the main Saksrom card, below the safety chips and above the summary area.

Do not create a separate large "case preparation" card that competes with the summary.

```text
Saksrom
Ny sak – 2026-05-16

[Safety chips]

[CasePreparationProgress]

[Summary placeholder / preliminary summary / completed summary]

[Chat input]
```

## Compact visual variant

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Import pågår                                                        │
│ 11/125 dokumenter · 62/566 sider · 211 kilder · ca. 4 min igjen      │
│ ███████░░░░░░░░░░░░ 9%                                               │
│ Nå: Henter tekst                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## State model

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
  saksromScope: "locked" | "controlled_sources_only" | "full_case";
};
```

## Progress percentage

Use backend progress if available. If frontend must calculate it, use stable weighted progress:

```ts
function getPreparationPercent(progress: CasePreparationProgress): number {
  const documentWeight = 0.35;
  const pageWeight = 0.45;
  const sourceWeight = 0.20;

  const documentRatio = safeRatio(progress.processedDocuments, progress.totalDocuments);
  const pageRatio = safeRatio(progress.processedPages, progress.totalPages);

  const sourceRatio =
    progress.processedPages > 0 && progress.sourceCount > 0
      ? Math.min(1, progress.sourceCount / Math.max(progress.processedPages, 1))
      : 0;

  return Math.round(
    100 * (
      documentWeight * documentRatio +
      pageWeight * pageRatio +
      sourceWeight * sourceRatio
    )
  );
}

function safeRatio(done: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(1, done / total));
}
```

## ETA

Use a moving average, not instant rate.

```ts
type EtaState = {
  startedAt: number;
  lastUpdatedAt: number;
  processedUnits: number;
  totalUnits: number;
};

function estimateEtaSeconds(state: EtaState): number | undefined {
  const elapsedSeconds = (Date.now() - state.startedAt) / 1000;
  if (elapsedSeconds < 3 || state.processedUnits <= 0) return undefined;

  const unitsPerSecond = state.processedUnits / elapsedSeconds;
  const remainingUnits = Math.max(0, state.totalUnits - state.processedUnits);

  if (unitsPerSecond <= 0) return undefined;
  return Math.round(remainingUnits / unitsPerSecond);
}
```

Copy when ETA is unknown:

```text
Estimerer tid …
```

Copy when ETA is short:

```text
Under 1 min igjen
```

## Next best action rules

### While import runs

```text
Neste steg
Import pågår
```

### Partial ready

```text
Neste steg
Du kan spørre Saksrom med kontrollerte kilder
```

### Review required

```text
Neste steg
Kontroller dokumenter
```

### Ready

```text
Neste steg
Spør Saksrom
```

## Chat input copy

### Locked

```text
Saksrom åpnes når dokumentgrunnlaget er klart nok
```

### Partial

```text
Spør Saksrom — svar bygger bare på kontrollerte kilder
```

### Ready

```text
Spør Saksrom om saken, kildene eller neste steg
```

### Failed or review required

```text
Spør Saksrom — svar kan bare bruke dokumentene som er kontrollert
```

## Summary display rules

### Do not display final summary when not ready

If `state` is `import_running`, `extracting_text`, `creating_sources`:

```text
Saksoppsummering kommer her
```

### Show preliminary summary only when enough controlled sources exist

If `state` is `partial_ready`:

```text
Foreløpig saksoppsummering
Bygger på [x] kontrollerte dokumenter. [y] dokumenter behandles fortsatt.
```

### Show full summary only when summarization is complete

If `state` is `ready`:

```text
Saksoppsummering
```

## Layout stability rules

- Do not mount/unmount large screen sections during progress updates.
- `CasePreparationProgress` should have stable height.
- Summary area should keep a stable container height with placeholder/skeleton.
- Do not move chat input while progress updates.
- Progress updates should not steal focus.
- Announce progress changes politely for screen readers, not every tick.

## Accessibility

Progress component:

```tsx
<div role="status" aria-live="polite" aria-label="Importstatus">
  ...
</div>
```

Progress bar:

```tsx
<div
  role="progressbar"
  aria-valuenow={percent}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label="Klargjøring av saksgrunnlag"
/>
```

Avoid announcing every small percentage update. Announce phase changes and major milestones.

## Acceptance criteria

- Saksrom screen does not switch between two large layouts while import runs.
- A compact progress component shows current phase, documents, pages, sources and ETA.
- Summary area uses stable placeholder until data is ready.
- Preliminary summary is clearly labeled as preliminary.
- Final summary appears only when summarization is complete.
- Chat input copy matches availability: locked, partial or ready.
- "Next best action" shows "Import pågår" during import.
- No layout jump when progress updates.
- Progress is accessible via `role="progressbar"` and `aria-live="polite"`.
