# Readiness Verdict Spec

Readiness bestemmer hva Evida trygt kan vise og hvilke arbeidsrom som er tilgjengelige.

## Terskler

- `< 50%` kildeklar dekning: `not_ready`
- `50-79%`: `requires_control`
- `80-94%`: `ready_for_preliminary_analysis`
- `>= 95%`: `ready_for_draft_control`

## Produktregler

- 0% dekning skal aldri vise saksforståelse eller anbefale juridisk analyse.
- Under 80% skal Saksrom vise behandlingsstatus, ikke saksoppsummering.
- 80-94% kan vise foreløpig saksoppsummering med forbehold.
- 95%+ kan vise full saksoppsummering og åpne utkastkontroll, men AI-output må fortsatt godkjennes av bruker.

## Implementerte filer

- `evida-core/desktop-tauri/src/features/readiness/caseReadiness.ts`
- `evida-core/desktop-tauri/src/types/readiness.ts`
- `evida-core/desktop-tauri/src/lib/readiness.ts`

