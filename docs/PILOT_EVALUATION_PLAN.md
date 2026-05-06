# Evida Pilot Evaluation Plan

Status: pre-alpha evaluation build. Use test data only.

## Goal

A first evaluator should be able to open Evida, import safe test documents, reach Saksrom, ask questions, inspect sources, and understand what is incomplete without verbal guidance.

## Pilot Entry Criteria

- `Start Evida.bat` opens the current Evida build.
- `Evida Release/Evida.exe` exists.
- `Evida Release/SHA256SUMS.txt` verifies all release artifacts.
- App shows `PRE-ALPHA · testdata only`.
- Intro vignette opens before login.
- Eval login works with the documented evaluation user.
- No main UI labels contain broken Norwegian characters.
- Test data reset is available from Export.

## Evaluation Script

1. Open `Start Evida.bat`.
2. Click the intro vignette.
3. Log in with the evaluation credentials shown in the app.
4. Create a new test case.
5. Import one or more safe test documents.
6. Confirm that the import queue shows file-level progress.
7. Confirm that the app moves to Saksrom after import.
8. Ask: `Hva handler saken om?`
9. Open at least one source from an answer.
10. Open Kontrollgrunnlag and review coverage, OCR, audit, and source basis.
11. Return to Saksrom and ask: `Hva mangler?`
12. Delete the test case and confirm it disappears from the active list.

## Pass Criteria

- The evaluator never needs to ask what the next step is.
- Document import gives visible progress and a clear ready/attention state.
- Saksrom behaves like a calm chat workspace.
- AI/local answers show sources or explicitly say source is missing.
- Uncertainty and missing basis are visible per answer.
- Technical details are in Kontrollgrunnlag, not on the start page or default Saksrom view.
- The evaluator can delete test cases.

## Stop Conditions

Stop the pilot and capture diagnostics if any of these occur:

- App cannot start from `Start Evida.bat`.
- Import cannot recover from a failed or unsupported file.
- Saksrom shows raw source feeds as the primary content.
- An answer presents factual claims without sources or missing-source warning.
- Real client data is requested or used.

## Metrics To Capture

- Time from launch to first created case.
- Time from import start to first Saksrom view.
- Import success/failure count.
- First-question asked: yes/no.
- Source opened from answer: yes/no.
- Kontrollgrunnlag opened: yes/no.
- Test case deletion completed: yes/no.
- User confusion notes.
