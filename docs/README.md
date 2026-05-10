# Evida / CasePilot Documentation Pack

Dette er en repo-klar dokumentasjonspakke for Evida / CasePilot.

Legg mappen `docs/` rett inn i repoet:

```text
CasePilot/
  docs/
  evida-core/
```

Aktiv app-kode:

```text
evida-core/desktop-tauri
```

## Innhold

| Fil | Formål |
|---|---|
| `CTO_HANDOFF_DESKTOP_WORKSPACE.md` | Multi-window, native desktop-menyer, settings og sikkerhet |
| `SAKSROM_READABILITY_SPEC.md` | Lesbarhet, layout, tekststørrelse og Saksrom-visning |
| `SAKSROM_AI_ANSWER_QUALITY_SPEC.md` | Hindrer dårlige AI-svar, metadata-dumping og irrelevante svar |
| `SAKSROM_COLLABORATION_VOICE_SPEC.md` | Hvordan Evida skal “snakke” som samarbeidspartner |
| `SAKSROM_PROD_GRADE_DOD.md` | Ikke-forhandlingsbar DoD for AI-svar fra dag 1 |
| `AI_ANSWER_GOLDEN_TESTS.md` | Golden tests/regresjonstester for kritiske spørsmål |
| `DEMO_QA_CHECKLIST.md` | Sjekkliste før demo |
| `PROD_READINESS_CHECKLIST.md` | Pilot-/produksjonsklarhet |
| `CODEX_IMPLEMENTATION_ORDER.md` | Rekkefølge for Codex/utvikler |
| `fixtures/ai_answer_golden_tests.json` | Maskinlesbar golden-test fixture |
| `fixtures/answer_schema.json` | Strukturert JSON-schema for Saksrom-svar |

## Grunnregel

```text
Pilot kan ha færre funksjoner.
Pilot kan ikke ha lavere tillitsnivå.
```

## P0-regel

```text
Evida må aldri vise rå, uvalidert AI-output direkte til bruker.
```

Alle Saksrom-svar skal gå gjennom:

```text
question intent classification
→ source retrieval
→ structured answer generation
→ answer validation
→ source validation
→ retry if needed
→ safe fallback if still invalid
→ controlled frontend rendering
```
