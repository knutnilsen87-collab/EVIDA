# Evida / CasePilot — faktisk mappe: pilot-readiness rapport

Dato: 2026-05-11  
Kilde: `Evida_CasePilot_Developer_Investor_Pack_20260511-160747.zip`

## 1. Hva som ble verifisert i denne gjennomgangen

Jeg pakket ut den faktiske mappen og kjørte de testene som kan kjøres i dette miljøet.

| Kontroll | Resultat |
|---|---:|
| `npm ci --prefer-offline --no-audit` i `evida-core/desktop-tauri` | PASS |
| `npm test` i `evida-core/desktop-tauri` | PASS — 7 skript / 165 assertions totalt rapportert av skriptene |
| `npm run build` i `evida-core/desktop-tauri` | PASS |
| `python -m pytest -q` i `evida-core/ai-engine` | PASS — 9 tests |
| `python -m pytest -q` i `evida-core/backend-api` | PASS — 2 tests |
| `python -m ruff check evida-core/ai-engine evida-core/backend-api` | PASS |
| `npm audit --audit-level=moderate` | PASS — 0 rapporterte sårbarheter |
| Spring Boot `mvn test` | IKKE VERIFISERT HER — Maven mangler i miljøet |
| Rust `cargo test` / `cargo check` / Tauri build | IKKE VERIFISERT HER — Rust/Cargo mangler i miljøet |
| Clean-machine GUI smoke | IKKE VERIFISERT HER — må gjøres på Windows / ren Windows-profil |

## 2. Viktigste funn

### Funn A — Frontend og Python-testene er grønne

Dette er bra. Frontendens egen testpakke dekker blant annet readiness, processing, adaptive Saksrom, legal commands, handoff, answer quality og smoke path. Produksjonsbuilden lykkes også.

### Funn B — `Start Evida.bat` er nå riktig forbedret

Den faktiske mappen har en forbedret launcher som foretrekker `Evida Release\Evida.exe` før repoets `target\release`-exe. Dette fjerner en tidligere høy risiko for at feil/gammel build startes.

### Funn C — dokumentasjonen refererer til rot-`ops`-skript som ikke finnes i pakken

Flere filer refererer til:

```text
ops\New-EvidaRelease.ps1
ops\Test-EvidaRelease.ps1
ops\Verify-ProductionBoundary.ps1
ops\Test-EvidaHardening.ps1
ops\Test-EvidaSmokePreflight.ps1
```

Men rotmappen i zippen har ingen `ops/`-mappe. Dette er en praktisk release-blocker fordi dokumentert release-prosedyre ikke kan kjøres fra pakken uten å legge inn disse filene.

### Funn D — `api.ts` har en P0-risiko: browser-dev fallback kan maskere ekte desktopfeil

Mange funksjoner gjør:

```ts
try {
  return await callTauri(...)
} catch {
  // bruk localStorage browser-dev fallback
}
```

Dette er trygt i ren nettleser-dev, men farlig i Tauri desktop. Hvis en Rust/Tauri-kommando feiler i desktop — for eksempel databasefeil, importfeil, duplikatfil eller korrumpert lokal state — kan frontend falle tilbake til fake `localStorage`-data og late som ting fungerer.

For pilot må dette endres slik at browser-dev fallback bare brukes når Tauri runtime faktisk mangler. I desktop skal Tauri-feil vises som ekte feil, ikke maskeres.

Jeg laget en P0-patch som legger inn `assertDevFallbackAllowed()` og stopper fallback i desktop-runtime.

### Funn E — duplicate import bør håndteres pent før pilot

SQLite-skjemaet har `UNIQUE(case_id, sha256)` på dokumenter. Hvis samme dokument importeres to ganger i samme sak, kan dette trigge databasefeil. Med funn D uendret kan det bli maskert; med funn D fikset vil det vises som feil. Beste pilotfiks er å returnere en pen melding: “Dokumentet er allerede importert i denne saken.”

### Funn F — ekstern AI er godt avgrenset i faktisk kode

Faktisk `commands.rs` sjekker `security.external_ai_enabled` og `security.allow_source_excerpt_sending` før OpenAI-kall. Dette er en forbedring fra tidligere analyse. Likevel bør pilot kjøres med ekstern AI av, og det bør være tydelig i innstillinger.

### Funn G — clean-machine smoke mangler fortsatt

`docs/CLEAN_MACHINE_SMOKE_RESULT.md` sier at clean-machine smoke ikke er passert. Dette må gjøres før kunden får builden, ellers vet dere ikke om kunden faktisk kan starte og bruke appen uten dev-miljø.

## 3. P0 — må gjøres før kundepilot

1. Legg inn rot-`ops`-skriptene eller oppdater all dokumentasjon til korrekte script paths.
2. Fiks `api.ts` slik at desktopfeil ikke faller tilbake til browser-dev store.
3. Kjør `npm ci`, `npm test`, `npm run build` etter endringen.
4. Kjør Python AI-engine tests og ruff.
5. Kjør Spring Boot `mvn test` på maskin med Maven eller i CI før dere nevner control-plane som verifisert.
6. Kjør Rust `cargo test --manifest-path evida-core/desktop-tauri/src-tauri/Cargo.toml` på maskin med Rust.
7. Kjør `npm run tauri:build` på Windows-maskinen som skal lage release.
8. Kjør release-verifisering og SHA256-manifest.
9. Gjennomfør clean-machine / clean-profile GUI smoke.
10. Test duplicate import, tom fil, unsupported filtype, PDF uten tekstlag, sletting av sak og restart.

## 4. Anbefalt pilot-policy

For piloten om 2 dager:

```text
- Kun testdata.
- Ekstern AI av.
- Bruk kun godkjente testfiler i første demonstrasjon.
- Start alltid via Start Evida.bat eller Evida Release\Evida.exe.
- Ikke bruk Spring Boot som live avhengighet med mindre mvn test + kontrollplane flow er verifisert.
- Ikke bruk scannede PDF-er/bilder med mindre OCR er testet på akkurat pilotmaskinen.
```

## 5. Minimum manuell GUI-test som må kjøres på Windows

Kjør på ren Windows-profil eller maskin som ikke har bygget appen før:

1. Kopier bare `Evida Release/` og `Start Evida.bat`.
2. Start appen.
3. Bekreft intro/login.
4. Opprett ny sak.
5. Importer TXT med tydelig tekst.
6. Importer DOCX med tydelig tekst.
7. Importer PDF med tekstlag.
8. Spør: `Hva handler saken om?`
9. Åpne minst én kilde fra svaret.
10. Spør: `Hva mangler?`
11. Kjør ett workroom, for eksempel kronologi.
12. Åpne Kontrollgrunnlag.
13. Eksporter diagnostikk.
14. Importer samme fil igjen og bekreft pen/forståelig håndtering.
15. Importer unsupported filtype og bekreft pen/forståelig håndtering.
16. Slett saken.
17. Lukk appen.
18. Start appen igjen og bekreft at slettet sak ikke vises aktivt.

## 6. Hva P0-patchen inneholder

Patchen jeg laget inneholder:

1. `evida-core/desktop-tauri/src/lib/api.ts`
   - legger inn guard mot browser-dev fallback i desktop runtime.
   - gjør at Tauri-feil ikke blir falsk localStorage-suksess.

2. `ops/New-EvidaRelease.ps1`
   - bygger/kopierer release artifacts og lager manifest/checksum.

3. `ops/Test-EvidaRelease.ps1`
   - verifiserer releasefiler og SHA256.

4. `ops/Verify-ProductionBoundary.ps1`
   - sjekker at pre-alpha/testdata/prod-boundary er dokumentert.

5. `ops/Test-EvidaSmokePreflight.ps1`
   - sjekker release-/smoke-forutsetninger før manuell GUI-test.

6. `ops/Test-EvidaHardening.ps1`
   - sjekker CSP, capabilities, ekstern AI default og fallback-guard.

Patchen er testet mot frontend:

```text
npm ci --prefer-offline --no-audit  PASS
npm test                            PASS
npm run build                       PASS
```

## 7. Endelig go/no-go-regel

Pilot kan gjennomføres når disse er grønne:

```text
[ ] npm ci
[ ] npm test
[ ] npm run build
[ ] python ai-engine pytest
[ ] python backend-api pytest, hvis backend-api beholdes i pakken
[ ] ruff check
[ ] npm audit moderate
[ ] cargo test på Windows/devmaskin
[ ] npm run tauri:build på Windows/devmaskin
[ ] release manifest + checksums
[ ] clean-machine GUI smoke
[ ] duplicate import test
[ ] unsupported file test
[ ] no-text PDF / OCR-mangel test
[ ] restart etter sletting/import
```

Hvis én av disse feiler, ikke kall builden klar. Fiks, bygg ny release, og kjør smoke på nytt.
