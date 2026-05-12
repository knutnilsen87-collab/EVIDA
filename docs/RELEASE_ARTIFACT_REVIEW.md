# Release Artifact Review

Reviewed: 2026-05-11

## Checklist expectation

`docs/RELEASE_CHECKLIST.md` expects:

```text
Evida Release/Evida.exe
Evida Release/Evida installer.exe
Evida Release/Evida installer.msi
Evida Release/SHA256SUMS.txt
Evida Release/release-manifest.json
Evida Release/LES_MEG.txt
```

## Verification command

```powershell
powershell -ExecutionPolicy Bypass -File ops/Test-EvidaRelease.ps1
```

## Current status

The checklist now explicitly separates:

- local evaluation release verification
- clean-machine / clean-profile smoke
- Spring Boot control-plane verification
- known release gaps

Do not hand a build to a broader evaluator until `ops/Test-EvidaRelease.ps1` passes for the intended release folder and `docs/CLEAN_MACHINE_SMOKE_RESULT.md` has a filled result.

