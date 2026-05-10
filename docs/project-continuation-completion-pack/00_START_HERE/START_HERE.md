# Start Here

Project: Evida / CasePilot
Status: pre-alpha technical scaffold / local evaluation build.

The active product is a desktop-first legal workspace for local document import, source-bound Saksrom dialogue, readiness/control views and legal workrooms. The active frontend/desktop app lives in `evida-core/desktop-tauri`.

Do not treat this repository as production-ready. Do not use real client data. The canonical root docs say the same: `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, and `DECISIONS/`.

Fast orientation:
- Start app: `Start Evida.bat`, or dev from `evida-core/desktop-tauri`.
- Build frontend: `npm.cmd run build`.
- Test desktop logic: `npm.cmd test`.
- Build desktop bundle: `npm.cmd run tauri:build`.
- Verify production boundary: `powershell -ExecutionPolicy Bypass -File ops\Verify-ProductionBoundary.ps1`.

Latest verification used for this pack:
- `ops\Verify-ProductionBoundary.ps1`: passed.
- `npm.cmd test` in `evida-core/desktop-tauri`: passed.
- `npm.cmd run build` in `evida-core/desktop-tauri`: passed.

Immediate rule for the next developer: preserve local-first, source-grounded behavior and do not blur the boundary between pre-alpha evaluation capability and production legal readiness.
