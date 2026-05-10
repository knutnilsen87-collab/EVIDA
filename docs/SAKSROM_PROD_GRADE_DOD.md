# Prod-Grade Definition of Done — Saksrom AI Answers

## Formål

Dette dokumentet definerer ikke-forhandlingsbare prod-grade krav til Saksrom AI-svar.

Gjelder fra dag 1:

```text
dev
demo
pilot
evaluation
production
```

Pilot kan ha begrenset funksjonalitet. Pilot kan ikke ha svakere tillit, kildekontroll eller svar-kvalitet.

## Core product rule

```text
Evida må aldri vise rå, uvalidert AI-output direkte til bruker.
```

Alle svar skal gjennom:

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

Dette er P0.

## Product-level DoD

```text
[ ] User questions are classified by intent before answering.
[ ] AI output uses strict structured JSON schema.
[ ] Raw AI text is never rendered directly.
[ ] Main answer is separated from sources/citations.
[ ] Main answer speaks like a professional collaborator.
[ ] Main answer directly answers the user’s actual question.
[ ] Source metadata is never dumped into main answer.
[ ] Document titles, file names, Bates labels and stress-test labels are kept out of main answer.
[ ] Evidence uncertainty is shown when source basis is weak.
[ ] Next best step is included when relevant.
[ ] Source IDs are validated against retrieved sources.
[ ] Invalid answers are blocked before display.
[ ] Invalid answers trigger one controlled retry.
[ ] Retry failure triggers safe professional fallback.
[ ] Validation failures are logged for diagnostics.
[ ] Demo-safe mode cannot bypass quality validation.
[ ] Golden regression questions pass before release.
[ ] Build fails or release is blocked if answer-quality tests fail.
```

## P0 release gate

Ingen build er pilotklar eller prodklar uten:

```text
npm.cmd run build
tauri build starts successfully
Saksrom golden answer tests pass
answer validation tests pass
source validation tests pass
fallback behavior works
```

Build skal blokkeres hvis:

```text
- raw AI output vises direkte
- answer contains repeated source/document metadata in main answer
- answer ignores user question
- source_ids are invalid
- known process/status questions are misrouted
- fallback exposes raw AI/provider text
```

## QuestionIntent

```ts
type QuestionIntent =
  | "case_content"
  | "recommendation"
  | "process_status"
  | "source_question"
  | "risk_assessment"
  | "timeline"
  | "contradiction"
  | "evidence"
  | "general";
```

Eksempler:

```text
Hvem hadde faktisk kontroll over selskapene = case_content
Hva bør jeg gjøre først = recommendation
Hvorfor gjenstår det 87 sider = process_status
Hva bygger du dette på = source_question
Stemmer tidslinjen med forklaringene = timeline
Hva er svakheten i saken = risk_assessment
Finnes det motstrid = contradiction
```

## Structured schema

```json
{
  "direct_answer": "string",
  "partner_assessment": "string",
  "reasoning_points": ["string"],
  "uncertainty": "string",
  "next_best_step": "string",
  "suggested_followups": ["string"],
  "source_ids": ["string"],
  "answer_quality": {
    "answered_user_question": true,
    "question_type": "case_content | recommendation | process_status | source_question | risk_assessment | timeline | contradiction | evidence | general",
    "confidence": "low | medium | high"
  }
}
```

## Validation

Validering må feile hvis:

```text
- direct_answer er tom
- direct_answer er for kort
- main answer inneholder source metadata
- main answer inneholder dokumentnavn
- main answer inneholder Bates-labels
- main answer inneholder stresstest-labels
- uncertainty mangler ved ufullstendig grunnlag
- source_ids inneholder ugyldige IDs
```

Blocked patterns:

```text
ØKOKRIM - EVIDA STRESSTEST
EVIDA STRESSTEST
CASEPILOT Mega Test
Bates OKO-
Dokument-ID:
Dokumenttype:
løpenummer
Regnskapsutdrag | Bates
.pdf
```

## Retry

Ved valideringsfeil, retry én gang:

```text
Your previous answer failed validation because it copied source metadata or did not directly answer the user.

Rewrite the answer as a professional collaborator answer.

Rules:
- Answer the actual user question first.
- Do not include document titles, file names, Bates labels, stress-test labels or source metadata in the main answer.
- Use source IDs only in source_ids.
- If the evidence is insufficient, say so clearly.
- Recommend the next best practical step.
- Return only valid JSON using the required schema.
```

## Safe fallback

Hvis retry feiler:

```text
Jeg klarte ikke å lage et godt nok saksbasert svar på dette spørsmålet akkurat nå. Kildegrunnlaget som ble hentet ser ut til å være for preget av dokumentmetadata eller mangler tydelig saksinnhold.

Jeg anbefaler å åpne Kontrollstatus, se hvilke kilder som faktisk er lesbare, og oppdatere kildegrunnlaget før vi prøver igjen.
```

## Demo-safe mode

```text
EVIDA_DEMO_SAFE_MODE=true
```

Demo-safe mode skal gjøre produktet strengere, ikke løsere:

```text
[ ] raw AI output vises aldri
[ ] validation er obligatorisk
[ ] retry er obligatorisk ved feil
[ ] fallback vises hvis retry feiler
[ ] godkjente cached demo-svar kan brukes bare hvis source context matcher
```

## Observability

Logg internt:

```json
{
  "question": "Hvem hadde faktisk kontroll over selskapene",
  "intent": "case_content",
  "selected_source_count": 8,
  "source_coverage_percent": 91,
  "pending_ocr_pages": 87,
  "provider_attempts": 2,
  "validation_status": "retry_passed",
  "validation_failure_reason": "MAIN_ANSWER_CONTAINS_SOURCE_METADATA",
  "displayed": "retry_answer"
}
```

Ikke logg full dokumenttekst eller sensitiv chat som default.

## Hard blockers

Ikke release hvis:

```text
[BLOCKER] AI answer can render without validation.
[BLOCKER] AI answer repeats document metadata in main answer.
[BLOCKER] AI answer invents certainty without sources.
[BLOCKER] process/status question is answered as case-content.
[BLOCKER] source IDs are invalid or hallucinated.
[BLOCKER] fallback exposes raw AI/provider text.
[BLOCKER] golden tests fail.
[BLOCKER] external AI sends full documents by default.
```

## Minimum pilot requirement

```text
[ ] strict answer schema
[ ] answer validation
[ ] retry
[ ] safe fallback
[ ] source separation
[ ] intent classification
[ ] golden tests
[ ] no raw AI output
```

## Final standard

Ikke:

```text
AI gir vanligvis et greit svar.
```

Men:

```text
Evida viser aldri et utrygt, irrelevant eller metadata-dumpet svar uten å fange det først.
```
