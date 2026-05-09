# Case Naming Spec

Evida skal ikke automatisk trekke sensitivt saksnavn fra dokumentinnhold.

## Regler

- Ved første dokumentopplasting uten valgt sak opprettes saken automatisk.
- Midlertidig navn er `Ny sak – YYYY-MM-DD`.
- Fysisk prosjektmappe bruker `caseId`, ikke saksnavn.
- Etter første saksoppsummering vises kortet "Navngi saken".
- Brukeren kan lagre eget navn eller gjøre det senere.
- "Foreslå navn" er en aktiv brukerhandling og brukes aldri automatisk.

## Mapperegel

Riktig:

```text
cases/case_<caseId>/
```

Feil:

```text
cases/Klientnavn_Sensitiv_Sak/
```

## Implementerte filer

- `evida-core/desktop-tauri/src-tauri/src/db.rs`
- `evida-core/desktop-tauri/src/components/CaseRoomView.tsx`

