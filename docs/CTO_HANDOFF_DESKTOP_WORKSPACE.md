# CTO Handoff — Desktop Workspace, Multi-Window, Menus, Settings & Security

## Formål

Dette er en repo-tilpasset delta-handoff for eksisterende Evida / CasePilot.

Dette skal ikke bygges som ny app fra scratch. Det skal implementeres i eksisterende Tauri/React/Rust/SQLite-app.

Repo:

```text
https://github.com/knutnilsen87-collab/CasePilot
```

Aktiv app:

```text
evida-core/desktop-tauri
```

## Mål

Evida skal oppføre seg som et profesjonelt desktop-first juridisk arbeidsverktøy.

Appen skal støtte:

```text
1. Ny sak fra hvor som helst.
2. Bytt sak / tidligere saker.
3. Ny sak i nytt vindu.
4. Åpne eksisterende sak i nytt vindu.
5. Standard desktop-menyer.
6. Reelle hurtigtaster.
7. Innstillinger.
8. Status-first sikkerhetsflate.
9. Window-scoped case context.
10. Tydelig aktiv sak i hvert vindu.
```

## Ikke-forhandlingsbar arkitekturregel

```text
Hvert Evida-vindu skal være bundet til én aktiv sak eller én ny tom sak.
Alle operasjoner i vinduet skal kun gjelde den saken.
```

Det betyr:

```text
- Ingen global activeCaseId delt på tvers av vinduer.
- Hvert vindu har egen windowCaseContext.
- Alle read/write commands får caseId eksplisitt.
- Import, chat, AI-svar, kilder, readiness og eksport scopes til current window caseId.
- Window title og header viser alltid aktiv sak.
```

## Eksisterende filer som trolig berøres

Frontend:

```text
src/App.tsx
src/types.ts
src/lib/api.ts
src/components/Sidebar.tsx
src/styles.css
```

Backend:

```text
src-tauri/src/commands.rs
src-tauri/src/db.rs
src-tauri/src/domain.rs
src-tauri/src/lib.rs
src-tauri/tauri.conf.json
```

Nye frontend-filer:

```text
src/components/CaseHeader.tsx
src/components/CaseSwitcher.tsx
src/components/DesktopMenuBar.tsx
src/components/settings/SettingsView.tsx
src/components/settings/SecuritySettings.tsx
src/components/settings/StorageSettings.tsx
src/components/settings/CaseRoomSettings.tsx
src/components/settings/AccessibilitySettings.tsx
src/components/settings/ShortcutSettings.tsx
src/lib/windowCaseContext.ts
src/lib/shortcuts.ts
```

## WindowCaseContext

Legg til i `src/types.ts`:

```ts
export interface WindowCaseContext {
  windowId: string;
  caseId: string | null;
  displayName: string;
  caseNumber: string | null;
  workspaceView: ViewKey;
}
```

Utvid `CaseSummary`:

```ts
export interface CaseSummary {
  id: string;
  name: string;
  case_number: string | null;
  jurisdiction: string;
  status: CaseStatus;
  document_count: number;
  page_count: number;
  source_coverage_percent: number;
  risk_level: "low" | "medium" | "high" | "unknown";
  updated_at: string;
  last_opened_at: string | null;
}
```

Opprett:

```text
src/lib/windowCaseContext.ts
```

Ansvar:

```text
- identifisere Tauri window label
- lese initial caseId fra window URL/query/backend
- lagre aktiv sak kun for dette vinduet
- expose bindCase(caseSummary, view)
- expose clearCase()
- oppdatere window title ved case-endring
```

## CaseHeader

Opprett:

```text
src/components/CaseHeader.tsx
```

Må vise:

```text
- aktivt saksnavn
- saksnummer hvis finnes
- dokumentantall
- sideantall
- source coverage badge
- readiness badge
- Bytt sak
- Ny sak
- Innstillinger
```

Readiness-regler:

```text
Ingen dokumenter:
Badge: Ikke startet
Message: Start med dokumentene

Dokumenter, ingen kilder:
Badge: Krever kontroll
Message: Dokumenter importert, men mangler sporbare kildeutdrag

Coverage < 80:
Badge: Lav dekning
Message: Ikke klar for trygg analyse

Coverage 80–94:
Badge: Foreløpig
Message: Kan gi foreløpig Saksrom-oppsummering

Coverage >= 95 og ingen pending OCR:
Badge: Klar for utkastkontroll
Message: Dokumentgrunnlaget er klart for kontrollert arbeid
```

## Sidebar

Oppdater:

```text
src/components/Sidebar.tsx
```

Legg til over view-listen:

```text
+ Ny sak
Bytt sak
Ny sak i nytt vindu
```

## CaseSwitcher

Opprett:

```text
src/components/CaseSwitcher.tsx
```

Vis per sak:

```text
- name
- case_number
- document_count
- page_count
- source_coverage_percent
- risk_level
- updated_at
- last_opened_at
```

Actions:

```text
Åpne
Åpne i nytt vindu
Gi nytt navn
```

## Database additions

Oppdater `src-tauri/src/db.rs`.

Legg til kolonner:

```rust
add_column_if_missing(conn, "cases", "case_number", "TEXT");
add_column_if_missing(conn, "cases", "last_opened_at", "TEXT");
add_column_if_missing(conn, "cases", "workspace_path", "TEXT");
```

Legg til settings-tabell:

```sql
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

## Nye Rust commands

Legg til i `src-tauri/src/commands.rs`:

```rust
rename_case
set_case_number
mark_case_opened
get_setting
set_setting
list_settings
open_new_case_window
open_case_window
set_current_window_title
```

Registrer i:

```text
src-tauri/src/lib.rs
```

## Multi-window-regel

```text
Hvis case-window-<caseId> allerede finnes, fokuser eksisterende vindu.
Ikke åpne duplicate write window for samme sak i MVP.
```

## Menyer

Implementer native Tauri menu hvis praktisk, ellers in-app `DesktopMenuBar`.

Må ha:

```text
Fil
Rediger
Vis
Vindu
Hjelp
```

Fil:

```text
Ny sak
Ny sak i nytt vindu
Åpne tidligere sak
Importer dokumenter
Lagre
Eksporter
Lukk sak
Avslutt
```

## Hurtigtaster

```text
Ctrl+N          Ny sak
Ctrl+Shift+N    Ny sak i nytt vindu
Ctrl+O          Åpne tidligere sak
Ctrl+I          Importer dokumenter
Ctrl+F          Finn i saken
Ctrl+K          Sakspilot / Command palette
Ctrl+,          Innstillinger
Ctrl+W          Lukk vindu
Ctrl+Q          Avslutt
```

Regel:

```text
Hvis shortcut vises i UI, må den fungere.
```

## Settings

Seksjoner:

```text
Generelt
Saksrom
Dokumenter
Sikkerhet
Lagring
AI-provider
Tilgjengelighet
Tastatursnarveier
Om Evida
```

MVP-prioritet:

```text
1. Sikkerhet
2. Saksrom
3. Lagring
4. Tilgjengelighet
5. Tastatursnarveier
```

Sikkerhet må være status-first:

```text
Lokal behandling
Ekstern AI
Kryptert lagring
Full databasekryptering
Database path
Produksjonsbruk status
```

Defaults:

```text
external AI disabled
full document sending disabled
external AI confirmation required
export without control disabled
log redaction enabled
```

## DoD

```text
[ ] + Ny sak finnes i sidebar.
[ ] + Ny sak oppretter sak i current window.
[ ] Fil → Ny sak fungerer.
[ ] Ctrl+N fungerer.
[ ] Case switcher finnes.
[ ] Ctrl+O åpner case switcher.
[ ] Case kan åpnes i current window.
[ ] Case kan åpnes i nytt vindu.
[ ] Samme case fokuserer eksisterende vindu.
[ ] Hvert vindu har isolert case context.
[ ] Window title viser aktiv sak.
[ ] Header viser aktiv sak, readiness og coverage.
[ ] Menyer finnes og fungerer.
[ ] Settings finnes.
[ ] Sikkerhet er status-first.
[ ] Ekstern AI er av default.
[ ] Full document sending er av default.
[ ] Build passerer.
```
