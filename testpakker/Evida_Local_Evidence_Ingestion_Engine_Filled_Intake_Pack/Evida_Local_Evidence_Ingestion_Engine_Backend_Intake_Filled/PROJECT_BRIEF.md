# PROJECT_BRIEF

## Project name
**Evida Local Evidence Ingestion Engine**  
Arbeidstitler: **Local Evidence Ingestion Engine**, **Evidence Readiness Engine**, **Document Import Engine**, **Case Ingestion Core**.

## One-line summary
En lokal, innebygd og gjenbrukbar importmotor for Evida Desktop som tar inn store mengder saksdokumentasjon raskt, sikkert og grundig, og som alltid viser hva som er funnet, hva som er AI-klart, hva som gjenstår, og hva som krever manuell kontroll.

## Problem the project solves
Evida skal brukes på saker der nesten all dokumentasjon kan være utslagsgivende. En vanlig opplastingsfunksjon er derfor ikke nok. Produktet trenger en robust lokal motor som:

- tar inn enkeltfiler, mapper, undermapper og store batches
- fortsetter selv om enkeltfiler feiler
- gir hver fil, side og chunk eksplisitt status
- skiller mellom "foreløpig AI-brukbart", "fullt verifisert", "manuelt gjennomgått" og "ikke lesbart"
- hindrer falsk 100 %-status
- gjør det enkelt for brukeren å kontrollere problemfiler og problem-sider manuelt
- bevarer chain of custody, originalfil, hash, filsti, metadata, kildehenvisning og rapportering
- kjører lokalt i Evida Desktop av hensyn til sensitivitet, GDPR, taushetsbelagt materiale og offline-bruk

## Who the project is for
Primært for Evida-brukere som arbeider med juridiske, kommersielle eller dokumenttunge saker der dokumentasjonen kan påvirke utfallet.

Typiske brukere:
- advokater
- saksbehandlere
- etterforskere/interne granskere
- compliance-/revisjonsmedarbeidere
- bedriftseiere eller privatpersoner som samler dokumentasjon i en konflikt eller sak
- Evida support/operatører som må diagnostisere importproblemer uten tilgang til sensitivt innhold

## Why this project should exist
Hvis importmotoren bommer, kan hele Evida gi feil konklusjoner. Evida kan ikke være et høytillitsverktøy hvis dokumentgrunnlaget er ufullstendig, usynlig eller feilmerket.

Denne motoren er derfor ikke en støttefunksjon. Den er et grunnleggende tillitslag for hele produktet.

## What success looks like
Prosjektet er vellykket når:

1. Ingen oppdaget fil forsvinner uten eksplisitt status.
2. Alle filer får SHA-256-hash eller eksplisitt failure status.
3. Alle AI-brukbare tekstutdrag kan spores tilbake til fil, side og helst Bates/sidehenvisning.
4. Brukeren ser live:
   - hvor mange dokumenter og sider som er funnet
   - hvor mye som er behandlet
   - hvor mye AI kan bruke nå
   - hvor mye som gjenstår
   - estimert tid igjen
   - hvilke filer/sider som krever handling
5. Systemet anbefaler å vente med full saksanalyse til import og manuell kontroll er fullført.
6. Problemfiler og problem-sider havner i en enkel Review Queue.
7. Bruker kan åpne aktuell side direkte, se problemet, og huke av:
   - sett manuelt
   - relevant
   - ikke relevant
   - blank/uten betydning
   - prøv OCR på nytt
   - krever oppfølging
8. Importen kan pauses, gjenopptas, kanselleres og gjenopptas etter app-krasj eller restart.
9. Sluttrapport kan eksporteres som JSON/CSV/PDF senere, men JSON/CSV er nok i første MVP.
10. Evida AI vet forskjellen på maskinlest kilde, OCR-kilde, lav-confidence OCR og manuelt gjennomgått ikke-maskinlest materiale.

## Long-term vision
Motoren skal først leveres innebygd i Evida Desktop, men designes som en gjenbrukbar lokal evidence-ingestion core som senere kan brukes i andre produkter eller trekkes ut som egen service.

Langsiktig skal motoren støtte:
- store saker med titusenvis av filer
- 100 000+ sider
- robust OCR med fallback
- email/attachment families
- Bates-håndtering
- near-duplicate detection
- hybrid search/retrieval
- evidence readiness scoring
- chain-of-custody export
- production diagnostics bundle
- import benchmark mode
- sannhetsmanifest/golden tests

## Non-goals / what this project is NOT
Dette prosjektet er ikke:

- en enkel upload-widget
- en skybasert opplastingstjeneste
- en generell filbehandler
- en komplett juridisk analyseagent
- et dokumentredigeringsverktøy
- et system som garanterer at alle dokumenter kan tolkes perfekt
- et system som kan behandle passordbeskyttede/krypterte filer uten brukerhandling
- et system som skjuler usikkerhet eller problemfiler for å få importen til å se grønn ut

## Geographic/language scope
Første versjon skal optimaliseres for:
- norsk og engelsk
- lokale norske filnavn, æøå, Unicode, lange stier
- norsk juridisk/administrativ dokumentasjon
- dokumenttyper vanlige i saker: PDF, DOCX, TXT, MD, CSV, LOG, PNG, JPG/JPEG, TIFF/TIF, BMP, EML, MSG, XLSX, XLS, ODS, PPTX, ZIP
- offline/local-first desktop-bruk

## Business/commercial context
Evida sin verdi er avhengig av at brukeren stoler på at hele saken er representert. En robust importmotor er derfor en differensierende produktfordel og kan senere bli en egen plattformkomponent.

## Known constraints
- Evida er en desktop-app som kjøres lokalt.
- Dokumenter kan inneholde sensitiv, taushetsbelagt eller personidentifiserbar informasjon.
- Standardmodus skal være local-only.
- UI må ikke fryse under import.
- Import må tåle store datamengder på vanlige bruker-maskiner.
- Motoren må fungere med begrenset RAM, begrenset diskplass, dvale, app-restart og midlertidig utilgjengelige filer.
- Evida AI må ikke behandle uferdig/importert materiale som komplett sak.

## Links/references/assets
- Evida product context from current conversation.
- Uploaded Evida developer/investor pack: `Evida_CasePilot_Developer_Investor_Pack_20260511-160747.zip`
- Aegis project specifications and standards loaded in conversation.
- This filled intake pack is the implementation foundation for the ingestion engine.
