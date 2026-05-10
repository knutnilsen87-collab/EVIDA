# Codex Implementation Order

## Formål

Dette dokumentet gir anbefalt rekkefølge for implementering.

Målet er å unngå risikable rewrites og prioritere tillit først.

## P0 — Trust and AI Answer Safety

Start her.

Dokumenter:

```text
SAKSROM_PROD_GRADE_DOD.md
SAKSROM_AI_ANSWER_QUALITY_SPEC.md
SAKSROM_COLLABORATION_VOICE_SPEC.md
AI_ANSWER_GOLDEN_TESTS.md
```

Tasks:

```text
1. Add QuestionIntent classification.
2. Add structured AI answer schema.
3. Add answer normalization for old/new message formats.
4. Add answer quality validation.
5. Add source ID validation.
6. Add retry-on-failure.
7. Add safe fallback.
8. Separate main answer from sources in frontend.
9. Add golden test fixtures.
10. Block build/release if golden tests fail.
```

Grunn:

```text
Evida kan mangle funksjoner i pilot.
Evida kan ikke vise dårlige AI-svar.
```

## P1 — Saksrom Partner Voice

Dokument:

```text
SAKSROM_COLLABORATION_VOICE_SPEC.md
```

Tasks:

```text
1. Update provider prompt.
2. Make answer format direct and collaborative.
3. Add suggested follow-ups.
4. Ensure process/status questions route correctly.
5. Ensure recommendation questions give practical next steps.
```

## P2 — Saksrom Readability

Dokument:

```text
SAKSROM_READABILITY_SPEC.md
```

Tasks:

```text
1. Add readable text column.
2. Increase body font size/line height.
3. Add clear section hierarchy.
4. Convert key points to bullets where safe.
5. Convert actors/tracks to chips.
6. Convert uncertainty to callout.
7. Add reading mode CSS support.
```

## P3 — Desktop Workspace

Dokument:

```text
CTO_HANDOFF_DESKTOP_WORKSPACE.md
```

Tasks:

```text
1. Add windowCaseContext.
2. Add CaseHeader.
3. Add + Ny sak and Bytt sak to sidebar.
4. Add CaseSwitcher.
5. Add case_number and last_opened_at.
6. Add menus and shortcuts.
7. Add multi-window commands.
8. Add Settings/Security.
```

## P4 — QA / Release Gates

Dokumenter:

```text
DEMO_QA_CHECKLIST.md
PROD_READINESS_CHECKLIST.md
```

Tasks:

```text
1. Add manual QA checklist to repo.
2. Add production readiness checklist.
3. Add diagnostics for answer validation.
4. Add demo-safe mode that does not bypass validation.
5. Add release-blocker list.
```

## Første Codex task

```text
Implement the P0 Saksrom AI Answer Safety requirements from docs/SAKSROM_PROD_GRADE_DOD.md and docs/SAKSROM_AI_ANSWER_QUALITY_SPEC.md. Do not redesign the app. Add question intent classification, structured answer schema, answer validation, retry, safe fallback, source separation, and golden tests. Ensure raw AI output is never rendered directly.
```

## Ikke gjør

```text
- Ikke rebuild appen fra scratch.
- Ikke redesign UI før svar-sikkerhet er fikset.
- Ikke bypass validation i demo mode.
- Ikke bruk source metadata som main answer content.
- Ikke bruk global activeCaseId på tvers av vinduer.
```
