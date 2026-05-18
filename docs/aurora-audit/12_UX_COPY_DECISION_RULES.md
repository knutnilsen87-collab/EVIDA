# UX Copy and Decision Rules

## Purpose

This file defines the language and decision rules for Document Control and Saksrom preparation.

The goal is to remove confusion and prevent users from thinking they are legally approving document content.

## Core wording principle

The user is not approving the truth or legal value of a document.

The user is deciding whether the document may be used as **source material** in Saksrom.

## Terms to avoid

Avoid:

```text
Godkjenn
Bulk godkjenn
Godkjenn dokument
Godkjenn som kilde
Dokumentet er juridisk godkjent
```

These can imply legal approval.

## Preferred terms

Use:

```text
Marker som kontrollert
Bruk som kildegrunnlag
Marker som kontrollert og bruk som kilde
Marker valgte som kontrollert
Hold utenfor kildegrunnlaget
Kjør OCR for valgte
Last opp ny kopi
```

## Global explanatory sentence

Use this sentence prominently on Document Control:

```text
Du godkjenner ikke innholdet som juridisk sant.
Du bestemmer bare om dokumentet kan inngå i sakens kildegrunnlag.
```

## Import/preparation states

### Import running

Title:

```text
Import pågår
```

Description:

```text
Evida leser dokumentene og lager sporbare kilder.
```

Progress line:

```text
11 av 125 dokumenter · 62 av 566 sider · 211 kildeutdrag · ca. 4 min igjen
```

Current phase examples:

```text
Nå: Leser filer
Nå: Teller sider
Nå: Henter tekst
Nå: Lager kildeutdrag
Nå: Bygger saksgrunnlag
```

### Partial ready

Title:

```text
Saksrom kan brukes med foreløpig kildegrunnlag
```

Description:

```text
Svar bygger bare på dokumentene som er kontrollert så langt.
```

### Review required

Title:

```text
Import fullført — kontroll kreves
```

Description:

```text
Noen dokumenter må kontrolleres før hele saken kan brukes som kildegrunnlag.
```

Primary action:

```text
Kontroller dokumenter
```

### Ready

Title:

```text
Saksgrunnlaget er klart
```

Description:

```text
Saksrom kan bruke de kontrollerte kildene i saken.
```

Primary action:

```text
Spør Saksrom
```

## Next best action rules

### Rule priority

```text
1. Import running
2. Import failed
3. Review required
4. OCR required
5. Partial ready
6. Ready
```

### Output copy

#### Import running

```text
Neste steg
Import pågår
```

#### Review required

```text
Neste steg
Kontroller dokumenter
```

#### OCR required

```text
Neste steg
Kjør OCR
```

#### Partial ready

```text
Neste steg
Spør Saksrom med kontrollerte kilder
```

#### Ready

```text
Neste steg
Spør Saksrom
```

## Document Control status copy

### `needs_ocr`

```text
OCR trengs

Siden mangler maskinlesbar tekst.
Kjør OCR hvis dokumentet skal brukes som kildegrunnlag.
```

### `missing_text`

```text
Mangler tekst

Evida fant ikke nok lesbar tekst til å sitere dokumentet trygt.
```

### `partial_source`

```text
Delvis behandlet

Noen sider kan brukes, men resten krever kontroll.
```

### `import_failed`

```text
Import feilet

Teksten kunne ikke hentes ut.
Last opp en ny kopi eller hold dokumentet utenfor kildegrunnlaget.
```

### `corrupt`

```text
Filen kan ikke leses

Dokumentet ser ut til å være korrupt eller utilgjengelig.
```

### `duplicate`

```text
Mulig duplikat

Dokumentet ligner på et dokument som allerede finnes i saken.
```

## Decision panel copy templates

### Needs OCR

```text
Hvorfor må dette kontrolleres?
Evida fant ikke maskinlesbar tekst i dokumentet. Saksrom kan derfor ikke sitere innholdet trygt ennå.

Hva bør du gjøre?
Kjør OCR hvis dokumentet skal brukes som kildegrunnlag. Hvis dokumentet ikke hører til saken, hold det utenfor.
```

Actions:

```text
Kjør OCR
Marker som kontrollert og bruk som kilde
Hold utenfor kildegrunnlaget
```

### Partial source

```text
Hvorfor må dette kontrolleres?
Dokumentet er delvis behandlet. Noen sider har kildeutdrag, men andre sider mangler tekst.

Hva bør du gjøre?
Se previewen. Hvis dokumentet kan inngå i saken med dagens kildegrunnlag, marker det som kontrollert. Hvis ikke, kjør OCR eller hold det utenfor.
```

Actions:

```text
Marker som kontrollert og bruk som kilde
Kjør OCR
Hold utenfor kildegrunnlaget
```

### Import failed/corrupt

```text
Hvorfor må dette kontrolleres?
Evida kunne ikke hente ut innholdet fra dokumentet.

Hva bør du gjøre?
Last opp en ny kopi hvis dokumentet skal være med i saken. Hvis dokumentet ikke skal brukes, hold det utenfor kildegrunnlaget.
```

Actions:

```text
Last opp ny kopi
Hold utenfor kildegrunnlaget
```

## Bulk confirmation copy

```text
Marker 7 dokumenter som kontrollert?

Dette betyr:
- Dokumentene kan brukes som kildegrunnlag i Saksrom.
- Innholdet blir ikke vurdert som juridisk sant.
- Handlingen blir logget i audit-loggen.

[ ] Jeg har kontrollert at dokumentene kan inngå i saken.

[Marker 7 som kontrollert] [Avbryt]
```

## Toast messages

### Single action saved

```text
✓ Lagret. Neste dokument åpnet.
```

### OCR started

```text
OCR startet for valgte dokumenter.
```

### Bulk controlled

```text
7 dokumenter ble markert som kontrollert.
```

### Excluded

```text
Dokumentet holdes utenfor kildegrunnlaget.
```

### Preview failed

```text
Preview kunne ikke åpnes.
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

## Empty states

### No document selected

```text
Velg et dokument for å forhåndsvise innholdet.
```

### No documents in current filter

```text
Ingen dokumenter i dette filteret.
```

### Control complete

```text
Dokumentkontroll fullført

Alle dokumenter er enten klare for Saksrom eller holdt utenfor kildegrunnlaget.

[Gå til Saksrom]
```

## Acceptance criteria

- No user-facing copy says "bulk godkjenn".
- No user-facing copy implies legal approval of truth.
- Every action explains its effect.
- Import/preparation copy always tells the user whether they should wait, control documents, run OCR or ask Saksrom.
- Chat placeholder always matches the actual source readiness state.
