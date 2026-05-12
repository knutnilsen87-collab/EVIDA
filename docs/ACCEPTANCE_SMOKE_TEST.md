# Evida Acceptance Smoke Test

Run before handing a build to a first evaluator.

Canonical e2e smoke path:

```text
import -> Saksrom -> source -> workroom
```

## Release Verification

- Run `powershell -ExecutionPolicy Bypass -File ops/New-EvidaRelease.ps1`.
- Run `powershell -ExecutionPolicy Bypass -File ops/Test-EvidaRelease.ps1`.
- Confirm `Evida Release/Evida.exe` timestamp is current.
- Confirm `SHA256SUMS.txt` and `release-manifest.json` exist.

## App Smoke Test

- Start via `Start Evida.bat`.
- Intro screen is only the vignette/video.
- Clicking intro opens login or start screen.
- Login screen uses Evida naming.
- Header says `PRE-ALPHA · testdata only` and `Sikker lokalmodus`.
- No broken Norwegian text is visible.

## Workflow Smoke Test

- Create a test case.
- Import a PDF, DOCX or TXT test document.
- Import several documents in one selection.
- Import a folder with approved test documents and confirm nested supported files are queued.
- Drag and drop several documents at once.
- Drag and drop a folder with approved test documents.
- Import queue shows:
  - Valgt
  - Sjekker fil
  - Beregner hash
  - Leser tekst
  - Lager kildegrunnlag
  - Klar or Krever oppmerksomhet
- Evida opens Saksrom after import.
- Saksrom shows summary and chat, not a technical dashboard.
- Ask one question.
- Answer shows sources or a missing-source notice.
- Answer shows uncertainty, missing basis, and next step.
- Source opens in drawer/modal.
- Use one suggested workroom action from Saksrom, for example chronology, evidence, contradictions or risk.
- Workroom opens with the same active case and no duplicate write window.
- Kontrollgrunnlag shows OCR, coverage, sources, audit and database/security status.
- Delete the test case and confirm it is removed from active cases.

## Automated Preflight

Run the non-GUI preflight before manual app smoke:

```powershell
powershell -ExecutionPolicy Bypass -File ops/Test-EvidaSmokePreflight.ps1
```

This does not replace the manual app smoke. It verifies that the release boundary, backend decision, smoke runbook and known limitations are present before a build is handed over.

## Security Smoke Test

- No real client data is used.
- OpenAI key is not required for local mode.
- If OpenAI is configured, answer sources must validate against local source IDs.
- Production Spring profile must fail without JWT issuer or JWK set URI.

## Known Non-Prod Limits

- Build is not code-signed.
- Full database-file encryption is not complete SQLCipher; sensitive fields are encrypted.
- Maven is not bundled locally in this repo; Spring tests run in CI or on machines with Maven.
- External AI should not be used with real client data without a signed data processing setup.
