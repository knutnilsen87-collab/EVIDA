# 01 Hurtigstart for utviklere

## Mål

Få en ny utvikler fra null til kjørende lokal app, testet kodebase og oppdatert releasepakke.

## Start appen som bruker

Fra repo-roten:

```text
Start Evida.bat
```

Startfilen prøver først:

```text
Evida Release\Evida.exe
```

Hvis releasefilen ikke finnes, prøver den utviklerbygget:

```text
evida-core\desktop-tauri\src-tauri\target\release\evida-desktop.exe
```

## Kjør appen som utvikler

```powershell
cd evida-core\desktop-tauri
npm.cmd run dev
```

Dette starter Vite webmodus. Webmodus bruker browser/localStorage-fallback for deler av dataflyten. Full desktopfunksjonalitet krever Tauri.

## Bygg frontend

```powershell
cd evida-core\desktop-tauri
npm.cmd run build
```

Dette kjører TypeScript og Vite production build.

## Kjør testene

```powershell
cd evida-core\desktop-tauri
npm.cmd run test
```

Testpakken kjører kontraktstester for:

- readiness
- dokumentgrunnlag
- import-UX
- prosessering
- Saksrom-adferd
- legal commands
- handoff
- svarkvalitet
- smoke-path
- case-flow
- hardening

## Bygg desktop release

Fra repo-roten:

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\New-EvidaRelease.ps1
```

Dette bygger Tauri release og oppdaterer:

```text
Evida Release\Evida.exe
Evida Release\Evida installer.exe
Evida Release\Evida installer.msi
Evida Release\SHA256SUMS.txt
Evida Release\release-manifest.json
```

## Verifiser release

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\Test-EvidaRelease.ps1
powershell -ExecutionPolicy Bypass -File .\ops\Test-EvidaSmokePreflight.ps1
```

## Lokal data

Desktopdata ligger under brukerens lokale appdata:

```text
%LOCALAPPDATA%\Evida\
```

Typisk databasefil:

```text
%LOCALAPPDATA%\Evida\evida.local.sqlite3
```

Testdata kan resettes i appens eksport-/vedlikeholdsflate eller via Tauri-kommandoen `reset_test_data`.

## Før du endrer kode

1. Sjekk `git status --short`.
2. Ikke revert endringer du ikke har laget.
3. Les relevant kode i `evida-core\desktop-tauri\src`.
4. Kjør minst målrettede tester før full build.
5. Hvis `.exe` påvirkes, kjør release-scriptet og release-testene.
