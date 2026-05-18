# Evida utviklermappe

Dette er startmappen for utviklere som skal forstå, bygge videre på eller kvalitetssikre Evida.

Status: lokal pre-alpha/evaluation build. Ikke bruk reelle klientdata uten eksplisitt avtale.

## Les i denne rekkefølgen

1. [Hurtigstart for utviklere](01-hurtigstart-for-utviklere.md)
2. [Produktflyt og brukerreise](02-produktflyt-og-brukerreise.md)
3. [Arkitektur og kodekart](03-arkitektur-og-kodekart.md)
4. [UI/UX og skjermkart](04-ui-ux-og-skjermkart.md)
5. [Data, API og importpipeline](05-data-api-og-importpipeline.md)
6. [Bygg, test, release og kvalitet](06-bygg-test-release-og-kvalitet.md)
7. [Sikkerhet, privacy og begrensninger](07-sikkerhet-privacy-og-begrensninger.md)
8. [Videre arbeid og eierskap](08-videre-arbeid-og-eierskap.md)
9. [Aurora romtilgjengelighet](09-aurora-room-availability.md)
10. [Skjermbilder og visuell referanse](skjermbilder/README.md)

## Hva appen er nå

Evida er en lokal desktop-app for juridisk dokumentarbeid:

- brukeren åpner introvideoen
- appen går direkte til Saksrom uten login
- dokumenter importeres lokalt
- Evida lager kildegrunnlag, importstatus og kontrollflater
- Saksrom svarer med kildebevisst språk og viser hva som mangler
- analyseflater låses gradvis opp basert på dokumentgrunnlag

## Viktigste mapper

```text
.
|-- Start Evida.bat
|-- Evida Release/
|-- assets/brand/
|-- docs/
|-- ops/
|-- utvikler-mappe/
`-- evida-core/desktop-tauri/
    |-- src/
    |-- src-tauri/src/
    |-- scripts/
    `-- package.json
```

## Viktigste kommandoer

```powershell
cd evida-core\desktop-tauri
npm.cmd run test
npm.cmd run build
```

Release fra repo-roten:

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\New-EvidaRelease.ps1
powershell -ExecutionPolicy Bypass -File .\ops\Test-EvidaRelease.ps1
powershell -ExecutionPolicy Bypass -File .\ops\Test-EvidaSmokePreflight.ps1
```

## Kilde til sannhet

Denne mappen er en kuratert oversikt. Dypere referanser ligger fortsatt i:

- [ARCHITECTURE.md](../ARCHITECTURE.md)
- [SECURITY.md](../SECURITY.md)
- [CURRENT_STATUS.md](../CURRENT_STATUS.md)
- [docs/ACCEPTANCE_SMOKE_TEST.md](../docs/ACCEPTANCE_SMOKE_TEST.md)
- [docs/PILOT_EVALUATION_PLAN.md](../docs/PILOT_EVALUATION_PLAN.md)
- [docs/RELEASE_CHECKLIST.md](../docs/RELEASE_CHECKLIST.md)
