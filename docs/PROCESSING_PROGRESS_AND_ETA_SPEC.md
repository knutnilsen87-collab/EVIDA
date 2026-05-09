# Processing Progress And ETA Spec

Status: implemented baseline for Evida desktop evaluation.

## Product Rule

Document processing is autopilot-first. The user uploads or drops documents, and Evida shows plain-language progress without requiring OCR, source-object, hash, MIME or indexing knowledge.

## Processing Stages

The processing pipeline is monotonic:

1. queued: Venter på behandling
2. reading_file: Leser fil
3. counting_pages: Teller sider
4. extracting_text: Henter tekst
5. finding_source_points: Finner kildepunkter
6. building_case_basis: Bygger saksgrunnlag
7. checking_coverage: Kontrollerer dekning
8. completed: Klar

The active chip must not rotate as animation. Past steps are done, current step is active, future steps are pending.

## Page Progress

Saksrom processing cards show:

- processed pages / total pages
- pages remaining
- pages that can be used as sources
- source coverage percent
- current step
- ETA or explicit unavailable/calculating copy

If page-level progress is unavailable, the UI says `Sideprogresjon beregnes`.

## ETA

ETA is bucketed to stable labels:

- Under 1 minutt igjen
- Omtrent 1–3 minutter igjen
- Omtrent 3–5 minutter igjen
- Omtrent 5–15 minutter igjen
- Over 15 minutter igjen
- Beregnes
- Ikke tilgjengelig i denne versjonen

## Acceptance Criteria

- Processing steps move forward only.
- Current step text matches the active chip.
- Progress percent matches the current stage when exact progress is unknown.
- Page remaining is `totalPages - processedPages`.
- Coverage is derived from `pagesWithSources / totalPages`.
- The UI does not fake page countdown when no processing basis exists.
