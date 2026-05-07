# Legal Work Modes Spec

Status: implemented locally in `codex-adaptive-saksrom-litigation-v3`, not yet merged to `main`.

## Required Modes

Saksrom legal work modes are temporary and intent-based. The user must never be trapped in a mode.

Implemented modes:

- Free chat
- Case understanding
- Chronology
- Evidence
- Crosslink
- Claims / anførsler
- Contradictions
- Counterarguments
- Legal sources / presedens
- Risk
- Deadlines
- Strategy
- Settlement
- Draft
- Quality
- Final control
- Redaction / masking
- Bates / references

## Command Parser

Required commands:

```text
'kronologi
'krysskobling
'bevis
'anforsler
'motargumenter
'presedens
'risiko
'frister
'strategi
'forlik
'utkast
'kvalitet
'endelig
'masker
'bates
```

Commands, buttons and natural language must resolve to the same work modes.

## Source Rule

Every formal legal work product must include:

- source basis
- uncertainty
- missing information
- next step

Rettskilder must be verified in an authoritative database before use.

