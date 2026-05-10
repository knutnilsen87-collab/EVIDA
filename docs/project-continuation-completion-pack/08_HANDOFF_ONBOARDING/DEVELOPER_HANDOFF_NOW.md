# Developer Handoff Now

You are joining Evida / CasePilot, a pre-alpha local legal workspace. Start by reading root `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `DECISIONS/`, then this continuation pack.

Active app path:
```text
evida-core/desktop-tauri
```

Core commands:
```powershell
cd evida-core\desktop-tauri
npm.cmd test
npm.cmd run build
npm.cmd run tauri:build
```

Boundary command:
```powershell
powershell -ExecutionPolicy Bypass -File ops\Verify-ProductionBoundary.ps1
```

Do not use real client data. Do not claim production readiness. Do not let deprecated FastAPI starter material override the Spring Boot ownership direction.

Current best next task: harden the evaluation MVP by adding an import -> Saksrom -> source -> workroom smoke test and cleaning backend ownership ambiguity.
