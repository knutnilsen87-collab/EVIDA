# Litigation Simulation Spec

Status: implemented locally in `codex-adaptive-saksrom-litigation-v3`, not yet merged to `main`.

## Product Placement

Rettssimulering is a separate workspace and sidebar item. It is not a default part of Saksrom chat.

Saksrom is for understanding, organizing and working with the case. Rettssimulering is for stress-testing the case under procedural, adversarial and judicial pressure.

Saksrom may route selected issues to Rettssimulering through a structured suggested action:

```text
Test i Rettssimulering
```

The workspace is not shown as a primary onboarding action.

## Purpose

Rettssakssimulering is a preparation and training tool inside Saksrom. It must never present itself as a replacement for an attorney's legal, procedural or ethical assessment.

## Required Commands

```text
'prosess
'hovedforhandling
'dommer
'motpart
'kryssforhor
'direkte
'prosedyre
'dom
'forlik
'rolle
```

## Supported Modes

- Simulated judge panel / dommerspørsmål
- Simulated opposing counsel
- Cross-examination plan
- Direct examination plan
- Procedure / closing argument test
- Simulated judgment
- Settlement simulation

## Workspace Cards

The Rettssimulering home shows:

- Dommerpanel
- Motpartens advokat
- Kryssforhør
- Direkte eksaminasjon
- Prosedyretest
- Forlikssimulering
- Simulert dom

Each card explains:

- what it does
- required source basis
- risk level
- recommended use

## Intensity Levels

- mild
- realistic
- aggressive
- judge_critical

Default: `realistic`.

## Mandatory Footer

Litigation simulation outputs must include:

- KILDESTATUS
- GJENSTÅR
- RISIKOVARSEL
- NESTE STEG
- warning that legal sources must be verified in Lovdata Pro, Rettsdata or another authoritative database

## Safety Rules

Evida must not:

- claim to predict court outcomes
- present simulated judgment as likely truth
- guarantee settlement ranges
- fabricate legal sources
- imply lawyer review is optional
- give procedural certainty when dates/deadlines are not verified

## Unlock Rules

- `Ikke klar`: locked
- `Krever kontroll`: preview-only / blocked result actions
- `Klar for foreløpig analyse`: ordinary simulations available
- `Klar for utkastkontroll`: full simulation available

`Simulert dom` requires `Klar for utkastkontroll` and must show an extra overtrust warning.
