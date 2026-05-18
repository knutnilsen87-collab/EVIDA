# 06 Bygg, test, release og kvalitet

## Standard test

```powershell
cd evida-core\desktop-tauri
npm.cmd run test
```

Dette er minimum før endringer leveres.

## Frontend build

```powershell
cd evida-core\desktop-tauri
npm.cmd run build
```

Dette må være grønt før release.

## Desktop build

```powershell
cd evida-core\desktop-tauri
npm.cmd run tauri:build
```

Normal arbeidsflyt bruker likevel release-scriptet fra repo-roten:

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\New-EvidaRelease.ps1
```

## Releaseverifisering

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\Test-EvidaRelease.ps1
powershell -ExecutionPolicy Bypass -File .\ops\Test-EvidaSmokePreflight.ps1
```

Releaseoutput:

```text
Evida Release\Evida.exe
Evida Release\Evida installer.exe
Evida Release\Evida installer.msi
Evida Release\Evida_0.1.0_x64-setup.exe
Evida Release\Evida_0.1.0_x64_en-US.msi
Evida Release\SHA256SUMS.txt
Evida Release\release-manifest.json
```

## Hva testene dekker

```text
run-case-readiness-tests.mjs
```

Readinessregler for når saken kan brukes.

```text
run-document-basis-tests.mjs
```

Dokumentgruppering og kildegrunnlag.

```text
run-first-user-import-ux-tests.mjs
```

Førstebrukeropplevelse for import, ETA og neste handling.

```text
run-processing-tests.mjs
```

Prosesseringsstatus og terminale importtilstander.

```text
run-adaptive-saksrom-tests.mjs
```

Saksrom-adferd, forslag og arbeidsstil.

```text
run-legal-command-tests.mjs
```

Juridiske kommandoer.

```text
run-handoff-tests.mjs
```

Handoff-kontrakter for produktflyt.

```text
run-answer-quality-tests.mjs
```

Svarkvalitet og kildebevissthet.

```text
run-smoke-path-tests.mjs
run-case-flow-tests.mjs
run-phase-hardening-tests.mjs
```

Røyksti, oppstartsflyt, UI-kontrakter og hardeningkrav.

## Manuell smoke

Se:

```text
docs\ACCEPTANCE_SMOKE_TEST.md
docs\PILOT_EVALUATION_PLAN.md
```

Minimum:

1. Start `Evida.exe`.
2. Klikk introvideo.
3. Bekreft at appen åpnes uten login.
4. Importer flere testdokumenter.
5. Bekreft status, ETA og neste handling.
6. Åpne Saksrom.
7. Still spørsmål.
8. Åpne kilde/dokumentdrawer.
9. Åpne Dokumentkontroll.
10. Kjør releaseverifisering etter build.

## Når `.exe` må oppdateres

Oppdater `.exe` når endringen påvirker:

- React UI
- Tauri/Rust kommandoer
- assets i `public/`
- release scripts
- sikkerhets-/preflightkrav

Ikke si at en bruker kan teste endringen i releaseappen før `ops\New-EvidaRelease.ps1` er kjørt.
