# AI Answer Golden Tests

## Formål

Golden tests er regresjonstester for kritiske Saksrom-spørsmål.

De må passere før demo, pilot og produksjon.

## Spørsmål som skal testes

```text
Hvem hadde faktisk kontroll over selskapene
Hva bør jeg gjøre først
Hvorfor gjenstår det 87 sider
Hva bygger du dette på
Hvilke transaksjoner går igjen i flere dokumenter
Er denne saken sterk
Stemmer tidslinjen med forklaringene
Finnes det motstrid mellom forklaring og dokumentasjon
```

## Krav til hvert svar

```text
[ ] Svar starter med direkte respons.
[ ] Svar inneholder ikke blocked metadata patterns.
[ ] Svar inneholder usikkerhet når grunnlag er ufullstendig.
[ ] Svar inneholder neste steg.
[ ] Source IDs er gyldige.
[ ] Main answer og source section er separate.
[ ] Intent classification er korrekt.
```

## Blocked metadata patterns

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

## Foreslått fixture

```text
docs/fixtures/ai_answer_golden_tests.json
```

## Foreslåtte testfiler

Frontend:

```text
src/lib/answerQuality.test.ts
```

Backend:

```text
src-tauri/tests/ai_answer_quality_tests.rs
```

## Eksempeltest: faktisk kontroll

Question:

```text
Hvem hadde faktisk kontroll over selskapene
```

Expected intent:

```text
case_content
```

Must contain any:

```text
kontroll
beslutninger
økonomi
disponerte
usikker
```

Must not contain:

```text
ØKOKRIM - EVIDA STRESSTEST
Dokument-ID:
løpenummer
Bates OKO-
```

## Eksempeltest: anbefaling

Question:

```text
Hva bør jeg gjøre først
```

Expected intent:

```text
recommendation
```

Must contain any:

```text
jeg ville startet
først
dokumentgrunnlag
kronologi
```

## Eksempeltest: prosess/status

Question:

```text
Hvorfor gjenstår det 87 sider
```

Expected intent:

```text
process_status
```

Must contain any:

```text
gjenstår
behandlet
kildeutdrag
dokumentbehandling
```

## Release rule

```text
Hvis golden tests feiler, er builden ikke pilotklar.
```
