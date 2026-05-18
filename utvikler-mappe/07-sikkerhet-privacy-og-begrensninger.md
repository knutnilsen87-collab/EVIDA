# 07 Sikkerhet, privacy og begrensninger

## Status

Evida er pre-alpha/evaluation build.

Ikke produksjonsklar.

Ikke godkjent for reelle klientdata uten særskilt avtale.

## Gjeldende prinsipper

- lokal behandling som standard
- ingen ekstern AI som standard
- ingen rå juridiske dokumenter til ekstern AI som standard
- ingen dokumenttekst i logger
- kildegrunnlag skal være sporbar til dokument og side
- svar skal vise kilder eller tydelig si at kilde mangler

## Lokal database

Database ligger typisk her:

```text
%LOCALAPPDATA%\Evida\evida.local.sqlite3
```

Sikkerhetsstatus i koden:

```text
src-tauri/src/db.rs
src-tauri/src/crypto.rs
src-tauri/src/db_key.rs
src/components/settings/SettingsView.tsx
```

Sensitive felt bruker AES-256-GCM-feltkryptering. Full SQLCipher/full-file databasekryptering er fortsatt markert som produksjonsgap i statusdokumentasjonen.

## Audit

Audit-/hash-kjede-relatert kode:

```text
src-tauri/src/audit.rs
src-tauri/src/hash.rs
src-tauri/src/db.rs
```

Relevante tabeller:

```text
audit_events
manual_review_actions
case_ai_messages
case_ai_message_sources
```

## AI-policy

Innstillinger og policyflater:

```text
src/components/settings/SettingsView.tsx
src/components/CaseRoomView.tsx
src/lib/answerQuality.ts
```

Viktig:

- ekstern AI skal være av som standard
- full dokumentutsending skal være av
- ekstern AI skal kreve eksplisitt bekreftelse
- svar må ikke skjule manglende kildegrunnlag

## Kjente begrensninger

- Dette er lokal evaluation-app, ikke enterprise auth/control-plane.
- Ingen login i evaluation-build.
- Tauri desktop gir riktig lokal filtilgang; Vite browsermodus er bare utviklerfallback.
- Release er usignert pre-alpha med mindre releaseprosessen senere endres.
- Full produksjonsgodkjenning krever flere manuelle og tekniske gates.

## Viktige dokumenter

```text
SECURITY.md
ARCHITECTURE.md
docs\SECURITY_FOUNDATION_STATUS.md
docs\SETTINGS_AND_SECURITY_SPEC.md
docs\RELEASE_HARDENING_STATUS.md
docs\PROD_READINESS_CHECKLIST.md
docs\DEPENDENCY_AND_SBOM_PLAN.md
docs\RELEASE_SIGNING_DECISION.md
DECISIONS\
```
