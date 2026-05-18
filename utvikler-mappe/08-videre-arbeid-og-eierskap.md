# 08 Videre arbeid og eierskap

## Anbefalt eierskap

Frontend/UI:

- `src/App.tsx`
- `src/styles.css`
- `src/components/`
- `src/features/`

Desktop/Rust:

- `src-tauri/src/commands.rs`
- `src-tauri/src/db.rs`
- `src-tauri/src/ingestion.rs`
- `src-tauri/src/ingestion_core.rs`
- `src-tauri/src/audit.rs`

Release/ops:

- `ops/`
- `Evida Release/`
- `docs/RELEASE_CHECKLIST.md`
- `docs/ACCEPTANCE_SMOKE_TEST.md`

Produkt og QA:

- `docs/PILOT_EVALUATION_PLAN.md`
- `docs/first-user/`
- `docs/evida-phase-4-8/`
- `utvikler-mappe/`

## Siste viktige produktbeslutninger

- Login er fjernet fra lokal evaluation-build.
- Normal oppstart går via introvideo.
- Klikk på intro åpner appen direkte.
- Vanlig oppstart skal ikke hoppe rett til dokumentopplasting på grunn av gammel localStorage-session.
- Importstatus skal vise tydelig progresjon, ETA/når ferdig, og neste handling.
- Dokumentkontroll skal være en tydelig arbeidsflyt, ikke bare en teknisk liste.

## Høyeste risiko før bredere pilot

- ren maskin-smoke på målmaskiner
- dokumentimport på store og rare filsett
- OCR-/unsupported-file edge cases
- kildebevissthet i Saksrom
- release-signering
- SBOM/SCA/SAST
- tydelig produksjonsgrense for auth, tenant og policy

## Når nye utviklere starter

1. Les `utvikler-mappe/README.md`.
2. Kjør `npm.cmd run test`.
3. Kjør `npm.cmd run build`.
4. Start releaseappen.
5. Følg `docs/ACCEPTANCE_SMOKE_TEST.md`.
6. Åpne `src/App.tsx` og `src/lib/api.ts` for å forstå appflyten.
7. Åpne `src-tauri/src/lib.rs`, `commands.rs` og `db.rs` for backendflaten.

## Hvordan legge til en ny feature

1. Finn riktig eierområde: UI, import, readiness, Saksrom, analyse, data eller release.
2. Legg logikken nær eksisterende mønster.
3. Oppdater UI bare der brukerflyten faktisk trenger det.
4. Legg til eller oppdater kontraktstest i `scripts/`.
5. Kjør `npm.cmd run test`.
6. Kjør `npm.cmd run build`.
7. Oppdater `.exe` hvis bruker skal teste i releaseappen.
8. Oppdater denne utviklermappen hvis feature endrer appflyt, arkitektur eller QA.
