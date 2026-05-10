# Demo QA Checklist

## Formål

Denne sjekklisten skal kjøres før Evida vises til noen eksternt.

Målet er ikke å fake demoen. Målet er å sikre at tillit, svar-kvalitet og kildehåndtering fungerer før fremvisning.

## Pre-demo setup

```text
[ ] Bruk kjent demo/evaluation case.
[ ] Ikke demo med helt uprøvd dokumentgrunnlag.
[ ] Sjekk dokumentimportstatus.
[ ] Sjekk at source coverage ikke feilaktig viser 100% hvis sider mangler.
[ ] Sjekk pending/OCR pages.
[ ] Sjekk ekstern AI-setting.
[ ] Sjekk demo-safe mode hvis relevant.
```

## Spørsmål som må testes

```text
Hvem hadde faktisk kontroll over selskapene
Hva bør jeg gjøre først
Hvorfor gjenstår det 87 sider
Hva bygger du dette på
Hvilke transaksjoner går igjen i flere dokumenter
Er denne saken sterk
```

## Forventet svaradferd

```text
[ ] Første setning svarer på faktisk spørsmål.
[ ] Svar høres ut som profesjonell samarbeidspartner.
[ ] Svar dumper ikke source titles.
[ ] Svar repeterer ikke stress-test labels.
[ ] Svar repeterer ikke Bates labels i main body.
[ ] Usikkerhet er tydelig når grunnlag er svakt.
[ ] Neste beste steg er inkludert.
[ ] Kilder er i source section.
[ ] Suggested followups er relevante.
```

## UI checks

```text
[ ] Saksrom tekst er behagelig å lese.
[ ] Lesekolonne er ikke for bred.
[ ] Input box er sticky.
[ ] Action buttons fungerer.
[ ] Case name/window title er korrekt.
[ ] Navigasjon fungerer.
[ ] Settings åpner.
[ ] Security status er synlig.
```

## Failure behavior

Simuler dårlig provider response hvis mulig.

Verifiser:

```text
[ ] Validation blokkerer dårlig svar.
[ ] Retry kjøres én gang.
[ ] Safe fallback vises hvis retry feiler.
[ ] Raw AI output vises aldri.
[ ] Validation failure logges i dev diagnostics.
```

## Ikke demo hvis

```text
[ ] Dårlig AI-svar kan vises direkte.
[ ] Metadata vises i main answer.
[ ] Dokumentdekning er misvisende.
[ ] Statusspørsmål routes som juridiske case-content-spørsmål.
[ ] Ekstern AI sender data uten eksplisitte settings.
[ ] Fallback eksponerer raw provider output.
```

## Final readiness

```text
[ ] Golden tests passed.
[ ] Manual QA passed.
[ ] Build passed.
[ ] App starts cleanly.
[ ] Known demo route works.
```
