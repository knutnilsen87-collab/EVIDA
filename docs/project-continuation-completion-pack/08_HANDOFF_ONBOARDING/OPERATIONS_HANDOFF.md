# Operations Handoff

## Current operating mode
Local Windows evaluation build only.

## Start path for user
`Start Evida.bat` tries `Evida Release\Evida.exe`, then developer release exe.

## Release scripts
```powershell
powershell -ExecutionPolicy Bypass -File ops\New-EvidaRelease.ps1
powershell -ExecutionPolicy Bypass -File ops\Test-EvidaRelease.ps1
```

## Expected artifacts
- `Evida Release/Evida.exe`
- `Evida Release/Evida installer.exe`
- `Evida Release/Evida installer.msi`
- `Evida Release/SHA256SUMS.txt`
- `Evida Release/release-manifest.json`

## Operating restrictions
- Test/evaluation data only.
- No real client data.
- Do not enable external AI/cloud document processing without approved policy.
- Logs and shared diagnostics must not contain legal document text.
