# Readiness Verdict Spec

Status: implemented locally in `codex-adaptive-saksrom-litigation-v3`, not yet merged to `main`.

## Goal

Control data must result in a clear user-facing verdict, not only a checklist.

## Verdicts

```text
Ikke klar
Krever kontroll
Klar for foreløpig analyse
Klar for utkastkontroll
```

## Meaning

`Ikke klar`

The case has no usable document basis yet. The user should create/select a case and import documents.

`Krever kontroll`

Documents exist, but one or more blockers remain: no source excerpts, OCR/tekstkontroll pending, low coverage or unprocessed pages.

`Klar for foreløpig analyse`

Saksrom can answer, build chronology and build evidence lists with source citations, but draft/final use remains gated.

`Klar for utkastkontroll`

The case has high source coverage, no OCR blockers, no open import deviations and at least one analysis artifact. Draft work can start, but still requires manual legal review.

## Required UI Placement

- Saksrom
- Kontrollgrunnlag
- Sidebar
- Utkast
- Eksport

## Gating Rule

Draft generation is blocked unless the verdict is `Klar for utkastkontroll`.

